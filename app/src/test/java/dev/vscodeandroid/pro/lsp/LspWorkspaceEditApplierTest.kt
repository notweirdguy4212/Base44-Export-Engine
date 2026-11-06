package dev.vscodeandroid.pro.lsp

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File
import java.nio.file.Files

class LspWorkspaceEditApplierTest {
    @Test fun appliesEditsAcrossMultipleProjectFiles() {
        val root = Files.createTempDirectory("lsp-workspace-edit").toFile()
        try {
            File(root, "one.py").writeText("print(1)\n")
            File(root, "two.py").writeText("print(2)\n")
            val changes = JSONObject()
                .put(File(root, "one.py").toURI().toString(), JSONArray().put(edit("print(1)", "print('one')")))
                .put(File(root, "two.py").toURI().toString(), JSONArray().put(edit("print(2)", "print('two')")))
            val paths = LspWorkspaceEditApplier(root).apply(JSONObject().put("changes", changes),
                read = { File(root, it).readText() }, write = { path, content -> File(root, path).writeText(content) })
            assertEquals(setOf("one.py", "two.py"), paths.toSet())
            assertEquals("print('one')\n", File(root, "one.py").readText())
            assertEquals("print('two')\n", File(root, "two.py").readText())
        } finally { root.deleteRecursively() }
    }

    @Test(expected = IllegalArgumentException::class)
    fun rejectsStaleVersionedDocumentChanges() {
        val root = Files.createTempDirectory("lsp-workspace-version").toFile()
        try {
            val file = File(root, "main.py")
            file.writeText("x")
            val change = JSONObject().put("textDocument", JSONObject().put("uri", file.toURI().toString()).put("version", 2))
                .put("edits", JSONArray().put(edit("x", "y")))
            LspWorkspaceEditApplier(root).apply(JSONObject().put("documentChanges", JSONArray().put(change)),
                { file.readText() }, { _, _ -> }, validateVersion = { _, version -> version == 3 })
        } finally { root.deleteRecursively() }
    }

    @Test(expected = IllegalArgumentException::class)
    fun rejectsWorkspaceEditOutsideProjectRoot() {
        val root = Files.createTempDirectory("lsp-workspace-safe").toFile()
        val outside = Files.createTempFile("lsp-outside", ".txt").toFile()
        try {
            val changes = JSONObject().put(outside.toURI().toString(), JSONArray().put(edit("x", "y")))
            LspWorkspaceEditApplier(root).apply(JSONObject().put("changes", changes), { "x" }, { _, _ -> })
        } finally { root.deleteRecursively(); outside.delete() }
    }

    private fun edit(before: String, after: String) = JSONObject()
        .put("range", JSONObject().put("start", JSONObject().put("line", 0).put("character", 0))
            .put("end", JSONObject().put("line", 0).put("character", before.length)))
        .put("newText", after)
}
