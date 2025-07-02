import {
  VariantTree,
  VariantNode,
  GameState,
  PlayerState,
  RESOURCE_TYPES,
} from './variants';
import { VariantTransactionProcessor } from './variantTransactions';
import {
  ResourceObjectType,
  TransactionType,
  TransactionTypeEnum,
  PlayerType,
  UnknownTransaction,
} from './types';

function updateResourceAmount(
  resources: ResourceObjectType,
  resourceType: keyof ResourceObjectType,
  amount: number
): void {
  resources[resourceType] += amount;
}

function getResourceAmount(
  resources: ResourceObjectType,
  resourceType: keyof ResourceObjectType
): number {
  return resources[resourceType];
}

function isValidResourceType(
  resourceType: string
): resourceType is keyof ResourceObjectType {
  return RESOURCE_TYPES.includes(resourceType as keyof ResourceObjectType);
}

export class PropbableGameState {
  private variantTree: VariantTree;
  private transactionProcessor: VariantTransactionProcessor;
  private transactionHistory: TransactionType[];

  constructor(initialPlayers: PlayerType[]) {
    // Initialize game state with players and their known starting resources
    const initialGameState: GameState = {};
    this.transactionHistory = [];

    for (const player of initialPlayers) {
      initialGameState[player.name] = {
        resources: { ...player.resources }, // Copy the initial resources
      };
      // set initial transactions
      this.transactionHistory.push({
        type: TransactionTypeEnum.RESOURCE_GAIN,
        playerName: player.name,
        resources: { ...player.resources },
      });
    }

    this.variantTree = new VariantTree(initialGameState);
    this.transactionProcessor = new VariantTransactionProcessor(
      this.variantTree
    );
  }

  /**
   * Get all unknown transactions
   */
  getUnknownTransactions(): UnknownTransaction[] {
    return this.transactionProcessor.getUnresolvedTransactions();
  }

  /**
   * Get unknown transaction by ID
   */
  getUnknownTransaction(id: string): UnknownTransaction | undefined {
    return this.transactionProcessor.getUnknownTransaction(id);
  }

  /**
   * Resolve unknown transaction by specifying what resource was stolen
   */
  resolveUnknownTransaction(
    id: string,
    resolvedResource: keyof ResourceObjectType
  ): boolean {
    return this.transactionProcessor.resolveUnknownTransaction(
      id,
      resolvedResource
    );
  }

  /**
   * Resolve all unknown transactions by looking at possible variants
   * if there doesn't exist a node with that transaction id then mark it as resolved
   * if there is only one node mark all transactions as resolved, never mark a transaction
   * as unresolved in this function
   */
  resolveAllUnknownTransactions(): void {
    const unresolvedTransactions = this.getUnknownTransactions();

    for (const transaction of unresolvedTransactions) {
      // Get all current leaf nodes that have this transaction in their chain
      const allLeafNodes = this.variantTree.getCurrentVariantNodes();
      const transactionNodes = allLeafNodes.filter(node =>
        node.hasTransactionId(transaction.id)
      );

      if (transactionNodes.length === 0) {
        // No nodes exist with this transaction ID - variants have been pruned away
        // Mark as resolved but we don't know what resource was stolen
        transaction.isResolved = true;
      } else if (transactionNodes.length === 1) {
        // Only one variant remains - we can determine what resource was stolen
        const remainingNode = transactionNodes[0];

        // Find the stolen resource by looking at the transaction chain
        const stolenResource = this.findStolenResourceInChain(
          remainingNode,
          transaction.id
        );

        if (stolenResource) {
          // Resolve the transaction with the determined resource
          this.transactionProcessor.resolveUnknownTransaction(
            transaction.id,
            stolenResource
          );
        } else {
          // Mark as resolved even if we can't determine the resource
          transaction.isResolved = true;
        }
      } else {
        // Multiple nodes exist - check if they all have the same stolen resource for this transaction
        const stolenResources = new Set<string>();

        for (const node of transactionNodes) {
          const stolenResource = this.findStolenResourceInChain(
            node,
            transaction.id
          );
          if (stolenResource) {
            stolenResources.add(stolenResource);
          }
        }

        if (stolenResources.size === 1) {
          // All variants agree on what resource was stolen
          const stolenResource = Array.from(
            stolenResources
          )[0] as keyof ResourceObjectType;
          this.transactionProcessor.resolveUnknownTransaction(
            transaction.id,
            stolenResource
          );
        }
      }
      // If multiple nodes exist with different stolen resources, leave the transaction unresolved
    }
  }

