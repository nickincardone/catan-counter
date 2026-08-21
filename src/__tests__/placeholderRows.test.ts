// Colonist's chat is a virtual scroller that mints rows with a data-index long
// before their content exists — in a replay, hundreds at once, and the first one
// seen carried index 572. The parser's duplicate check is a monotonic
// high-water mark, so reading an empty row spends its index: when the scroller
// finally fills that row in, the real message is discarded as already-seen and
// whatever it said is lost. Counts then drift quietly below the truth.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { updateGameFromChat } from '../chatParser';
import { game, resetGameState } from '../gameState';
import { totalsFor } from '../cardLedger';
import { createElementFromHTML } from './testUtils';

jest.mock('../overlay', () => ({
  updateGameStateDisplay: jest.fn(),
  showYouPlayerDialog: jest.fn(),
}));

/** A row the scroller has created but not filled in: no text, no icons. */
function placeholderRow(index: number): HTMLElement {
  return createElementFromHTML(`<div data-index="${index}"></div>`);
}

/** "<player> got <grain>", as colonist renders it. */
function gotGrain(index: number, player: string): HTMLElement {
  return createElementFromHTML(
    `<div data-index="${index}"><span><span style="font-weight:600;color:#111">${player}</span>` +
      ` got <img alt="grain"></span></div>`
  );
}

function placedSettlement(index: number, player: string): HTMLElement {
  return createElementFromHTML(
    `<div data-index="${index}"><span><span style="font-weight:600;color:#111">${player}</span>` +
      ` placed a <img alt="settlement"></span></div>`
  );
}

describe('rows the scroller has not filled in yet', () => {
  beforeEach(() => {
    resetGameState();
    game.youPlayerName = null;
    // Seat both players the way the chat does, at the lowest indices.
    updateGameFromChat(placedSettlement(0, 'Alice'));
    updateGameFromChat(placedSettlement(1, 'Bob'));
  });

  it('does not consume the index its real message will arrive under', () => {
    // The replay case: an empty row far ahead of anything read so far.
    updateGameFromChat(placeholderRow(572));

    // The real message for a much lower index must still be read.
    updateGameFromChat(gotGrain(31, 'Alice'));
    expect(totalsFor('Alice').got).toBe(1);
  });

  it('reads the message when that same row is finally filled in', () => {
    updateGameFromChat(placeholderRow(40));
    updateGameFromChat(gotGrain(40, 'Alice'));

    expect(totalsFor('Alice').got).toBe(1);
    expect(game.players.find(p => p.name === 'Alice')!.resources.wheat).toBe(1);
  });

  it('still refuses a message it has genuinely already read', () => {
    updateGameFromChat(gotGrain(40, 'Alice'));
    updateGameFromChat(gotGrain(40, 'Alice'));

    expect(totalsFor('Alice').got).toBe(1);
  });

  it('survives a whole screen of placeholders without losing anything', () => {
    // What the replay actually looked like: 407 empty rows around 13 real ones.
    for (let index = 400; index < 560; index++) {
      updateGameFromChat(placeholderRow(index));
    }
    for (const [index, player] of [
      [31, 'Alice'],
      [32, 'Bob'],
      [405, 'Alice'],
      [500, 'Bob'],
    ] as Array<[number, string]>) {
      updateGameFromChat(gotGrain(index, player));
    }

    expect(totalsFor('Alice').got).toBe(2);
    expect(totalsFor('Bob').got).toBe(2);
  });
});
