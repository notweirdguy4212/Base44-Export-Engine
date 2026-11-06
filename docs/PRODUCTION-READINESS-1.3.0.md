# Production-readiness assessment — 1.3.0

## Implemented in source

| Area | Current implementation | Verification status |
|---|---|---|
| LSP transport | JSON-RPC framing, lifecycle, document versions, URI-routed notifications, completion, diagnostics, code actions, resolve/execute, formatting and workspace edits | LSP source compilation against local Android/JSON stubs; edit and workspace-registry JVM smoke checks. No live server test. |
| Editor integration | Debounced caret completion with a selectable overlay; Problems diagnostics; code-action and formatting controls | Source inspection only. Native Sora completion and diagnostic-marker integration remain incomplete. |
| Projects | Persistent named projects with create/open/rename/delete; independent roots; selected-project SAF import | Workspace registry JVM smoke check and workspace-store stub compilation. No SAF/device test. |
| Git | Local stage/unstage/commit, branches, tags, stash, diff/history, merge, HTTPS remotes, fetch/pull/push, manual conflict marking | Git source and UI not built against the Android app in this environment; remote transport and conflict paths untested. |
| DAP | Stdio framing, initialize/launch, breakpoints, threads, stack/scopes/variables, stepping, pause and evaluate | DAP source compiled against local JSON stubs; no adapter package or live debug session tested. |
| Runtime | Existing Python/Node/Java app-UID broker; isolated-UID shell service with input/output/time bounds | Runtime, workspace and isolated-service source compiled against local Android/SAF stubs. No Android process/UID test. |
| Toolchains | User import, executable discovery, SHA-256 and ELF-machine/device-ABI inventory | Source compilation against local stubs; no real Android runtime/server package tested. |

## Critical blockers

1. **Android build and device validation:** run Gradle sync, unit tests, lint, debug/release assembly and instrumentation tests on API 26–35 devices, including ARM64. This environment has no Gradle executable/wrapper or Android SDK/android.jar and could not resolve external dependencies.
2. **Verified distributions:** no Python, Node.js, Java, LSP or DAP distributions are bundled. SHA-256 is an integrity fingerprint only; ELF machine matching does not validate a publisher signature, Android/Bionic ABI details, API level, dynamic libraries, dependencies, licenses or runtime behavior. Publish signed manifests and reproducible per-ABI packages, then verify on real devices.
3. **LSP/editor completeness:** completion uses a custom overlay rather than Sora's native completion component. Diagnostics are listed in Problems, not painted as editor markers/tooltips. Live server tests, cancellation, capability edge cases and large-workspace tests remain outstanding.
4. **Execution security:** only shell scripts use the isolated-process service. Python/Node/Java still execute under the application UID. The isolated shell service has no dedicated filesystem namespace, seccomp policy, CPU/memory/PID quotas or guaranteed process-tree termination. It is a separate-UID boundary, not a hardened hostile-code sandbox.
5. **Debug adapters:** DAP transport is implemented, but no adapter binaries are shipped or verified. Python/Node adapter startup, breakpoints, stepping, source mapping and termination must be validated on each supported ABI.
6. **Git completeness:** HTTPS operations and common local workflows are present, but SSH, rebase, submodules, LFS, credential-helper support and a full interactive merge-conflict editor are absent. Remote tests and malformed-repository security tests are required.
7. **Project lifecycle:** project CRUD is present, but SAF live sync, file watcher, rename/move/delete/create-folder, autosave, crash recovery and large-file paging remain incomplete.
8. **Release engineering:** add protected signing keys, reproducible builds, SBOM, dependency/license/vulnerability scanning, privacy review, accessibility tests and Play policy review.

## Security rules for this preview

- Treat imported toolchains and language servers as executable code. Import only from sources you trust.
- Do not run untrusted Python, Node.js or Java code; those processes share the app UID and inherit the app's Internet permission.
- Imported language servers and DAP adapters also run under the app UID and inherit the app's Internet permission.
- The isolated shell runner runs under a distinct Android isolated-process UID and does not inherit app permissions, but should not be treated as a complete sandbox for hostile workloads.
- Do not store Git tokens in source code or project files. The UI keeps credentials in memory for the current operation only.

## Release decision

**Not approved for production distribution.** Version 1.3.0 is an engineering preview. A successful Android build, on-device verification, authenticated ABI-specific toolchain packages and the blockers above are prerequisites for production approval.
