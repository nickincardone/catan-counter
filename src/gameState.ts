import { GameType, PlayerType, ResourceObjectType } from './types.js';

export function getDefaultGame(): GameType {
  return {
    players: [],
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
    remainingDiscoveryCardsProbabilities: {
      knights: 0,
      victoryPoints: 0,
      yearOfPlenties: 0,
      roadBuilders: 0,
      monopolies: 0,
    },
  };
}

export let game: GameType = getDefaultGame();

export function ensurePlayerExists(playerName: string): void {
  const existingPlayer = game.players.find(p => p.name === playerName);
  if (!existingPlayer) {
    const newPlayer: PlayerType = {
      name: playerName,
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
    };
    game.players.push(newPlayer);
  }
}

export function updateResources(
  playerName: string,
  resourceChanges: Partial<ResourceObjectType>
): void {
  ensurePlayerExists(playerName);
  const player = game.players.find(p => p.name === playerName);
  if (player) {
    Object.keys(resourceChanges).forEach(resource => {
      const key = resource as keyof ResourceObjectType;
      const change = resourceChanges[key];
      if (change !== undefined) {
        // Update player resources
        player.resources[key] += change;
        // Update game resources (opposite of player change)
        game.gameResources[key] -= change;
      }
    });
  }
} 