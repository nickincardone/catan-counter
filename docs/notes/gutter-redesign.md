# Catan Counter — V2 "Gutter" UI Redesign

Historical design notes for the shipped gutter interface. Some launch assumptions
are superseded; use the [user guide](../getting-started.md) for current behavior
and [architecture guide](../architecture.md) for the implementation map.
Source paths below are relative to the repository root.

## Purpose

Add a second, opt-in user interface ("v2") that lives in the **gutters** around a
shrunken colonist.io page, instead of floating on top of it as v1 does. The
existing overlay ("v1") stays fully functional and shipping; the user picks a
mode from an extension popup.

The redesign's second goal, equal in weight to the visual one: every block of the
UI becomes an **independent section** that knows nothing about where it is
rendered. Moving the dice chart from the bottom gutter to the left rail should
later be a change to one config value, not a rewrite. Drag-and-drop
rearrangement is explicitly **not** built now — only the seams that make it cheap
later.

Reference mockup: `Left Gutter Counter (standalone) (1).html` (Downloads). All
sizes, colors and copy below are read out of that file's template and component
logic, not eyeballed from the screenshot.

---

## Locked decisions

These were decided up front and the plan assumes them. Changing one changes work
downstream, so they're recorded here rather than buried in a phase.

| #   | Decision                                                         | Choice                                                                                                                                      |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | How the colonist page shrinks                                    | **Squeeze the layout** — give the page real margins so colonist re-lays out at a smaller viewport. Not `transform: scale`.                  |
| 2   | v1/v2 switching                                                  | **Extension toolbar popup** (new surface — there is no `action` today). Persisted in `chrome.storage`, applied live without reload.         |
| 3   | Gutters at launch                                                | **Left + bottom render content; all four (left/right/top/bottom) are first-class in the layout engine.** Empty gutters collapse to zero.    |
| 4   | Per-player VP / knights / buildings (tracked but never rendered) | **New `players` section, registered but unplaced by default.** It exists to prove the section system handles more than the mocked four.     |
| 5   | Rail header "T14 · 88% CERTAIN"                                  | **Dropped for now.** Turn count isn't tracked and the certainty number needs a definition first. Header is logo + title + collapse chevron. |
| 6   | Dev deck caption                                                 | **Who played it / how many played** — attribution from `player.discoveryCards`, `"N unseen"` for never-revealed types.                      |
| 7   | Unknown-steal resolution                                         | **Inline chips + UNDO.** Replaces v1's modal in v2. Undo needs a new tracker capability (§6.1).                                             |
| 8   | Fonts                                                            | **Bundle Manrope + JetBrains Mono woff2** as web-accessible resources. No dependence on colonist's CSP.                                     |
| 9   | Collapse / resize                                                | Chevron collapses the rail to a **~28px strip** (page reclaims the space); inner edge is a **drag handle** to resize, 280–420px, persisted. |

---

## 1. What exists today

### 1.1 v1 UI inventory

`src/overlay.ts` (~1000 lines) is one module doing everything: a fixed
`position: fixed` white panel at top-right, 450px wide, drag/resize/minimize,
and content produced as **HTML strings concatenated into `innerHTML`** on every
update. It renders exactly five things:

| v1 block                   | Function                               | Notes                                                                                      |
| -------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| Resource probability table | `generateResourceProbabilityTable()`   | Per-player 5 resources, `min` + `+prob`; header shows bank left (mislabeled `cardsInPlay`) |
| Unknown transactions       | `generateUnknownTransactionsDisplay()` | List + click → **modal** (`showTransactionResolutionModal`)                                |
| Dev cards remaining        | `generateDevCardsDisplay()`            | Global deck only, `left/total` per type                                                    |
| Dice chart                 | `generateDiceChart()`                  | Bars, no expected-rate marker                                                              |
| Blocked by robber          | `generateBlockedDiceDisplay()`         | Dice number + resource + count                                                             |

Plus two pieces of chrome that v2 must also provide: the **history-loading
spinner** (`setHistoryLoading`) and the **"which player are you?" dialog**
(`showYouPlayerDialog`, called from `gameActions.ts`).

### 1.2 Public surface other modules depend on

Only three modules import the overlay, which keeps the v1/v2 routing change tiny:

```
src/chatParser.ts  → updateGameStateDisplay
src/content.ts     → showGameStateOverlay, setHistoryLoading, updateGameStateDisplay
src/gameActions.ts → showYouPlayerDialog
```

### 1.3 Data already available (mockup field → real source)

Almost everything the mockup shows already exists in state. Marked **NEW** where
it does not.

