# VS Code Android Pro 1.2.0 — engineering update

## Added

- Project-folder import from Android SAF into an app-private workspace.
- Workspace file listing, UTF-8 read/write and new-file creation.
- SAF toolchain-folder import with bounded copy, executable detection and private storage.
- Editor language-mode changes now update the live Sora language instance.
- Shared LSP sessions per language/workspace with document-URI notification routing.
- LSP completion request action at end-of-document.
- LSP startup monitor-lock deadlock fix and improved process cleanup.
- Runtime bounded byte-stream capture, argument limits, project-local temp directory and minimal process environment.
- Git status, stage-all, patch diff, history and safer checkout/delete operations.
- Expanded workspace, runtime, Git and LSP tests.

## Compatibility

- Android min SDK: 26
- Compile/target SDK: 35
- Java source/target: 17
- App version: 1.2.0 (version code 120)

## Known limitations

See `PRODUCTION-READINESS-1.2.0.md`. This release is not production-approved: toolchains are user-supplied and unverified, runtime isolation is not hardened, LSP integration is partial, remote Git/debugging/extensions are not implemented, and no APK/device build verification was possible in the current environment.
