package dev.vscodeandroid.pro.lsp

import java.io.Closeable
import java.io.File
import org.json.JSONObject

/** Known LSP launch profiles. Executables and their dependencies must be provisioned by the user. */
object LspServerCatalog {
    data class Profile(val id: String, val executable: String, val args: List<String>, val extensions: Set<String>, val languageId: String)
    val profiles = listOf(
        Profile("python", "pylsp", emptyList(), setOf("py"), "python"),
        Profile("typescript", "typescript-language-server", listOf("--stdio"), setOf("js", "jsx", "mjs", "cjs", "ts", "tsx"), "typescript"),
        Profile("kotlin", "kotlin-language-server", emptyList(), setOf("kt", "kts"), "kotlin"),
        Profile("java", "jdtls", emptyList(), setOf("java"), "java"),
        Profile("clangd", "clangd", listOf("--background-index"), setOf("c", "h", "cc", "cpp", "cxx", "hpp"), "cpp"),
        Profile("go", "gopls", emptyList(), setOf("go"), "go"),
        Profile("rust", "rust-analyzer", emptyList(), setOf("rs"), "rust"),
        Profile("php", "phpactor", listOf("language-server"), setOf("php"), "php"),
        Profile("ruby", "solargraph", listOf("stdio"), setOf("rb"), "ruby")
    )
    fun forFile(fileName: String): Profile? = profiles.firstOrNull { fileName.substringAfterLast('.', "").lowercase() in it.extensions }
}

/** Manages one language-server process per language/workspace and routes diagnostics by document URI. */
class LspManager(private val appFiles: File) : Closeable {
    private val sessions = mutableMapOf<String, LspWorkspaceSession>()
    private val listeners = mutableMapOf<String, MutableMap<String, (String, JSONObject) -> Unit>>()
    private val workspaceEditListeners = mutableMapOf<String, MutableMap<String, (List<String>) -> Unit>>()

    @Synchronized fun open(
        fileName: String,
        workspace: File,
        text: String,
        onWorkspaceEditApplied: (List<String>) -> Unit = {},
        onNotification: (String, JSONObject) -> Unit = { _, _ -> }
    ): String {
        val profile = LspServerCatalog.forFile(fileName) ?: error("No LSP profile for this file type")
        val executable = File(File(appFiles, "toolchains"), profile.executable)
        require(executable.isFile && executable.canExecute()) { "${profile.executable} is not installed in app-private toolchains" }
        val canonicalWorkspace = workspace.canonicalFile
        require(canonicalWorkspace.isDirectory) { "Workspace does not exist" }
        val document = File(canonicalWorkspace, fileName).canonicalFile
        require(document.toPath().startsWith(canonicalWorkspace.toPath()) && document.isFile) { "Document escapes workspace or does not exist" }
        val uri = document.toURI().toString()
        val sessionKey = "${profile.id}:${canonicalWorkspace.absolutePath}"
        val session = sessions.getOrPut(sessionKey) {
            LspWorkspaceSession(executable, profile.args, canonicalWorkspace,
                onWorkspaceEditApplied = { paths ->
                    val callbacks = synchronized(this) { workspaceEditListeners[sessionKey]?.values?.toList().orEmpty() }
                    callbacks.forEach { callback -> runCatching { callback(paths) } }
                },
                onNotification = { method, params ->
                    val documentUri = params.optJSONObject("textDocument")?.optString("uri")
                        ?: params.optString("uri", "")
                    synchronized(this) { listeners[sessionKey]?.get(documentUri) }?.invoke(method, params)
                }
            ).also { it.start() }
        }
        listeners.getOrPut(sessionKey) { mutableMapOf() }[uri] = onNotification
        workspaceEditListeners.getOrPut(sessionKey) { mutableMapOf() }[uri] = onWorkspaceEditApplied
        val ext = fileName.substringAfterLast('.', "").lowercase()
        val languageId = when (ext) {
            "js", "jsx", "mjs", "cjs" -> "javascript"
            "c", "h" -> "c"
            else -> profile.languageId
        }
        session.open(uri, languageId, text)
        return sessionKey
    }