| Mockup field                           | Source                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| bank left `19/19`                      | `game.gameResources[res]` (bank remaining, starts 19) / 19                                  |
| player known counts                    | `probableGameState.getPlayerResourceProbabilities(name).minimumResources`                   |
| player `+50%` fractions                | `…​.additionalResourceProbabilities`                                                        |
| row summary `5 known`                  | sum of `minimumResources`                                                                   |
| player color                           | `player.color`                                                                              |
| steal list                             | `probableGameState.getUnknownTransactions()`                                                |
| steal candidate chips + %              | `probableGameState.getTransactionResourceProbabilities(id)`                                 |
| steal timestamp                        | `UnknownTransaction.timestamp`                                                              |
| resolve a steal                        | `probableGameState.resolveUnknownTransaction(id, res)`                                      |
| **undo a resolution**                  | **NEW** — §6.1                                                                              |
| dice counts                            | `game.diceRolls`                                                                            |
| dice expected-rate tick                | **NEW (view-model math only)** — `total × odds(n)/36`                                       |
| blocked by robber                      | `game.blockedDiceRolls`                                                                     |
| dev deck left/total                    | `game.knights` / `monopolies` / `roadBuilders` / `yearOfPlenties` / `victoryPoints`         |
| **dev caption "emipaco" / "2 played"** | **NEW (derivation only)** — `player.discoveryCards.*` already counts plays per player; §6.2 |
| players section (VP/knights/buildings) | `player.victoryPoints`, `.knights`, `.settlements`, `.cities`, `.roads`                     |
| header turn / certainty                | dropped (decision 5)                                                                        |

**Nothing in the mockup requires new game-logic parsing.** The only genuinely new
tracker behavior is undo (§6.1). Everything else is presentation or arithmetic
over data the tracker already produces.

---

## 2. Target layout

```
┌──────────┬──────────────────────────────────────────────┐
│          │                                              │
│  LEFT    │            colonist.io page                  │
│  RAIL    │      (squeezed, still fully interactive)      │
│  365px   │                                              │
│          │                                              │
│ hands    │                                              │
│ steals   │                                              │
│ blocked  │                                              │
│          ├───────────────────────┬──────────────────────┤
│          │  dice (1fr)           │  dev deck (1fr)      │  210px
└──────────┴───────────────────────┴──────────────────────┘
```

- Left rail: `365px` default, resizable `280–420`, collapses to `28px`.
- Bottom bar: `210px`, split into two equal halves.
- Right and top gutters: supported by the engine, `0px` and empty by default.
- Rail body scrolls (`overflow-y: auto`); the header is pinned.

### 2.1 Design tokens (extracted from the mockup)

The palette was revised after the first build (second mockup): the navy panel
became a neutral dark, the accent moved from yellow to amber, **every** section
label is now the accent colour rather than only Unknown steals, and the type is
a couple of steps larger throughout.

```ts
// src/ui/shell/theme.ts
export const THEME = {
  panel: '#16181c', // rail + bottom bar background
  hairline: 'rgba(255,255,255,.09)',
  surface: 'rgba(255,255,255,.05)', // cards, rows, dev tiles
  surfaceEmpty: 'rgba(255,255,255,.02)', // a zero resource cell
  accent: '#e8a33d', // logo, every section label, ×N counts
  good: '#5ec8a0', // hot dice, untouched dev pile, confirmed
  goodText: '#8fe0c4',
  probable: '#6fdcae', // fractions, which sit on a resource tint
  danger: '#e35b5b', // the 7 bar
  bar: '#5b6775', // normal dice bar
  text: '#ffffff',
  textBody: '#eef1f4',
  textMuted: '#c3ccd4',
  labelDim: '#8a939d', // right-hand hints ("bank left")
  monoDim: '#949da6',
  zero: '#4b5158', // a 0 that isn't real
  well: '#24272d', // circle behind a blocked dice number
  chevron: '#b9c2cc',
} as const;

export const RESOURCE_STYLE = {
  tree: { color: '#3f8f2f', tint: 'rgba(63,143,47,.22)' },
  brick: { color: '#cf5b32', tint: 'rgba(207,91,50,.22)' },
  sheep: { color: '#8dc63f', tint: 'rgba(141,198,63,.22)' },
  wheat: { color: '#e8b23a', tint: 'rgba(232,178,58,.22)' },
  ore: { color: '#9aa8ae', tint: 'rgba(154,168,174,.22)' },
} as const;
```

Typography: **Manrope** 800 for names and titles; **JetBrains Mono** for every
number, label and timestamp. Section labels are `11px`, `letter-spacing: .14em`,
uppercase. Resource card images render `22×31` in the bank row, `12×17` in steal
chips, dev cards `26×35`.

