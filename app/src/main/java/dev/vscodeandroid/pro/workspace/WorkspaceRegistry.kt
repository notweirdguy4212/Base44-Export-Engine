package dev.vscodeandroid.pro.workspace

import java.io.File
import java.util.Locale

/** Persistent, filesystem-backed registry for independently managed local projects. */
class WorkspaceRegistry(appFiles: File) {
    data class Project(val id: String, val displayName: String, val root: File)
    private val root = File(appFiles.canonicalFile, "workspaces").canonicalFile
    private val metadata = File(root, ".projects").apply { mkdirs() }

    init { root.mkdirs(); ensureProject("default", "Default project") }

    @Synchronized fun list(): List<Project> = root.listFiles()?.asSequence()
        ?.filter { it.isDirectory && it.name.matches(Regex("[A-Za-z0-9_-]{1,64}")) }
        ?.map { dir -> Project(dir.name, readName(dir.name), dir.canonicalFile) }
        ?.sortedBy { it.displayName.lowercase(Locale.ROOT) }?.toList().orEmpty()

    @Synchronized fun create(displayName: String): Project {
        val name = displayName.trim()
        require(name.length in 1..80 && name.none { it.code < 32 || it in "/\\" }) { "Project name must be 1–80 characters and cannot contain path separators" }
        val base = name.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9_-]+"), "-").trim('-').take(48).ifBlank { "project" }
        var id = base
        var suffix = 2
        while (File(root, id).exists()) id = "${base}-${suffix++}"
        val dir = File(root, id).canonicalFile
        require(dir.toPath().startsWith(root.toPath()) && dir.mkdir()) { "Unable to create project" }
        writeName(id, name)
        return Project(id, name, dir)
    }

    @Synchronized fun rename(id: String, displayName: String): Project {
        val name = displayName.trim()
        require(name.length in 1..80 && name.none { it.code < 32 || it in "/\\" })
        val dir = projectRoot(id)
        writeName(id, name)
        return Project(id, name, dir)
    }

    @Synchronized fun delete(id: String) {
        require(id != "default") { "The default project cannot be deleted" }
        val dir = projectRoot(id)
        require(dir.canonicalFile.parentFile == root) { "Invalid project root" }
        require(dir.deleteRecursively()) { "Unable to delete project files" }
        File(metadata, "$id.name").delete()
    }

    fun root(id: String): File = projectRoot(id)

    @Synchronized private fun ensureProject(id: String, name: String) {
        val dir = projectRoot(id)
        dir.mkdirs()
        if (!File(metadata, "$id.name").exists()) writeName(id, name)
    }

    private fun projectRoot(id: String): File {
        require(id.matches(Regex("[A-Za-z0-9_-]{1,64}"))) { "Invalid project id" }
        val dir = File(root, id).canonicalFile
        require(dir.toPath().startsWith(root.toPath()) && dir.parentFile == root) { "Project path escapes registry" }
        return dir
    }

    private fun readName(id: String): String = runCatching { File(metadata, "$id.name").readText().trim() }
        .getOrNull()?.takeIf { it.isNotBlank() } ?: id

    private fun writeName(id: String, name: String) {
        val target = File(metadata, "$id.name")
        val temporary = File(metadata, "$id.name.tmp")
        temporary.writeText(name)
        if (!temporary.renameTo(target)) {
            temporary.copyTo(target, overwrite = true)
            temporary.delete()
        }
    }
}
