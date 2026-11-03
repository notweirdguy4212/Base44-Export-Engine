# Security policy

## Supported versions

Security fixes are applied to the latest release. Older versions may not receive updates.

## Reporting a vulnerability

Please do not open a public issue for a suspected security vulnerability. Contact the project maintainer through the private security reporting feature of the hosting platform, if enabled, or arrange a private disclosure with the maintainer before sharing technical details.

Include the affected version, browser version, impact and a minimal reproduction. Do not include live tokens, cookies, private project exports or personal information.

## Security principles

- Keep host permissions scoped to `https://app.base44.com/*`.
- Never log or export authentication token values.
- Do not transmit project source to external services.
- Validate archive paths and avoid path traversal.
- Treat project source and page content as untrusted input.
