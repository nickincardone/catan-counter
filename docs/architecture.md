# Architecture

Catan Counter is a TypeScript Chrome extension bundled with Rollup. Its content script parses chat, updates shared game state, and renders one of two interfaces.

## Code map

| Area                          | Entry points                                                                                               |
| :---------------------------- | :--------------------------------------------------------------------------------------------------------- |
| Startup and observation       | [`src/content.ts`](../src/content.ts)                                                                      |
| Chat parsing and DOM helpers  | [`src/chatParser.ts`](../src/chatParser.ts), [`src/domUtils.ts`](../src/domUtils.ts)                       |
| Game state and actions        | [`src/gameState.ts`](../src/gameState.ts), [`src/gameActions.ts`](../src/gameActions.ts)                   |
| Probability orchestration     | [`src/probableGameState.ts`](../src/probableGameState.ts)                                                  |
| Variant tree and transactions | [`src/variants.ts`](../src/variants.ts), [`src/variantTransactions.ts`](../src/variantTransactions.ts)     |
| UI routing                    | [`src/ui/index.ts`](../src/ui/index.ts)                                                                    |
| Gutter shell and sections     | [`src/ui/shell/`](../src/ui/shell/), [`src/ui/sections/`](../src/ui/sections/)                             |
| Floating overlay              | [`src/overlay.ts`](../src/overlay.ts)                                                                      |
| Page-world integration        | [`src/pageTransportHook.ts`](../src/pageTransportHook.ts), [`src/pageViewport.ts`](../src/pageViewport.ts) |
| Capture bridge and local logs | [`src/transportCapture.ts`](../src/transportCapture.ts), [`src/messageLogger.ts`](../src/messageLogger.ts) |

## Page and extension worlds

The manifest starts a small hook in the page's main world and the content script in Chrome's isolated extension world. The hook observes WebSocket traffic and exchanges validated messages with the extension; it does not call extension APIs directly.

For gutters, the hook reports a reduced viewport so Colonist recomputes its own layout. The shell positions the game in the remaining area. This is a layout change, not a scaled screenshot: the board and its click targets stay aligned.

The gutter interface lives in a shadow root to isolate its styles. Sections read a shared view model and render inside their assigned boxes; placement is configuration. The UI router switches between this shell and the floating overlay.

## Chat recovery

Colonist's virtual scroller only keeps a small portion of chat in the DOM. On startup or reconnect, recovery scans with an independent cursor and observes rows as their contents arrive, including turn separators.

Before parsing recovered history, the extension verifies every index from zero through the observed tail. Automatic jumps to the newest message must not advance the recovery cursor past unread history. After three unsuccessful scans, it displays an incomplete-history warning instead of treating partial counts as complete.

Live observation also handles content changes in recycled rows. Regression tests cover missing middle ranges and delayed row content as well as complete-history recovery.

## Design notes

These preserve implementation history and may contain superseded assumptions; they are not the current user guide:

- [Variant-system debugging notes](notes/variant-system.md)
- [Gutter UI design notes](notes/gutter-redesign.md)

[Documentation](README.md) · [Local development](development.md) · [How tracking works](tracking.md)
