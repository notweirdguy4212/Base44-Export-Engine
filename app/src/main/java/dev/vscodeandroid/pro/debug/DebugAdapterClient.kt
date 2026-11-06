package dev.vscodeandroid.pro.debug

import dev.vscodeandroid.pro.toolchain.ToolchainAudit
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.File
import java.nio.charset.StandardCharsets
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/** Debug Adapter Protocol stdio transport. It speaks DAP; the selected adapter supplies debugger semantics. */
class DebugAdapterClient(
    private val executable: File,
    private val args: List<String>,
    private val workspace: File,
    private val onEvent: (String, JSONObject) -> Unit = { _, _ -> }
) : Closeable {
    private val sequence = AtomicInteger(1)
    private val pending = ConcurrentHashMap<Int, (JSONObject) -> Unit>()
    @Volatile private var process: Process? = null
    @Volatile private var input: BufferedInputStream? = null
    @Volatile private var output: BufferedOutputStream? = null

    fun start() {
        val tools = File(workspace.parentFile?.parentFile, "toolchains").canonicalFile
        val workspaces = File(workspace.parentFile?.parentFile, "workspaces").canonicalFile
        require(executable.canonicalFile.toPath().startsWith(tools.toPath()) && executable.isFile && executable.canExecute()) {
            "Debug adapter must be an executable in the private toolchains directory"
        }
        ToolchainAudit.requireDeviceAbiCompatible(executable)
        require(workspace.canonicalFile.toPath().startsWith(workspaces.toPath()) && workspace.isDirectory) {
            "Debug workspace is outside the managed project area"
        }
        require(args.size <= 32 && args.all { it.length <= 1024 && '\u0000' !in it }) { "Invalid adapter arguments" }
        check(process?.isAlive != true) { "A debug adapter is already running" }
        val appRoot = workspaces.parentFile.canonicalFile
        val safeAdapterName = executable.name.replace(Regex("[^A-Za-z0-9._-]"), "_")
        val processHome = File(appRoot, "runtime-home/${workspace.name}/dap-$safeAdapterName").canonicalFile.apply { mkdirs() }
        val temp = File(processHome, "tmp").canonicalFile.apply { mkdirs() }
        require(processHome.toPath().startsWith(appRoot.toPath()) && temp.toPath().startsWith(processHome.toPath()))
        val logRoot = File(appRoot, "logs").apply { mkdirs() }
        val log = File(logRoot, "dap-${workspace.name}-$safeAdapterName.log")
        val started = ProcessBuilder(listOf(executable.canonicalPath) + args)
            .directory(workspace)
            .apply {
                environment().clear()
                environment()["HOME"] = processHome.absolutePath
                environment()["TMPDIR"] = temp.absolutePath
                environment()["PATH"] = "${tools.absolutePath}:/system/bin:/system/xbin"
            }.start()
        process = started
        Thread({ drainStderr(started.errorStream, log) }, "dap-stderr-${executable.name}").apply { isDaemon = true; start() }
        input = BufferedInputStream(started.inputStream)
        output = BufferedOutputStream(started.outputStream)
        Thread({ readLoop() }, "dap-reader-${executable.name}").apply { isDaemon = true }.start()
    }

    fun request(command: String, arguments: JSONObject = JSONObject(), callback: (JSONObject) -> Unit = {}): Int {
        check(process?.isAlive == true) { "Debug adapter is not running" }
        require(command.matches(Regex("[A-Za-z][A-Za-z0-9_]{0,63}")))
        val seq = sequence.getAndIncrement()
        pending[seq] = callback
        val packet = JSONObject().put("seq", seq).put("type", "request")
            .put("command", command).put("arguments", arguments)
        try { send(packet) } catch (failure: Throwable) { pending.remove(seq); throw failure }
        return seq
    }

    fun initialize(adapterId: String = "generic", callback: (JSONObject) -> Unit = {}) = request("initialize", JSONObject()
        .put("clientID", "vscode-android-pro").put("clientName", "VS Code Android Pro")
        .put("adapterID", adapterId).put("pathFormat", "path")
        .put("linesStartAt1", true).put("columnsStartAt1", true)
        .put("supportsVariableType", true).put("supportsVariablePaging", true)
        .put("supportsRunInTerminalRequest", false).put("supportsProgressReporting", false), callback)

    fun launch(program: File, args: List<String> = emptyList(), stopOnEntry: Boolean = true,
               adapterArguments: JSONObject = JSONObject(), callback: (JSONObject) -> Unit = {}) {
        val root = workspace.canonicalFile
        val target = program.canonicalFile
        require(target.toPath().startsWith(root.toPath()) && target.isFile) { "Debug target must be a file inside the project" }
        require(args.size <= 256 && args.all { it.length <= 4096 && '\u0000' !in it })
        val launchArguments = JSONObject().put("program", target.absolutePath)
            .put("cwd", root.absolutePath).put("args", JSONArray(args)).put("stopOnEntry", stopOnEntry)
            .put("console", "internalConsole")
        adapterArguments.keys().forEach { key -> launchArguments.put(key, adapterArguments.get(key)) }
        request("launch", launchArguments, callback)
    }

    fun setBreakpoints(source: File, lines: List<Int>, callback: (JSONObject) -> Unit = {}) {
        val target = source.canonicalFile
        require(target.toPath().startsWith(workspace.canonicalFile.toPath()) && target.isFile)
        val points = JSONArray().apply { lines.distinct().sorted().filter { it > 0 }.take(500).forEach { put(JSONObject().put("line", it)) } }
        request("setBreakpoints", JSONObject().put("source", JSONObject().put("name", target.name).put("path", target.absolutePath))
            .put("breakpoints", points).put("sourceModified", false), callback)
    }

    fun control(command: String, threadId: Int? = null, callback: (JSONObject) -> Unit = {}) {
        require(command in setOf("configurationDone", "continue", "next", "stepIn", "stepOut", "pause", "threads", "stackTrace", "scopes", "variables", "disconnect"))
        val args = JSONObject()
        if (threadId != null) when (command) {
            "scopes" -> args.put("frameId", threadId)
            "variables" -> args.put("variablesReference", threadId)
            "continue", "next", "stepIn", "stepOut", "pause", "stackTrace" -> args.put("threadId", threadId)
        }
        request(command, args, callback)
    }

    fun evaluate(expression: String, frameId: Int? = null, callback: (JSONObject) -> Unit = {}) {
        require(expression.isNotBlank() && expression.length <= 4096)
        val args = JSONObject().put("expression", expression).put("context", "repl")
        if (frameId != null) args.put("frameId", frameId)
        request("evaluate", args, callback)
    }

    private fun send(packet: JSONObject) {
        val bytes = packet.toString().toByteArray(StandardCharsets.UTF_8)
        synchronized(this) {
            val stream = output ?: error("Debug adapter output is closed")
            stream.write("Content-Length: ${bytes.size}\r\n\r\n".toByteArray(StandardCharsets.US_ASCII))
            stream.write(bytes); stream.flush()
        }
    }

    private fun drainStderr(stream: java.io.InputStream, destination: File) {
        val captured = ByteArrayOutputStream()
        stream.use { input ->
            val buffer = ByteArray(8192)
            while (true) {
                val count = runCatching { input.read(buffer) }.getOrDefault(-1)
                if (count < 0) break
                val remaining = 1_048_576 - captured.size()
                if (remaining > 0) captured.write(buffer, 0, minOf(count, remaining))
            }
        }
        runCatching { destination.writeBytes(captured.toByteArray()) }
    }

    private fun readLoop() {
        try {
            while (process?.isAlive == true) {
                val stream = input ?: break
                var length = -1
                while (true) {
                    val line = readLine(stream) ?: return
                    if (line.isEmpty()) break
                    if (line.startsWith("Content-Length:", true)) length = line.substringAfter(':').trim().toInt()
                }
                require(length in 0..8_388_608) { "Invalid DAP packet length" }
                val bytes = ByteArray(length); var offset = 0
                while (offset < length) {
                    val n = stream.read(bytes, offset, length - offset)
                    if (n < 0) return
                    offset += n
                }
                val packet = JSONObject(String(bytes, StandardCharsets.UTF_8))
                when (packet.optString("type")) {
                    "response" -> pending.remove(packet.optInt("request_seq"))?.let { callback -> runCatching { callback(packet) } }
                    "event" -> runCatching { onEvent(packet.optString("event"), packet.optJSONObject("body") ?: JSONObject()) }
                }
            }
        } catch (_: Exception) {
            // Adapter stderr is retained in the project for diagnostics.
        } finally { pending.clear() }
    }

    private fun readLine(stream: BufferedInputStream): String? {
        val out = StringBuilder()
        while (true) {
            val b = stream.read()
            if (b < 0) return if (out.isEmpty()) null else out.toString()
            if (b == 10) return out.toString().removeSuffix("\r")
            require(out.length < 16_384) { "DAP header too large" }
            out.append(b.toChar())
        }
    }

    override fun close() {
        if (process?.isAlive == true) {
            runCatching { request("disconnect", JSONObject().put("restart", false)) }
            process?.destroy()
            if (process?.waitFor(750, java.util.concurrent.TimeUnit.MILLISECONDS) == false) process?.destroyForcibly()
        }
        pending.clear(); input = null; output = null; process = null
    }
}
