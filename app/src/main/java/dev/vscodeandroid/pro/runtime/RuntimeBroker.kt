package dev.vscodeandroid.pro.runtime

import dev.vscodeandroid.pro.toolchain.ToolchainAudit
import java.io.File
import java.io.InputStream
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/**
 * Executes explicitly provisioned toolchains with a narrow argv/environment contract.
 * This is defence-in-depth only; Android child processes still share the app UID.
 */
class RuntimeBroker(private val appFiles: File) {
    data class Result(val exitCode: Int?, val stdout: String, val stderr: String, val timedOut: Boolean)

    private val appRoot = appFiles.canonicalFile
    private val tools = File(appRoot, "toolchains").canonicalFile
    private val workspaces = File(appRoot, "workspaces").canonicalFile

    init { tools.mkdirs(); workspaces.mkdirs() }

    fun run(
        runtime: String,
        projectId: String,
        relativeScript: String,
        args: List<String> = emptyList(),
        timeoutSeconds: Long = 15,
        maxOutputBytes: Int = 256_000
    ): Result {
        require(runtime in setOf("python", "node", "java")) { "Unsupported runtime" }
        require(projectId.matches(Regex("[A-Za-z0-9_-]{1,64}"))) { "Invalid project id" }
        require(timeoutSeconds in 1..60) { "Timeout must be between 1 and 60 seconds" }
        require(relativeScript.isNotBlank() && relativeScript.length <= 4096 && !relativeScript.contains('\\') && '\u0000' !in relativeScript) { "Invalid script path" }
        require(args.size <= 64 && args.all { it.length <= 4096 && '\u0000' !in it }) { "Invalid runtime arguments" }
        require(maxOutputBytes in 1024..1_048_576) { "Output limit must be between 1 KiB and 1 MiB" }

        val project = File(workspaces, projectId).canonicalFile
        require(project.toPath().startsWith(workspaces.toPath()) && project.isDirectory) { "Workspace is outside the managed projects directory" }
        val script = File(project, relativeScript).canonicalFile
        require(script.toPath().startsWith(project.toPath()) && script.isFile && script.canRead()) {
            "Script is outside the workspace or missing"
        }
        val executable = File(tools, runtime).canonicalFile
        require(executable.toPath().startsWith(tools.toPath()) && executable.isFile && executable.canExecute()) {
            "$runtime runtime is not installed. Provision its executable in the private toolchains directory first."
        }
        ToolchainAudit.requireDeviceAbiCompatible(executable)

        val processHome = File(appRoot, "runtime-home/$projectId/runtime").canonicalFile.apply { mkdirs() }
        val temp = File(processHome, "tmp").canonicalFile.apply { mkdirs() }
        require(processHome.toPath().startsWith(appRoot.toPath()) && temp.toPath().startsWith(processHome.toPath())) {
            "Runtime temporary directory escapes app-private storage"
        }
        val command = when (runtime) {
            "java" -> listOf(executable.absolutePath, script.absolutePath) + args
            else -> listOf(executable.absolutePath, script.absolutePath) + args
        }
        val process = ProcessBuilder(command)
            .directory(project)
            .redirectErrorStream(false)
            .apply {
                environment().clear()
                environment()["HOME"] = processHome.absolutePath
                environment()["TMPDIR"] = temp.absolutePath
                environment()["TMP"] = temp.absolutePath
                environment()["PATH"] = "${tools.absolutePath}:/system/bin:/system/xbin"
                environment()["LANG"] = "C.UTF-8"
            }
            .start()

        val stdout = BoundedCapture(maxOutputBytes)
        val stderr = BoundedCapture(maxOutputBytes)
        val outThread = thread(name = "runtime-stdout", isDaemon = true) { stdout.consume(process.inputStream) }
        val errThread = thread(name = "runtime-stderr", isDaemon = true) { stderr.consume(process.errorStream) }
        val finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS)
        if (!finished) {
            // Best-effort termination. This does not constitute process-group or kernel sandboxing.
            process.destroy()
            if (!process.waitFor(250, TimeUnit.MILLISECONDS)) process.destroyForcibly()
        }
        outThread.join(1_000)
        errThread.join(1_000)
        if (outThread.isAlive) runCatching { process.inputStream.close() }
        if (errThread.isAlive) runCatching { process.errorStream.close() }
        return Result(
            if (finished) process.exitValue() else null,
            stdout.text(), stderr.text(), !finished
        )
    }

    private class BoundedCapture(private val limit: Int) {
        private val bytes = java.io.ByteArrayOutputStream(minOf(limit, 8192))
        @Volatile private var truncated = false

        fun consume(input: InputStream) {
            val buffer = ByteArray(8192)
            input.use { stream ->
                while (true) {
                    val read = stream.read(buffer)
                    if (read < 0) break
                    synchronized(bytes) {
                        val remaining = limit - bytes.size()
                        if (remaining > 0) bytes.write(buffer, 0, minOf(read, remaining))
                        if (read > remaining) truncated = true
                    }
                }
            }
        }

        fun text(): String = synchronized(bytes) {
            bytes.toString(Charsets.UTF_8.name()) + if (truncated) "\n[output truncated at ${limit} bytes]" else ""
        }
    }
}