### 2.2 Section-by-section spec

Order in the rail is top-to-bottom as listed.

**`hands`** (left rail)

- Header row: `HANDS` / `bank left`.
- Bank row: grid `76px repeat(5, 1fr)`, each resource its card image with bank
  remaining beneath in mono 8px.
- One card per player, `border-left: 3px solid <player color>`, name in the
  player's color, `N known` on the right.
- 5 cells per player: big mono number (white if > 0, `zero` color if 0), and
  beneath it the `+NN%` fraction in `good` when probable holdings exist. Cell
  background is the resource tint when the player has or might have it, else
  `surfaceEmpty`; `border-top: 3px solid <resource color>`.
- Footer copy: "Solid numbers are guaranteed. Green fractions are probable
  holdings from unresolved steals."

**`unknown-steals`** (left rail)

- Header: `UNKNOWN STEALS · N` / `click to resolve`. (Every section label is
  the accent colour now, so this one is no longer distinguished.)
- Per steal: `<thief> stole from <victim>` with both names in player colors, a
  timestamp on the right, then candidate chips sorted by descending probability:
  resource icon + `wheat 50%`.
- Click a chip → resolve. A resolved card switches to teal border/background, one
  chip reading `wheat · confirmed`, and an `UNDO` affordance.

**`blocked-robber`** (left rail)

- Header: `BLOCKED BY ROBBER` / `N DENIED`.
- Rows: dice number in a circle, resource icon, `×N` in accent.

**`dice`** (bottom, half the bar)

- Header: `DICE · N ROLLS` / `white tick = expected rate`.
- Bars scaled to the max count; a 1px white line at the expected rate
  (`total × odds/36`) so over/under-performance is visible at a glance.
- Bar color: `danger` for 7, `good` when `count > expected × 1.3`, else `bar`.
- Number labels below.

**`dev-deck`** (bottom, half the bar)

- Header: `DEV DECK · N LEFT` / `left / total`.
- 5 equal tiles: card image, `left/total`, name, a progress bar, and the
  attribution caption (§6.2).

**`players`** (registered, unplaced — decision 4)

- Per player: VP, knights played, settlements/cities/roads remaining.

---

## 3. Architecture

### 3.1 Layering

```
game state  →  GameView (pure data)  →  sections (pure DOM)  →  shell (placement)
                     ▲                        ▲                      ▲
              testable in jsdom        testable in jsdom      testable in jsdom
              with no chrome APIs      with a fake view       with a fake registry
```

The **view model** is what makes sections independent. A section receives a
plain-data `GameView` and emits actions; it never imports `gameState`,
`probableGameState`, or `chrome`. That is what lets a section be mounted into any
gutter, rendered in a test, or later dragged somewhere else.

### 3.2 The view model

```ts
// src/ui/view/types.ts
export interface GameView {
  players: PlayerView[];
  bank: Record<ResourceKey, { left: number; total: number }>;
  steals: StealView[];
  blocked: BlockedView[];
  dice: DiceView; // counts, expected rates, total
  devDeck: DevDeckView; // per type: left, total, caption
  youPlayerName: string | null;
  isLoadingHistory: boolean;
}
```

`buildGameView(game): GameView` in `src/ui/view/gameView.ts` is a **pure
function** — same input, same output, no DOM, no chrome. All the mockup's derived
math (bar heights, expected-rate tick position, chip sort order, `N known`,
bank ratios, dev captions) lives here, and is unit tested directly.

### 3.3 The section contract

```ts
// src/ui/sections/types.ts
export type SectionId =
  | 'hands'
  | 'unknown-steals'
  | 'blocked-robber'
  | 'dice'
  | 'dev-deck'
  | 'players';

export type GutterAxis = 'vertical' | 'horizontal';

export interface SectionContext {
  /** Dispatch a user intent. The shell owns what actually happens. */
  emit(action: SectionAction): void;
}

export interface SectionInstance {
  update(view: GameView): void;
  destroy(): void;
}

export interface SectionDefinition {
  id: SectionId;
  title: string;
  /** Which gutter shapes this section can render into. */
  supports: GutterAxis[];
  /** Refuse to place it somewhere it can't be read. */
  min: { width: number; height: number };
  mount(
    host: HTMLElement,
    view: GameView,
    ctx: SectionContext
  ): SectionInstance;
}
```

Rules that keep sections movable:

1. A section renders **only inside the `host` element it is handed**. No
   `document.body`, no `position: fixed`, no ids — class names are scoped inside
   the shadow root.
2. A section never reads its own position. If it must adapt to shape, it reads
   `supports`/host size, not "am I in the left rail".
