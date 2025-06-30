import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  bankTrade,
  buildRoad,
  buildSettlement,
  monopolySteal,
  placeSettlement,
  playerGetResources,
  playerOffer,
  unknownSteal,
} from '../gameActions';
import { game, resetGameState } from '../gameState';
import { PropbableGameState } from '../probableGameState';
import {
  expectMatchingVariantCombinations,
  expectNonZeroResources,
} from './testUtils';

jest.mock('../overlay', () => ({
  updateGameStateDisplay: jest.fn(),
}));

describe('unknownTransactions', () => {
  beforeEach(() => {
    // Reset the game state
    resetGameState();

    // Initial placements
    placeSettlement('Alice');
    placeSettlement('Bob');
    placeSettlement('Charlie');
    placeSettlement('Diana');
    placeSettlement('Diana');
    placeSettlement('Charlie');
    placeSettlement('Bob');
    placeSettlement('Alice');

    game.probableGameState = new PropbableGameState(game.players);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('creation', () => {
    it('should create unknown transactions', () => {
      playerGetResources('Alice', { brick: 3, sheep: 3 });
      playerGetResources('Bob', { tree: 1, brick: 1 });

      unknownSteal('Alice', 'Bob');

      expect(game.probableGameState.getUnknownTransactions()).toHaveLength(1);
      expect(
        game.probableGameState.getUnknownTransactions()[0].isResolved
      ).toBe(false);
    });

    it('should create branching unknown transactions correctly', () => {
      playerGetResources('Alice', { brick: 3, sheep: 3 });
      playerGetResources('Bob', { tree: 1, brick: 1 });

      unknownSteal('Alice', 'Bob');
      unknownSteal('Charlie', 'Alice');

      expect(game.probableGameState.getUnknownTransactions()).toHaveLength(2);
      expect(
        game.probableGameState.getUnknownTransactions()[0].isResolved
      ).toBe(false);
      expect(
        game.probableGameState.getUnknownTransactions()[1].isResolved
      ).toBe(false);
    });
  });

  describe('resolution', () => {
    it('should partial resolve unknown transactions', () => {
      playerGetResources('Alice', { sheep: 3 });
      playerGetResources('Bob', { tree: 1, brick: 1, ore: 1 });

      unknownSteal('Alice', 'Bob');

      expect(game.probableGameState.getUnknownTransactions()).toHaveLength(1);
      const initialTransactionResourceProbabilities =
        game.probableGameState.getTransactionResourceProbabilities(
          game.probableGameState.getUnknownTransactions()[0].id
        );

      expectNonZeroResources(initialTransactionResourceProbabilities!, {
        brick: 1 / 3,
        ore: 1 / 3,
        tree: 1 / 3,
      });

      playerOffer('Bob', { tree: 1 });

      const unknownTransactions =
        game.probableGameState.getUnknownTransactions();
      expect(unknownTransactions).toHaveLength(1);
      expect(unknownTransactions[0].isResolved).toBe(false);

      const transactionResourceProbabilities =
        game.probableGameState.getTransactionResourceProbabilities(
          unknownTransactions[0].id
        );

      expectNonZeroResources(transactionResourceProbabilities!, {
        brick: 1 / 2,
        ore: 1 / 2,
      });

      playerOffer('Bob', { brick: 1 });

      expect(game.probableGameState.getUnknownTransactions()).toHaveLength(0);
    });

    it('should partial resolve unknown transactions - scenario 2', () => {
      playerGetResources('Alice', { sheep: 3 });
      playerGetResources('Bob', { tree: 1, brick: 1, ore: 1 });

      unknownSteal('Alice', 'Bob');

      expect(game.probableGameState.getUnknownTransactions()).toHaveLength(1);
      const initialTransactionResourceProbabilities =
        game.probableGameState.getTransactionResourceProbabilities(
          game.probableGameState.getUnknownTransactions()[0].id
        );

      expectNonZeroResources(initialTransactionResourceProbabilities!, {
        brick: 1 / 3,
        ore: 1 / 3,
        tree: 1 / 3,
      });

      playerOffer('Bob', { tree: 1 });

      const unknownTransactions =
        game.probableGameState.getUnknownTransactions();
      expect(unknownTransactions).toHaveLength(1);
      expect(unknownTransactions[0].isResolved).toBe(false);

      const transactionResourceProbabilities =
        game.probableGameState.getTransactionResourceProbabilities(
          unknownTransactions[0].id
        );

      // actual is {ore: .5, brick: 0, tree: 0, wheat: 0, sheep: 0}
      expectNonZeroResources(transactionResourceProbabilities!, {
        ore: 1 / 2,
        brick: 1 / 2,
      });

      bankTrade('Alice', { brick: 1, sheep: -2 });
      playerOffer('Alice', { brick: 1 });

      const updatedTransactionResourceProbabilities =
        game.probableGameState.getTransactionResourceProbabilities(
          unknownTransactions[0].id
        );

      // test fails here, somehow the bank trade and player offer change
      // the probabilities although they have no effect
      // actual is {ore: .5, brick: 0, tree: 0, wheat: 0, sheep: 0}
      expectNonZeroResources(updatedTransactionResourceProbabilities!, {
        ore: 1 / 2,
        brick: 1 / 2,
      });

      playerOffer('Bob', { brick: 1 });

      expect(game.probableGameState.getUnknownTransactions()).toHaveLength(0);
    });

    it('should partial resolve unknown transactions - scenario 3', () => {
      playerGetResources('Alice', { sheep: 3 });
      playerGetResources('Bob', { tree: 2, brick: 1, ore: 1 });

      unknownSteal('Alice', 'Bob');

      expect(game.probableGameState.getUnknownTransactions()).toHaveLength(1);
      const initialTransactionResourceProbabilities =
        game.probableGameState.getTransactionResourceProbabilities(
          game.probableGameState.getUnknownTransactions()[0].id
        );

      expectNonZeroResources(initialTransactionResourceProbabilities!, {
        brick: 1 / 4,
        ore: 1 / 4,
        tree: 2 / 4,
      });

      bankTrade('Bob', { tree: -2, brick: 1 });

      const unknownTransactions =
        game.probableGameState.getUnknownTransactions();
      expect(unknownTransactions).toHaveLength(1);
      expect(unknownTransactions[0].isResolved).toBe(false);

      const transactionResourceProbabilities =
        game.probableGameState.getTransactionResourceProbabilities(
          unknownTransactions[0].id
        );

      // actual is {ore: .5, brick: 0, tree: 0, wheat: 0, sheep: 0}
      expectNonZeroResources(transactionResourceProbabilities!, {
        ore: 1 / 2,
        brick: 1 / 2,
      });
    });
  });
  it('should resolve unknown transactions', () => {
    playerGetResources('Alice', { brick: 3, sheep: 3 });
    playerGetResources('Bob', { tree: 1, brick: 1 });

    unknownSteal('Alice', 'Bob');

    expect(game.probableGameState.getUnknownTransactions()).toHaveLength(1);

    buildRoad('Alice');

    const unknownTransactions = game.probableGameState.getUnknownTransactions();
    expect(unknownTransactions).toHaveLength(0);
  });
});
