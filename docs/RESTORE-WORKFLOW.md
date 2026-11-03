# Restore workflow and adapter contract

## Current release

Base44 Toolkit 4.0.0 creates portable ZIP64 backups and a restore runbook. It does not automatically write files into a Base44 project because no supported Base44 write/import interface has been verified for this release.

## Safe manual restore

1. Keep an untouched copy of the exported ZIP64 archive.
2. Validate the archive using a ZIP64-capable utility.
3. Review `BASE44-EXPORT-MANIFEST.json`, `SHA256SUMS.txt` and the recovery reports.
4. Use an official Base44 import/restore workflow if the platform provides one for the target project.
5. Resolve conflicts deliberately; do not overwrite a live project without a separate backup and preview.
6. Verify the restored file inventory and run dependency installation, type checks, tests and a production build.

## Future adapter requirements

An adapter may only be registered after the platform exposes a documented, supported import/write contract. It must provide:

- capability discovery and API version identification;
- authenticated project targeting without exporting session tokens;
- a dry-run/preview listing every file to create, replace or delete;
- explicit user confirmation immediately before writes;
- conflict detection and idempotency or resumable operation IDs;
- bounded batches, retry semantics and cancellation;
- a post-restore read-back verification report;
- audit records that never include secrets or access tokens.

`lib/restore-adapter.js` defines the interface but intentionally returns no active adapter. The UI must remain read-only until all requirements above can be implemented against official documentation.
