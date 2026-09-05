# Public client repository

This repository is intended for public distribution. Keep changes scoped to
the browser extension, local development tools, documentation of shipped client
features, and tests.

- Private services and their implementation plans belong in a separate private
  repository. Do not add them here or describe internal service plans in public
  documentation.
- Keep local planning notes in the ignored `private/` directory. The existing
  `data-collection.md` is also local-only and must remain ignored.
- Keep captured game datasets and raw exports in the ignored `data/` directory.
  Use synthetic or anonymized data for new test fixtures.
- Never commit credentials, populated environment files, or browser/session
  data. Environment examples may contain placeholders only.
- Before committing, review the staged file list and diff. Do not force-add
  ignored files. Ignore rules do not remove files from earlier commits.

Read `docs/development.md` for setup and `docs/architecture.md` for the code map.
Use the Node version in `.nvmrc`.
