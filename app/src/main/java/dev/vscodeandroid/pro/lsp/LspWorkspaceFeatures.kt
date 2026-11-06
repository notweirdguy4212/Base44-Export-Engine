package dev.vscodeandroid.pro.lsp

import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** Typed, bounded views over the JSON payloads used by LSP. */
object LspWorkspaceFeatures {
    data class Diagnostic(
        val message: String,
        val severity: Int,
        val code: String?,
        val source: String?,
        val startLine: Int,
        val startCharacter: Int,
        val endLine: Int,
        val endCharacter: Int
    )

    data class Completion(val label: String, val insertText: String, val detail: String?, val documentation: String?)
    data class CodeAction(val title: String, val kind: String?, val preferred: Boolean, val payload: JSONObject)

    fun diagnostics(params: JSONObject): List<Diagnostic> {
        val items = params.optJSONArray("diagnostics") ?: return emptyList()
        return buildList {
            for (i in 0 until minOf(items.length(), 500)) {
                val item = items.optJSONObject(i) ?: continue
                val range = item.optJSONObject("range") ?: JSONObject()
                val start = range.optJSONObject("start") ?: JSONObject()
                val end = range.optJSONObject("end") ?: JSONObject()
                add(Diagnostic(
                    item.optString("message", "Diagnostic"), item.optInt("severity", 3),
                    item.opt("code")?.toString(), item.optString("source").takeIf(String::isNotBlank),
                    start.optInt("line", 0).coerceAtLeast(0), start.optInt("character", 0).coerceAtLeast(0),
                    end.optInt("line", 0).coerceAtLeast(0), end.optInt("character", 0).coerceAtLeast(0)
                ))
            }
        }
    }

    fun completions(response: JSONObject): List<Completion> {
        val result = response.optJSONObject("value") ?: response
        val items = result.optJSONArray("items") ?: response.optJSONArray("value") ?: return emptyList()
        return buildList {
            for (i in 0 until minOf(items.length(), 200)) {
                val item = items.optJSONObject(i) ?: continue
                val label = item.optString("label").takeIf(String::isNotBlank) ?: continue
                val edit = item.optJSONObject("textEdit")
                val insert = edit?.optString("newText")?.takeIf(String::isNotBlank)
                    ?: item.optString("insertText").takeIf(String::isNotBlank) ?: label
                add(Completion(label, insert, item.optString("detail").takeIf(String::isNotBlank),
                    item.opt("documentation")?.let { doc -> if (doc is JSONObject) doc.optString("value") else doc.toString() }))
            }
        }
    }

    fun codeActions(response: JSONObject): List<CodeAction> {
        val array = response.optJSONArray("value") ?: response.optJSONArray("items") ?: return emptyList()
        return buildList {
            for (i in 0 until minOf(array.length(), 100)) {
                val item = array.optJSONObject(i) ?: continue
                val title = item.optString("title").takeIf(String::isNotBlank) ?: continue
                add(CodeAction(title, item.optString("kind").takeIf(String::isNotBlank), item.optBoolean("isPreferred"), item))
            }
        }
    }
}

/** Applies only text edits to files under one selected project. Resource operations are rejected. */
class LspWorkspaceEditApplier(private val workspace: File) {
    private val root = workspace.canonicalFile

    fun apply(
        edit: JSONObject,
        read: (String) -> String,
        write: (String, String) -> Unit,
        validateVersion: (uri: String, version: Int) -> Boolean = { _, _ -> true }
    ): List<String> {
        val editsByUri = linkedMapOf<String, JSONArray>()
        val changes = edit.optJSONObject("changes")
        if (changes != null) {
            val keys = changes.keys()
            while (keys.hasNext()) {
                val uri = keys.next()
                editsByUri[uri] = changes.optJSONArray(uri) ?: JSONArray()
            }
        }
        val documentChanges = edit.optJSONArray("documentChanges")
        if (documentChanges != null) {
            for (i in 0 until documentChanges.length()) {
                val change = documentChanges.optJSONObject(i) ?: error("Invalid document change")
                require(change.has("textDocument") && change.has("edits")) {
                    "Create, rename and delete resource operations are not supported by this editor"
                }
                val document = change.getJSONObject("textDocument")
                val uri = document.getString("uri")
                val version = document.opt("version")
                if (version != null && version !== JSONObject.NULL) {
                    require(version is Number && validateVersion(uri, version.toInt())) { "Workspace edit was generated for a stale document version" }
                }
                val edits = change.optJSONArray("edits") ?: JSONArray()
                editsByUri[uri] = edits
            }
        }
        require(editsByUri.size <= 100) { "Workspace edit affects too many files" }
        val staged = editsByUri.map { (uri, edits) ->
            val file = File(java.net.URI(uri)).canonicalFile
            require(file.toPath().startsWith(root.toPath()) && file.isFile) { "Workspace edit targets a file outside the selected project" }
            val relative = file.relativeTo(root).invariantSeparatorsPath
            val original = read(relative)
            require(original.toByteArray(Charsets.UTF_8).size <= MAX_FILE_BYTES) { "Workspace edit targets a file larger than the editor limit" }
            val updated = applyTextEdits(original, edits)
            require(updated.toByteArray(Charsets.UTF_8).size <= MAX_FILE_BYTES) { "Workspace edit would exceed the editor file limit" }
            relative to updated
        }
        require(staged.sumOf { it.second.toByteArray(Charsets.UTF_8).size.toLong() } <= MAX_TOTAL_BYTES) {
            "Workspace edit exceeds the total write limit"
        }
        staged.forEach { (path, content) -> write(path, content) }
        return staged.map { it.first }
    }

    private data class TextEdit(val start: Int, val end: Int, val text: String)

    companion object { private const val MAX_FILE_BYTES = 4 * 1024 * 1024; private const val MAX_TOTAL_BYTES = 32L * 1024 * 1024 }

    private fun applyTextEdits(original: String, edits: JSONArray): String {
        require(edits.length() <= 2_000) { "Too many text edits" }
        val parsed = buildList {
            for (i in 0 until edits.length()) {
                val item = edits.getJSONObject(i)
                val range = item.getJSONObject("range")
                val start = offset(original, range.getJSONObject("start"))
                val end = offset(original, range.getJSONObject("end"))
                require(start <= end) { "Invalid text edit range" }
                add(TextEdit(start, end, item.optString("newText")))
            }
        }.sortedByDescending { it.start }
        var result = original
        var previousStart = Int.MAX_VALUE
        for (edit in parsed) {
            require(edit.end <= previousStart) { "Overlapping text edits are rejected" }
            result = result.substring(0, edit.start) + edit.text + result.substring(edit.end)
            previousStart = edit.start
        }
        return result
    }

    private fun offset(text: String, position: JSONObject): Int {
        val targetLine = position.optInt("line", -1)
        val targetCharacter = position.optInt("character", -1)
        require(targetLine >= 0 && targetCharacter >= 0)
        var line = 0
        var index = 0
        while (line < targetLine && index < text.length) {
            if (text[index++] == '\n') line++
        }
        require(line == targetLine) { "Text edit line is outside document" }
        val lineEnd = text.indexOf('\n', index).let { if (it < 0) text.length else it }
        require(targetCharacter <= lineEnd - index) { "Text edit character is outside document line" }
        return index + targetCharacter
    }
}
