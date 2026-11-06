package dev.vscodeandroid.pro

import dev.vscodeandroid.pro.editor.textMateScopeFor
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class EditorLanguageScopeTest {
    @Test fun mapsCommonLanguageExtensionsToTextMateScopes() {
        assertEquals("source.python", textMateScopeFor("main.py"))
        assertEquals("source.js", textMateScopeFor("app.js"))
        assertEquals("source.kotlin", textMateScopeFor("Main.kt"))
        assertEquals("source.rust", textMateScopeFor("main.rs"))
        assertEquals("text.html.basic", textMateScopeFor("index.html"))
    }
    @Test fun unknownExtensionHasNoGrammar() { assertNull(textMateScopeFor("notes.unknown")) }
}
