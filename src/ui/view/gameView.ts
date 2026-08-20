// view/gameView.ts
// Turns tracker state into the plain data v2 renders. Everything derived — bar
// heights, expected-rate ticks, chip ordering, captions, summaries — is computed
// here rather than in a section, so it is unit-testable without a DOM and so two
// sections can never disagree about the same number.
//
// This module is pure: same GameType in, same GameView out. No DOM, no chrome.

import type { GameType, PlayerType, ResourceObjectType } from '../../types.js';
import {
  RESOURCE_ORDER,
  type BankView,
  type BlockedView,
  type DevCardKey,
  type DevCardView,
  type DevDeckView,
  type DiceBarView,
  type DiceTone,
  type DiceView,
  type GameView,
  type PlayerView,
  type ResourceCellView,
  type ResourceKey,
  type StealCandidateView,
  type StealView,
} from './types.js';

/** Cards of each resource in a standard game. */
const BANK_TOTAL = 19;

/** Ways to roll each total with two dice, out of 36. */
const DICE_ODDS: Record<number, number> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
};

/** A roll this far above its expected rate is called out as running hot. */
const HOT_MULTIPLIER = 1.3;

const DEV_CARDS: Array<{
  key: DevCardKey;
  name: string;
  icon: string;
  total: number;
}> = [
  { key: 'knights', name: 'Knight', icon: 'knight.svg', total: 14 },
  { key: 'monopolies', name: 'Monopoly', icon: 'mono.svg', total: 2 },
  { key: 'roadBuilders', name: 'Roads', icon: 'rb.svg', total: 2 },
  { key: 'yearOfPlenties', name: 'Plenty', icon: 'yop.svg', total: 2 },
  { key: 'victoryPoints', name: 'Vic. Pt', icon: 'vp.svg', total: 5 },
];

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

const pct = (p: number): string => `${Math.round(p * 100)}%`;

/**
 * Players in reading order with you last, matching v1's ordering — your own
 * hand is the one you already know, so it belongs at the bottom of the rail.
 */
export function orderPlayers(
  players: PlayerType[],
  youPlayerName: string | null
): PlayerType[] {
  if (!youPlayerName) return players;
  const index = players.findIndex(player => player.name === youPlayerName);
  if (index === -1) return players;
  return [
    ...players.slice(index + 1),
    ...players.slice(0, index),
    players[index],
  ];
}

