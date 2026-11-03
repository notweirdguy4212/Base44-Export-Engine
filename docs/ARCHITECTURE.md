# Architecture — Base44 Toolkit 4.0.0

## Runtime contexts

- `sidepanel.html` / `sidepanel.js`: operator interface, project selection, queue controls and job monitor.
- `background.js`: Manifest V3 module service worker. It coordinates jobs and Chrome Downloads; it is intentionally restartable.
- `lib/database.js`: IndexedDB schema for durable job records and file Blob staging.
- `offscreen/offscreen.html` / `offscreen.js`: hidden document that can create Blob URLs and assemble the archive.
- `lib/zip64.js`: store-only ZIP64 encoder using 64-bit sizes and offsets.
- `classic.html` / `classic.js`: preserved legacy editor-tree recovery workflow.

## Durable job model

A job record contains its ID, project ID, active tab ID, state, stage, progress, byte/file counters, lease expiry, download ID and timestamps. Staged file records use the compound key `[jobId, path]` and hold Blob payloads, byte size, CRC-32 and an optional SHA-256 digest. Successful project backups promote a pending inventory into the `snapshots` store; the next export writes an automatic version comparison report. Pending snapshots are committed only after Chrome confirms the download completed.

State transitions:

`queued → fetching → staging → packaging → downloading → completed`

Recoverable failures are marked `failed`; user actions can set `paused` or `cancelled`. If the service worker stops during `fetching` or `staging`, the worker re-requests the project payload and replaces partial staging. If it stops during `packaging`, the archive is rebuilt from the staged IndexedDB entries. The `leaseUntil` field avoids concurrent workers taking the same job after an alarm wake-up.

Chrome alarms are used as a watchdog, not as a promise of continuous execution. MV3 workers can be terminated by Chrome; all durable state therefore lives outside worker globals.

## ZIP64 format

Each entry is written as a stored (method 0), UTF-8 ZIP64 record. The local header uses ZIP64 extra field `0x0001` with 64-bit uncompressed and compressed sizes. The central directory stores 64-bit sizes and local-header offsets. The archive ends with the ZIP64 EOCD record, ZIP64 locator and classic EOCD sentinel values.

The encoder builds a Blob from small header byte arrays and original Blob payloads. It does not concatenate all file bytes into one Uint8Array. This is a Blob-backed archive assembly strategy; it does not make the upstream Base44 JSON endpoint itself streaming.

## Integrity

CRC-32 is calculated incrementally from each Blob stream. SHA-256 uses Web Crypto for individual files up to 128 MiB. Larger files intentionally omit SHA-256 to avoid a full-file `arrayBuffer()` allocation. ZIP CRC validates accidental corruption, not authenticity or malicious tampering.

## Restore boundary

`lib/restore-adapter.js` defines the expected adapter interface. `getRestoreAdapter()` returns `null` in this release because no official Base44 write/import contract is configured. Never replace this with a guessed private endpoint. An eventual adapter must be documented, explicitly enabled, previewable, user-confirmed and independently verifiable.
