package dev.vscodeandroid.pro.lsp

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class LspTextEditsTest {
    @Test fun appliesMultipleEditsFromEndToStart() {
        val edits = JSONArray()
            .put(edit(0, 0, 0, 3, "fun"))
            .put(edit(1, 0, 1, 1, "42"))
        assertEquals("fun x\n42", LspTextEdits.apply("val x\n1", edits))
    }

    @Test(expected = IllegalArgumentException::class)
    fun rejectsOutOfRangeEdits() {
        LspTextEdits.apply("x", JSONArray().put(edit(4, 0, 4, 1, "y")))
    }

    @Test(expected = IllegalArgumentException::class)
    fun rejectsOverlappingEdits() {
        val edits = JSONArray()
            .put(edit(0, 1, 0, 5, "x"))
            .put(edit(0, 3, 0, 7, "y"))
        LspTextEdits.apply("abcdefgh", edits)
    }

    @Test fun stripsCommonSnippetTabStops() {
        assertEquals("print(value)", LspTextEdits.plainSnippet("print(\${1:value})\$0"))
        assertEquals("const x = a", LspTextEdits.plainSnippet("const x = \${1|a,b|}"))
    }

    private fun edit(sl: Int, sc: Int, el: Int, ec: Int, replacement: String) = JSONObject()
        .put("range", JSONObject().put("start", JSONObject().put("line", sl).put("character", sc))
            .put("end", JSONObject().put("line", el).put("character", ec)))
        .put("newText", replacement)
}
