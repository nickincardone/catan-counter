import {
  GameType,
  PlayerType,
  ResourceObjectType,
  UnknownTransaction,
} from './types.js';
import { getCurrentPlayerFromHeader } from './domUtils.js';

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
    unknownTransactions: [],
  };
}

export let game: GameType = getDefaultGame();

// Track the "you" player
export let youPlayerName: string | null = null;
let hasAskedForYouPlayer = false;
export let isWaitingForYouPlayerSelection = false;

export function setYouPlayer(playerName: string): void {
  youPlayerName = playerName;
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
  youPlayerName = playerName;
  hasAskedForYouPlayer = true;
  isWaitingForYouPlayerSelection = false;
}

export function markYouPlayerAsked(): void {
  hasAskedForYouPlayer = true;
  isWaitingForYouPlayerSelection = true;
}

export function resetGameState(): void {
  // Reset game state but keep "you" player info
  const previousYouPlayer = youPlayerName;
  const previousAskedStatus = hasAskedForYouPlayer;
  const previousWaitingStatus = isWaitingForYouPlayerSelection;

  game = getDefaultGame();

  // Restore "you" player info
  youPlayerName = previousYouPlayer;
  hasAskedForYouPlayer = previousAskedStatus;
  isWaitingForYouPlayerSelection = previousWaitingStatus;

  console.log('🔄 Game state reset, reprocessing messages...');
}

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
  if (!player) return;

  // For negative resource changes (spending), check if we need to resolve unknown transactions
  Object.keys(resourceChanges).forEach(resource => {
    const key = resource as keyof ResourceObjectType;
    const change = resourceChanges[key];
    if (change !== undefined && change < 0) {
      // Player is trying to spend resources
      const requiredAmount = Math.abs(change);
      const currentAmount = player.resources[key];

      if (currentAmount < requiredAmount) {
        // Player doesn't have enough, try to resolve unknown transactions
        const shortfall = requiredAmount - currentAmount;
        console.log(
          `⚠️  ${playerName} needs ${shortfall} more ${key}, attempting to resolve unknown transactions...`
        );

        if (
          !attemptToResolveUnknownTransactions(playerName, key, requiredAmount)
        ) {
          console.log(
            `❌ Could not resolve unknown transactions for ${playerName} to get ${shortfall} ${key}`
          );
          // Still apply the change - this could result in negative resources which might be useful for debugging
        }
      }
    }
  });

  // Apply all resource changes
  Object.keys(resourceChanges).forEach(resource => {
    const key = resource as keyof ResourceObjectType;
    const change = resourceChanges[key];
    if (change !== undefined) {
      // Update player resources
      player.resources[key] += change;
      // Update game resources (opposite of player change)
      game.gameResources[key] -= change;

      // Check if bank reached maximum for this resource type (19 = all cards back in bank)
      if (game.gameResources[key] === 19) {
        resolveUnknownProbabilitiesForResource(key);
      }
    }
  });
}

