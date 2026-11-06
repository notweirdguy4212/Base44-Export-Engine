package dev.vscodeandroid.pro.lsp

import org.json.JSONArray
import org.json.JSONObject

/** Applies LSP TextEdits in descending document order so earlier offsets remain stable. */
object LspTextEdits {
    fun apply(text: String, edits: JSONArray): String {
        data class Edit(val start: Int, val end: Int, val replacement: String)
        require(edits.length() <= 2_000) { "LSP returned too many text edits" }
        val parsed = ArrayList<Edit>()
        for (i in 0 until edits.length()) {
            val item = edits.optJSONObject(i) ?: continue
            val range = item.optJSONObject("range") ?: continue
            val start = offset(text, range.optJSONObject("start") ?: continue)
            val end = offset(text, range.optJSONObject("end") ?: continue)
            require(end >= start) { "LSP returned an inverted text edit range" }
            parsed += Edit(start, end, item.optString("newText"))
        }
        var result = text
        var lastStart = Int.MAX_VALUE
        for (edit in parsed.sortedByDescending { it.start }) {
            require(edit.end <= result.length && edit.end <= lastStart) { "LSP returned overlapping or invalid text edits" }
            result = result.substring(0, edit.start) + edit.replacement + result.substring(edit.end)
            lastStart = edit.start
        }
        return result
    }

    /** Resolves common LSP snippet placeholders when the editor has no snippet-session support. */
    fun plainSnippet(snippet: String): String {
        var value = snippet.replace(Regex("\\$\\{\\d+\\|([^}]+)\\}")) { it.groupValues[1].substringBefore(',') }
        value = value.replace(Regex("\\$\\{\\d+:([^{}]*)\\}")) { it.groupValues[1] }
        value = value.replace(Regex("\\$\\{\\d+\\}"), "")
        value = value.replace(Regex("\\$\\d+"), "")
        return value.replace("\\$", "$").replace("\\}", "}").replace("\\{", "{")
    }

    private fun offset(text: String, position: JSONObject): Int {
        val targetLine = position.optInt("line", -1)
        val targetColumn = position.optInt("character", -1)
        require(targetLine >= 0 && targetColumn >= 0) { "Invalid LSP position" }
        var line = 0
        var offset = 0
        while (line < targetLine && offset < text.length) {
            if (text[offset++] == '\n') line++
        }
        require(line == targetLine) { "LSP position is beyond document" }
        val lineEnd = text.indexOf('\n', offset).let { if (it < 0) text.length else it }
        require(targetColumn <= lineEnd - offset) { "LSP column is beyond line" }
        return offset + targetColumn
    }
}
