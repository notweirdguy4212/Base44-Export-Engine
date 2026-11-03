# Contributing

Thanks for considering a contribution. The goal is to keep Base44 Toolkit useful, understandable and honest about what it can recover.

## Development setup

1. Use a current Chrome or Chromium browser.
2. Open `chrome://extensions`, enable Developer mode and load this directory unpacked.
3. After editing files, use the extension's reload control and reopen the side panel.
4. Run `npm run check` and `npm test` before submitting changes.

There is no build step or package install required for the extension itself.

## Pull requests

- Keep changes focused and explain the user-facing problem they solve.
- Describe the Base44 page state and browser version used for testing.
- Include before/after screenshots for interface changes.
- Add or update tests for pure logic and repository checks.
- Update `CHANGELOG.md` and relevant documentation.
- Do not commit exported projects, credentials, cookies, session tokens or customer data.
- Do not add remote telemetry or third-party upload services without an explicit privacy review.

## Recovery correctness

Treat Base44 endpoints and editor DOM as unstable integration points. Prefer clear failure reports over silent assumptions. Never claim a file is restored, complete or verified unless the implementation has actually established that fact. Static scans should label uncertain findings as candidates.

## Commit style

Use short, imperative commit subjects, for example: `Add checksum comparison report`.

## Translations

English is the canonical documentation. Translations live under `l10n/<language-code>/`. Keep feature names, warnings and limitations aligned with the English source.
