import {
  GameType,
  GameTypeEnum,
  PlayerType,
  ResourceObjectType,
  UnknownTransaction,
} from './types.js';
import { getCurrentPlayerFromHeader } from './domUtils.js';
import { PropbableGameState } from './gameStateWithVariants.js';

export function getDefaultGame(): GameType {
  return {
    players: [],
    gameType: GameTypeEnum.STANDARD,
    gameResources: {
      sheep: 19,
      wheat: 19,
      brick: 19,
      tree: 19,
      ore: 19,
    },
    devCards: 25,
    knights: 14,
    victoryPoints: 5,
    yearOfPlenties: 2,
    roadBuilders: 2,
    monopolies: 2,
    hasRolledFirstDice: false,
    diceRolls: {
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
      10: 0,
      11: 0,
      12: 0,
    },
    blockedDiceRolls: {},
    remainingDiscoveryCardsProbabilities: {
      knights: 0,
      victoryPoints: 0,
      yearOfPlenties: 0,
      roadBuilders: 0,
      monopolies: 0,
    },
    youPlayerName: null,
    probableGameState: new PropbableGameState([]),
  };
}

export let game: GameType = getDefaultGame();

let hasAskedForYouPlayer = false;
export let isWaitingForYouPlayerSelection = false;

export function setYouPlayer(playerName: string): void {
  game.youPlayerName = playerName;
  isWaitingForYouPlayerSelection = false;
}

/**
 * Automatically sets the current player from header_profile_username
 * Returns true if successful, false otherwise
 */
export function autoDetectCurrentPlayer(): boolean {
  const detectedPlayer = getCurrentPlayerFromHeader();
  if (detectedPlayer) {
    setYouPlayer(detectedPlayer);
    hasAskedForYouPlayer = true; // Mark as resolved
    console.log(`✅ Auto-detected and set current player: ${detectedPlayer}`);
    return true;
  }

  console.log('❌ Failed to auto-detect current player');
  return false;
}

export function setYouPlayerForTesting(playerName: string): void {
  game.youPlayerName = playerName;
  hasAskedForYouPlayer = true;
  isWaitingForYouPlayerSelection = false;
}

export function markYouPlayerAsked(): void {
  hasAskedForYouPlayer = true;
  isWaitingForYouPlayerSelection = true;
}

export function resetGameState(): void {
  // Reset game state but keep "you" player info
  const previousYouPlayer = game.youPlayerName;
  const previousAskedStatus = hasAskedForYouPlayer;
  const previousWaitingStatus = isWaitingForYouPlayerSelection;

  game = getDefaultGame();

  // Restore "you" player info
  game.youPlayerName = previousYouPlayer;
  hasAskedForYouPlayer = previousAskedStatus;
  isWaitingForYouPlayerSelection = previousWaitingStatus;

  console.log('🔄 Game state reset, reprocessing messages...');
}

export function ensurePlayerExists(playerName: string, color?: string): void {
  const existingPlayer = game.players.find(p => p.name === playerName);
  if (!existingPlayer) {
    const newPlayer: PlayerType = {
      name: playerName,
      color: color || '#000',
      resources: { sheep: 0, wheat: 0, brick: 0, tree: 0, ore: 0 },
      resourceProbabilities: { sheep: 0, wheat: 0, brick: 0, tree: 0, ore: 0 },
      settlements: 5,
      cities: 4,
      roads: 15,
      knights: 0,
      victoryPoints: 0,
      discoveryCards: {
        knights: 0,
        victoryPoints: 0,
        yearOfPlenties: 0,
        roadBuilders: 0,
        monopolies: 0,
      },
      discoveryCardProbabilities: {
        knights: 0,
        victoryPoints: 0,
        yearOfPlenties: 0,
        roadBuilders: 0,
        monopolies: 0,
      },
      totalRobbers: 0,
      totalCards: 0,
    };
    game.players.push(newPlayer);
  }
}

export function updateResources(
  playerName: string,
  resourceChanges: Partial<ResourceObjectType>
): void {
  const player = game.players.find(p => p.name === playerName);
  if (!player) return;
  Object.keys(resourceChanges).forEach(resource => {
    const key = resource as keyof ResourceObjectType;
    const change = resourceChanges[key];
    if (change !== undefined) {
      player.resources[key] += change;
      game.gameResources[key] -= change;
    }
  });
}