export function addUnknownSteal(thief: string, victim: string): string {
  const victimPlayer = game.players.find(p => p.name === victim);
  if (!victimPlayer) {
    console.error(`❌ Victim player ${victim} not found`);
    return '';
  }

  // Calculate what resources the victim had that could be stolen
  const possibleResources: ResourceObjectType = { ...victimPlayer.resources };

  // Generate unique ID for this transaction
  const transactionId = `steal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const unknownTransaction: UnknownTransaction = {
    id: transactionId,
    type: 'steal',
    timestamp: Date.now(),
    thief,
    victim,
    possibleResources,
    isResolved: false,
  };

  game.unknownTransactions.push(unknownTransaction);

  // Update probabilities for both players
  updateProbabilitiesAfterUnknownSteal(thief, victim, possibleResources);

  console.log(
    `🔍 Added unknown steal: ${thief} stole from ${victim} (Transaction ID: ${transactionId})`
  );
  console.log(`📊 Victim had: ${JSON.stringify(possibleResources)}`);

  return transactionId;
}

function updateProbabilitiesAfterUnknownSteal(
  thief: string,
  victim: string,
  possibleResources: ResourceObjectType
): void {
  const thiefPlayer = game.players.find(p => p.name === thief);
  const victimPlayer = game.players.find(p => p.name === victim);

  if (!thiefPlayer || !victimPlayer) return;

  // Calculate total possible cards that could be stolen
  const totalPossibleCards = Object.values(possibleResources).reduce(
    (sum, count) => sum + count,
    0
  );

  if (totalPossibleCards === 0) {
    console.log(`⚠️  ${victim} had no cards to steal`);
    return;
  }

  // Update thief's resource probabilities (they gained one of these resources)
  Object.keys(possibleResources).forEach(resource => {
    const key = resource as keyof ResourceObjectType;
    const resourceCount = possibleResources[key];
    if (resourceCount > 0) {
      const probability = resourceCount / totalPossibleCards;
      thiefPlayer.resourceProbabilities[key] += probability;
    }
  });

  // Update victim's resource probabilities (they lost one card, but we don't know which)
  Object.keys(possibleResources).forEach(resource => {
    const key = resource as keyof ResourceObjectType;
    const resourceCount = possibleResources[key];
    if (resourceCount > 0) {
      const probability = resourceCount / totalPossibleCards;
      victimPlayer.resourceProbabilities[key] -= probability;
    }
  });

  console.log(`📈 Updated probabilities for ${thief} and ${victim}`);
}

export function attemptToResolveUnknownTransactions(
  playerName: string,
  requiredResource: keyof ResourceObjectType,
  requiredAmount: number = 1
): boolean {
  const player = game.players.find(p => p.name === playerName);
  if (!player) return false;

  // Check if player has enough of the required resource
  if (player.resources[requiredResource] >= requiredAmount) {
    return true; // No need to resolve, player has the resource
  }

  const shortfall = requiredAmount - player.resources[requiredResource];

  // Check if player has enough including probabilities
  // Count how many unresolved transactions could potentially provide this resource
  const unresolvedStealsForResource = game.unknownTransactions.filter(
    transaction =>
      !transaction.isResolved &&
      transaction.type === 'steal' &&
      transaction.thief === playerName &&
      transaction.possibleResources[requiredResource] > 0
  );

  const maxPossibleFromUnresolvedSteals = unresolvedStealsForResource.length;
  const totalMaxAvailable =
    player.resources[requiredResource] + maxPossibleFromUnresolvedSteals;
  if (totalMaxAvailable < requiredAmount) {
    console.log(
      `❌ ${playerName} doesn't have enough ${requiredResource} even with probabilities`
    );
    return false;
  }

  // Find unresolved transactions where this player was the thief and could have stolen this resource
  const unresolvedSteals = game.unknownTransactions.filter(
    transaction =>
      !transaction.isResolved &&
      transaction.type === 'steal' &&
      transaction.thief === playerName &&
      transaction.possibleResources[requiredResource] > 0
  );

  if (unresolvedSteals.length === 0) {
    console.log(
      `❌ No unresolved steals found for ${playerName} involving ${requiredResource}`
    );
    return false;
  }

  // For now, resolve the most recent steal that could provide this resource
  // In a more sophisticated system, you might want to resolve based on highest probability
  const stealToResolve = unresolvedSteals[unresolvedSteals.length - 1];

  console.log(`🔍 Resolving unknown steal: ${stealToResolve.id}`);
  console.log(
    `   ${playerName} stole ${requiredResource} from ${stealToResolve.victim}`
  );

  // Resolve the transaction
  stealToResolve.isResolved = true;
  stealToResolve.resolvedResource = requiredResource;

  // Update actual resources
  player.resources[requiredResource] += shortfall;
  const victimPlayer = game.players.find(p => p.name === stealToResolve.victim);
  if (victimPlayer) {
    victimPlayer.resources[requiredResource] -= shortfall;
  }

  // Clear probabilities for this resolved transaction
  clearProbabilitiesForResolvedTransaction(stealToResolve);

  console.log(
    `✅ Resolved steal: ${playerName} stole ${requiredResource} from ${stealToResolve.victim}`
  );
  return true;
}

