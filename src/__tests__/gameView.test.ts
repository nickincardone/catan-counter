import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  blockedDiceRoll,
  placeSettlement,
  playerGetResources,
  rollDice,
  unknownSteal,
  useKnight,
  useMonopoly,
} from '../gameActions';
import { game, resetGameState, setYouPlayerForTesting } from '../gameState';
import { PropbableGameState } from '../probableGameState';
import {
  buildDevCaption,
  buildGameView,
  formatStealTime,
  orderPlayers,
} from '../ui/view/gameView';

/** Four seated players with a fresh variant tree, as the real game bootstraps. */
function seatPlayers(): void {
  resetGameState();
  // resetGameState deliberately preserves the "you" player across a reset, so
  // clear it explicitly or it leaks between cases.
  game.youPlayerName = null;
  ['Alice', 'Bob', 'Charlie', 'Diana'].forEach(name => placeSettlement(name));
  game.probableGameState = new PropbableGameState(game.players);
}

describe('buildGameView', () => {
  beforeEach(seatPlayers);

  it('is pure data — no DOM or chrome APIs are touched', () => {
    delete (globalThis as any).chrome;
    expect(() => buildGameView(game)).not.toThrow();
  });

  describe('bank', () => {
    it('reports what is left of each resource, in display order', () => {
      playerGetResources('Alice', { wheat: 2 });

      const { bank } = buildGameView(game);
      expect(bank.map(b => b.resource)).toEqual([
        'tree',
        'brick',
        'sheep',
        'wheat',
        'ore',
      ]);
      expect(bank.every(b => b.total === 19)).toBe(true);
      expect(bank.find(b => b.resource === 'wheat')!.left).toBe(17);
      expect(bank.find(b => b.resource === 'ore')!.left).toBe(19);
    });
  });

  describe('players', () => {
    it('puts you last, keeping the others in turn order', () => {
      setYouPlayerForTesting('Bob');
      expect(buildGameView(game).players.map(p => p.name)).toEqual([
        'Charlie',
        'Diana',
        'Alice',
        'Bob',
      ]);
    });

    it('keeps game order when you are unknown', () => {
      expect(buildGameView(game).players.map(p => p.name)).toEqual([
        'Alice',
        'Bob',
        'Charlie',
        'Diana',
      ]);
    });

    it('summarizes guaranteed cards and marks empty cells', () => {
      playerGetResources('Alice', { wheat: 2, ore: 1 });

      const alice = buildGameView(game).players.find(p => p.name === 'Alice')!;
      expect(alice.knownCards).toBe(3);

      const wheat = alice.cells.find(c => c.resource === 'wheat')!;
      expect(wheat.known).toBe(2);
      expect(wheat.probabilityLabel).toBe('');
      expect(wheat.hasAny).toBe(true);

      const tree = alice.cells.find(c => c.resource === 'tree')!;
      expect(tree.known).toBe(0);
      expect(tree.hasAny).toBe(false);
    });

    it('shows probable holdings from an unresolved steal as a percentage', () => {
      playerGetResources('Bob', { wheat: 1, ore: 1 });
      unknownSteal('Alice', 'Bob');

      const alice = buildGameView(game).players.find(p => p.name === 'Alice')!;
      const wheat = alice.cells.find(c => c.resource === 'wheat')!;

      expect(wheat.known).toBe(0); // guaranteed nothing...
      expect(wheat.probability).toBeCloseTo(0.5); // ...but might hold it
      expect(wheat.probabilityLabel).toBe('+50%');
      expect(wheat.hasAny).toBe(true);
      expect(alice.knownCards).toBe(0);
    });
  });

  describe('unknown steals', () => {
    it('lists candidates by descending probability with readable labels', () => {
      playerGetResources('Bob', { wheat: 1, ore: 1, brick: 2 });
      unknownSteal('Alice', 'Bob');

      const [steal] = buildGameView(game).steals;
      expect(steal.thief).toBe('Alice');
      expect(steal.victim).toBe('Bob');
      expect(steal.resolved).toBe(false);

      const probabilities = steal.candidates.map(c => c.probability);
      expect([...probabilities].sort((a, b) => b - a)).toEqual(probabilities);
      expect(steal.candidates[0].resource).toBe('brick'); // Bob holds two
      expect(steal.candidates[0].label).toBe('brick 50%');
      expect(steal.candidates.every(c => c.probability > 0)).toBe(true);
    });

    it('is empty when a steal was deducible without branching', () => {
      playerGetResources('Bob', { wheat: 1 }); // only one type to take
      unknownSteal('Alice', 'Bob');
      expect(buildGameView(game).steals).toHaveLength(0);
    });
  });

  describe('dice', () => {
    it('counts rolls and scales bars against the tallest', () => {
      rollDice(6);
      rollDice(6);
      rollDice(8);

      const { dice } = buildGameView(game);
      expect(dice.totalRolls).toBe(3);
      expect(dice.bars).toHaveLength(11);
      expect(dice.bars[0].n).toBe(2);

      const six = dice.bars.find(b => b.n === 6)!;
      const eight = dice.bars.find(b => b.n === 8)!;
      expect(six.heightPct).toBe(100);
      expect(eight.heightPct).toBe(50);
    });

    it('gives unrolled numbers no bar rather than a divide-by-zero', () => {
      const { dice } = buildGameView(game);
      expect(dice.totalRolls).toBe(0);
      expect(dice.bars.every(b => b.heightPct === 0)).toBe(true);
      expect(dice.bars.every(b => Number.isFinite(b.expectedTopPct))).toBe(
        true
      );
    });

    it('tones sevens apart and flags numbers running hot', () => {
      for (let i = 0; i < 10; i++) rollDice(5);
      rollDice(7);

      const { dice } = buildGameView(game);
      expect(dice.bars.find(b => b.n === 7)!.tone).toBe('seven');
      expect(dice.bars.find(b => b.n === 5)!.tone).toBe('hot');
      expect(dice.bars.find(b => b.n === 9)!.tone).toBe('normal');
    });

    it('places the expected-rate tick inside its own bar', () => {
      for (let i = 0; i < 11; i++) rollDice(8);

      const eight = buildGameView(game).dice.bars.find(b => b.n === 8)!;
      // 11 rolls, 5/36 of them expected on 8 — well under what actually landed,
      // so the tick sits below the top of a full-height bar.
      expect(eight.expected).toBeCloseTo((11 * 5) / 36);
      expect(eight.expectedTopPct).toBeGreaterThan(0);
      expect(eight.expectedTopPct).toBeLessThanOrEqual(100);
    });
  });

  describe('blocked by robber', () => {
    it('sorts by dice number then resource and totals what was denied', () => {
      blockedDiceRoll(8, 'wheat');
      blockedDiceRoll(5, 'tree');
      blockedDiceRoll(5, 'tree');

      const view = buildGameView(game);
      expect(view.blocked).toEqual([
        { diceNumber: 5, resource: 'tree', count: 2 },
        { diceNumber: 8, resource: 'wheat', count: 1 },
      ]);
      expect(view.blockedTotal).toBe(3);
    });
  });

  describe('dev deck', () => {
    it('counts unplayed cards, including victory points that are never played', () => {
      const { devDeck } = buildGameView(game);
      expect(devDeck.remaining).toBe(25);

      const vp = devDeck.cards.find(c => c.key === 'victoryPoints')!;
      expect(vp.left).toBe(5);
      expect(vp.total).toBe(5);
      expect(vp.leftPct).toBe(100);
      expect(vp.caption).toBe('5 unseen');
      expect(vp.untouched).toBe(true);
    });

    it('drops the count and the bar as cards get played', () => {
      useKnight('Alice');
      useKnight('Alice');

      const knight = buildGameView(game).devDeck.cards.find(
        c => c.key === 'knights'
      )!;
      expect(knight.left).toBe(12);
      expect(knight.leftPct).toBeCloseTo((12 / 14) * 100);
      expect(knight.untouched).toBe(false);
      expect(buildGameView(game).devDeck.remaining).toBe(23);
    });

    it('attributes a card to the only player who played it', () => {
      useMonopoly('Charlie');
      const mono = buildGameView(game).devDeck.cards.find(
        c => c.key === 'monopolies'
      )!;
      expect(mono.caption).toBe('Charlie');
    });
  });

  it('reports whether tracking has started and whether history is replaying', () => {
    expect(buildGameView(game).hasStarted).toBe(false);
    expect(buildGameView(game).isLoadingHistory).toBe(false);

    rollDice(9);
    expect(buildGameView(game).hasStarted).toBe(true);
    expect(
      buildGameView(game, { isLoadingHistory: true }).isLoadingHistory
    ).toBe(true);
  });
});

