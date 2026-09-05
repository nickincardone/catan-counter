# Data & exports

## Local storage

The extension processes game observations in the browser. It saves UI preferences, game chat logs, and replay captures locally using Chrome extension storage. Those records can survive refreshes, closed tabs, and navigation.

Chat logging is independent of the parser, so stored messages can include conversation and events the tracker does not use. A separate page hook captures game WebSocket observations, including protocol data used to decode the board and subsequent building or robber events.

No upload is required to use the counter. Local storage does not make an exported file safe to publish.

## Export options

- **Game logs:** the floating overlay's save control exports the current game. From DevTools in the extension content-script context, `__catanCounter.exportAllGameLogs()` exports stored game logs.
- **Replay captures:** the extension popup provides replay export and clear controls. These are raw debugging captures and are not anonymized game-log exports. Clearing replay captures is not a promise to clear every other log or preference.

Game-log exports replace known player names with placement-order labels such as `Player 1`. They scrub known names from chat, HTML, spatial state, and decodable MessagePack, and omit opaque binary payloads. This is not a complete privacy guarantee: other account metadata or identifying conversation can remain. Raw replay exports can include original usernames and messages.

Review and sanitize any export before sharing it. Keep captured datasets in the ignored `data/` directory; public fixtures and screenshots should use synthetic or anonymized data.

## Formats and limits

Resumable game logs use schema v5; downloaded game-log exports use schema v6. Older stored logs are upgraded in memory. These schema versions do not describe the separate raw replay format.

Game-log records include timestamps, ordered messages, bounded transport captures, and normalized spatial state when decoding succeeds. Spatial state contains terrain, number tokens, ports, corners, edges, player colors, robber position, and ordered building/robber events. The normalized chat distinguishes conversation, trade offers, game events, system messages, and separators.

The game-log transport proof of concept caps each payload at 256 KiB and each game's captures at 20,000 entries or approximately 50 MB of encoded payloads. WebSocket URL query strings and fragments are removed before persistence. Capture limits and protocol changes can leave incomplete spatial data.

For precise types and current behavior, use [`src/messageLogger.ts`](../src/messageLogger.ts) and [`src/transportCapture.ts`](../src/transportCapture.ts) rather than copying a large JSON example from documentation.

[Documentation](README.md) · [Architecture](architecture.md)
