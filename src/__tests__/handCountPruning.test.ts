import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PropbableGameState } from '../probableGameState';
import { applyHandCountResolution } from '../chatParser';
import { game, resetGameState, ensurePlayerExists } from '../gameState';
import { PlayerType, TransactionTypeEnum } from '../types';

jest.mock('../overlay', () => ({
  updateGameStateDisplay: jest.fn(),
  showYouPlayerDialog: jest.fn(),
}));

// Minimal players (the engine only reads .name and .resources).
function player(name: string, resources: Partial<PlayerType['resources']>): PlayerType {
  return {
    name,
    resources: { sheep: 0, wheat: 0, brick: 0, tree: 0, ore: 0, ...resources },
  } as PlayerType;
}

describe('pruneByHandCounts', () => {
  // Mirrors the real game: an unknown steal leaves a card ambiguous between two
  // players, then a monopoly makes their *totals* diverge across variants, so the
  // known hand counts (from colonist's player-information panel) can finally
  // resolve which player holds the card.
  function buildAmbiguousState(): PropbableGameState {
    const pgs = new PropbableGameState([
      player('Mathe', { wheat: 1, ore: 1 }), // 2 cards
      player('Aaren', {}),
      player('Camilo', {}),
    ]);

    // Aaren steals an unknown card from Mathe -> two variants:
    //   A) stole wheat: Aaren{wheat}, Mathe{ore}
    //   B) stole ore:   Aaren{ore},   Mathe{wheat}
    pgs.processTransaction({
      type: TransactionTypeEnum.ROBBER_STEAL,
      stealerName: 'Aaren',
      victimName: 'Mathe',
      stolenResource: null,
    });

    // Camilo monopolizes ore, taking 1 total. This survives in both variants but
    // zeroes everyone's ore, so now the variants differ in *who still holds a card*:
    //   A) Aaren{wheat} total 1, Mathe{} total 0
    //   B) Aaren{} total 0,      Mathe{wheat} total 1
    pgs.processTransaction({
      type: TransactionTypeEnum.MONOPOLY,
      playerName: 'Camilo',
      resourceType: 'ore',
      totalStolen: 1,
    });
    return pgs;
  }

  it('leaves the steal unresolved before hand counts are known', () => {
    const pgs = buildAmbiguousState();
    expect(
      pgs.getUnknownTransactions().filter(t => !t.isResolved)
    ).toHaveLength(1);
    // The contested wheat is genuinely ambiguous between Mathe and Aaren.
    expect(
      pgs.getPlayerResourceProbabilities('Mathe').additionalResourceProbabilities
        .wheat
    ).toBeGreaterThan(0);
  });

  it('resolves the steal once hand counts pin the distribution (Mathe 0, Aaren 1)', () => {
    const pgs = buildAmbiguousState();

    // From colonist's player-information panel: Mathe holds 0 cards, Aaren holds 1.
    pgs.pruneByHandCounts({ Mathe: 0, Aaren: 1 });

    // Variant B (Mathe still holds the wheat) is impossible -> pruned.
    expect(
      pgs.getUnknownTransactions().filter(t => !t.isResolved)
    ).toHaveLength(0);

    const aaren = pgs.getPlayerResourceProbabilities('Aaren');
    const mathe = pgs.getPlayerResourceProbabilities('Mathe');
    expect(aaren.minimumResources.wheat).toBe(1); // Aaren definitely has the wheat
    expect(aaren.additionalResourceProbabilities.wheat).toBe(0);
    expect(mathe.minimumResources.wheat).toBe(0);
    expect(mathe.additionalResourceProbabilities.wheat).toBe(0);
  });
});

describe('applyHandCountResolution (scrape panel + prune)', () => {
  beforeEach(() => {
    resetGameState();
    document.body.innerHTML = '';
  });

  // End-to-end glue: builds the same ambiguous state on the live `game`, renders a
  // player-information panel with the real counts, and confirms the steal resolves.
  it('resolves a steal by reading the live player-information panel', () => {
    ensurePlayerExists('Mathe');
    ensurePlayerExists('Aaren');
    ensurePlayerExists('Camilo');
    const mathe = game.players.find(p => p.name === 'Mathe')!;
    mathe.resources = { sheep: 0, wheat: 1, brick: 0, tree: 0, ore: 1 };

    game.probableGameState = new PropbableGameState(game.players);
    game.probableGameState.processTransaction({
      type: TransactionTypeEnum.ROBBER_STEAL,
      stealerName: 'Aaren',
      victimName: 'Mathe',
      stolenResource: null,
    });
    game.probableGameState.processTransaction({
      type: TransactionTypeEnum.MONOPOLY,
      playerName: 'Camilo',
      resourceType: 'ore',
      totalStolen: 1,
    });

    expect(
      game.probableGameState.getUnknownTransactions().filter(t => !t.isResolved)
    ).toHaveLength(1);

    // Live panel: Mathe 0 cards, Aaren 1, Camilo 1 (the monopolised ore).
    document.body.innerHTML = `
      <div data-player-information-container="true">
        <div data-player-color="2"><div>Mathe</div>
          <div data-resource-card><div>0</div></div></div>
        <div data-player-color="3"><div>Aaren</div>
          <div data-resource-card><div>1</div></div></div>
        <div data-player-color="1"><div>Camilo</div>
          <div data-resource-card><div>1</div></div></div>
      </div>`;

    applyHandCountResolution();

    expect(
      game.probableGameState.getUnknownTransactions().filter(t => !t.isResolved)
    ).toHaveLength(0);
    expect(
      game.probableGameState.getPlayerResourceProbabilities('Aaren')
        .minimumResources.wheat
    ).toBe(1);
  });
});
