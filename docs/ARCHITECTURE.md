# Architecture — 1.3.0

## Application layers

- **Compose workbench** — multi-project selector, explorer, tabs, Problems/Output/Terminal/Git/Debug panels and status bar.
- **Editor engine** — Sora Editor hosted by Compose; TextMate starter grammars, caret position events and a debounced LSP completion overlay.
- **Language tooling** — Content-Length JSON-RPC transport, shared language-server sessions, document versions, URI-routed diagnostics, completion, code actions, formatting and bounded workspace text edits. Server binaries remain user-provisioned.
- **Workspace services** — named project registry, SAF snapshot import, app-private project store, toolchain importer/auditor and JGit repository service.
- **Runtime services** — Android isolated-process shell service plus a separate app-UID RuntimeBroker for Python/Node/Java.
- **Debug services** — DAP stdio client and user-supplied debugpy/js-debug adapters.

## Trust boundaries

SAF project imports are copied into app-private storage with path, depth, file-count and byte limits. Imported toolchains are user-selected; ELF machine/ABI checks and SHA-256 inventory provide compatibility/integrity metadata, not vendor authenticity or dependency verification.

`.sh` scripts are passed to a service declared with `android:isolatedProcess="true"`. The service reports its UID, and the caller verifies that it differs from the application UID. This is a separate Android isolated UID/permission boundary, not a full container. The isolated process cannot access the app-private workspace/toolchains; code receives only the submitted script text. Wall-clock and output limits exist, but complete CPU/memory/PID quotas and process-tree containment are not implemented.

Python, Node, Java, LSP servers and DAP adapters are launched by the app process under the app UID and inherit the app's Internet permission. The app warns before running Python/Node/Java, but this is not isolation. Treat all user-imported executables and project code as trusted-only until a hardened runtime service is available.

## Remaining extension points

- Trusted signing root and signed Android/ABI-specific toolchain distributions.
- Native Sora completion popup and diagnostic markers.
- Complete LSP multi-document/resource-operation handling and language-specific settings.
- Isolated runtime packaging for Python/Node/Java with resource/network/file boundaries.
- Git conflict/rebase/cherry-pick UX, secure credential vault and SSH transport.
- Debug adapter validation, richer launch configurations, exception/conditional breakpoints and advanced watch/evaluate views.
- SAF live sync, file operations, crash recovery and robust project lifecycle.
