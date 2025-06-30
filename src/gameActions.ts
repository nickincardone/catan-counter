import {
  autoDetectCurrentPlayer,
  ensurePlayerExists,
  game,
  updateResources,
} from './gameState.js';
import { PropbableGameState } from './probableGameState.js';
import {
  DiceRollsType,
  ResourceObjectType,
  TransactionTypeEnum,
} from './types.js';

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

  game.probableGameState.processTransaction({
    type: TransactionTypeEnum.RESOURCE_LOSS,
    playerName: playerName,
    resources: discardedResources,
  });

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
export function placeSettlement(
  playerName: string | null,
  color?: string
): void {
  if (!playerName) return;

  ensurePlayerExists(playerName, color);
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
    if (!game.hasRolledFirstDice) {
      game.hasRolledFirstDice = true;

      // setting up probable game state with all players
      game.probableGameState = new PropbableGameState(game.players);

      // Auto-detect current player on the first dice roll instead of showing popup
      if (!game.youPlayerName && game.players.length > 0) {
        const success = autoDetectCurrentPlayer();
        if (!success) {
          console.log(
            '⚠️ Could not auto-detect current player. Manual selection may be needed.'
          );
        }
      }
    }

    game.diceRolls[diceTotal as keyof DiceRollsType]++;
  }
}

/**
 * Handle a blocked dice roll where the robber prevents resource production
 */
export function blockedDiceRoll(
  diceNumber: number,
  resourceType: string
): void {
  if (diceNumber >= 2 && diceNumber <= 12) {
    // Initialize the dice number object if it doesn't exist
    if (!game.blockedDiceRolls[diceNumber]) {
      game.blockedDiceRolls[diceNumber] = {};
    }

    // Initialize the resource count if it doesn't exist
    if (!game.blockedDiceRolls[diceNumber][resourceType]) {
      game.blockedDiceRolls[diceNumber][resourceType] = 0;
    }

    // Increment the blocked count
    game.blockedDiceRolls[diceNumber][resourceType]++;

    console.log(
      `🔒 Dice ${diceNumber} blocked for ${resourceType}. Total blocked: ${game.blockedDiceRolls[diceNumber][resourceType]}`
    );
  }
}

/**
 * Handle a player placing inital road, no brick/tree spent
 */
