// Who "you" is decides where every "X stole from you" card goes. Colonist's
// page header carries the logged-in ACCOUNT name, which is only the same thing
// when you are playing your own game — in a replay or while spectating it is
// nobody at the table. Accepting it there sent ten steals to a player who did
// not exist, silently, because the actions that move those cards simply return
// when they cannot find the name.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { getCurrentPlayerFromPanel } from '../domUtils';
import {
  autoDetectCurrentPlayer,
  game,
  resetGameState,
  youPlayerIsSeated,
} from '../gameState';
import { placeSettlement, stealFromYou } from '../gameActions';
import { getLedger } from '../cardLedger';

jest.mock('../overlay', () => ({
  updateGameStateDisplay: jest.fn(),
  showYouPlayerDialog: jest.fn(),
}));

/** Colonist's player panel: opponents carry an opponentPlayerRow class. */
function renderPanel(players: string[], viewer: string | null): void {
  document.body.innerHTML = `
    <div data-player-information-container>
      ${players
        .map(
          (name, i) => `
        <div data-player-color="${i}" class="${
          name === viewer
            ? 'playerRow-RMhJ5mpg'
            : 'opponentPlayerRow-AYNGolhx playerRow-RMhJ5mpg'
        }"><div class="container"><div class="usernameLarge">${name}</div><div class="counts"><span>7</span><span>4</span></div></div></div>`
        )
        .join('')}
    </div>`;
}

function renderHeader(username: string): void {
  const header = document.createElement('div');
  header.className = 'web-header-username';
  header.textContent = username;
  document.body.appendChild(header);
}

const PLAYERS = ['Runkel50655073', 'hoidd', 'Maddics', 'PHXcoyotes'];

describe('working out who "you" is', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGameState();
    game.youPlayerName = null;
    PLAYERS.forEach(name => placeSettlement(name));
  });

  it('reads the viewer off the panel, not the account name', () => {
    renderPanel(PLAYERS, 'PHXcoyotes');
    expect(getCurrentPlayerFromPanel()).toBe('PHXcoyotes');
  });

  it('prefers the panel over a header naming someone else', () => {
    renderPanel(PLAYERS, 'PHXcoyotes');
    renderHeader('NickTheSwift'); // the account watching the replay

    expect(autoDetectCurrentPlayer()).toBe(true);
    expect(game.youPlayerName).toBe('PHXcoyotes');
    expect(youPlayerIsSeated()).toBe(true);
  });

  it('refuses a header name belonging to nobody at the table', () => {
    renderHeader('NickTheSwift'); // no panel to fall back on

    expect(autoDetectCurrentPlayer()).toBe(false);
    expect(game.youPlayerName).toBeNull();
  });

  it('still accepts the header when it is your own game', () => {
    renderHeader('Maddics');

    expect(autoDetectCurrentPlayer()).toBe(true);
    expect(game.youPlayerName).toBe('Maddics');
  });

  it('gives up on a spectator view with no seat of its own', () => {
    renderPanel(PLAYERS, null); // every row is an opponent
    expect(getCurrentPlayerFromPanel()).toBeNull();
    expect(autoDetectCurrentPlayer()).toBe(false);
  });
});

describe('a steal from a "you" that is nobody', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGameState();
    game.youPlayerName = null;
    PLAYERS.forEach(name => placeSettlement(name));
  });

  it('says so rather than losing the card in silence', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    stealFromYou('Runkel50655073', 'NickTheSwift', 'brick');

    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0][0])).toContain('not in this game');
    // And nothing was recorded against the phantom or the thief.
    expect(getLedger('NickTheSwift').robLoss).toBe(0);
    expect(getLedger('Runkel50655073').robGain).toBe(0);
    warn.mockRestore();
  });

  it('records both sides once "you" is a real seat', () => {
    stealFromYou('Runkel50655073', 'PHXcoyotes', 'brick');

    expect(getLedger('Runkel50655073').robGain).toBe(1);
    expect(getLedger('PHXcoyotes').robLoss).toBe(1);
  });
});
