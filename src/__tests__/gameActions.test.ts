import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  monopolySteal,
  placeSettlement,
  playerGetResources,
  playerOffer,
  receiveStartingResources,
  unknownSteal,
} from '../gameActions';
import { game, resetGameState } from '../gameState';
import { ResourceObjectType } from '../types';

// Mock only the overlay to avoid DOM dependencies
jest.mock('../overlay', () => ({
  updateGameStateDisplay: jest.fn(),
}));

describe('gameActions', () => {
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

    // Clear all mocks
    jest.clearAllMocks();
  });

  it('after initial placements, game state should be correct', () => {
    expect(game.players.length).toBe(4);
    expect(game.players.map(p => p.name)).toEqual([
      'Alice',
      'Bob',
      'Charlie',
      'Diana',
    ]);
    expect(game.players.map(p => p.resources)).toEqual([
      { sheep: 0, wheat: 0, brick: 0, tree: 0, ore: 0 },
      { sheep: 0, wheat: 0, brick: 0, tree: 0, ore: 0 },
      { sheep: 0, wheat: 0, brick: 0, tree: 0, ore: 0 },
      { sheep: 0, wheat: 0, brick: 0, tree: 0, ore: 0 },
    ]);
    expect(game.players.map(p => p.settlements)).toEqual([3, 3, 3, 3]);
  });

  describe('receiveStartingResources', () => {
    it('should handle starting resources for four players correctly', () => {
      // Define starting resources for each player
      const aliceStartingResources: Partial<ResourceObjectType> = {
        wheat: 1,
        brick: 1,
        ore: 1,
      };

      const bobStartingResources: Partial<ResourceObjectType> = {
        sheep: 2,
        tree: 1,
      };

      const charlieStartingResources: Partial<ResourceObjectType> = {
        wheat: 1,
        sheep: 1,
        ore: 1,
      };

      const dianaStartingResources: Partial<ResourceObjectType> = {
        brick: 2,
        tree: 1,
        wheat: 1,
      };

      // Call receiveStartingResources for each player
      receiveStartingResources('Alice', aliceStartingResources);
      receiveStartingResources('Bob', bobStartingResources);
      receiveStartingResources('Charlie', charlieStartingResources);
      receiveStartingResources('Diana', dianaStartingResources);

      // Verify the actual game state after all operations
      const alice = game.players.find(p => p.name === 'Alice')!;
      const bob = game.players.find(p => p.name === 'Bob')!;
      const charlie = game.players.find(p => p.name === 'Charlie')!;
      const diana = game.players.find(p => p.name === 'Diana')!;

      // Verify Alice's resources
      expect(alice.resources).toEqual({
        sheep: 0,
        wheat: 1,
        brick: 1,
        tree: 0,
        ore: 1,
      });

      // Verify Bob's resources
      expect(bob.resources).toEqual({
        sheep: 2,
        wheat: 0,
        brick: 0,
        tree: 1,
        ore: 0,
      });

      // Verify Charlie's resources
      expect(charlie.resources).toEqual({
        sheep: 1,
        wheat: 1,
        brick: 0,
        tree: 0,
        ore: 1,
      });

      // Verify Diana's resources
      expect(diana.resources).toEqual({
        sheep: 0,
        wheat: 1,
        brick: 2,
        tree: 1,
        ore: 0,
      });

      // Verify bank resources (should be decreased by what players gained)
      expect(game.gameResources).toEqual({
        sheep: 16, // 19 - 3 (Bob: 2, Charlie: 1)
        wheat: 16, // 19 - 3 (Alice: 1, Charlie: 1, Diana: 1)
        brick: 16, // 19 - 3 (Alice: 1, Diana: 2)
        tree: 17, // 19 - 2 (Bob: 1, Diana: 1)
        ore: 17, // 19 - 2 (Alice: 1, Charlie: 1)
      });
    });

    it('should not change state when playerName is null', () => {
      const resources: Partial<ResourceObjectType> = { wheat: 1, brick: 1 };
      const initialGameResources = { ...game.gameResources };

      receiveStartingResources(null, resources);

      // Game resources should remain unchanged
      expect(game.gameResources).toEqual(initialGameResources);
    });

    it('should not change state when no resources are provided', () => {
      const emptyResources: Partial<ResourceObjectType> = {};
      const initialGameResources = { ...game.gameResources };
      const alice = game.players.find(p => p.name === 'Alice')!;
      const initialAliceResources = { ...alice.resources };

      receiveStartingResources('Alice', emptyResources);

      // Both game and player resources should remain unchanged
      expect(game.gameResources).toEqual(initialGameResources);
      expect(alice.resources).toEqual(initialAliceResources);
    });

    it('should not change state when all resource values are zero', () => {
      const zeroResources: Partial<ResourceObjectType> = {
        wheat: 0,
        brick: 0,
        tree: 0,
        sheep: 0,
        ore: 0,
      };
      const initialGameResources = { ...game.gameResources };
      const alice = game.players.find(p => p.name === 'Alice')!;
      const initialAliceResources = { ...alice.resources };

      receiveStartingResources('Alice', zeroResources);

      // Both game and player resources should remain unchanged
      expect(game.gameResources).toEqual(initialGameResources);
      expect(alice.resources).toEqual(initialAliceResources);
    });

    it('should handle partial resource objects correctly', () => {
      const partialResources: Partial<ResourceObjectType> = {
        wheat: 2,
      };

      receiveStartingResources('Alice', partialResources);

      const alice = game.players.find(p => p.name === 'Alice')!;

      // Verify Alice got the wheat
      expect(alice.resources.wheat).toBe(2);
      expect(alice.resources.sheep).toBe(0);
      expect(alice.resources.brick).toBe(0);
      expect(alice.resources.tree).toBe(0);
      expect(alice.resources.ore).toBe(0);

      // Verify bank lost the wheat
      expect(game.gameResources.wheat).toBe(17); // 19 - 2
    });
  });

  describe('playerOffer', () => {
    it('should eliminate resource from unknown steals when player offers their maxiumum possible amount of that resource', () => {
      playerGetResources('Alice', { wheat: 1, brick: 1, tree: 1 });
      // Bob has no resources
      expect(game.players.find(p => p.name === 'Bob')!.resources).toEqual({
        sheep: 0,
        wheat: 0,
        brick: 0,
        tree: 0,
        ore: 0,
      });

      unknownSteal('Bob', 'Alice');

      expect(game.unknownTransactions.length).toBe(1);
      expect(game.unknownTransactions[0].thief).toBe('Bob');
      expect(game.unknownTransactions[0].victim).toBe('Alice');
      expect(game.unknownTransactions[0].possibleResources).toEqual({
        wheat: 1,
        brick: 1,
        tree: 1,
        ore: 0,
        sheep: 0,
      });

      expect(
        game.players.find(p => p.name === 'Bob')!.resourceProbabilities
      ).toEqual({ wheat: 1 / 3, brick: 1 / 3, tree: 1 / 3, ore: 0, sheep: 0 });
      expect(
        game.players.find(p => p.name === 'Alice')!.resourceProbabilities
      ).toEqual({
        wheat: -1 / 3,
        brick: -1 / 3,
        tree: -1 / 3,
        ore: 0,
        sheep: 0,
      });

      playerOffer('Alice', { wheat: 1 });
      expect(game.unknownTransactions.length).toBe(1);
      // since Alice has 1 wheat, Bob must have one of the other resources
      expect(game.unknownTransactions[0].possibleResources).toEqual({
        wheat: 0,
        brick: 1,
        tree: 1,
        ore: 0,
        sheep: 0,
      });

      // player resource probabilities should be updated
      expect(
        game.players.find(p => p.name === 'Bob')!.resourceProbabilities
      ).toEqual({ wheat: 0, brick: 0.5, tree: 0.5, ore: 0, sheep: 0 });
      expect(
        game.players.find(p => p.name === 'Alice')!.resourceProbabilities
      ).toEqual({ wheat: 0, brick: -0.5, tree: -0.5, ore: 0, sheep: 0 });
    });
  });
  describe('monopolySteal', () => {
    it('should steal all the wheat from the bank', () => {
      playerGetResources('Alice', { wheat: 1 });
      playerGetResources('Bob', { wheat: 2 });
      playerGetResources('Charlie', { wheat: 3 });
      playerGetResources('Diana', { wheat: 1 });

      expect(game.gameResources.wheat).toBe(12);

      monopolySteal('Alice', 'wheat', 6);

      expect(game.players.find(p => p.name === 'Alice')!.resources.wheat).toBe(
        7
      );
      expect(game.gameResources.wheat).toBe(12);
      expect(game.players.find(p => p.name === 'Bob')!.resources.wheat).toBe(0);
      expect(
        game.players.find(p => p.name === 'Charlie')!.resources.wheat
      ).toBe(0);
      expect(game.players.find(p => p.name === 'Diana')!.resources.wheat).toBe(
        0
      );
    });
  });

  describe('Unknown transactions handling', () => {
    it('should eliminate unknown transactions if there only remains one possible resource', () => {
      playerGetResources('Alice', { wheat: 4, brick: 1 });

      unknownSteal('Bob', 'Alice');

      expect(game.unknownTransactions.filter(t => !t.isResolved).length).toBe(
        1
      );
      expect(game.unknownTransactions[0].thief).toBe('Bob');
      expect(game.unknownTransactions[0].victim).toBe('Alice');
      expect(game.unknownTransactions[0].possibleResources).toEqual({
        wheat: 4,
        brick: 1,
        tree: 0,
        ore: 0,
        sheep: 0,
      });
      expect(game.players.find(p => p.name === 'Bob')!.resources).toEqual({
        sheep: 0,
        wheat: 0,
        brick: 0,
        tree: 0,
        ore: 0,
      });
      expect(
        game.players.find(p => p.name === 'Bob')!.resourceProbabilities
      ).toEqual({
        wheat: 4 / 5,
        brick: 1 / 5,
        tree: 0,
        ore: 0,
        sheep: 0,
      });
      expect(
        game.players.find(p => p.name === 'Alice')!.resourceProbabilities
      ).toEqual({
        wheat: -4 / 5,
        brick: -1 / 5,
        tree: 0,
        ore: 0,
        sheep: 0,
      });

      // Alice offers brick so, Bob must have stolen one of the 4 wheats
      playerOffer('Alice', { brick: 1 });

      // unknown transactions should be eliminated
      expect(game.unknownTransactions.filter(t => !t.isResolved).length).toBe(
        0
      );
      // Bob should have 1 wheat
      expect(game.players.find(p => p.name === 'Bob')!.resources).toEqual({
        wheat: 1,
        brick: 0,
        tree: 0,
        ore: 0,
        sheep: 0,
      });
      // Alice should have 3 wheat and 1 brick
      expect(game.players.find(p => p.name === 'Alice')!.resources).toEqual({
        sheep: 0,
        wheat: 3,
        brick: 1,
        tree: 0,
        ore: 0,
      });

      // both players resource probabilities should be 0
      expect(
        game.players.find(p => p.name === 'Bob')!.resourceProbabilities
      ).toEqual({
        wheat: 0,
        brick: 0,
        tree: 0,
        ore: 0,
        sheep: 0,
      });
      expect(
        game.players.find(p => p.name === 'Alice')!.resourceProbabilities
      ).toEqual({
        wheat: 0,
        brick: 0,
        tree: 0,
        ore: 0,
        sheep: 0,
      });
    });

    it('should eliminate unknown transactions if there only remains one possible resource 2', () => {
      // making this mimic a real case I found that somehow isn't covered above
      playerGetResources('Alice', { wheat: 1, brick: 1 });
      playerGetResources('Bob', { sheep: 2, brick: 1, tree: 1 });
      unknownSteal('Bob', 'Alice');
      playerGetResources('Alice', { ore: 1 });

      expect(game.unknownTransactions.filter(t => !t.isResolved).length).toBe(
        1
      );
      expect(game.unknownTransactions[0].thief).toBe('Bob');
      expect(game.unknownTransactions[0].victim).toBe('Alice');

      // Alice offers wheat so, Bob must have stolen the brick
      playerOffer('Alice', { wheat: 1 });

      // unknown transactions should be eliminated
      expect(game.unknownTransactions.filter(t => !t.isResolved).length).toBe(
        0
      );
      // Bob should have 1 wheat
      expect(game.players.find(p => p.name === 'Bob')!.resources).toEqual({
        wheat: 0,
        brick: 2,
        tree: 1,
        ore: 0,
        sheep: 2,
      });
      // Alice should have 3 wheat and 1 brick
      expect(game.players.find(p => p.name === 'Alice')!.resources).toEqual({
        sheep: 0,
        wheat: 1,
        brick: 0,
        tree: 0,
        ore: 1,
      });

      // both players resource probabilities should be 0
      expect(
        game.players.find(p => p.name === 'Bob')!.resourceProbabilities
      ).toEqual({
        wheat: 0,
        brick: 0,
        tree: 0,
        ore: 0,
        sheep: 0,
      });
      expect(
        game.players.find(p => p.name === 'Alice')!.resourceProbabilities
      ).toEqual({
        wheat: 0,
        brick: 0,
        tree: 0,
        ore: 0,
        sheep: 0,
      });
    });
  });
});
