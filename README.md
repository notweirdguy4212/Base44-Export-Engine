# Base44 Toolkit

**Version 4.0.0** · Chrome / Chromium · Manifest V3 · Local-first project recovery

Base44 Toolkit is an independent utility for exporting project files exposed by an authenticated Base44 workspace, preserving them in a portable archive, and producing practical recovery diagnostics. It is not affiliated with or endorsed by Base44.

## What's new in 4.0.0

- **Chrome side-panel workspace** with Export, Jobs, Restore and Tools views.
- **Persistent background queue** stored in IndexedDB. Jobs survive side-panel closure and are recovered after service-worker suspension or browser startup.
- **ZIP64 archive engine** with 64-bit sizes and offsets, ZIP64 end records, UTF-8 paths and store-only entries. The archive is composed from Blob parts rather than one giant 32-bit ZIP byte array.
- **IndexedDB staging** for file payloads and job state. The extension uses Chrome alarms as a recovery watchdog; it does not try to keep an MV3 service worker permanently alive.
- **Batch queueing**, pause/resume/cancel/retry controls, progress reporting and download completion tracking.
- **Integrity metadata and version comparison** with CRC-32 on every archive entry, SHA-256 on individual files up to 128 MiB, and automatic added/changed/removed/unchanged reports against the last successfully downloaded backup. Larger files use size + CRC-32 for comparison and are marked without a SHA-256 digest.
- **Restore safety contract** and downloadable restore runbook. Remote writes are disabled until a documented Base44 import interface can be verified and integrated.
- **Classic editor recovery** remains available as a separate legacy tool for visible editor paths when direct project export is unavailable.

## Documentation languages

- [Deutsch](l10n/de/README.md)
- [Español](l10n/es/README.md)
- [Français](l10n/fr/README.md)
- [Polski](l10n/pl/README.md)

English is the canonical and most complete documentation.

## Install

1. Download and extract the release archive.
2. Open `chrome://extensions` in Chrome 120 or later.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the `base44-code-downloader-main` folder.
5. Sign in to Base44 and open a project you own or are authorised to export.
6. Click the extension icon to open the side panel, detect the project and queue an export.

## Export workflow

1. The side panel reads the active Base44 project ID and stores the active tab ID with each queued job.
2. The extension asks the active page to call the current project-code endpoint using the user's existing session. It does not transmit the token to another origin.
3. Returned files are converted into Blob payloads and staged in IndexedDB, with per-file CRC-32 and (for files up to 128 MiB) SHA-256 values.
4. The offscreen document reads staged Blob entries and assembles ZIP64 local records, a ZIP64 central directory, ZIP64 end-of-central-directory record, locator and classic EOCD sentinel.
5. The service worker hands the offscreen Blob URL to Chrome Downloads and records completion or interruption.

The Base44 endpoint currently returns the project payload as one JSON response. ZIP64 assembly and local staging are designed to avoid a single 4 GiB archive byte array, but this does **not** claim streaming network ingestion from Base44. Very large source responses can still be constrained by the platform response size, browser memory, IndexedDB quota and Chrome's download implementation.

## Persistent jobs and recovery

- Job records and staged files live in IndexedDB, not service-worker globals.
- Chrome alarms wake the worker to recover queued or interrupted fetch/staging/packaging jobs.
- A fetch or staging job interrupted by worker shutdown is re-fetched and staged again; partially staged entries are replaced, not silently treated as complete.
- A packaging job can be rebuilt from staged IndexedDB entries.
- Closing the side panel does not cancel a job.
- A user-cancelled job is marked cancelled and its staged files are removed.
- A completed download removes temporary staged payloads. The downloaded archive is the durable backup.

## Restore centre

No documented Base44 project write/import API was verified for this release. The Restore centre therefore provides a runbook and an explicit adapter contract, but does not send write requests to undocumented endpoints. A future adapter must implement documented authentication, project targeting, preview/dry-run, explicit user confirmation, conflict/idempotency handling and post-restore verification.

## Classic editor recovery

Open **Tools → Classic editor recovery** to access the earlier visible-editor workflow, including diagnostics, file-tree scanning and path-based source recovery. This path is best-effort and reads rendered editor text; it cannot guarantee binary assets, exact encodings or unloaded files. Its legacy ZIP writer is limited to smaller exports; use the main side-panel ZIP64 pipeline for direct project exports.

## Archive contents

- `BASE44-EXPORT-MANIFEST.json` — path, size, CRC-32 and available SHA-256 values.
- `SHA256SUMS.txt` — SHA-256 list for files up to 128 MiB.
- `EXPORT-README.md` — project and integrity notes.
- `EXPORT-VERIFICATION-REPORT.json` — ZIP64 end-record and central-directory preflight results.
- `BASE44-RECOVERY-REPORT.json`, `PROJECT-STRUCTURE.md`, `MISSING-FILES-REPORT.md`, `DEPENDENCY-RECOVERY.md`, `REACT-TYPESCRIPT-RECOVERY.md` and `REPAIR-PLAN.md` — static reconstruction diagnostics.
- `RESTORE-ADAPTER-STATUS.md` — restore capability and safety boundary.
- `PROJECT-VERSION-COMPARISON.md` — added, changed, removed and unchanged files versus the last successful backup.

The classic recovery workflow can also add project structure, dependency, missing-reference, React/TypeScript and repair-plan reports.

## Development and tests

Requires Node.js 20+ for repository checks; Chrome 120+ for the extension.

```sh
npm run check
npm test
```

The ZIP64 test creates an archive with ZIP64 end records. On Linux/macOS, validate the fixture with:

```sh
unzip -t /tmp/base44-toolkit-zip64-test.zip
```

## Limitations and security

- The current Base44 project-code endpoint is an implementation detail, not a stable public export contract. Base44 may change it.
- The direct API response is currently materialised as JSON before individual files are staged.
- The extension can only export files returned by the authenticated workspace. It cannot recover hidden or server-side-only project data, database records, secrets, environment variables or inaccessible assets.
- Static source and asset recovery is not proof of a reproducible build. Run the project's own install, type-check, test and production build steps.
- ZIP64 uses store-only entries (no compression) to avoid CPU and memory spikes and preserve byte payloads.
- SHA-256 is omitted for an individual file larger than 128 MiB; CRC-32 is still calculated for archive integrity but is not a cryptographic authenticity guarantee.
- Local IndexedDB data is browser-profile storage and may be cleared if the extension is removed or site data is manually cleared. Keep downloaded backups elsewhere.
- Only export projects you own or are authorised to access. Review archives before sharing them.

## Permissions

`activeTab`, `scripting`, and the Base44 host permission support the authenticated page request. `downloads` saves archives. `offscreen` creates a Blob-backed archive without a visible tab. `alarms` recovers queued work. `sidePanel` provides the workspace UI. `storage` stores preferences and `unlimitedStorage` allows IndexedDB staging to use the browser's available extension storage quota; actual disk availability still applies.

## Community

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [SECURITY.md](SECURITY.md), [SUPPORT.md](SUPPORT.md), and the GitHub issue templates.