    @Synchronized fun change(sessionKey: String, uri: String, text: String) {
        sessions[sessionKey]?.change(uri, text)
    }

    @Synchronized fun complete(
        sessionKey: String,
        uri: String,
        line: Int,
        character: Int,
        callback: (JSONObject) -> Unit
    ) {
        require(line >= 0 && character >= 0)
        sessions[sessionKey]?.complete(uri, line, character, callback)
            ?: error("No active language-server session")
    }

    @Synchronized fun codeActions(sessionKey: String, uri: String, range: JSONObject, diagnostics: org.json.JSONArray, callback: (JSONObject) -> Unit) =
        (sessions[sessionKey] ?: error("No active language-server session")).codeActions(uri, range, diagnostics, callback)
    @Synchronized fun resolveCodeAction(sessionKey: String, action: JSONObject, callback: (JSONObject) -> Unit) =
        (sessions[sessionKey] ?: error("No active language-server session")).resolveCodeAction(action, callback)
    @Synchronized fun hover(sessionKey: String, uri: String, line: Int, character: Int, callback: (JSONObject) -> Unit) =
        (sessions[sessionKey] ?: error("No active language-server session")).hover(uri, line, character, callback)
    @Synchronized fun definition(sessionKey: String, uri: String, line: Int, character: Int, callback: (JSONObject) -> Unit) =
        (sessions[sessionKey] ?: error("No active language-server session")).definition(uri, line, character, callback)
    @Synchronized fun references(sessionKey: String, uri: String, line: Int, character: Int, callback: (JSONObject) -> Unit) =
        (sessions[sessionKey] ?: error("No active language-server session")).references(uri, line, character, true, callback)
    @Synchronized fun rename(sessionKey: String, uri: String, line: Int, character: Int, newName: String, callback: (JSONObject) -> Unit) =
        (sessions[sessionKey] ?: error("No active language-server session")).rename(uri, line, character, newName, callback)
    @Synchronized fun save(sessionKey: String, uri: String, text: String) =
        (sessions[sessionKey] ?: error("No active language-server session")).save(uri, text)
    @Synchronized fun documentVersion(sessionKey: String, uri: String): Int? = sessions[sessionKey]?.documentVersion(uri)

    @Synchronized fun codeActions(
        sessionKey: String, uri: String, startLine: Int, startCharacter: Int,
        endLine: Int, endCharacter: Int, diagnostics: org.json.JSONArray = org.json.JSONArray(),
        callback: (JSONObject) -> Unit
    ) {
        require(startLine >= 0 && startCharacter >= 0 && endLine >= startLine && endCharacter >= 0)
        sessions[sessionKey]?.codeActions(uri, startLine, startCharacter, endLine, endCharacter, diagnostics, callback)
            ?: error("No active language-server session")
    }

    @Synchronized fun formatting(sessionKey: String, uri: String, callback: (JSONObject) -> Unit) {
        sessions[sessionKey]?.formatting(uri, callback) ?: error("No active language-server session")
    }

    @Synchronized fun executeCommand(sessionKey: String, command: String, arguments: org.json.JSONArray = org.json.JSONArray(), callback: (JSONObject) -> Unit = {}) {
        require(command.isNotBlank() && command.length <= 512)
        sessions[sessionKey]?.executeCommand(command, arguments, callback) ?: error("No active language-server session")
    }

    @Synchronized fun closeDocument(sessionKey: String, uri: String) {
        sessions[sessionKey]?.closeDocument(uri)
        listeners[sessionKey]?.remove(uri)
        workspaceEditListeners[sessionKey]?.remove(uri)
        if (listeners[sessionKey].isNullOrEmpty()) {
            sessions.remove(sessionKey)?.close()
            listeners.remove(sessionKey)
            workspaceEditListeners.remove(sessionKey)
        }
    }

    @Synchronized override fun close() {
        sessions.values.forEach { runCatching { it.close() } }
        sessions.clear()
        listeners.clear()
        workspaceEditListeners.clear()
    }
}
