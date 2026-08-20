// ui/index.ts
// The extension's single entry point for anything user-facing. It owns which
// interface is active and forwards to it, so the rest of the codebase never
// learns that there is more than one.

import { v1Ui } from './v1Adapter.js';
import { v2Ui } from './v2.js';
import {
  DEFAULT_UI_MODE,
  readUiMode,
  subscribeUiMode,
  type UiMode,
} from './uiMode.js';
import type { UiImpl } from './uiImpl.js';

const IMPLS: Record<UiMode, UiImpl> = { v1: v1Ui, v2: v2Ui };

let mode: UiMode = DEFAULT_UI_MODE;
let mounted = false;
/** Remembered so a mode switch mid-replay doesn't drop the loading state. */
let historyLoading = false;

function active(): UiImpl {
  return IMPLS[mode];
}

/**
 * Swap interfaces in place. The outgoing one unmounts first so it can undo its
 * page changes (v2 squeezes colonist's layout) before the next one starts.
 */
export function setUiMode(next: UiMode): void {
  if (next === mode) return;
  if (mounted) active().unmount();
  mode = next;
  if (mounted) {
    active().mount();
    active().setHistoryLoading(historyLoading);
    active().update();
  }
}

export function getUiMode(): UiMode {
  return mode;
}

/**
 * Show the interface. Mounts the stored mode as soon as storage answers — the
 * default mounts immediately so there is never a window with no UI at all.
 */
export function showGameStateOverlay(): void {
  if (mounted) return;
  mounted = true;
  active().mount();

  void readUiMode().then(stored => {
    if (stored !== mode) setUiMode(stored);
  });
  subscribeUiMode(setUiMode);
}

export function hideGameStateOverlay(): void {
  if (!mounted) return;
  active().unmount();
  mounted = false;
}

export function updateGameStateDisplay(): void {
  if (mounted) active().update();
}

export function setHistoryLoading(loading: boolean): void {
  historyLoading = loading;
  if (mounted) active().setHistoryLoading(loading);
}

export function showYouPlayerDialog(): void {
  active().showYouPlayerDialog();
}
