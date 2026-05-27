import { describe, it, expect, beforeEach } from '@jest/globals';
import { showGameStateOverlay, setHistoryLoading } from '../overlay';
import { resetGameState } from '../gameState';

describe('overlay history loader', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGameState();
    // overlay.ts uses chrome.runtime.getURL for resource icons; stub it.
    (globalThis as any).chrome = { runtime: { getURL: (p: string) => p } };
  });

  it('shows a loader while history is loading and removes it when done (reload scenario)', () => {
    showGameStateOverlay();
    const overlay = document.getElementById('catan-game-state-overlay');
    expect(overlay).toBeTruthy();

    // content.ts flips this on right after a refresh while it scrolls the chat
    // and rebuilds resource counts.
    setHistoryLoading(true);
    expect(overlay!.textContent).toContain('Loading game history');
    expect(overlay!.querySelector('.catan-spinner')).toBeTruthy();

    // When the calculations finish the loader is replaced by the normal content.
    setHistoryLoading(false);
    expect(overlay!.textContent).not.toContain('Loading game history');
    expect(overlay!.querySelector('.catan-spinner')).toBeNull();
  });
});