/** '6:35:45 PM' — wall-clock, because it is matched against the game's chat. */
export function formatStealTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours24 = date.getHours();
  const hours = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds} ${hours24 < 12 ? 'AM' : 'PM'}`;
}

function buildPlayer(
  player: PlayerType,
  game: GameType,
  youPlayerName: string | null
): PlayerView {
  const probabilities = game.probableGameState.getPlayerResourceProbabilities(
    player.name
  );

  const cells: ResourceCellView[] = RESOURCE_ORDER.map(resource => {
    const known = probabilities.minimumResources[resource] ?? 0;
    const probability =
      probabilities.additionalResourceProbabilities[resource] ?? 0;
    return {
      resource,
      known,
      probability,
      probabilityLabel: probability > 0 ? `+${pct(probability)}` : '',
      hasAny: known > 0 || probability > 0,
    };
  });

  return {
    name: player.name,
    color: player.color,
    knownCards: cells.reduce((total, cell) => total + cell.known, 0),
    cells,
    victoryPoints: player.victoryPoints,
    knights: player.knights,
    settlements: player.settlements,
    cities: player.cities,
    roads: player.roads,
    isYou: player.name === youPlayerName,
  };
}

function buildBank(gameResources: ResourceObjectType): BankView[] {
  return RESOURCE_ORDER.map(resource => ({
    resource,
    left: gameResources[resource],
    total: BANK_TOTAL,
  }));
}

function buildSteals(game: GameType): StealView[] {
  const colorOf = (name: string): string =>
    game.players.find(player => player.name === name)?.color ?? '#ffffff';

  return game.probableGameState.getUnknownTransactions().map(transaction => {
    const probabilities =
      game.probableGameState.getTransactionResourceProbabilities(
        transaction.id
      );

    const candidates: StealCandidateView[] = RESOURCE_ORDER.map(resource => ({
      resource,
      probability: probabilities?.[resource] ?? 0,
      label: '',
    }))
      .filter(candidate => candidate.probability > 0)
      .sort((a, b) => b.probability - a.probability)
      .map(candidate => ({
        ...candidate,
        label: `${candidate.resource} ${pct(candidate.probability)}`,
      }));

    return {
      id: transaction.id,
      thief: transaction.thief,
      thiefColor: colorOf(transaction.thief),
      victim: transaction.victim,
      victimColor: colorOf(transaction.victim),
      time: formatStealTime(transaction.timestamp),
      resolved: false,
      resolvedResource: null,
      candidates,
    };
  });
}

function buildBlocked(game: GameType): {
  blocked: BlockedView[];
  blockedTotal: number;
} {
  const blocked: BlockedView[] = [];

  for (const [diceNumber, byResource] of Object.entries(
    game.blockedDiceRolls
  )) {
    for (const [resource, count] of Object.entries(byResource)) {
      if (count > 0) {
        blocked.push({
          diceNumber: Number(diceNumber),
          resource: resource as ResourceKey,
          count,
        });
      }
    }
  }

  blocked.sort(
    (a, b) =>
      a.diceNumber - b.diceNumber ||
      RESOURCE_ORDER.indexOf(a.resource) - RESOURCE_ORDER.indexOf(b.resource)
  );

  return {
    blocked,
    blockedTotal: blocked.reduce((total, entry) => total + entry.count, 0),
  };
}

function buildDice(game: GameType): DiceView {
  const counts = Object.entries(game.diceRolls).map(([n, count]) => ({
    n: Number(n),
    count,
  }));
  const totalRolls = counts.reduce((total, entry) => total + entry.count, 0);
  // Guard the divisor: before the first roll every count is 0.
  const tallest = Math.max(1, ...counts.map(entry => entry.count));

  const bars: DiceBarView[] = counts
    .sort((a, b) => a.n - b.n)
    .map(({ n, count }) => {
      const expected = (totalRolls * DICE_ODDS[n]) / 36;
      // A short floor so an unrolled number is still a visible baseline.
      const heightPct = count === 0 ? 0 : Math.max(4, (count / tallest) * 100);
      const expectedPct = clamp((expected / tallest) * 100, 0, 100);

      const tone: DiceTone =
        n === 7
          ? 'seven'
          : count > expected * HOT_MULTIPLIER
            ? 'hot'
            : 'normal';

      return {
        n,
        count,
        heightPct,
        // Positioned from the top of its own bar, so it reads as "this bar is
        // above/below the rate you'd expect by now".
        expectedTopPct:
          heightPct > 0
            ? clamp((1 - expectedPct / heightPct) * 100, 0, 100)
            : 100,
        expected,
        tone,
      };
    });

  return { totalRolls, bars };
}

/**
 * Attribution for a dev card type. The tracker already counts plays per player
 * (gameActions increments discoveryCards on use), so this is a fold, not new
 * parsing. Victory points are never played, so they always read as unseen.
 */
export function buildDevCaption(
  players: PlayerType[],
  key: DevCardKey,
  left: number
): string {
  const playedBy = players
    .map(player => ({ name: player.name, count: player.discoveryCards[key] }))
    .filter(entry => entry.count > 0);

  if (playedBy.length === 0) return `${left} unseen`;
  if (playedBy.length === 1) {
    const [only] = playedBy;
    return only.count > 1 ? `${only.name} ×${only.count}` : only.name;
  }
  const total = playedBy.reduce((sum, entry) => sum + entry.count, 0);
  return `${total} played`;
}

function buildDevDeck(game: GameType): DevDeckView {
  const cards: DevCardView[] = DEV_CARDS.map(card => {
    // These counters decrement on play, not on draw, so `left` is "not yet
    // played" — which is why an untouched deck reads 5/5 for victory points.
    const left = game[card.key];
    return {
      key: card.key,
      name: card.name,
      icon: card.icon,
      left,
      total: card.total,
      leftPct: clamp((left / card.total) * 100, 0, 100),
      caption: buildDevCaption(game.players, card.key, left),
      untouched: left >= card.total,
    };
  });

  return {
    remaining: cards.reduce((total, card) => total + card.left, 0),
    cards,
  };
}

export function buildGameView(
  game: GameType,
  options: { isLoadingHistory?: boolean } = {}
): GameView {
  const { blocked, blockedTotal } = buildBlocked(game);

  return {
    players: orderPlayers(game.players, game.youPlayerName).map(player =>
      buildPlayer(player, game, game.youPlayerName)
    ),
    bank: buildBank(game.gameResources),
    steals: buildSteals(game),
    blocked,
    blockedTotal,
    dice: buildDice(game),
    devDeck: buildDevDeck(game),
    youPlayerName: game.youPlayerName,
    hasStarted: game.hasRolledFirstDice,
    isLoadingHistory: options.isLoadingHistory ?? false,
  };
}
