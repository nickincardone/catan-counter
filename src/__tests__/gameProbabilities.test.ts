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
import { PropbableGameState } from '../gameStateWithVariants';
import {
  expectMatchingVariantCombinations,
  expectNonZeroResources,
} from './testUtils';

// Mock only the overlay to avoid DOM dependencies
jest.mock('../overlay', () => ({
  updateGameStateDisplay: jest.fn(),
}));
describe('gameProbabilities', () => {
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

  describe('variant creation', () => {
    it('should create 2 variants for two resources', () => {
      playerGetResources('Alice', { brick: 3, sheep: 3 });
      playerGetResources('Bob', { tree: 1, brick: 1 });

      unknownSteal('Alice', 'Bob');

      const possibleGameStates =
        game.probableGameState.getAllPossibleGameStates();

      expect(possibleGameStates.length).toBe(2);
      expect(possibleGameStates[0].probability).toEqual(0.5);
      expect(possibleGameStates[1].probability).toEqual(0.5);

      const expectedCombinations = [
        {
          resources: {
            Alice: { brick: 3, sheep: 3, tree: 1 },
            Bob: { brick: 1 },
          },
          probability: 0.5,
        },
        {
          resources: {
            Alice: { brick: 4, sheep: 3 },
            Bob: { tree: 1 },
          },
          probability: 0.5,
        },
      ];

      expectMatchingVariantCombinations(
        expectedCombinations,
        possibleGameStates
      );
    });

    it('should create 4 variants for four resources', () => {
      playerGetResources('Alice', { brick: 3, sheep: 3 });
      playerGetResources('Bob', { tree: 1, brick: 1, ore: 1, wheat: 1 });

      unknownSteal('Alice', 'Bob');

      const possibleGameStates =
        game.probableGameState.getAllPossibleGameStates();

      expect(possibleGameStates.length).toBe(4);
      expect(possibleGameStates[0].probability).toEqual(0.25);
      expect(possibleGameStates[1].probability).toEqual(0.25);
      expect(possibleGameStates[2].probability).toEqual(0.25);
      expect(possibleGameStates[3].probability).toEqual(0.25);

      // Test that we have all expected combinations (Alice steals one of Bob's 4 resources)
      const expectedCombinations = [
        {
          resources: {
            Alice: { brick: 3, sheep: 3, tree: 1 },
            Bob: { brick: 1, ore: 1, wheat: 1 },
          },
          probability: 0.25,
        },
        {
          resources: {
            Alice: { brick: 4, sheep: 3 },
            Bob: { tree: 1, ore: 1, wheat: 1 },
          },
          probability: 0.25,
        },
        {
          resources: {
            Alice: { brick: 3, sheep: 3, ore: 1 },
            Bob: { brick: 1, tree: 1, wheat: 1 },
          },
          probability: 0.25,
        },
        {
          resources: {
            Alice: { brick: 3, sheep: 3, wheat: 1 },
            Bob: { brick: 1, tree: 1, ore: 1 },
          },
          probability: 0.25,
        },
      ];

      expectMatchingVariantCombinations(
        expectedCombinations,
        possibleGameStates
      );
    });
  });

  describe('variant resolution', () => {
    it('should resolve simple variants where user had to steal something specific', () => {
      playerGetResources('Alice', { brick: 3, sheep: 3 });
      playerGetResources('Bob', { tree: 1, brick: 1 });

      unknownSteal('Alice', 'Bob');

      const possibleGameStates =
        game.probableGameState.getAllPossibleGameStates();

      expect(possibleGameStates.length).toBe(2);
      expect(possibleGameStates[0].probability).toEqual(0.5);
      expect(possibleGameStates[1].probability).toEqual(0.5);

      const expectedCombinations = [
        {
          resources: {
            Alice: { brick: 3, sheep: 3, tree: 1 },
            Bob: { brick: 1 },
          },
          probability: 0.5,
        },
        {
          resources: {
            Alice: { brick: 4, sheep: 3 },
            Bob: { tree: 1 },
          },
          probability: 0.5,
        },
      ];

      expectMatchingVariantCombinations(
        expectedCombinations,
        possibleGameStates
      );

      buildRoad('Alice');

      // Alice built a road so she had to steal a tree
      const updatedPossibleGameStates =
        game.probableGameState.getAllPossibleGameStates();

      expect(updatedPossibleGameStates.length).toBe(1);
      expect(updatedPossibleGameStates[0].probability).toEqual(1);

      expectNonZeroResources(
        updatedPossibleGameStates[0].gameState['Alice'].resources,
        {
          brick: 2,
          sheep: 3,
        }
      );
    });

    it('should resolve 1 card steals', () => {
      playerGetResources('Alice', { brick: 3, sheep: 3 });
      playerGetResources('Bob', { tree: 1 });

      unknownSteal('Alice', 'Bob');

      const possibleGameStates =
        game.probableGameState.getAllPossibleGameStates();

      expect(possibleGameStates.length).toBe(1);
      expect(possibleGameStates[0].probability).toEqual(1);
    });

    it('should resolve 1 resource steals', () => {
      playerGetResources('Alice', { brick: 3, sheep: 3 });
      playerGetResources('Bob', { tree: 2 });

      unknownSteal('Alice', 'Bob');

      const possibleGameStates =
        game.probableGameState.getAllPossibleGameStates();

      expect(possibleGameStates.length).toBe(1);
      expect(possibleGameStates[0].probability).toEqual(1);

      expectNonZeroResources(
        possibleGameStates[0].gameState['Alice'].resources,
        {
          brick: 3,
          tree: 1,
          sheep: 3,
        }
      );

      expectNonZeroResources(possibleGameStates[0].gameState['Bob'].resources, {
        tree: 1,
      });
    });

    it('should resolve variants when user double steals from someone with two cards', () => {
      playerGetResources('Alice', { brick: 3, sheep: 3 });
      playerGetResources('Bob', { tree: 1, brick: 1 });

      unknownSteal('Alice', 'Bob');
      unknownSteal('Alice', 'Bob');

      const possibleGameStates =
        game.probableGameState.getAllPossibleGameStates();

      expect(possibleGameStates.length).toBe(1);
      expect(possibleGameStates[0].probability).toEqual(1);
    });

    it('should resolve complex variants when there is a monopoly', () => {
      playerGetResources('Alice', { wheat: 4 });
      playerGetResources('Bob', { wheat: 2, brick: 1 });
      playerGetResources('Charlie', { ore: 2 });

      unknownSteal('Alice', 'Bob');
      unknownSteal('Charlie', 'Bob');

      monopolySteal('Bob', 'wheat', 6);

      // this means that both steals were Bob's wheat
      const possibleGameStates =
        game.probableGameState.getAllPossibleGameStates();

      expect(possibleGameStates.length).toBe(1);

      expectNonZeroResources(possibleGameStates[0].gameState['Bob'].resources, {
        wheat: 6,
        brick: 1,
      });

      expectNonZeroResources(
        possibleGameStates[0].gameState['Alice'].resources,
        {}
      );

      expectNonZeroResources(
        possibleGameStates[0].gameState['Charlie'].resources,
        { ore: 2 }
      );
    });

    it('should notresolve complex variants when there is a monopoly and it cannot be determined', () => {
      playerGetResources('Alice', { wheat: 4 });
      playerGetResources('Bob', { wheat: 2, brick: 1 });
      playerGetResources('Charlie', { ore: 2 });

      unknownSteal('Alice', 'Bob');
      unknownSteal('Charlie', 'Bob');

      monopolySteal('Bob', 'wheat', 5);

      // this means that one of the steals was a wheat and the other was a brick
      // but we don't know which one
      // TODO: if we ever know how many total cards a player has we
      // can resolve this as we know the wheat came from
      // whomever lost an extra card
      const possibleGameStates =
        game.probableGameState.getAllPossibleGameStates();

      expect(possibleGameStates.length).toBe(2);
    });

    it('should resolve complex variants - scenario 1', () => {
      playerGetResources('Alice', { brick: 3, sheep: 3 });
      playerGetResources('Bob', { sheep: 1, tree: 1, brick: 1 });

      unknownSteal('Alice', 'Bob');
      unknownSteal('Alice', 'Bob');

      const possibleGameStates =
        game.probableGameState.getAllPossibleGameStates();
      expect(possibleGameStates.length).toBe(3);

      bankTrade('Alice', { brick: -3, wheat: 1 });
      buildSettlement('Alice');

      // If alice built a settlement then she had to steal a brick and a tree from Bob
      // so we don't know which steal was which but we should be able to resolve them both as a group

      const updatedPossibleGameStates =
        game.probableGameState.getAllPossibleGameStates();

      expect(updatedPossibleGameStates.length).toBe(1);
      expect(updatedPossibleGameStates[0].probability).toEqual(1);
    });

    it('should resolve complex variants - scenario 2', () => {
      playerGetResources('Alice', { wheat: 4, brick: 1 });
      playerGetResources('Charlie', { wheat: 2, brick: 1 });

      unknownSteal('Bob', 'Alice');
      unknownSteal('Bob', 'Charlie');

      const possibleGameStates =
        game.probableGameState.getAllPossibleGameStates();

      expect(possibleGameStates.length).toBe(4);

      const expectedCombinations = [
        {
          resources: {
            Alice: { wheat: 3, brick: 1 },
            Bob: { wheat: 2 },
            Charlie: { wheat: 1, brick: 1 },
          },
          probability: 8 / 15, // Wheat from Alice + Wheat from Charlie
        },
        {
          resources: {
            Alice: { wheat: 3, brick: 1 },
            Bob: { wheat: 1, brick: 1 },
            Charlie: { wheat: 2 },
          },
          probability: 4 / 15, // Wheat from Alice + Brick from Charlie
        },
        {
          resources: {
            Alice: { wheat: 4 },
            Bob: { wheat: 1, brick: 1 },
            Charlie: { wheat: 1, brick: 1 },
          },
          probability: 2 / 15, // Brick from Alice + Wheat from Charlie
        },
        {
          resources: {
            Alice: { wheat: 4 },
            Bob: { brick: 2 },
            Charlie: { wheat: 2 },
          },
          probability: 1 / 15, // Brick from Alice + Brick from Charlie
        },
      ];

      expectMatchingVariantCombinations(
        expectedCombinations,
        possibleGameStates
      );

      expectNonZeroResources(
        game.probableGameState.getPlayerResourceProbabilities('Alice')
          .additionalResourceProbabilities,
        {
          brick: 0.8,
          wheat: 0.2,
        }
      );

      expectNonZeroResources(
        game.probableGameState.getPlayerResourceProbabilities('Bob')
          .additionalResourceProbabilities,
        {
          brick: 7 / 15,
          wheat: 14 / 15,
        }
      );

      // Bob offers 2 brick so he must have stolen brick from both players
      playerOffer('Bob', { brick: 2 });

      const updatedPossibleGameStates =
        game.probableGameState.getAllPossibleGameStates();

      expect(updatedPossibleGameStates.length).toBe(1);
      expect(updatedPossibleGameStates[0].probability).toEqual(1);
    });

    it('should resolve complex variants - scenario 3', () => {
      playerGetResources('Alice', { wheat: 4 });
      playerGetResources('Bob', { wheat: 2, brick: 1 });
      playerGetResources('Charlie', { ore: 2 });

      unknownSteal('Alice', 'Bob');
      unknownSteal('Charlie', 'Alice');

      const possibleGameStates =
        game.probableGameState.getAllPossibleGameStates();

      expect(possibleGameStates.length).toBe(3);

      playerOffer('Charlie', { brick: 1 });
      const updatedPossibleGameStates =
        game.probableGameState.getAllPossibleGameStates();

      // This means Alice stole a brick which was then stolen by Charlie
      expect(updatedPossibleGameStates.length).toBe(1);
      expect(updatedPossibleGameStates[0].probability).toEqual(1);
    });
  });
});