3. Interaction is **event delegation on `host`** with `data-*` attributes, so a
   full re-render never orphans a handler.
4. All mutation goes out through `ctx.emit(...)`; sections never call the tracker.

```ts
export type SectionAction =
  | { type: 'resolve-steal'; id: string; resource: ResourceKey }
  | { type: 'undo-steal'; id: string };
```

### 3.4 Layout config (the part that makes moving cheap)

```ts
// src/ui/shell/layoutStore.ts
export interface Placement {
  id: SectionId;
  weight?: number;
}
export interface GutterConfig {
  size: number; // px along the gutter's thickness
  collapsed: boolean;
  sections: Placement[];
}
export interface V2Layout {
  version: 1;
  left: GutterConfig;
  right: GutterConfig;
  top: GutterConfig;
  bottom: GutterConfig;
}

export const DEFAULT_LAYOUT: V2Layout = {
  version: 1,
  left: {
    size: 290,
    collapsed: false,
    sections: [
      { id: 'hands' },
      { id: 'unknown-steals' },
      { id: 'blocked-robber' },
    ],
  },
  bottom: {
    size: 176,
    collapsed: false,
    sections: [
      { id: 'dice', weight: 1.6 },
      { id: 'dev-deck', weight: 1 },
    ],
  },
  right: { size: 0, collapsed: true, sections: [] },
  top: { size: 0, collapsed: true, sections: [] },
};
```

Moving the dice chart to the left rail later is: delete it from `bottom.sections`,
append to `left.sections`. Nothing else changes. Persisted to
`chrome.storage.local` under `catanUiLayout`, versioned, falling back to
`DEFAULT_LAYOUT` on any mismatch.

### 3.5 Style isolation — Shadow DOM

The v2 shell mounts into a single host element attached to `documentElement`,
with `attachShadow({ mode: 'open' })`. All v2 CSS is a single `<style>` inside
that root.

This matters more than usual here: v1 fights colonist's styles by inlining every
rule on every element (which is why `overlay.ts` is a wall of `style="…"`
strings). A shadow root removes that entirely — v2 gets to use real class names
and a real stylesheet, colonist's CSS can't leak in, and v2's can't leak out. It
also means a section's markup stays readable, which is a precondition for six
sections being maintainable.

Font faces are declared inside the shadow root via
`@font-face { src: url(chrome.runtime.getURL('assets/fonts/…')) }`.

### 3.6 Squeezing the page

`src/ui/shell/pageFrame.ts` owns every mutation of colonist's own DOM, so
teardown is exact. Written against the Phase 0 findings above.

```ts
applyPageFrame({ left, right, top, bottom }: Insets): void
releasePageFrame(): void
```

Implementation:

- **Viewport lie** (MAIN world): redefine `window.innerWidth`/`innerHeight` to
  report the space left over after the gutters, then dispatch a `resize` event so
  colonist re-lays out. This is the mechanism proven in Phase 0.
