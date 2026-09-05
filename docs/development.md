# Local development

## Setup

Use the Node version in [`.nvmrc`](../.nvmrc).

```bash
git clone https://github.com/nickincardone/catan-counter.git
cd catan-counter
nvm use
npm ci
npm run build
```

Then [load the repository as an unpacked extension](getting-started.md#installation).

## Everyday commands

| Command                 | Purpose                                                     |
| :---------------------- | :---------------------------------------------------------- |
| `npm run build`         | Build the extension, popup, page hook, and preview bundles. |
| `npm run watch`         | Rebuild as source changes.                                  |
| `npx tsc --noEmit`      | Check TypeScript types.                                     |
| `npm test`              | Run Jest tests.                                             |
| `npm run test:watch`    | Rerun tests as files change.                                |
| `npm run test:coverage` | Run tests with coverage.                                    |
| `npm run test:ci`       | Run noninteractive coverage checks.                         |
| `npm run format:check`  | Check formatting.                                           |

Format edited files with `npx prettier --write <paths>`. The broader `npm run format` formats the repository; `npm run dev` runs formatting and a build when TypeScript changes.

If Watchman is unavailable in your environment, run:

```bash
npm test -- --watchman=false --runInBand
```

Chrome does not automatically reload an unpacked extension after a build. Reload its extension card and test in a fresh game. Do not refresh a game whose state you need to preserve.

## Preview without a live game

After building, serve the repository locally:

```bash
python3 -m http.server 8777 --bind 127.0.0.1
```

Open [the layout preview](http://127.0.0.1:8777/dev-preview.html) for the simple canvas/chat alignment harness, or [the showcase](http://127.0.0.1:8777/dev-showcase.html) for the README screenshot scene.

Both mount the real gutter shell and sections against a synthetic game from [`src/dev/preview.ts`](../src/dev/preview.ts). The showcase board is illustrative, not a Colonist capture or a reconstruction of that game. Neither preview ships in the extension manifest.

The seed rolls the dice before dealing its main resource batch because the first roll rebuilds the variant tree. It exposes `__catanPreview` for local debugging.

### Updating the README screenshot

Build, open the showcase, and capture the page content without browser chrome. Save it as `docs/images/overview.jpg`. Keep the sample-data caption in the README. Never use identifiable game chat or raw captures in public screenshots.

## Tests and contributions

Tests live in [`src/__tests__/`](../src/__tests__/). They cover parsing, game actions, probability branches, chat recovery, and the UI. Use synthetic or anonymized fixtures. Coverage thresholds in [`jest.config.js`](../jest.config.js) act as a regression ratchet.

Before opening a pull request:

1. Add regression coverage for behavior changes.
2. Run type checks, tests, and a build; include regenerated bundles when source changes.
3. Check formatting and `git diff --check`.
4. Review the staged diff for captured data, credentials, or local-only notes. Follow [`AGENTS.md`](../AGENTS.md).

[Documentation](README.md) · [Architecture](architecture.md)