  /**
   * Find the stolen resource for a specific transaction in a node's chain
   */
  private findStolenResourceInChain(
    node: VariantNode,
    transactionId: string
  ): keyof ResourceObjectType | null {
    let current: VariantNode | null = node;

    while (current) {
      if (current.transactionId === transactionId && current.stolenResource) {
        return current.stolenResource;
      }
      current = current.parent;
    }

    return null;
  }

  /**
   * Process a transaction
   */
  processTransaction(transaction: TransactionType): void {
    // Add transaction to history for debugging
    this.transactionHistory.push(transaction);

    switch (transaction.type) {
      case TransactionTypeEnum.ROBBER_STEAL: {
        if (transaction.stolenResource) {
          // Known steal - we know exactly what was stolen
          this.processKnownSteal(
            transaction.stealerName,
            transaction.victimName,
            transaction.stolenResource
          );
        } else {
          // Unknown steal - create probability branches
          this.transactionProcessor.processUnknownSteal(
            transaction.stealerName,
            transaction.victimName
          );
        }
        break;
      }

      case TransactionTypeEnum.MONOPOLY: {
        this.transactionProcessor.processMonopoly(
          transaction.playerName,
          transaction.resourceType,
          transaction.totalStolen
        );
        break;
      }

      case TransactionTypeEnum.TRADE: {
        this.transactionProcessor.processTrade(
          transaction.player1,
          transaction.player2,
          transaction.resourceChanges
        );
        break;
      }

      case TransactionTypeEnum.TRADE_OFFER: {
        this.transactionProcessor.processTradeOffer(
          transaction.playerName,
          transaction.offeredResources
        );
        break;
      }

      case TransactionTypeEnum.RESOURCE_GAIN: {
        this.processResourceGain(transaction.playerName, transaction.resources);
        break;
      }

      case TransactionTypeEnum.RESOURCE_LOSS: {
        this.processResourceLoss(transaction.playerName, transaction.resources);
        break;
      }

      case TransactionTypeEnum.BANK_TRADE: {
        this.processBankTrade(
          transaction.playerName,
          transaction.resourceChanges
        );
        break;
      }

      default:
        // This should never happen with proper typing, but keeping for safety
        const exhaustiveCheck: never = transaction;
        console.warn(
          `Unknown transaction type: ${(exhaustiveCheck as any).type}`
        );
    }

    // Auto-resolve any transactions that can now be determined
    this.resolveAllUnknownTransactions();
  }

  /**
   * Process a known steal (we know exactly what resource was stolen)
   */
  private processKnownSteal(
    stealerName: string,
    victimName: string,
    resourceType: keyof ResourceObjectType
  ): void {
    const currentNodes = this.variantTree.getCurrentVariantNodes();

    for (const node of currentNodes) {
      const gameState = node.gameState;

      // Check if victim has this resource in this variant
      const victimState = gameState[victimName];
      const stealerState = gameState[stealerName];

      if (
        victimState &&
        stealerState &&
        getResourceAmount(victimState.resources, resourceType) > 0
      ) {
        // Execute the steal
        updateResourceAmount(victimState.resources, resourceType, -1);
        updateResourceAmount(stealerState.resources, resourceType, 1);
      } else {
        // This variant is invalid - victim doesn't have the resource
        this.variantTree.removeVariantNode(node);
      }
    }

    this.variantTree.pruneInvalidNodes();
  }

  /**
   * Process definite resource gain
   */
  private processResourceGain(
    playerName: string,
    resources: Partial<ResourceObjectType>
  ): void {
    const currentNodes = this.variantTree.getCurrentVariantNodes();

    for (const node of currentNodes) {
      const gameState = node.gameState;
      const playerState = gameState[playerName];

      if (playerState) {
        // Execute the gain
        for (const [resourceType, amount] of Object.entries(resources)) {
          if (typeof amount === 'number' && isValidResourceType(resourceType)) {
            updateResourceAmount(playerState.resources, resourceType, amount);
          }
        }
      }
    }
  }

  /**
   * Process definite resource loss
   */
  private processResourceLoss(
    playerName: string,
    resources: Partial<ResourceObjectType>
  ): void {
    const currentNodes = this.variantTree.getCurrentVariantNodes();

    for (const node of currentNodes) {
      const gameState = node.gameState;
      const playerState = gameState[playerName];

      if (playerState) {
        let canAfford = true;

        // Check if player can afford this loss in this variant
        for (const [resourceType, amount] of Object.entries(resources)) {
          if (
            typeof amount === 'number' &&
            isValidResourceType(resourceType) &&
            getResourceAmount(playerState.resources, resourceType) < amount
          ) {
            canAfford = false;
            break;
          }
        }

        if (canAfford) {
          // Execute the loss
          for (const [resourceType, amount] of Object.entries(resources)) {
            if (
              typeof amount === 'number' &&
              isValidResourceType(resourceType)
            ) {
              updateResourceAmount(
                playerState.resources,
                resourceType,
                -amount
              );
            }
          }
        } else {
          // This variant is invalid - player can't afford the loss
          this.variantTree.removeVariantNode(node);
        }
      }
    }

    this.variantTree.pruneInvalidNodes();
  }

