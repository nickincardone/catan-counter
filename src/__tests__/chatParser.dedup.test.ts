import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { updateGameFromChat } from '../chatParser';
import { resetGameState, game } from '../gameState';
import { createElementFromHTML } from './testUtils';

// Avoid touching the real overlay/DOM during parsing.
jest.mock('../overlay', () => ({
  updateGameStateDisplay: jest.fn(),
  showYouPlayerDialog: jest.fn(),
}));

describe('chatParser data-index dedup', () => {
  beforeEach(() => {
    resetGameState();
  });

  it('counts a message only once when its row is re-processed (overlapping scroll windows)', () => {
    // A settlement message creates the player.
    const settlement = createElementFromHTML(
      '<div data-index="0"><span><span style="font-weight:600;color:#111">Alice</span> placed a <img alt="settlement"></span></div>'
    );
    updateGameFromChat(settlement);

    // "Alice got 1 grain" -> +1 wheat.
    const gotGrain = createElementFromHTML(
      '<div data-index="1"><span><span style="font-weight:600;color:#111">Alice</span> got <img alt="grain"></span></div>'
    );
    updateGameFromChat(gotGrain);

    // Re-process the SAME row. While loading history we scroll the virtual scroller
    // in overlapping windows, so the most-recently-processed row re-renders and is
    // fed to the parser again. The data-index dedup must ignore it (otherwise the
    // boundary message between windows is counted twice).
    updateGameFromChat(gotGrain);

    const alice = game.players.find(p => p.name === 'Alice');
    expect(alice).toBeDefined();
    expect(alice!.resources.wheat).toBe(1);
  });
});
