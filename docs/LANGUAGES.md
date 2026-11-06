# Language support matrix — 1.3.0

Language mode, grammar, LSP profile, runtime and debugger are separate capabilities. A profile does not mean the corresponding binary is installed or Android-compatible.

| Language | Extensions | TextMate | LSP profile | Run/debug status |
|---|---|---:|---:|---|
| Python | `.py` | Yes | pylsp | Python runtime is user-imported and runs under app UID after warning; debugpy adapter is user-imported |
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` | Yes | typescript-language-server | Node runtime is user-imported and runs under app UID after warning; js-debug adapter is user-imported |
| TypeScript | `.ts`, `.tsx` | Yes | typescript-language-server | Requires compatible Node/runtime and adapter setup; not device-verified |
| Kotlin | `.kt`, `.kts` | Yes | kotlin-language-server | No managed runtime distribution |
| Java | `.java` | Yes | jdtls | Java runtime is user-imported and runs under app UID after warning; no configured DAP adapter |
| C | `.c`, `.h` | Yes | clangd | No managed runtime distribution |
| C++ | `.cpp`, `.cc`, `.cxx`, `.hpp` | Yes | clangd | No managed runtime distribution |
| Go | `.go` | Yes | gopls | No managed runtime distribution |
| Rust | `.rs` | Yes | rust-analyzer | No managed runtime distribution |
| PHP | `.php` | Yes | phpactor | No managed runtime distribution |
| Ruby | `.rb` | Yes | solargraph | No managed runtime distribution |
| Swift | `.swift` | Yes | None | No managed runtime distribution |
| Dart | `.dart` | Yes | None | No managed runtime distribution |
| HTML | `.html`, `.htm` | Yes | None | No managed runtime distribution |
| CSS | `.css`, `.scss` | Yes | None | No managed runtime distribution |
| JSON | `.json` | Yes | None | No managed runtime distribution |
| Markdown | `.md` | Yes | None | No managed runtime distribution |
| Shell | `.sh` | N/A | None | Runs through Android isolated-process UID; limited shell environment and no project filesystem mount |
| C# | `.cs` | No | None | No managed runtime distribution |

The 17 bundled grammars are starter lexical grammars, not the complete VS Code grammar corpus. LSP completions are caret-aware but displayed in a companion panel, and diagnostics appear in Problems rather than editor markers. User-imported runtimes/servers/adapters have not been cryptographically authenticated or validated on real Android hardware.
