package dev.vscodeandroid.pro.toolchain

import android.content.Context
import android.net.Uri
import androidx.documentfile.provider.DocumentFile
import java.io.File
import java.io.FileOutputStream

/** Imports a user-selected toolchain directory into private storage. No code is downloaded or trusted. */
class ToolchainInstaller(private val appFiles: File) {
    data class InstallSummary(val files: Int, val bytes: Long, val skipped: Int, val executables: List<String>)
    data class CompatibilityAudit(val name: String, val sha256: String, val kind: String, val compatible: Boolean, val detail: String)

    private val tools = File(appFiles, "toolchains").canonicalFile
    init { tools.mkdirs() }

    fun importDirectory(
        context: Context,
        treeUri: Uri,
        maxFiles: Int = 10_000,
        maxBytes: Long = 300L * 1024 * 1024
    ): InstallSummary {
        require(maxFiles in 1..20_000 && maxBytes in 1..(1024L * 1024 * 1024)) { "Invalid toolchain import limits" }
        val source = DocumentFile.fromTreeUri(context, treeUri) ?: error("Unable to access selected toolchain folder")
        require(source.isDirectory) { "Selected toolchain is not a folder" }
        val staging = File(appFiles, ".toolchains-import-${System.nanoTime()}").canonicalFile
        require(staging.toPath().startsWith(appFiles.canonicalFile.toPath()))
        staging.mkdirs()
        var count = 0
        var bytes = 0L
        var skipped = 0
        try {
            fun copyTree(directory: DocumentFile, relative: String, depth: Int) {
                require(depth <= 32) { "Toolchain folder nesting exceeds 32 levels" }
                directory.listFiles().forEach { child ->
                    val name = child.name ?: run { skipped++; return@forEach }
                    if (name == "." || name == ".." || name == ".git" || name.contains('/') || name.contains('\\') || name.any { it.code < 32 }) {
                        skipped++; return@forEach
                    }
                    val path = if (relative.isEmpty()) name else "$relative/$name"
                    val target = File(staging, path).canonicalFile
                    require(target.toPath().startsWith(staging.toPath())) { "Toolchain path escapes staging directory" }
                    if (child.isDirectory) {
                        target.mkdirs()
                        copyTree(child, path, depth + 1)
                    } else if (child.isFile) {
                        if (++count > maxFiles) error("Toolchain contains more than $maxFiles files")
                        target.parentFile?.mkdirs()
                        val copied = context.contentResolver.openInputStream(child.uri)?.use { input ->
                            FileOutputStream(target).use { output ->
                                val buffer = ByteArray(32 * 1024)
                                while (true) {
                                    val read = input.read(buffer)
                                    if (read < 0) break
                                    bytes += read
                                    if (bytes > maxBytes) error("Toolchain import exceeds ${maxBytes / (1024 * 1024)} MiB")
                                    output.write(buffer, 0, read)
                                }
                            }
                            true
                        } ?: false
                        if (!copied) skipped++
                        else if (shouldBeExecutable(target) && !target.setExecutable(true, true)) {
                            error("Unable to mark toolchain executable: $path")
                        }
                    } else skipped++
                }
            }
            copyTree(source, "", 0)
            staging.walkTopDown().filter { it.isFile }.forEach { staged ->
                val relative = staged.relativeTo(staging).invariantSeparatorsPath
                val destination = File(tools, relative).canonicalFile
                require(destination.toPath().startsWith(tools.toPath())) { "Toolchain destination escapes private directory" }
                destination.parentFile?.mkdirs()
                staged.copyTo(destination, overwrite = true)
                if (staged.canExecute() && !destination.setExecutable(true, true)) {
                    error("Unable to preserve executable permission: $relative")
                }
            }
            val executableNames = listOf("python", "node", "java", "pylsp", "typescript-language-server", "kotlin-language-server", "jdtls", "clangd", "gopls", "rust-analyzer", "phpactor", "solargraph", "debugpy-adapter", "js-debug-adapter")
            val installed = executableNames.filter { File(tools, it).let { f -> f.isFile && f.canExecute() } }
            return InstallSummary(count, bytes, skipped, installed)
        } finally {
            staging.deleteRecursively()
        }
    }

    fun installedExecutables(): List<String> = tools.walkTopDown().filter { it.isFile && it.canExecute() }
        .map { it.relativeTo(tools).invariantSeparatorsPath }.sorted().toList()

    /** Architecture and integrity inventory; this is not a publisher-signature or dependency verification. */
    fun auditInstalledToolchains(): List<CompatibilityAudit> = tools.walkTopDown()
        .filter { it.isFile && it.canExecute() }
        .map { file ->
            val finding = ToolchainAudit.inspect(file)
            CompatibilityAudit(finding.file.relativeTo(tools).invariantSeparatorsPath, finding.sha256,
                if (finding.elfMachine == null) "script-or-data" else "ELF-machine-${finding.elfMachine}",
                finding.abiMatch == true, finding.notes)
        }.toList()

    private fun shouldBeExecutable(file: File): Boolean {
        if (file.name in setOf(
                "python", "python3", "node", "java", "pylsp", "typescript-language-server",
                "kotlin-language-server", "jdtls", "clangd", "gopls", "rust-analyzer", "phpactor", "solargraph", "debugpy-adapter", "js-debug-adapter"
            ) || file.extension.equals("sh", ignoreCase = true)) return true
        return runCatching {
            file.inputStream().use { input ->
                val first = input.read()
                val second = input.read()
                val third = input.read()
                val fourth = input.read()
                (first == '#'.code && second == '!'.code) ||
                    (first == 0x7f && second == 'E'.code && third == 'L'.code && fourth == 'F'.code)
            }
        }.getOrDefault(false)
    }
}
