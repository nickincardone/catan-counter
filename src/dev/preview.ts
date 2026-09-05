// dev/preview.ts
// A harness for looking at the v2 gutter UI without a live colonist game.
//
// It seats four players, plays a plausible opening, and mounts the real shell
// with the real sections against that state — so what you see is what a game
// renders, not a mock. Not part of the extension: nothing in manifest.json
// references it, and it is only reachable by opening dev-preview.html.

import {
  bankTrade,
  blockedDiceRoll,
  buildCity,
  buildRoad,
  buildSettlement,
  buyDevCard,
  placeSettlement,
  playerDiscard,
  playerGetResources,
  monopolySteal,
  playerTrade,
  receiveStartingResources,
  rollDice,
  unknownSteal,
  useKnight,
  useMonopoly,
  useYearOfPlenty,
  yearOfPlentyTake,
} from '../gameActions.js';
import { game, resetGameState, setYouPlayerForTesting } from '../gameState.js';
import { PropbableGameState } from '../probableGameState.js';
import { Shell } from '../ui/shell/shell.js';
import '../ui/sections/index.js';
import { isViewportCommand, PAGE_VIEWPORT_SOURCE } from '../pageViewport.js';

// Emulate Colonist's DOM placement without overriding window.innerHeight in
// this single-world harness (the extension and page have separate worlds).
window.addEventListener('message', event => {
  if (
    event.source !== window ||
    event.origin !== window.location.origin ||
    !isViewportCommand(event.data)
  )
    return;
  const canvas = document.getElementById('game-canvas')!;
  const ui = document.getElementById('ui-game')!;
  const rect = canvas.getBoundingClientRect();
  ui.style.top = `${rect.top}px`;
  ui.style.width = `${rect.width}px`;
  ui.style.height = `${rect.height}px`;
  window.postMessage(
    {
      source: PAGE_VIEWPORT_SOURCE,
      type: 'report',
      nonce: event.data.nonce,
      real: { width: window.innerWidth, height: window.innerHeight },
      reported: { width: rect.width, height: rect.height },
      content: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      },
    },
    window.location.origin
  );
});

// The sections resolve bundled assets through chrome.runtime.getURL; outside
// the extension they are just relative paths.
(globalThis as unknown as Record<string, unknown>).chrome = {
  runtime: { getURL: (path: string) => path },
};

const PLAYERS: Array<[string, string]> = [
  ['Harbor', '#59a8e8'],
  ['Ember', '#e35b5b'],
  ['Cedar', '#f0a35e'],
  ['You', '#e6edf3'],
];

function seedGame(): void {
  resetGameState();
  game.youPlayerName = null;

  for (const [name, color] of PLAYERS) placeSettlement(name, color);
  game.probableGameState = new PropbableGameState(game.players);
  for (const [name] of PLAYERS) {
    receiveStartingResources(name, { wheat: 1, sheep: 1 });
  }
  // Set before the first roll: rollDice asks who you are otherwise, and here
  // there is no colonist page to auto-detect from.
  setYouPlayerForTesting('You');

  // Dice first, and not only for realism: the first roll deliberately rebuilds
  // the variant tree from scratch, because that is when tracking properly
  // begins. Anything dealt or stolen before it is discarded.
  const rolls: Record<number, number> = {
    2: 2,
    3: 2,
    4: 3,
    5: 6,
    6: 5,
    7: 12,
    8: 6,
    9: 9,
    10: 4,
    11: 3,
    12: 2,
  };
  for (const [total, count] of Object.entries(rolls)) {
    for (let i = 0; i < count; i++) rollDice(Number(total));
  }

  // A game's worth of card movement, so both card-flow tables have something
  // real to show. Everything here is affordable, as a real game's would be.
  // Kept within what the bank actually holds — 19 of each — so the bank row
  // does not go negative.
  playerGetResources('Ember', {
    tree: 3,
    brick: 3,
    sheep: 4,
    wheat: 3,
    ore: 2,
  });
  playerGetResources('Cedar', {
    tree: 2,
    brick: 2,
    sheep: 1,
    wheat: 3,
    ore: 3,
  });
  playerGetResources('You', {
    tree: 3,
    brick: 2,
    sheep: 2,
    wheat: 2,
    ore: 4,
  });
  playerGetResources('Harbor', {
    tree: 1,
    brick: 1,
    sheep: 2,
    wheat: 2,
    ore: 4,
  });

  playerTrade('Ember', 'Cedar', { wheat: -2, tree: 1 });
  bankTrade('You', { ore: -4, brick: 1 });
  buildSettlement('Ember');
  buildRoad('Cedar');
  buildCity('You');
  buyDevCard('Harbor');
  buyDevCard('Ember');
  playerDiscard('Cedar', { wheat: 2, ore: 1 });

  playerGetResources('Ember', { sheep: 3, wheat: 2 });
  playerGetResources('Cedar', { wheat: 2, brick: 1 });
  playerGetResources('You', { sheep: 1, wheat: 3 });
  playerGetResources('Harbor', { ore: 1, wheat: 1 });

  // Two open steals, so the probability columns and the chips have something
  // to show.
  unknownSteal('Harbor', 'Cedar');
  unknownSteal('Cedar', 'Harbor');

  blockedDiceRoll(5, 'tree');
  blockedDiceRoll(5, 'tree');
  blockedDiceRoll(5, 'tree');
  blockedDiceRoll(6, 'wheat');
  blockedDiceRoll(8, 'wheat');

  useKnight('Ember');
  useKnight('Harbor');
  useMonopoly('Harbor');
  // Gives the ledger's DEV column something to show: a monopoly haul counts as
  // cards gained through a development card.
  monopolySteal('Harbor', 'sheep', 4);
  useYearOfPlenty('Cedar');
  yearOfPlentyTake('Cedar', { brick: 1, tree: 1 });
}

seedGame();

const shell = new Shell({
  onAction: action => {
    if (action.type === 'resolve-steal') {
      game.probableGameState.resolveUnknownTransaction(
        action.id,
        action.resource
      );
    } else if (action.type === 'undo-steal') {
      game.probableGameState.unresolveUnknownTransaction(action.id);
    }
    shell.update();
  },
});

shell.mount();

// Handy while iterating on a section from the console.
(globalThis as unknown as Record<string, unknown>).__catanPreview = {
  shell,
  game,
  reseed: () => {
    seedGame();
    shell.update();
  },
};