export function placeInitialRoad(playerName: string | null): void {
  if (!playerName) return;
  const player = game.players.find(p => p.name === playerName);
  if (player && player.roads > 0) {
    player.roads--;
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

  // add call to game probable processor to handle trade
  game.probableGameState.processTransaction({
    type: TransactionTypeEnum.TRADE,
    player1: playerName,
    player2: tradePartner,
    resourceChanges: resourceChanges,
  });

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

  // add call to game probable processor to handle resource gain
  game.probableGameState.processTransaction({
    type: TransactionTypeEnum.RESOURCE_GAIN,
    playerName: playerName,
    resources: resources,
  });

  updateResources(playerName, resources);
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

  game.probableGameState.processTransaction({
    type: TransactionTypeEnum.ROBBER_STEAL,
    stealerName: thief,
    victimName: victim,
    stolenResource: resource,
  });

  updateResources(thief, { [resource]: 1 } as any);
  updateResources(victim, { [resource]: -1 } as any);
}

/**
 * Handle an unknown steal - tries to deduce the resource or records it as unknown
 */
export function unknownSteal(
  thief: string | null,
  victim: string | null
): void {
  if (!thief || !victim) return;

  // Check if victim has only one type of resource across ALL possible variants
  const victimProbabilities =
    game.probableGameState.getPlayerResourceProbabilities(victim);

  // Count how many resource types the victim could possibly have
  const possibleResourceTypes = Object.entries(
    victimProbabilities.minimumResources
  )
    .filter(([_, count]) => count > 0)
    .concat(
      Object.entries(
        victimProbabilities.additionalResourceProbabilities
      ).filter(([_, probability]) => probability > 0)
    );

  // Remove duplicates by converting to Set and back
  const uniqueResourceTypes = [
    ...new Set(possibleResourceTypes.map(([resourceType]) => resourceType)),
  ];

  if (uniqueResourceTypes.length === 1) {
    // Victim has only one type of resource - we can deduce what was stolen
    const resourceType = uniqueResourceTypes[0] as keyof ResourceObjectType;

    knownSteal(thief, victim, resourceType);
  } else {
    // Unknown steal - we don't know what resource was stolen
    game.probableGameState.processTransaction({
      type: TransactionTypeEnum.ROBBER_STEAL,
      stealerName: thief,
      victimName: victim,
      stolenResource: null,
    });
  }
}

/**
 * Handle a player buying a development card
 */
export function buyDevCard(playerName: string | null): void {
  if (!playerName) return;

  game.probableGameState.processTransaction({
    type: TransactionTypeEnum.RESOURCE_LOSS,
    playerName: playerName,
    resources: { wheat: 1, sheep: 1, ore: 1 },
  });

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

  // Validate that there are actual resource changes
  const hasChanges = Object.values(resourceChanges).some(
    count => count && count !== 0
  );
  if (!hasChanges) return;

  // Process the bank trade as a single transaction
  game.probableGameState.processTransaction({
    type: TransactionTypeEnum.BANK_TRADE,
    playerName: playerName,
    resourceChanges: resourceChanges,
  });

  updateResources(playerName, resourceChanges);

  console.log(
    `🏦 ${playerName} made a bank trade: ${JSON.stringify(resourceChanges)}`
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
  }
}

/**
 * Handle a player building a settlement
 */
export function buildSettlement(playerName: string | null): void {
  if (!playerName) return;

  const player = game.players.find(p => p.name === playerName);
  if (player) {
    game.probableGameState.processTransaction({
      type: TransactionTypeEnum.RESOURCE_LOSS,
      playerName: playerName,
      resources: { tree: 1, wheat: 1, brick: 1, sheep: 1 },
    });

    updateResources(playerName, {
      tree: -1,
      wheat: -1,
      brick: -1,
      sheep: -1,
    });
    player.settlements--;
    player.victoryPoints++;
  }
}

/**
 * Handle a player building a city
 */
export function buildCity(playerName: string | null): void {
  if (!playerName) return;

  const player = game.players.find(p => p.name === playerName);
  if (player) {
    game.probableGameState.processTransaction({
      type: TransactionTypeEnum.RESOURCE_LOSS,
      playerName: playerName,
      resources: { ore: 3, wheat: 2 },
    });

    updateResources(playerName, { ore: -3, wheat: -2 });
    player.cities--;
    player.settlements++; // City replaces settlement
    player.victoryPoints++;
  }
}

/**
 * Handle a player building a road
 */
export function buildRoad(playerName: string | null): void {
  if (!playerName) return;

  const player = game.players.find(p => p.name === playerName);
  if (player) {
    game.probableGameState.processTransaction({
      type: TransactionTypeEnum.RESOURCE_LOSS,
      playerName: playerName,
      resources: { tree: 1, brick: 1 },
    });
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

  game.probableGameState.processTransaction({
    type: TransactionTypeEnum.RESOURCE_GAIN,
    playerName: playerName,
    resources: resources,
  });

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

  game.probableGameState.processTransaction({
    type: TransactionTypeEnum.MONOPOLY,
    playerName: playerName,
    resourceType: resourceType,
    totalStolen: totalStolen,
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

  game.probableGameState.processTransaction({
    type: TransactionTypeEnum.TRADE_OFFER,
    playerName: playerName,
    offeredResources: offeredResources,
  });
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

  game.probableGameState.processTransaction({
    type: TransactionTypeEnum.ROBBER_STEAL,
    stealerName: thief,
    victimName: victim,
    stolenResource: stolenResource,
  });

  // Transfer resource from victim to thief
  updateResources(thief, { [stolenResource]: 1 } as any);
  updateResources(victim, { [stolenResource]: -1 } as any);

  console.log(`🦹 ${thief} stole ${stolenResource} from you (${victim})`);
}
