# Production-readiness assessment — 1.2.0

## Implemented in this source revision

| Subsystem | Implemented | Verified in this environment |
|---|---|---|
| Sora editor and TextMate grammars | Native editor, 17 bundled starter grammars, local completion, language-mode switching | Source inspection; full Android build unavailable |
| Project workspace | SAF folder import, bounded copy to app-private storage, file listing/create/read/write, canonical path validation | Workspace store compiled against Android/SAF API stubs; JVM smoke test passed |
| Toolchain import | SAF folder import to private toolchains directory, bounded copy, executable permission and known-binary discovery | Source inspection; no actual Android binary execution test |
| LSP transport | JSON-RPC Content-Length framing, initialize/initialized, notifications, document versions, completion request, lifecycle cleanup, listener routing by URI | LSP sources compiled against Android/JSON API stubs; no live language server available |
| Runtime | Python/Node/Java executable adapters, private executable and workspace checks, argv-only invocation, bounded byte output, timeout, minimal environment | RuntimeBroker compiled with Kotlin/JDK; fake-executable smoke test passed |
| Git | Init/status/stage/unstage/stage-all/commit/branches/checkout/delete/patch diff/log | Unit tests added; JGit tests not executed here |
| CI | JVM tests, Android lint, debug/release assemble and artifact upload | Workflow source reviewed; CI not run |

## Release blockers — do not label production-ready yet

1. **Build and device verification:** execute Gradle sync, compile, unit tests, Android lint, debug/release builds, and test on physical ARM64 phones/tablets and API 26+ emulators. No Android SDK/Gradle installation is available in the current build environment.
2. **Toolchain distribution:** provide signed, reproducible ARM64-compatible Python, Node.js and Java runtime packages; the current SAF importer only copies user-selected files and sets executable bits. It does not verify signatures, resolve dependencies or prove Android ABI/exec compatibility. Validate shared libraries, license obligations, update integrity, offline install and rollback.
3. **LSP distribution:** provide compatible server binaries and dependencies; implement a verified installer and per-server compatibility matrix. Current profiles are launch metadata, not installed servers.
4. **Editor/LSP integration:** connect completion to the live editor caret and completion popup; map diagnostics to editor markers; implement cancellation, code actions, hover, rename, formatting, semantic tokens and server capability negotiation.
5. **Sandbox:** move execution out of the app UID into a separately isolated execution service with OS-enforced filesystem/network/resource boundaries. The current broker is explicitly not a secure sandbox.
6. **Project management:** support multiple named workspaces, transactional project replacement, SAF live synchronization, create-folder, rename, delete, move, file conflict detection, large-file handling and recovery after process death.
7. **Git:** implement remote transport, credential storage, fetch/pull/push, merge/rebase, conflict resolution, tags and richer diff/staging UI; run security tests against malformed repositories and hostile path names.
8. **Debugger/extensions:** implement a real Debug Adapter Protocol client and a constrained extension model or clearly remove unsupported extension/debug affordances. VS Code Marketplace compatibility cannot be claimed without an extension host and API compatibility layer.
9. **Release engineering:** configure a protected production signing key outside the repository, reproducible builds, SBOM, dependency/license scanning, vulnerability review, crash reporting policy, privacy review and Play policy checks.
10. **Accessibility and device matrix:** validate screen readers, hardware keyboard, IME, split-screen, large fonts, landscape, tablets, low-memory devices and lifecycle restoration.

## Security statement

The current runtime process shares the application UID and can access resources available to the app. Clearing environment variables, validating paths, using argv arrays, bounding output and terminating the direct child are useful defence-in-depth measures, but they do not provide kernel isolation, network denial, CPU/memory quotas or reliable process-tree termination. Never run untrusted projects in this broker.

## Release decision

**Not approved for production distribution.** Version 1.2.0 is a more complete engineering baseline with real project, LSP, runtime and Git improvements. A successful Android build, on-device test evidence, provisioned toolchains and the release blockers above are prerequisites for production approval.
