package dev.vscodeandroid.pro

import dev.vscodeandroid.pro.lsp.LspServerCatalog
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LspServerCatalogTest {
    @Test fun mapsKnownLanguageServerProfiles() {
        assertEquals("python", LspServerCatalog.forFile("main.py")?.id)
        assertEquals("typescript", LspServerCatalog.forFile("app.ts")?.id)
        assertEquals("typescript", LspServerCatalog.forFile("app.mjs")?.id)
        assertEquals("typescript", LspServerCatalog.forFile("app.cjs")?.id)
        assertEquals("rust", LspServerCatalog.forFile("lib.rs")?.id)
        assertNull(LspServerCatalog.forFile("unknown.txt"))
    }
}
