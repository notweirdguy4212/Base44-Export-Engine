package dev.vscodeandroid.pro

import org.junit.Assert.assertEquals
import org.junit.Test

class LanguageModeTest {
    @Test fun mapsCommonSourceExtensions() {
        assertEquals("Kotlin", languageFor("MainActivity.kt"))
        assertEquals("Java", languageFor("Main.java"))
        assertEquals("Python", languageFor("script.py"))
        assertEquals("JavaScript", languageFor("app.jsx"))
        assertEquals("TypeScript", languageFor("app.tsx"))
        assertEquals("Rust", languageFor("main.rs"))
        assertEquals("Markdown", languageFor("README.md"))
    }

    @Test fun unknownExtensionFallsBackToPlainText() {
        assertEquals("Plain Text", languageFor("source.unknown"))
        assertEquals("Plain Text", languageFor("README"))
    }
}