describe('buildDevCaption', () => {
  const player = (name: string, knights: number) =>
    ({
      name,
      discoveryCards: {
        knights,
        victoryPoints: 0,
        yearOfPlenties: 0,
        roadBuilders: 0,
        monopolies: 0,
      },
    }) as any;

  it('reads as unseen when nothing of the type has been played', () => {
    expect(buildDevCaption([player('Alice', 0)], 'knights', 14)).toBe(
      '14 unseen'
    );
  });

  it('names a single player, with a count when they played several', () => {
    expect(buildDevCaption([player('Alice', 1)], 'knights', 13)).toBe('Alice');
    expect(buildDevCaption([player('Alice', 3)], 'knights', 11)).toBe(
      'Alice ×3'
    );
  });

  it('falls back to a total once more than one player has played the type', () => {
    expect(
      buildDevCaption([player('Alice', 2), player('Bob', 1)], 'knights', 11)
    ).toBe('3 played');
  });
});

describe('helpers', () => {
  it('formats steal times as wall-clock', () => {
    expect(formatStealTime(new Date(2026, 0, 2, 18, 35, 45).getTime())).toBe(
      '6:35:45 PM'
    );
    expect(formatStealTime(new Date(2026, 0, 2, 0, 5, 9).getTime())).toBe(
      '12:05:09 AM'
    );
    expect(formatStealTime(new Date(2026, 0, 2, 12, 0, 0).getTime())).toBe(
      '12:00:00 PM'
    );
  });

  it('leaves ordering alone when you are not among the players', () => {
    const players = [{ name: 'Alice' }, { name: 'Bob' }] as any;
    expect(orderPlayers(players, 'Nobody')).toBe(players);
    expect(orderPlayers(players, null)).toBe(players);
  });
});
