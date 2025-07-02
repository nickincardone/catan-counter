// This file contains transaction logs from real games where I encountered some bug

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
import { game1 } from './gameTransactionLogs/game1';
import { TransactionType } from '../types';

jest.mock('../overlay', () => ({
  updateGameStateDisplay: jest.fn(),
}));

describe('real game 1', () => {
  beforeEach(() => {
    // Reset the game state
    resetGameState();

    // Initial placements
    placeSettlement('NickTheSwift');
    placeSettlement('Beagle77');
    placeSettlement('Hobbie6244');
    placeSettlement('88ym88');

    game.probableGameState = new PropbableGameState(game.players);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('creation', () => {
    it('handle scenario 1 correctly', () => {
      const gameTransactions = game1;
      for (const transaction of gameTransactions) {
        console.log(transaction);
        game.probableGameState.processTransaction(
          transaction as TransactionType
        );
      }

      // In the game there were 3 unknown robs in a row, but it created 5 transactions
      expect(game.probableGameState.getUnknownTransactions()).toHaveLength(3);
    });
  });
});
