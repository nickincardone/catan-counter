import {
  addUnknownSteal,
  attemptToResolveUnknownTransactions,
  autoDetectCurrentPlayer,
  eliminateResourceFromVictimTransactions,
  ensurePlayerExists,
  game,
  updateResources,
  youPlayerName,
} from './gameState.js';
import { ResourceObjectType } from './types.js';

/**
 * Handle a player discarding resources
 */
export function playerDiscard(
  playerName: string | null,
  discardedResources: Partial<ResourceObjectType>
): void {
  if (!playerName) return;

  // Remove resources from player (negative values, automatically adds to bank)
  const playerChanges: Partial<ResourceObjectType> = {};

  Object.keys(discardedResources).forEach(resource => {
    const key = resource as keyof ResourceObjectType;
    const count = discardedResources[key];
    if (count && count > 0) {
      playerChanges[key] = -count;
    }
  });

  updateResources(playerName, playerChanges);

  console.log(
    `🗑️ ${playerName} discarded resources: ${JSON.stringify(discardedResources)}`
  );
}

/**
 * Handle a player placing a settlement
 */
export function placeSettlement(playerName: string | null): void {
  if (!playerName) return;

  ensurePlayerExists(playerName);
  const player = game.players.find(p => p.name === playerName);
  if (player && player.settlements > 0) {
    player.settlements--;
    console.log(
      `🏠 ${playerName} placed a settlement. Remaining settlements: ${player.settlements}`
    );
  }
}

/**
 * Handle a dice roll
 */
export function rollDice(diceTotal: number): void {
  if (diceTotal >= 2 && diceTotal <= 12) {
    (game.diceRolls as any)[diceTotal]++;
    console.log(
      `🎲 Dice rolled: ${diceTotal}. Total rolls for ${diceTotal}: ${(game.diceRolls as any)[diceTotal]}`
    );

    // Auto-detect current player on the first dice roll instead of showing popup
    if (!youPlayerName && game.players.length > 0) {
      const success = autoDetectCurrentPlayer();
      if (!success) {
        console.log(
          '⚠️ Could not auto-detect current player. Manual selection may be needed.'
        );
      }
    }
  }
}

/**
 * Handle a player placing a road
 */
export function placeRoad(playerName: string | null): void {
  if (!playerName) return;
  const player = game.players.find(p => p.name === playerName);
  if (player && player.roads > 0) {
    player.roads--;
    console.log(
      `🛣️ ${playerName} placed a road. Remaining roads: ${player.roads}`
    );
  }
}

/**
 * Handle a trade between two players
 */
export function playerTrade(
  playerName: string | null,
  tradePartner: string | null,
  resourceChanges: Partial<ResourceObjectType>
): void {
  if (!playerName || !tradePartner) return;

  // Validate that there are actual resource changes
  const hasChanges = Object.values(resourceChanges).some(
    count => count && count !== 0
  );
  if (!hasChanges) return;

  // Update the player who initiated the trade
  updateResources(playerName, resourceChanges);

  // Update the trade partner (opposite changes)
  const partnerChanges: Partial<ResourceObjectType> = {};
  Object.entries(resourceChanges).forEach(([resource, count]) => {
    if (count && count !== 0) {
      partnerChanges[resource as keyof ResourceObjectType] = -count;
    }
  });
  updateResources(tradePartner, partnerChanges);

  console.log(
    `🤝 ${playerName} traded with ${tradePartner}. Changes: ${JSON.stringify(resourceChanges)}`
  );
}

/**
 * Handle a player getting resources
 */
export function playerGetResources(
  playerName: string | null,
  resources: Partial<ResourceObjectType>
): void {
  if (!playerName) return;

  // Validate that there are actual resources to get
  const hasResources = Object.values(resources).some(
    count => count && count > 0
  );
  if (!hasResources) return;
  updateResources(playerName, resources);

  console.log(`🌾 ${playerName} got resources: ${JSON.stringify(resources)}`);
}

/**
 * Handle a known steal where we know what resource was stolen
 */
export function knownSteal(
  thief: string | null,
  victim: string | null,
  resource: keyof ResourceObjectType
): void {
  if (!thief || !victim) return;

  updateResources(thief, { [resource]: 1 } as any);
  updateResources(victim, { [resource]: -1 } as any);

  console.log(`🦹 ${thief} stole ${resource} from ${victim}`);
}

/**
 * Handle an unknown steal - tries to deduce the resource or records it as unknown
 */
