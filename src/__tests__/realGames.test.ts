// This file contains transaction logs from real games where I encountered some bug

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { placeSettlement } from '../gameActions';
import { game, resetGameState } from '../gameState';
import { PropbableGameState } from '../probableGameState';
import { TransactionType } from '../types';
import { game2 } from './gameTransactionLogs/game2';
import { game1 } from './gameTransactionLogs/game1';

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

  it('handle scenario 1 correctly', () => {
    const gameTransactions = game1;
    for (const transaction of gameTransactions) {
      game.probableGameState.processTransaction(transaction as TransactionType);
    }

    // In the game there were 3 unknown robs in a row, but it created 5 transactions
    expect(game.probableGameState.getUnknownTransactions()).toHaveLength(3);
  });
});

describe('real game 2', () => {
  beforeEach(() => {
    // Reset the game state
    resetGameState();

    // Initial placements
    placeSettlement('Lovich');
    placeSettlement('Marthe');
    placeSettlement('NickTheSwift');
    placeSettlement('Merril');

    game.probableGameState = new PropbableGameState(game.players);

    // Clear all mocks
    jest.clearAllMocks();
  });

  it('handle scenario 1 correctly', () => {
    const gameTransactions = game2;
    for (const transaction of gameTransactions) {
      game.probableGameState.processTransaction(transaction as TransactionType);
    }

    // In the game there should be only 2 unresolved transactions but there were 3
    expect(game.probableGameState.getUnknownTransactions()).toHaveLength(2);
  });
});
