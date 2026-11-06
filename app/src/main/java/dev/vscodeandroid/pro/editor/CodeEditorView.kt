package dev.vscodeandroid.pro.editor

import android.graphics.Typeface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import io.github.rosemoe.sora.event.ContentChangeEvent
import io.github.rosemoe.sora.event.SelectionChangeEvent
import io.github.rosemoe.sora.lang.EmptyLanguage
import io.github.rosemoe.sora.langs.textmate.TextMateColorScheme
import io.github.rosemoe.sora.langs.textmate.TextMateLanguage
import io.github.rosemoe.sora.langs.textmate.registry.ThemeRegistry
import io.github.rosemoe.sora.widget.CodeEditor

@Composable
fun CodeEditorView(
    text: String,
    fileName: String,
    languageName: String? = null,
    onTextChanged: (String) -> Unit,
    onCursorChanged: (Int, Int) -> Unit = { _, _ -> },
    modifier: Modifier = Modifier
) {
    AndroidView(
        modifier = modifier,
        factory = { context ->
            TextMateSetup.initialize(context)
            val codeEditor = CodeEditor(context)
            codeEditor.apply {
                typefaceText = Typeface.MONOSPACE
                textSize = 14f
                colorScheme = TextMateColorScheme.create(ThemeRegistry.getInstance())
                setEditorLanguage(languageFor(fileName, languageName))
                tag = "$fileName|$languageName"
                setText(text)
                subscribeAlways<ContentChangeEvent> { onTextChanged(codeEditor.text.toString()) }
                subscribeAlways<SelectionChangeEvent> {
                    val cursor = codeEditor.cursor
                    onCursorChanged(cursor.leftLine, cursor.leftColumn)
                }
            }
            codeEditor
        },
        update = { editor ->
            val languageTag = "$fileName|$languageName"
            if (editor.tag != languageTag) {
                editor.setEditorLanguage(languageFor(fileName, languageName))
                editor.tag = languageTag
            }
            if (editor.text.toString() != text) editor.setText(text)
        },
        onRelease = { it.release() }
    )
}

private fun languageFor(fileName: String, languageName: String?) : io.github.rosemoe.sora.lang.Language {
    val scope = if (languageName != null) textMateScopeForLanguage(languageName) else textMateScopeFor(fileName)
    return scope?.let { TextMateLanguage.create(it, true) } ?: EmptyLanguage()
}

private fun textMateScopeForLanguage(language: String): String? = when (language.lowercase()) {
    "python" -> "source.python"; "javascript" -> "source.js"; "typescript" -> "source.ts"
    "kotlin" -> "source.kotlin"; "java" -> "source.java"; "c" -> "source.c"; "c++" -> "source.cpp"
    "go" -> "source.go"; "rust" -> "source.rust"; "php" -> "source.php"; "ruby" -> "source.ruby"
    "swift" -> "source.swift"; "dart" -> "source.dart"; "html" -> "text.html.basic"
    "css" -> "source.css"; "json" -> "source.json"; "markdown" -> "text.html.markdown"
    "plain text", "c#" -> null
    else -> null
}
