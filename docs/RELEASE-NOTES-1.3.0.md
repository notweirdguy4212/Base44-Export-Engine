# Release notes — 1.3.0 engineering preview

## Editor and language services

- Completion requests now follow the editor caret with a short debounce, and selectable results are shown over the editor.
- Completion insertion honours LSP `textEdit` ranges and basic snippet placeholders.
- Added LSP code-action requests, code-action resolution, command execution, document formatting, and guarded application of multi-file workspace edits.
- LSP-originated workspace edits update open editor tabs after the files are written.
- Diagnostics are decoded and presented with severity and source position in the Problems panel.

## Projects and source control

- Added a persistent project registry with create/open/rename/delete operations and per-project workspace roots.
- Project-folder import now targets the selected project.
- Git UI covers staging/unstaging, commits, branches, tags, stash, merge, HTTPS remote configuration, fetch/pull/push and manual conflict resolution marking.
- Added an explicit Internet permission for HTTPS Git transport. Git credentials are supplied per operation and are not persisted in the remote configuration.

## Runtime, toolchains and debugging

- Added an Android isolated-process service for shell-script execution. It reports its UID, enforces a script-size cap, output cap and wall-clock timeout.
- Python, Node.js and Java remain app-UID execution paths and require explicit confirmation that the code is trusted.
- Toolchain import now supports SHA-256 and ELF-machine inventory against the current device's supported ABIs. Hashes do not authenticate publishers.
- Added a DAP stdio client with launch, breakpoint, stepping, stack, scope, variable and evaluate requests. Compatible adapters must be supplied by the user.

## Verification boundary

Protocol and core sources were compiled against local API stubs and small JVM smoke checks were run. A full Android Gradle build, Android lint, real LSP/runtime/adapter integration, emulator testing and physical-device security testing were not possible in the available environment. No APK is included. See `TEST-REPORT-1.3.0.md`.
