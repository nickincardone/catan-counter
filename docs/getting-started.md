# Installation & user guide

## Installation

Catan Counter is loaded as an unpacked Chrome extension.

1. Download this repository using GitHub's **Code → Download ZIP** and extract it, or clone it. The repository includes the built extension files; building is only needed when changing source code.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the repository folder containing `manifest.json`.
4. Pin the extension from Chrome's extensions menu if you want easy access to its popup.
5. Open a game on [Colonist](https://colonist.io).

The extension currently appears as **Colonist.io Dice Stats** in Chrome's extension manager. Its in-game interface is called **Counter**.

For a source build, see [Local development](development.md).

## Using the counter

Tracking begins with the first dice roll. Your player is detected automatically when possible; select your name if prompted so messages involving “you” are attributed correctly.

### Gutters

Gutters are the default interface. They reserve space around the game instead of covering the board.

- Open the **gear** to place sections in the left, right, top, or bottom gutter, reorder them, or switch them off.
- Resize the gutters or choose a preset. Unsupported placements are disabled with a reason.
- Use each gutter's directional button to collapse or reopen it independently. Its size and collapsed state are remembered.
- When no rail is visible, a floating gear keeps settings accessible.

Layout changes apply immediately and persist. Sections are moved through settings, not drag-and-drop.

### Unknown steals

The hands table separates guaranteed cards from probable holdings. Unknown steals remain available for later clarification.

- Click the **Unknown steals** header to collapse or expand the list. The count remains visible and updates while collapsed.
- If you learn which resource was stolen, select its resource chip.
- Use **UNDO** to remove your resolution. The tracker replays the game with the remaining resolutions.

See [How tracking works](tracking.md) for what the numbers mean.

### Overlay

Choose **Overlay** in the extension popup for the original floating panel. Drag its header to move it, minimize it to the header, or resize it from the bottom-right corner. Switching between Gutters and Overlay does not require a page reload.

## Refreshes and missing history

After a reconnect or page refresh, the extension attempts to recover the complete game chat before displaying counts. Colonist only renders part of the chat at once, so recovery may take time.

An incomplete-history warning means the tracker could not verify the full history. It does not silently present those partial counts as a complete game. See [Chat recovery](architecture.md#chat-recovery) for details.

Avoid refreshing an active game just to change layouts. A refresh can disconnect your seat, and a completed game's history may no longer be available afterward.

## Updating

Get the updated repository files, then click **Reload** on the extension's card at `chrome://extensions`. Test the update in a fresh game. If you changed TypeScript source, build it first.

[Documentation](README.md) · [Data & exports](data-and-exports.md)
