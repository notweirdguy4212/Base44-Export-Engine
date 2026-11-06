# Test report — 1.3.0 engineering preview

Date: 2026-11-06

## Checks executed in this environment

| Check | Result | Scope |
|---|---|---|
| Kotlin PSI parse of all main/test source files | PASS | No Kotlin parser error nodes in the source tree. This is syntax parsing, not full semantic compilation. |
| LSP transport/session/catalog compile | PASS (stubbed APIs) | Kotlin 1.9 compiler with local `org.json`, Android Process and Build stubs. No live server was started. |
| LSP text-edit/workspace-edit smoke checks | PASS | Functional local JSON stub: descending edits, overlapping-range rejection, snippet placeholder flattening, bounded multi-file edits and workspace path containment. |
| DAP client compile | PASS (stubbed APIs) | Kotlin source compiled against local JSON and Android Build stubs. No adapter process was launched. |
| Workspace store and registry compile | PASS (stubbed Android/SAF APIs) | Store and registry Kotlin sources compile; registry smoke check covers create, list, rename, delete and default-project preservation. |
| Toolchain installer/audit compile | PASS (stubbed Android/SAF/Build APIs) | Importer and audit sources compile; ELF header machine parsing, arm64-v8a match/mismatch and SHA-256 length tested against a stubbed ABI list. No Android binary was executed. |
| RuntimeBroker compile | PASS (stubbed Android Build API) | Compiled with the ABI-audit helper; no Python/Node/Java runtime was run. |
| Isolated shell service and Binder runner compile | PASS (stubbed Android APIs) | Compiled with Android service/messenger/process stubs and local coroutines JAR. No device UID test. |
| Git service compile | PASS (stubbed JGit API) | Kotlin source compiled against a minimal JGit-shaped stub, not the actual JGit dependency. |
| Manifest XML parse | PASS | Android manifest parsed with Python XML parser. |
| TextMate JSON assets | PASS | Bundled grammar/registry/theme JSON files parse. |
| JUnit tests | ADDED, NOT RUN | Includes LSP edit/snippet/path tests, registry CRUD tests and Git stage/branch/stash/tag/merge/remote tests. |
| ZIP integrity | PASS | Packaged source archive checked with `unzip -t`. |

## Not executed

- `:app:testDebugUnitTest`
- `:app:lintDebug`
- `:app:assembleDebug` or `:app:assembleRelease`
- Full semantic Android/Compose app compilation
- Android instrumentation, emulator or physical-device tests
- Isolated service UID separation on a real Android device
- Live LSP initialization, completion, diagnostics, code actions and formatting
- Real Python/Node/Java execution or Android ABI/runtime compatibility tests
- JGit tests against the real Android dependency or HTTPS fetch/pull/push against a provider
- Real Python/JavaScript DAP adapter sessions
- Security tests for hostile workspaces, process trees, filesystem escape, network denial and resource exhaustion

## Environment limitation

JDK 21 and Kotlin compiler 1.9.0 are present. There is no Gradle executable or wrapper, Android SDK/`android.jar`, and external dependency downloads are unavailable because network name resolution fails. Stub compilation validates selected Kotlin source/API shape only; it does not replace the Android Gradle build or runtime testing.

## Result

No APK was built. No Android device, live language server, runtime distribution, Git remote or debugger adapter was tested. The checks above are not evidence of production readiness.