- **Shift** (ISOLATED world is fine — it's just a stylesheet): one injected rule
  setting the CSS `translate` property on `body`'s direct children by the left/top
  insets. Never touch `transform`, which colonist uses for centering.
- **Pin, don't iterate** (revised in Phase 8 against a live game): the inset
  frees exactly what it asks for, but colonist _centers_ its layers, so half the
  freed space lands above the game and half below — asking for a 176px bottom
  gutter leaves 88px at each end. Measuring the content and shifting it up so it
  sits at the top inset moves the wasted top gap down to where the gutter
  actually is, and is exact in one pass. The shift is cleared before each
  measurement rather than compensated for, so repeated calls land identically.
- Debounce during a rail drag; fire once on release.
- `releasePageFrame()` deletes the property overrides (restoring the native
  getters), removes the stylesheet, and dispatches a final `resize` so colonist
  returns to full size. Switching v2 → v1 must leave zero residue.
- **Guard**: if the remaining page width would drop below `MIN_PAGE_WIDTH`,
  auto-collapse gutters instead of squeezing further, and say so in the rail
  rather than silently shrinking the game.

Because the lie is global, anything on the page reading `innerWidth` sees it
(colonist's own code, ad scripts). That is the point — but it is also the single
most invasive thing v2 does, and the reason `releasePageFrame()` has to be exact.

Two extension behaviors depend on colonist's DOM and must be re-verified after
squeezing, because both are load-bearing:

- the **chat virtual scroller** — the history sweep in `content.ts` reads
  `scrollTop`/`scrollHeight` live and re-sweeps, so a shorter viewport means more
  steps but should still converge;
- the **`[data-player-information-container]` panel** — `pruneByHandCounts()`
  reads hand sizes from it. If a narrower layout hides or restructures it, exact
  post-monopoly resolution silently degrades.

### 3.7 Mode routing

Introduce `src/ui/index.ts` exporting the same four names the rest of the code
already imports (`showGameStateOverlay`, `updateGameStateDisplay`,
`setHistoryLoading`, `showYouPlayerDialog`), each routing to the active mode.
`overlay.ts` is **not modified** — it becomes the v1 implementation behind the
router. The only edits elsewhere are three import paths.

```ts
let mode: UiMode = 'v1';
export function setUiMode(next: UiMode): void {
  // teardown old, mount new
  if (next === mode) return;
  mode === 'v1' ? v1.hideGameStateOverlay() : v2.unmount();
  mode = next;
  mode === 'v1' ? v1.showGameStateOverlay() : v2.mount();
}
```

`chrome.storage.onChanged` on `catanUiMode` calls `setUiMode`, so the popup
switch applies live to an in-progress game with no reload — important, because
reloading colonist mid-game hands your seat to a bot.

---

## 4. New files

```
src/ui/
  index.ts                  mode router; the only thing other modules import
  uiMode.ts                 storage read/write + change subscription
  view/
    types.ts                GameView and friends
    gameView.ts             buildGameView(game) — pure
  shell/
    theme.ts                tokens from §2.1
    styles.ts               the shadow-root stylesheet
    pageFrame.ts            squeeze/release colonist's layout
    layoutStore.ts          V2Layout, defaults, persistence, migration
    gutters.ts              build the four gutters, place sections, weights
    shell.ts                mount/unmount, shadow root, header, collapse, resize
  sections/
    types.ts                SectionDefinition / SectionInstance / SectionAction
    registry.ts             id → definition
    hands.ts
    unknownSteals.ts
    blockedRobber.ts
    dice.ts
    devDeck.ts
    players.ts
  v2.ts                     mount()/unmount()/update() for the v2 mode
src/popup/
  popup.html
  popup.ts
assets/fonts/
  nunito-*.woff2  ibm-plex-mono-*.woff2
```

Changed: `manifest.json` (action + popup, fonts in `web_accessible_resources`),
`rollup.config.js` (third bundle for the popup), `src/chatParser.ts`,
`src/content.ts`, `src/gameActions.ts` (import path only),
`src/probableGameState.ts` + `src/variantTransactions.ts` (undo, §6.1),
`README.md`.

---

## 5. Phases

Each phase ends green: `npm test` passes and the extension still loads and tracks
a real game. v1 must keep working at every single step.

### Phase 0 — Spike: does the squeeze survive colonist? ✅ DONE

Run live against a `Play vs. Bots` game (`#white7051`) at 2056×1038. **Result:
the squeeze works, with two corrections to the original plan.**

**How colonist lays itself out.** There is no single "page root" to pad. Colonist
absolutely-positions three sibling layers on `<body>` — `#game-canvas`, a second
unnamed `<canvas>`, and `#ui-game.ui-game-container` — and writes **inline pixel**
`left/top/width/height` on each (canvas backing store at `devicePixelRatio`, so
2× here). Vertical centering is `top: 50%` paired with
`transform: translateY(-50%)`. Padding `<body>` therefore moves nothing.

**Finding 1 — it re-lays out from `window.innerWidth/innerHeight`.** Overriding
those two getters and dispatching a `resize` event produced a genuine re-layout:
canvas `1726×948 → 1436×862`, board, chat, player panel and action bar all
repositioned, **crisp at native resolution, full desktop layout, no mobile
breakpoint** at −290w/−176h. This is the mechanism `pageFrame.ts` will use, from
the MAIN world (the transport hook already runs there).

```ts
Object.defineProperty(window, 'innerWidth', {
  configurable: true,
  get: () => real - inset,
});
window.dispatchEvent(new Event('resize'));
```

**Finding 2 — the freed space lands bottom-RIGHT; shifting needs `translate`,
not `transform`.** Colonist anchors to the top-left, so a narrower viewport frees
space on the right. To put the page in the top-right as designed, body's direct
children are shifted with the **independent CSS `translate` property** — colonist
owns `transform` (the `translateY(-50%)` above) and clobbering it breaks vertical
centering. `translate` is unset and composes cleanly:

```css
body > *:not(#catan-v2-root) {
  translate: 290px 0;
}
```

Verified visually: a clean 290px left gutter, the whole UI intact and shifted,
and colonist's own left ad rail lands just inside the game area rather than under
the rail.

**Finding 3 — the vertical inset lands half above the game.** Lying by −176px
of height appeared to free only ~89px at the bottom. Phase 8 measured this
properly against a live game and found the cause: the inset frees exactly the
space it asks for, but colonist **centers** its layers vertically, so the freed
space is split evenly above and below (88/88 for a 176 request; 132/132 for 264;
154/154 for 308 — always exactly half).

The fix is not to ask for more, which converges only asymptotically, but to
**pin the content to the top**: measure where the content sits and shift it up
by that amount, moving the useless gap above the game down to where the gutter
is. Exact in a single pass, verified live at two different gutter sizes and
idempotent across repeated applications. Horizontal needs no such correction —
colonist reserves its own ad rails, so the game is already narrower than the
width it is given.

**Finding 4 — the extension's DOM dependencies survive.**
`[data-player-information-container]` stays present and visible (341×382), so
hand-count pruning is unaffected, and `findChatContainer()`'s rulebook-anchor
heuristic still resolves in the squeezed layout.

**Exit gate: passed.** The `transform: scale` fallback is not needed.

**Unrelated observation to chase separately:** early in that game there were
**zero `[data-index]` elements on the page** — the chat container held a single
un-indexed message wrapper. `content.ts` keys its whole capture pipeline
(`captureRow`, `MessageOrderBuffer`, the logger's dedup) on `data-index`, so
either colonist only adds the attribute once its virtual scroller engages past
some message count, or this is a real gap in the new UI. Worth confirming in a
longer game; it is not a v2 concern and must not be fixed inside this redesign.

### Phase 1 — Mode plumbing (no visual change)

- `uiMode.ts`, `ui/index.ts` router, three import-path edits.
- Popup: `popup.html` + `popup.ts`, `action` in the manifest, rollup bundle.
- v2 mode mounts a placeholder that just proves switching works both ways.

**Exit gate:** toggling the popup switches modes live mid-game; v1 is
byte-for-byte the same experience it is today; v1 overlay test still passes.

### Phase 2 — View model

- `view/types.ts`, `view/gameView.ts`, with all derived math.
- Unit tests over a fixture game: bank ratios, `N known`, probability fractions,
  chip ordering, dice bar heights and expected-rate tick, dev captions.

**Exit gate:** `buildGameView` is fully covered and imports neither DOM nor
`chrome`.

### Phase 3 — Shell

- Shadow root host, stylesheet, bundled fonts.
- `pageFrame.ts` using Phase 0's findings, with exact restore.
- Four gutters from `V2Layout`; empty ones take zero space.
- Rail header (logo, "Counter", chevron), collapse to 28px, drag-to-resize
  250–380, both persisted.

**Exit gate:** empty gutters render around a correctly squeezed page; collapse
and resize give the space back to colonist; switching to v1 restores the page
exactly.

### Phase 4 — Section framework

- `sections/types.ts`, `registry.ts`, mount/update/destroy lifecycle.
- `gutters.ts` places sections by config, honors `weight`, refuses a placement
  whose `supports`/`min` don't fit and logs why.
- One throwaway section proves mount → update → destroy and delegated events.

**Exit gate:** a test moves a section between gutters **by config alone** and
asserts it renders in the new host. This is the test that protects decision 3 —
if it's ever hard to write, the section boundary has leaked.

### Phase 5 — The sections

In order, each its own commit with its own test: `hands` → `unknown-steals` →
`blocked-robber` → `dice` → `dev-deck` → `players`.

Per section: mount into a detached host with a fixture `GameView`, assert the
rendered numbers/colors/labels, assert emitted actions on click, assert
`update()` with a changed view doesn't leak stale DOM or duplicate handlers.

**Exit gate:** v2 renders the mockup faithfully against a real logged game
(`src/__tests__/gameTransactionLogs/`).

### Phase 6 — Tracker capabilities

- §6.1 undo, wired to the `undo-steal` action.
- §6.2 dev-card attribution captions.

**Exit gate:** resolve → undo → resolve differently produces the same state as
resolving differently the first time. That equivalence is the whole test.

### Phase 7 — Chrome and edge states

- History-loading spinner in the rail (v2 form of `setHistoryLoading`).
- "Which player are you?" dialog rendered inside the shadow root.
- Empty states: no game yet, no steals, no blocked rolls, fewer than 4 players.
- Rail scrolls correctly when content overflows; bottom bar never overflows.

### Phase 8 — Verify and document

- Full `test-change` run on a live bot game in v2 mode: refresh recovery, a
  monopoly, an unknown steal resolved and undone, dice accumulating.
- README section for v2 + the popup; screenshot.
- Consider raising `jest.config.js` coverage thresholds off 0 now that the UI is
  testable (they're currently 0 despite the README claiming 80%).

---

## 6. New tracker capabilities

### 6.1 Undoing a manual resolution

`resolveUnknownTransaction(id, resource)` exists; there is no inverse, and adding
one by mutating the variant tree in place is not sound — resolving prunes
branches, and pruned branches can't be resurrected.

**Approach: rebuild by replay.** `PropbableGameState` already keeps
`transactionHistory`. Add:

- a snapshot of the players passed to the constructor;
- a `manualResolutions: Map<string, ResourceKey>` recording operator decisions;
- `unresolveUnknownTransaction(id)`: delete from the map, then rebuild a fresh
  tree by replaying `transactionHistory` and re-applying the surviving manual
  resolutions in their original order.

Properties: undo is exact rather than approximate; it composes with hand-count
pruning (which re-derives from the rebuilt tree); and it's O(history) per undo,
which for a game's worth of transactions is trivially fast and only happens on an
explicit click.

Tests: undo restores the exact pre-resolution distribution; resolve→undo→resolve
differently ≡ resolving differently first; undo of an _auto_-resolved (certainty)
transaction is refused, since that wasn't an operator decision.

### 6.2 Dev-card attribution

No new parsing — `useKnight`/`useMonopoly`/`useRoadBuilding`/`useYearOfPlenty`
already increment `player.discoveryCards.*`. The caption is a fold in
`buildGameView`:

- exactly one player has plays of that type → their name (`"emipaco"`);
- several → `"N played"`;
- none → `"N unseen"` where N is the deck remainder.

Victory points are never played, so VP is always `"N unseen"`.

---

## 7. Testing

| Layer           | How                                                                          |
| --------------- | ---------------------------------------------------------------------------- |
| `buildGameView` | Pure unit tests over fixture games; no DOM                                   |
| Sections        | Mount into a detached host with a fixture view; assert DOM + emitted actions |
| Layout engine   | Place/move/collapse by config; assert hosts and sizes                        |
| `pageFrame`     | Assert insets applied, `resize` dispatched, and **exact** restore on release |
| Undo            | Equivalence tests (§6.1)                                                     |
| v1              | Existing `overlay.test.ts` must keep passing untouched                       |
| End-to-end      | `.agents/skills/test-change` on a live bot game, in both modes               |

jsdom has no layout engine — it reports zero sizes. So assert _structure and
declared styles_ (which host an element is in, what CSS custom properties and
inline sizes were set), never computed geometry. Anything geometric belongs to
the Phase 0/8 live checks.

---

## 8. Risks

| Risk                                                           | Mitigation                                                                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Colonist flips to a mobile-ish layout when squeezed            | Phase 0 spike; `MIN_PAGE_WIDTH` floor with auto-collapse; documented `transform: scale` fallback                                           |
| Squeezing hides `[data-player-information-container]`          | Explicitly verified in Phase 0 — it's what makes post-monopoly resolution exact                                                            |
| Shorter chat viewport slows or breaks the history sweep        | Sweep already reads live scroll position and re-sweeps up to 3×; re-verify in Phase 0                                                      |
| Colonist ships a DOM change that breaks the page-root selector | Isolate the selector in `pageFrame.ts`; on failure, don't squeeze — render gutters as an overlay and warn, rather than corrupting the page |
| Shadow DOM + `chrome.runtime.getURL` fonts blocked by CSP      | Fonts are extension-origin web-accessible resources; verify in Phase 3 and fall back to the system stack                                   |
| Two UIs drift apart                                            | Both consume the same `GameView`; new derived math lands in the view model, never in a renderer                                            |
| Scope creep into drag-and-drop                                 | Explicitly out of scope; the Phase 4 config-move test is the substitute                                                                    |

---

## 9. Out of scope

Drag-and-drop section rearrangement; a section-visibility settings panel; theming
beyond the mockup's palette; touch/mobile layouts; rendering anything from the
spatial board capture (the decoded board is a separate future surface); porting
v1 to the new architecture. v1 stays exactly as it is.

---

## 10. Decisions taken while building

Judgement calls made without you, recorded for review. Each says what was chosen
and what it costs, so any can be reversed cheaply. Nothing here is load-bearing
enough that changing it would mean starting over.

**1. The viewport override rides the existing main-world hook.**
Colonist's layout reads `window.innerWidth/innerHeight`, which the isolated
world cannot change, so the override has to run in the page's own world. Rather
than injecting a second script, `pageViewport.ts` is imported by the transport
hook and takes commands over the bridge that already existed. One injection, one
protocol. The cost: the transport hook now has a second responsibility, and the
override is global — anything on the page reading `innerWidth` sees the smaller
number, ad scripts included. That is inherent to the approach, and the reason
`releasePageFrame()` restores the native getters exactly.

**2. The tracker's undo works by replay, and transaction ids lost their clock.**
Resolving a steal prunes branches, and pruned branches cannot be resurrected, so
undo rebuilds the tree from the transaction history. That required transaction
ids to stop embedding `Date.now()`, since a rebuild would otherwise mint new ids
for the same steals. Ids are now `stealer_victim_counter`, still unique within a
processor. Nothing persists these ids — they are not in the game logs — so the
change is safe, but it is a change to a shared type's contract.

**3. Hand-count pruning is deliberately not replayed.**
It comes from reading colonist's player panel rather than from the chat, so
immediately after an undo the tree holds only what the chat proves. The next
message re-applies it. The alternative — recording panel readings and replaying
them — would make undo depend on remembered observations of a live DOM, which
seemed worse than a brief, self-correcting loss of precision.

**4. Steals resolved by the tracker itself are retired from the list.**
Only steals still open, or resolved by a person, are listed. Otherwise every
steal ever taken would accumulate in the rail forever. It does mean there is no
UI trace of an auto-resolution after the fact.

**5. The gutters show a status instead of the tables in two situations.**
During a history replay, and before the first dice roll. Both are moments when
the numbers are about to be thrown away — the first roll deliberately rebuilds
the variant tree — so showing them would be showing fiction. This mirrors what
the overlay already does. Consequence: for the first minute of a game, v2 is a
status line rather than a UI.

**6. The seat-picker dialog is still v1's.**
"Which player are you?" is a modal rather than a gutter, and the existing one
works in either mode, so v2 delegates to it. It does not match the v2 palette.
Worth a pass if it bothers you.

**7. A development preview ships in the repo.**
`dev-preview.html` plus a fourth rollup bundle render the real shell and sections
against a seeded game, so the UI can be worked on without a live match. It is how
most of this was checked. Nothing in `manifest.json` references it, but the built
`dev-preview.js` does sit in the extension folder. Say the word and it can move
behind a separate build script.

**8. Coverage thresholds were raised from 0 to just under where the suite sits.**
They were `0` across the board while the README claimed 80%. They are now a
ratchet (70/60/70/70) so coverage cannot regress silently, and the README no
longer claims a target nothing enforces.

**9. `tsconfig` moved from `module: es6` to `es2020`.**
So tests can use dynamic `import()` to reset the module registry between cases,
which the router tests need because `overlay.ts` caches its node in a
module-level variable. Rollup is unaffected.

**10. The card ledger is recorded in gameActions, not derived.**
RESOURCE_LOSS is emitted for a seven-discard, a dev-card purchase and all three
building types alike, so the transaction history cannot say why cards left a
hand. The ledger is therefore recorded where the chat message's meaning is still
known, and kept on the game object rather than inside the variant tree — the
first dice roll rebuilds that, which would take the whole game's history with
it.

**11. Both card-flow tables balance, and that is a tested invariant.**
`GOT + DEV − ROBD − 7s − SPENT = HAND` per player, and the full ledger's
`GAINED − LOST = HAND`. The design's full ledger did not balance — it had no
build-spend column and folded traded-away cards into a total with no column of
their own — so SPENT and TRDE were added to the LOST band.

**12. A monopoly's per-victim split is the one approximate entry.**
The chat states the haul but never who lost what. The caster's gain is exact;
each victim is charged what the tracker believes they held.

**13. Switched-off sections are an explicit list in the layout.**
Not "everything not placed", because a section missing from a stored layout is
ambiguous between hidden on purpose and added in a later version. With the list,
a genuinely new section appears where it was designed to and a hidden one stays
hidden. The list is optional so older stored layouts still parse.

**14. Presets set placement only.**
Picking one keeps your gutter sizes. The alternative — a preset as a complete
saved look — would silently undo a rail you had sized to taste.

### Still open for you

- **The end-to-end check needs you.** Everything else is verified — the sections
  in the preview harness, the page-framing math against a live bot game, 172 unit
  tests — but the final "load the built extension and switch to v2 in a real
  game" step needs an extension reload at `chrome://extensions`, which the
  browser tooling refuses to open. Reload the unpacked extension, open a game,
  and pick **Gutters** in the popup.
- **The rail header is bare.** Locked decision 5 dropped the
  `T14 · 88% CERTAIN` line. If you want it back, turn counting and a definition
  of "certain" are both small additions now that the view model exists.
- **Save-your-own presets** were deliberately left out: the two built-ins set
  placement, and naming, storing and deleting user presets is worth its own pass.
- **`data-index` was missing from chat rows** in an early-game observation
  (recorded under Phase 0). Unrelated to this work, but it is what the whole
  capture pipeline keys on, so it deserves a look in a longer game.
