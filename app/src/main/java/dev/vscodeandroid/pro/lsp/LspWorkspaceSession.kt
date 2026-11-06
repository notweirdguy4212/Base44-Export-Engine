package dev.vscodeandroid.pro.lsp

import org.json.JSONObject
import java.io.Closeable
import java.io.File
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.ConcurrentHashMap

/** Owns one server process and synchronizes open editor documents with it. */
class LspWorkspaceSession(
    executable: File,
    args: List<String>,
    workspace: File,
    onWorkspaceEditApplied: (List<String>) -> Unit = {},
    onNotification: (String, JSONObject) -> Unit = { _, _ -> }
) : Closeable {
    private val versions = ConcurrentHashMap<String, AtomicInteger>()
    private val client = LspProcessClient(executable, args, workspace, onWorkspaceEditApplied,
        currentDocumentVersion = { uri -> versions[uri]?.get() },
        onNotification = onNotification)

    @Synchronized fun start() = client.start()
    @Synchronized fun open(uri: String, languageId: String, text: String) {
        val version = versions.getOrPut(uri) { AtomicInteger(1) }.get()
        client.didOpen(uri, languageId, version, text)
    }
    @Synchronized fun change(uri: String, text: String) {
        val version = versions.getOrPut(uri) { AtomicInteger(1) }.incrementAndGet()
        client.didChange(uri, version, text)
    }
    @Synchronized fun closeDocument(uri: String) { client.didClose(uri); versions.remove(uri) }
    @Synchronized fun documentVersion(uri: String): Int? = versions[uri]?.get()
    fun complete(uri: String, line: Int, character: Int, callback: (JSONObject) -> Unit) = client.completion(uri, line, character, callback)
    fun codeActions(uri: String, range: JSONObject, diagnostics: org.json.JSONArray, callback: (JSONObject) -> Unit) =
        client.codeActions(uri, range, diagnostics, callback)
    fun codeActions(uri: String, startLine: Int, startCharacter: Int, endLine: Int, endCharacter: Int,
                    diagnostics: org.json.JSONArray = org.json.JSONArray(), callback: (JSONObject) -> Unit) =
        client.codeActions(uri, startLine, startCharacter, endLine, endCharacter, diagnostics, callback)
    fun resolveCodeAction(action: JSONObject, callback: (JSONObject) -> Unit) = client.resolveCodeAction(action, callback)
    fun hover(uri: String, line: Int, character: Int, callback: (JSONObject) -> Unit) = client.hover(uri, line, character, callback)
    fun definition(uri: String, line: Int, character: Int, callback: (JSONObject) -> Unit) = client.definition(uri, line, character, callback)
    fun references(uri: String, line: Int, character: Int, includeDeclaration: Boolean, callback: (JSONObject) -> Unit) =
        client.references(uri, line, character, includeDeclaration, callback)
    fun rename(uri: String, line: Int, character: Int, newName: String, callback: (JSONObject) -> Unit) =
        client.rename(uri, line, character, newName, callback)
    fun formatting(uri: String, tabSize: Int, insertSpaces: Boolean, callback: (JSONObject) -> Unit) =
        client.formatting(uri, tabSize, insertSpaces, callback)
    fun formatting(uri: String, callback: (JSONObject) -> Unit) = client.formatting(uri, callback)
    fun executeCommand(command: String, arguments: org.json.JSONArray = org.json.JSONArray(), callback: (JSONObject) -> Unit = {}) =
        client.executeCommand(command, arguments, callback)
    @Synchronized fun save(uri: String, text: String) = client.didSave(uri, text)
    @Synchronized override fun close() { versions.clear(); client.close() }
}