  /**
   * Process bank trade (player trades resources with the bank)
   */
  private processBankTrade(
    playerName: string,
    resourceChanges: Partial<ResourceObjectType>
  ): void {
    const currentNodes = this.variantTree.getCurrentVariantNodes();

    for (const node of currentNodes) {
      const gameState = node.gameState;
      const playerState = gameState[playerName];

      if (playerState) {
        let canAfford = true;

        // Check if player can afford the resources they're giving up
        for (const [resourceType, amount] of Object.entries(resourceChanges)) {
          if (
            amount < 0 && // Negative amounts are resources being given up
            isValidResourceType(resourceType) &&
            getResourceAmount(playerState.resources, resourceType) <
              Math.abs(amount)
          ) {
            canAfford = false;
            break;
          }
        }

        if (canAfford) {
          // Execute the bank trade (both losses and gains)
          for (const [resourceType, amount] of Object.entries(
            resourceChanges
          )) {
            if (
              typeof amount === 'number' &&
              isValidResourceType(resourceType)
            ) {
              updateResourceAmount(playerState.resources, resourceType, amount);
            }
          }
        } else {
          // This variant is invalid - player can't afford the trade
          this.variantTree.removeVariantNode(node);
        }
      }
    }

    this.variantTree.pruneInvalidNodes();
  }

  /**
   * Get the current best estimate of a player's resources
   */
  getPlayerResources(playerName: string): {
    [K in keyof PlayerState['resources']]: {
      min: number;
      max: number;
      mostLikely: number;
      confidence: number;
    };
  } {
    return this.transactionProcessor.getPlayerResourceUncertainty(playerName);
  }

  /**
   * Get resource probabilities for a player
   * Returns minimum guaranteed resources and probability of additional resources
   */
  getPlayerResourceProbabilities(playerName: string): {
    minimumResources: ResourceObjectType;
    additionalResourceProbabilities: ResourceObjectType;
  } {
    const variants = this.variantTree.getCurrentVariants();

    if (variants.length === 0) {
      // No variants - return all zeros
      const emptyResources: ResourceObjectType = {
        tree: 0,
        brick: 0,
        sheep: 0,
        wheat: 0,
        ore: 0,
      };
      return {
        minimumResources: { ...emptyResources },
        additionalResourceProbabilities: { ...emptyResources },
      };
    }

    // Calculate minimum resources across all variants
    const minimumResources: ResourceObjectType = {
      tree: Number.MAX_SAFE_INTEGER,
      brick: Number.MAX_SAFE_INTEGER,
      sheep: Number.MAX_SAFE_INTEGER,
      wheat: Number.MAX_SAFE_INTEGER,
      ore: Number.MAX_SAFE_INTEGER,
    };

    // Collect all resource counts with their probabilities
    const resourceCounts: Array<{
      resources: ResourceObjectType;
      probability: number;
    }> = [];

    for (const variant of variants) {
      const playerState = variant.gameState[playerName];
      if (playerState) {
        resourceCounts.push({
          resources: playerState.resources,
          probability: variant.probability,
        });

        // Update minimums
        for (const resourceType of RESOURCE_TYPES) {
          minimumResources[resourceType] = Math.min(
            minimumResources[resourceType],
            playerState.resources[resourceType]
          );
        }
      }
    }

    // If no player state found, set minimums to 0
    if (resourceCounts.length === 0) {
      for (const resourceType of RESOURCE_TYPES) {
        minimumResources[resourceType] = 0;
      }
    }

    // Calculate probability of having more than minimum for each resource
    const additionalResourceProbabilities: ResourceObjectType = {
      tree: 0,
      brick: 0,
      sheep: 0,
      wheat: 0,
      ore: 0,
    };

    for (const resourceType of RESOURCE_TYPES) {
      const minCount = minimumResources[resourceType];
      let probabilityOfMore = 0;

      for (const { resources, probability } of resourceCounts) {
        if (resources[resourceType] > minCount) {
          probabilityOfMore += probability;
        }
      }

      additionalResourceProbabilities[resourceType] = probabilityOfMore;
    }

    return {
      minimumResources,
      additionalResourceProbabilities,
    };
  }