function clearProbabilitiesForResolvedTransaction(
  transaction: UnknownTransaction
): void {
  const thiefPlayer = game.players.find(p => p.name === transaction.thief);
  const victimPlayer = game.players.find(p => p.name === transaction.victim);

  if (!thiefPlayer || !victimPlayer || !transaction.resolvedResource) return;

  // Calculate original probabilities to subtract
  const totalPossibleCards = Object.values(
    transaction.possibleResources
  ).reduce((sum, count) => sum + count, 0);

  if (totalPossibleCards === 0) return;

  // Clear the resolved resource probabilities
  const resolvedResource = transaction.resolvedResource;
  const originalProbability =
    transaction.possibleResources[resolvedResource] / totalPossibleCards;

  // Remove the resolved probability from thief and add back to victim
  thiefPlayer.resourceProbabilities[resolvedResource] -= originalProbability;
  victimPlayer.resourceProbabilities[resolvedResource] += originalProbability;

  // Clear other probabilities that are no longer valid
  Object.keys(transaction.possibleResources).forEach(resource => {
    const key = resource as keyof ResourceObjectType;
    if (key !== resolvedResource && transaction.possibleResources[key] > 0) {
      const probability =
        transaction.possibleResources[key] / totalPossibleCards;
      thiefPlayer.resourceProbabilities[key] -= probability;
      victimPlayer.resourceProbabilities[key] += probability;
    }
  });

  console.log(
    `🧹 Cleared probabilities for resolved transaction ${transaction.id}`
  );
}

function resolveUnknownProbabilitiesForResource(
  resourceType: keyof ResourceObjectType
): void {
  console.log(
    `📈 Bank reached 19 ${resourceType} cards - resolving unknown probabilities`
  );

  // Find all unresolved transactions that could have involved this resource type
  const affectedTransactions = game.unknownTransactions.filter(
    transaction =>
      !transaction.isResolved && transaction.possibleResources[resourceType] > 0
  );

  if (affectedTransactions.length === 0) {
    console.log(
      `📊 No unresolved transactions involving ${resourceType} found`
    );
    return;
  }

  // For each affected transaction, remove the probability for this resource type
  affectedTransactions.forEach(transaction => {
    const thiefPlayer = game.players.find(p => p.name === transaction.thief);
    const victimPlayer = game.players.find(p => p.name === transaction.victim);

    if (!thiefPlayer || !victimPlayer) return;

    // Calculate original probabilities
    const totalPossibleCards = Object.values(
      transaction.possibleResources
    ).reduce((sum, count) => sum + count, 0);

    if (totalPossibleCards === 0) return;

    // Calculate the probability that was assigned to this resource type
    const eliminatedProbability =
      transaction.possibleResources[resourceType] / totalPossibleCards;

    // Remove this probability from both players
    thiefPlayer.resourceProbabilities[resourceType] -= eliminatedProbability;
    victimPlayer.resourceProbabilities[resourceType] += eliminatedProbability;

    // Update the transaction to reflect that this resource is no longer possible
    transaction.possibleResources[resourceType] = 0;

    // Recalculate probabilities for remaining possible resources
    const remainingTotal = Object.values(transaction.possibleResources).reduce(
      (sum, count) => sum + count,
      0
    );

    if (remainingTotal > 0) {
      // Redistribute the eliminated probability among remaining possible resources
      Object.keys(transaction.possibleResources).forEach(resource => {
        const key = resource as keyof ResourceObjectType;
        const resourceCount = transaction.possibleResources[key];

        if (resourceCount > 0) {
          const newProbability = resourceCount / remainingTotal;
          const oldProbability = resourceCount / totalPossibleCards;
          const probabilityIncrease = newProbability - oldProbability;

          // Update player probabilities
          thiefPlayer.resourceProbabilities[key] += probabilityIncrease;
          victimPlayer.resourceProbabilities[key] -= probabilityIncrease;
        }
      });

      console.log(
        `📊 Updated probabilities for transaction ${transaction.id} - eliminated ${resourceType}`
      );
    } else {
      // No possible resources left - this shouldn't happen but handle gracefully
      console.log(
        `⚠️  Transaction ${transaction.id} has no remaining possible resources after eliminating ${resourceType}`
      );
    }
  });

  console.log(
    `✅ Resolved ${affectedTransactions.length} unknown transactions involving ${resourceType}`
  );
}

// Helper function to check if a player can afford a cost, potentially resolving unknown transactions
export function canPlayerAffordCost(
  playerName: string,
  cost: Partial<ResourceObjectType>
): boolean {
  const player = game.players.find(p => p.name === playerName);
  if (!player) return false;

  // Check each resource requirement
  for (const [resource, requiredAmount] of Object.entries(cost)) {
    const resourceKey = resource as keyof ResourceObjectType;
    const required = requiredAmount || 0;

    if (required > 0) {
      // Try to resolve unknown transactions if needed
      if (
        !attemptToResolveUnknownTransactions(playerName, resourceKey, required)
      ) {
        return false;
      }
    }
  }

  return true;
}
