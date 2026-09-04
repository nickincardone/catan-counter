import { describe, it, expect, beforeEach, jest } from '@jest/globals';

type Ui = typeof import('../ui/index');

// overlay.ts caches its node in a module-level variable, so each test needs a
// fresh module registry as well as a fresh document — otherwise the cached node
// outlives the DOM it was appended to.
async function freshUi(): Promise<Ui> {
  jest.resetModules();
  document.body.innerHTML = '';
  document.documentElement
    .querySelectorAll('#catan-v2-root')
    .forEach(el => el.remove());
  (globalThis as any).chrome = { runtime: { getURL: (p: string) => p } };
  const { resetGameState } = await import('../gameState');
  resetGameState();
  // A fresh module registry starts at DEFAULT_UI_MODE, so no reset is needed.
  return import('../ui/index');
}

/** v1 hides itself rather than detaching, so presence alone proves nothing. */
const v1Visible = (): boolean => {
  const el = document.getElementById('catan-game-state-overlay');
  return !!el && el.isConnected && el.style.display !== 'none';
};
const v2Present = (): boolean => !!document.getElementById('catan-v2-root');

describe('ui mode router', () => {
  let ui: Ui;
  beforeEach(async () => {
    ui = await freshUi();
  });

  it('mounts the gutter interface by default', () => {
    ui.showGameStateOverlay();
    expect(v2Present()).toBe(true);
    expect(v1Visible()).toBe(false);
    expect(ui.getUiMode()).toBe('v2');
  });

  it('swaps to the overlay in place, leaving no v2 residue on the page', () => {
    ui.showGameStateOverlay();
    ui.setUiMode('v1');

    expect(v1Visible()).toBe(true);
    expect(v2Present()).toBe(false);
    expect(ui.getUiMode()).toBe('v1');
  });

  it('swaps back to the gutters, taking the overlay off screen', () => {
    ui.showGameStateOverlay();
    ui.setUiMode('v1');
    ui.setUiMode('v2');

    expect(v2Present()).toBe(true);
    expect(v1Visible()).toBe(false);
  });

  it('does not mount anything before the chat is found', () => {
    ui.setUiMode('v1');
    expect(v1Visible()).toBe(false);
    expect(v2Present()).toBe(false);
  });

  it('mounts the chosen mode when the chat is finally found', () => {
    ui.setUiMode('v1');
    ui.showGameStateOverlay();
    expect(v1Visible()).toBe(true);
    expect(v2Present()).toBe(false);
  });

  it('ignores a switch to the mode already active', () => {
    ui.showGameStateOverlay();
    const before = document.getElementById('catan-v2-root');
    ui.setUiMode('v2');
    expect(document.getElementById('catan-v2-root')).toBe(before);
  });

  it('carries the history-loading state across a mode switch', () => {
    ui.showGameStateOverlay();
    ui.setHistoryLoading(true);
    ui.setUiMode('v1');

    // v1 renders the spinner whenever it is loading; the flag survived the trip.
    expect(document.querySelector('.catan-spinner')).toBeTruthy();
  });

  it('keeps an incomplete-history warning when switching interfaces', () => {
    ui.showGameStateOverlay();
    ui.setHistoryLoading(false, 'Some chat messages could not be recovered.');
    ui.setUiMode('v1');
    expect(
      document.getElementById('catan-game-state-overlay')!.textContent
    ).toContain('Game history incomplete');
    ui.setUiMode('v2');
    expect(
      document.getElementById('catan-v2-root')!.shadowRoot!.textContent
    ).toContain('Game history incomplete');
  });
});