export function unknownSteal(
  thief: string | null,
  victim: string | null
): void {
  if (!thief || !victim) return;

  // Check if victim has only one type of resource (with non-zero count)
  const victimPlayer = game.players.find(p => p.name === victim);
  const nonZeroResources = victimPlayer
    ? Object.entries(victimPlayer.resources).filter(([_, count]) => count > 0)
    : [];

  if (nonZeroResources.length === 1) {
    // Victim has only one type of resource - we can deduce what was stolen
    const [deductedResource] = nonZeroResources[0];
    const resourceType = deductedResource as keyof ResourceObjectType;

    knownSteal(thief, victim, resourceType);
  } else {
    // Unknown steal - we don't know what resource was stolen
    const transactionId = addUnknownSteal(thief, victim);
    console.log(
      `🔍 ${thief} stole unknown resource from ${victim} (Transaction: ${transactionId})`
    );
  }
}

/**
 * Handle a player buying a development card
 */
export function buyDevCard(playerName: string | null): void {
  if (!playerName) return;
  game.devCards--;
  updateResources(playerName, { wheat: -1, sheep: -1, ore: -1 });

  console.log(
    `🃏 ${playerName} bought a development card. Remaining dev cards: ${game.devCards}`
  );
}

/**
 * Handle a player trading with the bank
 */
export function bankTrade(
  playerName: string | null,
  resourceChanges: Partial<ResourceObjectType>
): void {
  if (!playerName) return;
  updateResources(playerName, resourceChanges);

  console.log(
    `🏦 ${playerName} traded with bank. Changes: ${JSON.stringify(resourceChanges)}`
  );
}

/**
 * Handle a player using a knight card
 */
export function useKnight(playerName: string | null): void {
  if (!playerName) return;
  const player = game.players.find(p => p.name === playerName);
  if (player) {
    player.knights++;
    player.discoveryCards.knights++;
    game.knights--;
    console.log(
      `⚔️ ${playerName} used a knight. Total knights played: ${player.knights}`
    );
  }
}

/**
 * Handle a player building a settlement
 */
export function buildSettlement(playerName: string | null): void {
  if (!playerName) return;

  const player = game.players.find(p => p.name === playerName);
  if (player) {
    // Cost: 1 wood, 1 wheat, 1 brick, 1 sheep
    updateResources(playerName, {
      tree: -1,
      wheat: -1,
      brick: -1,
      sheep: -1,
    });
    player.settlements--;
    player.victoryPoints++;
    console.log(
      `🏠 ${playerName} built a settlement. VP: ${player.victoryPoints}, Remaining settlements: ${player.settlements}`
    );
  }
}

/**
 * Handle a player building a city
 */
export function buildCity(playerName: string | null): void {
  if (!playerName) return;

  const player = game.players.find(p => p.name === playerName);
  if (player) {
    updateResources(playerName, { ore: -3, wheat: -2 });
    player.cities--;
    player.settlements++; // City replaces settlement
    player.victoryPoints++;
    console.log(
      `🏰 ${playerName} built a city. VP: ${player.victoryPoints}, Remaining cities: ${player.cities}`
    );
  }
}

/**
 * Handle a player building a road
 */
export function buildRoad(playerName: string | null): void {
  if (!playerName) return;

  const player = game.players.find(p => p.name === playerName);
  if (player) {
    updateResources(playerName, { tree: -1, brick: -1 });
    player.roads--;
    console.log(
      `🛣️ ${playerName} built a road. Remaining roads: ${player.roads}`
    );
  }
}

/**
 * Handle a player moving the robber
 */
export function moveRobber(playerName: string | null): void {
  if (!playerName) return;

  const player = game.players.find(p => p.name === playerName);
  if (player) {
    player.totalRobbers++;
    console.log(
      `🔒 ${playerName} moved the robber. Total robber moves: ${player.totalRobbers}`
    );
  }
}

/**
 * Handle a player using Year of Plenty card
 */
export function useYearOfPlenty(playerName: string | null): void {
  if (!playerName) return;

  const player = game.players.find(p => p.name === playerName);
  if (player) {
    game.yearOfPlenties--;
    player.discoveryCards.yearOfPlenties++;
    console.log(
      `🎯 ${playerName} used Year of Plenty. Remaining: ${game.yearOfPlenties}`
    );
  }
}

/**
 * Handle a player taking resources from bank via Year of Plenty
 */
export function yearOfPlentyTake(
  playerName: string | null,
  resources: Partial<ResourceObjectType>
): void {
  if (!playerName) return;

  const hasResources = Object.values(resources).some(
    count => count && count > 0
  );
  if (!hasResources) return;

  updateResources(playerName, resources);

  console.log(
    `🎯 ${playerName} took from bank via Year of Plenty: ${JSON.stringify(resources)}`
  );
}

