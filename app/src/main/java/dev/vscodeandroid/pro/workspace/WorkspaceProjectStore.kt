package dev.vscodeandroid.pro.workspace

import android.content.Context
import android.net.Uri
import androidx.documentfile.provider.DocumentFile
import java.io.File
import java.io.FileOutputStream

/** SAF import plus app-private workspace storage used consistently by editor, runtimes and Git. */
class WorkspaceProjectStore(private val appFiles: File) {
    data class ImportSummary(val files: Int, val bytes: Long, val skipped: Int)
    data class WorkspaceEntry(val relativePath: String, val directory: Boolean, val size: Long)

    private val workspaces = File(appFiles, "workspaces").canonicalFile

    init { workspaces.mkdirs() }

    fun defaultWorkspace(): File = projectWorkspace("default")

    fun projectWorkspace(projectId: String): File = projectRoot(projectId)

    fun listProjects(): List<String> = workspaces.listFiles()?.asSequence()
        ?.filter { it.isDirectory && it.name.matches(Regex("[A-Za-z0-9_-]{1,64}")) && !it.name.startsWith("." ) }
        ?.map { it.name }?.sorted()?.toList().orEmpty()

    fun createProject(projectId: String): File {
        require(projectId.matches(Regex("[A-Za-z0-9_-]{1,64}"))) { "Project name must use letters, numbers, _ or - (up to 64 characters)" }
        val target = File(workspaces, projectId).canonicalFile
        require(target.toPath().startsWith(workspaces.toPath()))
        require(!target.exists()) { "A project with that name already exists" }
        require(target.mkdirs()) { "Unable to create project" }
        return target
    }

    fun importTree(
        context: Context,
        treeUri: Uri,
        projectId: String = "default",
        maxFiles: Int = 5_000,
        maxBytes: Long = 100L * 1024 * 1024
    ): ImportSummary {
        require(projectId.matches(Regex("[A-Za-z0-9_-]{1,64}"))) { "Invalid project id" }
        require(maxFiles in 1..20_000 && maxBytes in 1..(500L * 1024 * 1024)) { "Invalid project import limits" }
        val root = File(workspaces, projectId).canonicalFile
        require(root.toPath().startsWith(workspaces.toPath()))
        root.mkdirs()
        val documentRoot = DocumentFile.fromTreeUri(context, treeUri) ?: error("Unable to access selected folder")
        require(documentRoot.isDirectory) { "Selected document is not a folder" }
        val staging = File(workspaces, ".import-${System.nanoTime()}").apply { mkdirs() }.canonicalFile
        require(staging.toPath().startsWith(workspaces.toPath()))
        var count = 0
        var bytes = 0L
        var skipped = 0

        fun copyDirectory(source: DocumentFile, relative: String, depth: Int) {
            require(depth <= 24) { "Project folder nesting exceeds 24 levels" }
            source.listFiles().forEach { child ->
                val name = child.name ?: run { skipped++; return@forEach }
                if (name == "." || name == ".." || name == ".git" || name == ".tmp" || name.startsWith(".import-") || name.contains('/') || name.contains('\\') || name.any { it.code < 32 }) {
                    skipped++; return@forEach
                }
                val path = if (relative.isEmpty()) name else "$relative/$name"
                val target = File(staging, path).canonicalFile
                require(target.toPath().startsWith(staging.toPath())) { "Imported path escapes workspace" }
                if (child.isDirectory) {
                    target.mkdirs()
                    copyDirectory(child, path, depth + 1)
                } else if (child.isFile) {
                    if (++count > maxFiles) error("Project contains more than $maxFiles files")
                    target.parentFile?.mkdirs()
                    context.contentResolver.openInputStream(child.uri)?.use { input ->
                        FileOutputStream(target).use { output ->
                            val buffer = ByteArray(16 * 1024)
                            while (true) {
                                val n = input.read(buffer)
                                if (n < 0) break
                                bytes += n
                                if (bytes > maxBytes) error("Project import exceeds ${maxBytes / (1024 * 1024)} MiB")
                                output.write(buffer, 0, n)
                            }
                        }
                    } ?: run { skipped++ }
                } else skipped++
            }
        }
        try {
            copyDirectory(documentRoot, "", 0)
            // Merge only after the entire source tree has been read successfully. Existing
            // project files not present in the imported tree are intentionally preserved.
            staging.walkTopDown().filter { it.isFile }.forEach { stagedFile ->
                val relative = stagedFile.relativeTo(staging).invariantSeparatorsPath
                val destination = File(root, relative).canonicalFile
                require(destination.toPath().startsWith(root.toPath())) { "Import destination escapes workspace" }
                destination.parentFile?.mkdirs()
                stagedFile.copyTo(destination, overwrite = true)
            }
            return ImportSummary(count, bytes, skipped)
        } finally {
            staging.deleteRecursively()
        }
    }

    fun listFiles(projectId: String = "default"): List<WorkspaceEntry> {
        val root = projectRoot(projectId)
        val result = mutableListOf<WorkspaceEntry>()
        fun visit(directory: File, prefix: String, depth: Int) {
            if (depth > 24 || result.size >= 10_000) return
            directory.listFiles()?.sortedBy { it.name.lowercase() }?.forEach { file ->
                if (file.name == ".git" || file.name == ".tmp" || file.name == ".projects" || file.name == "lsp-stderr.log" || file.name.endsWith(".log")) return@forEach
                val relative = if (prefix.isEmpty()) file.name else "$prefix/${file.name}"
                result += WorkspaceEntry(relative, file.isDirectory, if (file.isFile) file.length() else 0L)
                if (file.isDirectory) visit(file, relative, depth + 1)
            }
        }
        visit(root, "", 0)
        return result
    }

    fun resolve(projectId: String, relativePath: String): File {
        require(relativePath.isNotBlank() && relativePath.length <= 4096 && !relativePath.contains('\\') && '\u0000' !in relativePath &&
            relativePath.split('/').none { it == "." || it == ".." || it == ".git" || it == ".tmp" })
        val root = projectRoot(projectId)
        val target = File(root, relativePath).canonicalFile
        require(target.toPath().startsWith(root.toPath()) && target != root) { "Path escapes project workspace" }
        return target
    }

    fun read(projectId: String, relativePath: String, maxBytes: Long = 4L * 1024 * 1024): String {
        val file = resolve(projectId, relativePath)
        require(file.isFile && file.length() <= maxBytes) { "File is missing or exceeds the editor's 4 MiB limit" }
        return file.readText(Charsets.UTF_8)
    }

    fun write(projectId: String, relativePath: String, content: String) {
        val file = resolve(projectId, relativePath)
        require(content.toByteArray(Charsets.UTF_8).size <= 4 * 1024 * 1024) { "Editor document exceeds 4 MiB" }
        file.parentFile?.mkdirs()
        file.writeText(content, Charsets.UTF_8)
    }

    fun createFile(projectId: String, relativePath: String): File {
        val file = resolve(projectId, relativePath)
        require(!file.exists()) { "A file or folder with that name already exists" }
        file.parentFile?.mkdirs()
        require(file.createNewFile()) { "Unable to create file" }
        return file
    }

    private fun projectRoot(projectId: String): File {
        require(projectId.matches(Regex("[A-Za-z0-9_-]{1,64}"))) { "Invalid project id" }
        val root = File(workspaces, projectId).canonicalFile
        require(root.toPath().startsWith(workspaces.toPath())) { "Project path escapes workspace root" }
        root.mkdirs()
        return root
    }
}
