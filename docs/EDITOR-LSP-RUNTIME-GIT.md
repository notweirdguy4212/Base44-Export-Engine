# Editor, workspace, LSP, runtime, Git and debugger (1.3.0)

## Editor and LSP

Sora Editor hosts the text surface and TextMate starter grammars. The editor reports caret coordinates; a debounced effect requests LSP completions for the active document. Completion items retain their source payload, apply LSP `textEdit` ranges when supplied, and resolve common snippet placeholders because the editor does not provide a full snippet session. Suggestions are shown in a selectable overlay over the editor and mirrored in the Problems companion panel; they are not yet wired into Sora's native completion component.

`LspProcessClient` implements Content-Length framed JSON-RPC 2.0, initialize/initialized, open/change/save/close, completion, code actions, resolve, hover, definition, references, rename, formatting and executeCommand requests. It advertises workspace edit support and answers workspace/configuration, workspaceFolders, registration, progress creation and applyEdit requests. Diagnostics are routed by document URI into the Problems panel. Workspace edits are bounded to existing files under the project; resource operations are rejected. `LspTextEdits` applies edits in descending order and rejects overlapping ranges. `LspWorkspaceEditApplier` handles bounded multi-file text edits and path containment.

No LSP executable is bundled. Nine launch profiles are metadata only: pylsp, typescript-language-server, kotlin-language-server, jdtls, clangd, gopls, rust-analyzer, phpactor and solargraph. Imported servers run under the app UID and may access app resources. No Android-compatible server distribution has been cryptographically verified.

## Projects

`WorkspaceRegistry` stores project IDs and display names, creates/selects/deletes projects and protects the default project. `WorkspaceProjectStore` imports SAF folders into app-private storage and provides bounded file operations. Import is a snapshot/merge, not SAF live sync. Rename/move/create-folder, transactional replacement, file watching, autosave and crash recovery remain incomplete.

## Toolchains and runtime

`ToolchainInstaller` copies user-selected toolchain trees into app-private storage. `ToolchainAudit` reports SHA-256 and compares ELF `e_machine` against `Build.SUPPORTED_ABIS`. This does not authenticate a vendor, verify signatures, resolve shared libraries or prove Bionic/linker compatibility.

`.sh` source is sent over Binder to `IsolatedShellExecutionService`, declared with Android `isolatedProcess=true`. The service runs `/system/bin/sh` under an isolated UID, reports that UID, and the caller rejects a result if it is not distinct from the app UID. Script size, wall time and output are bounded. This service has no app-private workspace access and does not yet impose complete CPU/memory/PID quotas or process-tree containment.

Python, Node and Java use `RuntimeBroker` under the app UID. A confirmation dialog explicitly warns that this is not sandboxed. Language servers and debug adapters also run under the app UID. Because the app requests Android Internet permission for HTTPS Git, these child processes inherit that network permission. Do not run untrusted code or imported tooling with these processes.

## Git

`GitRepositoryService` supports init/status, stage/unstage/stage-all, commit, branches, checkout, create/delete branch, stash/list/apply/drop, tags, patch diff (staged or unstaged), history, HTTPS remote setup, fetch/pull/push with per-operation credentials and local merge. Credentials are not written to Git config and temporary character arrays/provider state are cleared after operations.

SSH, credential vault, signed commits/tags, full merge/rebase/cherry-pick continuation/abort, rich conflict resolution, submodules, worktrees, LFS and complete interactive diff/staging remain unsupported. Remote operations have not been validated against a live provider or real JGit runtime in this environment.

## Debugging

`DebugAdapterClient` speaks DAP stdio and supports initialize, launch, breakpoints, configurationDone, continue, next, stepIn, stepOut, pause, threads, stackTrace, scopes, variables, evaluate and disconnect. The workbench exposes Python and JavaScript adapter launch, breakpoints, stepping, stack and variable inspection. Adapters are user-supplied, not bundled or verified. No live DAP adapter test has been run.

## Verification limits

See `docs/TEST-REPORT-1.3.0.md`. LSP, DAP, isolated-service, toolchain-audit, registry and Git sources were checked using host Kotlin compiler and minimal API stubs. These checks do not prove compatibility with the real Android SDK, Compose, JGit, an Android device or real toolchain distributions. No Gradle build, lint, unit-test suite or APK assembly was possible in the current environment.