/**
 * Handle a player using Road Building card
 */
export function useRoadBuilding(playerName: string | null): void {
  if (!playerName) return;

  const player = game.players.find(p => p.name === playerName);
  if (player) {
    game.roadBuilders--;
    player.discoveryCards.roadBuilders++;
    console.log(
      `🛣️ ${playerName} used Road Building. Remaining: ${game.roadBuilders}`
    );
  }
}

/**
 * Handle a player using Monopoly card
 */
export function useMonopoly(playerName: string | null): void {
  if (!playerName) return;

  const player = game.players.find(p => p.name === playerName);
  if (player) {
    game.monopolies--;
    player.discoveryCards.monopolies++;
    console.log(
      `💰 ${playerName} used Monopoly. Remaining: ${game.monopolies}`
    );
  }
}

/**
 * Handle monopoly resource steal - takes resources from all other players
 */
export function monopolySteal(
  playerName: string | null,
  resourceType: keyof ResourceObjectType,
  totalStolen: number
): void {
  if (!playerName || totalStolen <= 0) return;

  const monopolyPlayer = game.players.find(p => p.name === playerName);
  if (!monopolyPlayer) return;

  // Calculate total resources to steal and remove from other players
  let actualStolen = 0;
  game.players.forEach(otherPlayer => {
    if (otherPlayer.name !== playerName) {
      const playerHas = otherPlayer.resources[resourceType];
      if (playerHas > 0) {
        actualStolen += playerHas;
        otherPlayer.resources[resourceType] = 0;
      }
    }
  });

  // Add the actual stolen amount to monopoly player (directly, not via updateResources)
  monopolyPlayer.resources[resourceType] += actualStolen;

  console.log(
    `💰 ${playerName} monopolized ${actualStolen} ${resourceType} from all players (expected: ${totalStolen})`
  );
}

/**
 * Handle a player receiving starting resources
 */
export function receiveStartingResources(
  playerName: string | null,
  resources: Partial<ResourceObjectType>
): void {
  if (!playerName) return;

  const hasResources = Object.values(resources).some(
    count => count && count > 0
  );
  if (!hasResources) return;

  updateResources(playerName, resources);

  console.log(
    `🏁 ${playerName} received starting resources: ${JSON.stringify(resources)}`
  );
}

/**
 * Handle a player offering resources in trade (helps resolve unknown transactions)
 */
export function playerOffer(
  playerName: string | null,
  offeredResources: Partial<ResourceObjectType>
): void {
  if (!playerName) return;

  const hasResources = Object.values(offeredResources).some(
    count => count && count > 0
  );
  if (!hasResources) return;

  const player = game.players.find(p => p.name === playerName);
  if (!player) return;

  // For each resource they're offering, they must have it
  // This can resolve unknown transactions
  Object.keys(offeredResources).forEach(resource => {
    const key = resource as keyof ResourceObjectType;
    const offeredCount = offeredResources[key];

    if (offeredCount && offeredCount > 0) {
      // Try to resolve unknown transactions for this resource
      const resolved = attemptToResolveUnknownTransactions(
        playerName,
        key,
        offeredCount
      );

      // If we couldn't resolve enough resources through transactions,
      // the player must still have the resources to offer them
      // (This handles the ambiguous case where multiple resolutions are possible)
      const currentAmount = player.resources[key];
      if (currentAmount < offeredCount) {
        const shortfall = offeredCount - currentAmount;
        player.resources[key] += shortfall;
        console.log(
          `➕ ${playerName} gained ${shortfall} ${key} to match offer (ambiguous resolution)`
        );
      }

      // If player is offering exactly the amount they have of a resource,
      // eliminate it from any unknown transactions where they were the victim
      // (because they must still have it to be able to offer it)
      if (player.resources[key] === offeredCount) {
        eliminateResourceFromVictimTransactions(playerName, key);
      }
    }
  });

  console.log(
    `💭 ${playerName} (offering: ${JSON.stringify(offeredResources)}) - checking for unknown transaction resolution`
  );
}

/**
 * Handle a player stealing a specific resource from the current player
 */
export function stealFromYou(
  thief: string | null,
  victim: string | null,
  stolenResource: keyof ResourceObjectType
): void {
  if (!thief || !victim) return;

  // Transfer resource from victim to thief
  updateResources(thief, { [stolenResource]: 1 } as any);
  updateResources(victim, { [stolenResource]: -1 } as any);

  console.log(`🦹 ${thief} stole ${stolenResource} from you (${victim})`);
}
