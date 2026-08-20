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

// The sections resolve bundled assets through chrome.runtime.getURL; outside
// the extension they are just relative paths.
(globalThis as unknown as Record<string, unknown>).chrome = {
  runtime: { getURL: (path: string) => path },
};

const PLAYERS: Array<[string, string]> = [
  ['emipaco', '#59a8e8'],
  ['Shaum1928', '#e35b5b'],
  ['Powdahhh', '#f0a35e'],
  ['NickTheSwift', '#e6edf3'],
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
  setYouPlayerForTesting('NickTheSwift');

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
  playerGetResources('Shaum1928', {
    tree: 3,
    brick: 3,
    sheep: 4,
    wheat: 3,
    ore: 2,
  });
  playerGetResources('Powdahhh', {
    tree: 2,
    brick: 2,
    sheep: 1,
    wheat: 3,
    ore: 3,
  });
  playerGetResources('NickTheSwift', {
    tree: 3,
    brick: 2,
    sheep: 2,
    wheat: 2,
    ore: 4,
  });
  playerGetResources('emipaco', {
    tree: 1,
    brick: 1,
    sheep: 2,
    wheat: 2,
    ore: 4,
  });

  playerTrade('Shaum1928', 'Powdahhh', { wheat: -2, tree: 1 });
  bankTrade('NickTheSwift', { ore: -4, brick: 1 });
  buildSettlement('Shaum1928');
  buildRoad('Powdahhh');
  buildCity('NickTheSwift');
  buyDevCard('emipaco');
  buyDevCard('Shaum1928');
  playerDiscard('Powdahhh', { wheat: 2, ore: 1 });

  playerGetResources('Shaum1928', { sheep: 3, wheat: 2 });
  playerGetResources('Powdahhh', { wheat: 2, brick: 1 });
  playerGetResources('NickTheSwift', { sheep: 1, wheat: 3 });
  playerGetResources('emipaco', { ore: 1, wheat: 1 });

  // Two open steals, so the probability columns and the chips have something
  // to show.
  unknownSteal('emipaco', 'Powdahhh');
  unknownSteal('Powdahhh', 'emipaco');

  blockedDiceRoll(5, 'tree');
  blockedDiceRoll(5, 'tree');
  blockedDiceRoll(5, 'tree');
  blockedDiceRoll(6, 'wheat');
  blockedDiceRoll(8, 'wheat');

  useKnight('Shaum1928');
  useKnight('emipaco');
  useMonopoly('emipaco');
  // Gives the ledger's DEV column something to show: a monopoly haul counts as
  // cards gained through a development card.
  monopolySteal('emipaco', 'sheep', 4);
  useYearOfPlenty('Powdahhh');
  yearOfPlentyTake('Powdahhh', { brick: 1, tree: 1 });
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
