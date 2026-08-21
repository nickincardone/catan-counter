import {
  GameType,
  GameTypeEnum,
  PlayerType,
  ResourceObjectType,
  UnknownTransaction,
} from './types.js';
import {
  getCurrentPlayerFromHeader,
  getCurrentPlayerFromPanel,
} from './domUtils.js';
import { PropbableGameState } from './probableGameState.js';

export function getDefaultGame(): GameType {
  return {
    players: [],
    gameType: GameTypeEnum.STANDARD,
    // Highest chat data-index processed so far; -1 means "none yet" so that the
    // first message (data-index 0) is still processed. See checkDuplicateElement.
    chatsProcessed: -1,
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
    cardLedger: {},
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
 * Automatically sets the current player from web-header-username
 * Returns true if successful, false otherwise
 */
export function autoDetectCurrentPlayer(): boolean {
  // The panel knows which seat the viewer is sitting in, so ask it first.
  const fromPanel = getCurrentPlayerFromPanel();
  if (fromPanel) {
    setYouPlayer(fromPanel);
    hasAskedForYouPlayer = true;
    console.log(`✅ Auto-detected current player from the panel: ${fromPanel}`);
    return true;
  }

  // The header holds the logged-in ACCOUNT name, which is only the same thing
  // when you are playing your own game. In a replay or while spectating it is
  // someone who is not at the table, and accepting it sends every "from you"
  // steal to a player who does not exist — silently, because the actions that
  // move those cards just return when they cannot find the name.
  const fromHeader = getCurrentPlayerFromHeader();
  if (fromHeader && game.players.some(player => player.name === fromHeader)) {
    setYouPlayer(fromHeader);
    hasAskedForYouPlayer = true;
    console.log(
      `✅ Auto-detected current player from the header: ${fromHeader}`
    );
    return true;
  }
  if (fromHeader) {
    console.log(
      `🔍 Ignoring header name "${fromHeader}" — not a player in this game`
    );
  }

  console.log('❌ Failed to auto-detect current player');
  return false;
}

/** Whether "you" names somebody actually sitting at this table. */
export function youPlayerIsSeated(): boolean {
  return (
    !!game.youPlayerName &&
    game.players.some(player => player.name === game.youPlayerName)
  );
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