  /**
   * Get the most likely complete game state
   */
  getMostLikelyGameState(): {
    gameState: GameState;
    probability: number;
  } | null {
    return this.transactionProcessor.getMostLikelyGameState();
  }

  /**
   * Get all possible game states with their probabilities
   */
  getAllPossibleGameStates(): Array<{
    gameState: GameState;
    probability: number;
  }> {
    return this.transactionProcessor.getAllPossibleGameStates();
  }

  /**
   * Get the number of possible game states being tracked
   */
  getVariantCount(): number {
    return this.variantTree.getCurrentVariantNodes().length;
  }

  /**
   * Get uncertainty score for the entire game state (0 = certain, 1 = completely uncertain)
   */
  getUncertaintyScore(): number {
    const variants = this.variantTree.getCurrentVariants();

    if (variants.length <= 1) return 0;

    // Calculate entropy as a measure of uncertainty
    const entropy = variants.reduce((sum, variant) => {
      if (variant.probability > 0) {
        return sum - variant.probability * Math.log2(variant.probability);
      }
      return sum;
    }, 0);

    // Normalize entropy to 0-1 scale
    const maxEntropy = Math.log2(variants.length);
    return maxEntropy > 0 ? entropy / maxEntropy : 0;
  }

  /**
   * Debug: Print current variants and their probabilities
   */
  debugPrintVariants(): void {
    const variants = this.variantTree.getCurrentVariants();
    console.log(
      `\n=== Current Game State Variants (${variants.length} total) ===`
    );

    variants.forEach((variant, index) => {
      console.log(
        `\nVariant ${index + 1} (${(variant.probability * 100).toFixed(1)}% probability):`
      );

      for (const [playerName, playerState] of Object.entries(
        variant.gameState
      )) {
        const resources = Object.entries(playerState.resources)
          .map(([type, count]) => `${type}: ${count}`)
          .join(', ');
        console.log(`  ${playerName}: ${resources}`);
      }
    });

    console.log(
      `\nUncertainty Score: ${(this.getUncertaintyScore() * 100).toFixed(1)}%`
    );
  }

  /**
   * Get resource probabilities for a specific transaction
   */
  getTransactionResourceProbabilities(
    transactionId: string
  ): ResourceObjectType | null {
    return this.transactionProcessor.getTransactionResourceProbabilities(
      transactionId
    );
  }

  /**
   * Get the complete transaction history for debugging
   */
  getTransactionHistory(): TransactionType[] {
    return [...this.transactionHistory]; // Return a copy to prevent external modification
  }

  /**
   * Get the number of transactions processed
   */
  getTransactionCount(): number {
    return this.transactionHistory.length;
  }

  /**
   * Debug: Print transaction history in a readable format
   */
  debugPrintTransactionHistory(): void {
    console.log(
      `\n=== Transaction History (${this.transactionHistory.length} total) ===`
    );

    this.transactionHistory.forEach((transaction, index) => {
      console.log(`\n${index + 1}. ${transaction.type}:`);

      switch (transaction.type) {
        case TransactionTypeEnum.ROBBER_STEAL:
          console.log(
            `  ${transaction.stealerName} stole from ${transaction.victimName}${transaction.stolenResource ? ` (${transaction.stolenResource})` : ' (unknown resource)'}`
          );
          break;
        case TransactionTypeEnum.MONOPOLY:
          console.log(
            `  ${transaction.playerName} played monopoly on ${transaction.resourceType}, stole ${transaction.totalStolen} total`
          );
          break;
        case TransactionTypeEnum.TRADE:
          console.log(
            `  Trade between ${transaction.player1} and ${transaction.player2}`
          );
          console.log(
            `  Resource changes: ${JSON.stringify(transaction.resourceChanges)}`
          );
          break;
        case TransactionTypeEnum.TRADE_OFFER:
          console.log(
            `  ${transaction.playerName} offered: ${JSON.stringify(transaction.offeredResources)}`
          );
          break;
        case TransactionTypeEnum.RESOURCE_GAIN:
          console.log(
            `  ${transaction.playerName} gained: ${JSON.stringify(transaction.resources)}`
          );
          break;
        case TransactionTypeEnum.RESOURCE_LOSS:
          console.log(
            `  ${transaction.playerName} lost: ${JSON.stringify(transaction.resources)}`
          );
          break;
        case TransactionTypeEnum.BANK_TRADE:
          console.log(
            `  ${transaction.playerName} bank trade: ${JSON.stringify(transaction.resourceChanges)}`
          );
          break;
      }
    });
  }

  /**
   * Clear transaction history (useful for testing or restarting)
   */
  clearTransactionHistory(): void {
    this.transactionHistory = [];
  }
}
