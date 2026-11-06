package dev.vscodeandroid.pro.editor

import android.content.Context
import io.github.rosemoe.sora.langs.textmate.registry.FileProviderRegistry
import io.github.rosemoe.sora.langs.textmate.registry.GrammarRegistry
import io.github.rosemoe.sora.langs.textmate.registry.ThemeRegistry
import io.github.rosemoe.sora.langs.textmate.registry.provider.AssetsFileResolver
import io.github.rosemoe.sora.langs.textmate.registry.model.IThemeSource
import io.github.rosemoe.sora.langs.textmate.registry.model.ThemeModel
import java.util.concurrent.atomic.AtomicBoolean

/** Loads bundled TextMate grammars once per process. */
object TextMateSetup {
    private val loaded = AtomicBoolean(false)
    fun initialize(context: Context) {
        if (!loaded.compareAndSet(false, true)) return
        runCatching {
            val resolver = FileProviderRegistry.getInstance()
            resolver.addFileProvider(AssetsFileResolver(context.applicationContext.assets))
            val path = "textmate/dark.json"
            val theme = ThemeModel(IThemeSource.fromInputStream(resolver.tryGetInputStream(path), path, null), "vscode-dark")
            ThemeRegistry.getInstance().loadTheme(theme)
            ThemeRegistry.getInstance().setTheme("vscode-dark")
            GrammarRegistry.getInstance().loadGrammars("textmate/languages.json")
        }.onFailure { loaded.set(false); throw it }
    }
}

fun textMateScopeFor(fileName: String): String? = when (fileName.substringAfterLast('.', "").lowercase()) {
    "py" -> "source.python"; "js","mjs","cjs" -> "source.js"; "ts","tsx" -> "source.ts"
    "kt","kts" -> "source.kotlin"; "java" -> "source.java"; "c","h" -> "source.c"; "cc","cpp","cxx","hpp" -> "source.cpp"
    "go" -> "source.go"; "rs" -> "source.rust"; "php" -> "source.php"; "rb" -> "source.ruby"
    "swift" -> "source.swift"; "dart" -> "source.dart"; "html","htm" -> "text.html.basic"
    "css","scss" -> "source.css"; "json" -> "source.json"; "md","markdown" -> "text.html.markdown"
    else -> null
}
