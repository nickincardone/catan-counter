import { ResourceObjectType, UnknownTransaction } from './types';
import {
  VariantTree,
  VariantNode,
  GameState,
  RESOURCE_TYPES,
} from './variants';

export class VariantTransactionProcessor {
  private unknownTransactions: UnknownTransaction[] = [];

  constructor(private variantTree: VariantTree) {}

  processUnknownSteal(stealerName: string, victimName: string): void {
    const currentNodes = this.variantTree.getCurrentVariantNodes();

    for (const node of currentNodes) {
      const newVariants: VariantNode[] = [];
      const gameState = node.gameState;
      const victimState = gameState[victimName];

      if (!victimState) {
        console.warn(`Victim ${victimName} not found in game state`);
        continue;
      }

      // Calculate total resources the victim has
      const totalResources = RESOURCE_TYPES.reduce(
        (sum, resourceType) => sum + victimState.resources[resourceType],
        0
      );

      if (totalResources === 0) {
        // Victim has no resources, this branch is invalid
        this.variantTree.removeVariantNode(node);
        continue;
      }

      const transactionId = `${stealerName}_${victimName}_${Date.now()}`;

      // Create a variant for each possible resource that could be stolen
      for (const resourceType of RESOURCE_TYPES) {
        const resourceCount = victimState.resources[resourceType];

        if (resourceCount > 0) {
          // Probability = (victim's amount of this resource / victim's total resources)
          const probability = resourceCount / totalResources;

          // Create new game state where this resource was stolen
          const newGameState = this.deepCloneGameState(gameState);
          newGameState[victimName].resources[resourceType] -= 1;

          if (!newGameState[stealerName]) {
            console.warn(`Stealer ${stealerName} not found in game state`);
            continue;
          }
          newGameState[stealerName].resources[resourceType] += 1;

          // Create variant node with transaction ID
          newVariants.push(
            new VariantNode(
              node,
              probability,
              newGameState,
              transactionId,
              resourceType
            )
          );
        }
      }

      // Create transaction record if we have multiple possible resources
      if (newVariants.length > 1 && transactionId) {
        const transaction: UnknownTransaction = {
          id: transactionId,
          timestamp: Date.now(),
          thief: stealerName,
          victim: victimName,
          isResolved: false,
        };

        this.unknownTransactions.push(transaction);
        console.log(
          `📝 Created unknown transaction ${transactionId}: ${stealerName} stole from ${victimName}`
        );
      }

      // Add all possible steal variants as children
      node.addVariantNodes(newVariants);
    }

    // Clean up invalid states
    this.variantTree.pruneInvalidNodes();
  }

  processMonopoly(
    playerName: string,
    resourceType: keyof ResourceObjectType,
    totalStolen: number
  ): void {
    const currentNodes = this.variantTree.getCurrentVariantNodes();

    for (const node of currentNodes) {
      const gameState = node.gameState;

      // Calculate how many of this resource all OTHER players have
      let actualTotal = 0;
      for (const [name, playerState] of Object.entries(gameState)) {
        if (name !== playerName) {
          actualTotal += playerState.resources[resourceType];
        }
      }

      // If this branch doesn't match the known total, eliminate it
      if (actualTotal !== totalStolen) {
        this.variantTree.removeVariantNode(node);
      }
    }

    // Update remaining valid branches with the monopoly results
    const remainingNodes = this.variantTree.getCurrentVariantNodes();
    for (const node of remainingNodes) {
      const gameState = node.gameState;

      // Player receives all the resources
      if (gameState[playerName]) {
        gameState[playerName].resources[resourceType] += totalStolen;
      }

      // All other players lose all of this resource
      for (const [name, playerState] of Object.entries(gameState)) {
        if (name !== playerName) {
          playerState.resources[resourceType] = 0;
        }
      }
    }
  }

  processTrade(
    player1: string,
    player2: string,
    resourceChanges: Partial<ResourceObjectType>
  ): void {
    const currentNodes = this.variantTree.getCurrentVariantNodes();

    for (const node of currentNodes) {
      const gameState = node.gameState;
      const player1Gives = Object.fromEntries(
        Object.entries(resourceChanges)
          .filter(([_, value]) => value < 0)
          .map(([key, value]) => [key, -value])
      );
      const player2Gives = Object.fromEntries(
        Object.entries(resourceChanges).filter(([_, value]) => value > 0)
      );

      // Check if trade is valid in this variant
      if (
        !this.canAffordTrade(gameState[player1], player1Gives) ||
        !this.canAffordTrade(gameState[player2], player2Gives)
      ) {
        this.variantTree.removeVariantNode(node);
        continue;
      }

      // Execute the trade
      this.executeResourceTransfer(gameState[player1], player1Gives, -1);
      this.executeResourceTransfer(gameState[player1], player2Gives, 1);
      this.executeResourceTransfer(gameState[player2], player2Gives, -1);
      this.executeResourceTransfer(gameState[player2], player1Gives, 1);
    }

    this.variantTree.pruneInvalidNodes();
  }

  processTradeOffer(
    playerName: string,
    offeredResources: Partial<ResourceObjectType>
  ): void {
    const currentNodes = this.variantTree.getCurrentVariantNodes();

    for (const node of currentNodes) {
      const gameState = node.gameState;
      const playerState = gameState[playerName];

      if (!playerState || !this.canAffordTrade(playerState, offeredResources)) {
        this.variantTree.removeVariantNode(node);
      }
    }
  }

  getMostLikelyGameState(): {
    gameState: GameState;
    probability: number;
  } | null {
    const variants = this.variantTree.getCurrentVariants();
    if (variants.length === 0) return null;

    return {
      gameState: variants[0].gameState,
      probability: variants[0].probability,
    };
  }

  getAllPossibleGameStates(): Array<{
    gameState: GameState;
    probability: number;
  }> {
    return this.variantTree.getCurrentVariants().map(variant => ({
      gameState: variant.gameState,
      probability: variant.probability,
    }));
  }

  /**
   * Get uncertainty level for a specific player's resources
   */
  getPlayerResourceUncertainty(playerName: string): {
    [K in keyof ResourceObjectType]: {
      min: number;
      max: number;
      mostLikely: number;
      confidence: number;
    };
  } {
    const variants = this.variantTree.getCurrentVariants();
    const result = {} as any;

    for (const resourceType of RESOURCE_TYPES) {
      const values = variants
        .map(v => ({
          value: v.gameState[playerName]?.resources[resourceType] || 0,
          probability: v.probability,
        }))
        .filter(v => v.value !== undefined);

      if (values.length === 0) {
        result[resourceType] = { min: 0, max: 0, mostLikely: 0, confidence: 0 };
        continue;
      }

      const min = Math.min(...values.map(v => v.value));
      const max = Math.max(...values.map(v => v.value));

      // Most likely value (highest probability)
      const mostLikely = values.reduce((best, current) =>
        current.probability > best.probability ? current : best
      ).value;

      // Confidence = probability of the most likely value
      const confidence = values
        .filter(v => v.value === mostLikely)
        .reduce((sum, v) => sum + v.probability, 0);

      result[resourceType] = { min, max, mostLikely, confidence };
    }

    return result;
  }

  /**
   * Helper: Deep clone game state
   */
  private deepCloneGameState(gameState: GameState): GameState {
    return JSON.parse(JSON.stringify(gameState));
  }

  /**
   * Helper: Check if player can afford a trade
   */
  private canAffordTrade(
    playerState: any,
    resources: Partial<ResourceObjectType>
  ): boolean {
    for (const [resourceType, amount] of Object.entries(resources)) {
      if (amount && playerState.resources[resourceType] < amount) {
        return false;
      }
    }
    return true;
  }

  /**
   * Helper: Execute resource transfer (multiplier: 1 for gain, -1 for loss)
   */
  private executeResourceTransfer(
    playerState: any,
    resources: Partial<ResourceObjectType>,
    multiplier: number
  ): void {
    for (const [resourceType, amount] of Object.entries(resources)) {
      if (amount) {
        playerState.resources[resourceType] += amount * multiplier;
      }
    }
  }

  /**
   * Get all unresolved unknown transactions
   */
  getUnresolvedTransactions(): UnknownTransaction[] {
    return this.unknownTransactions.filter(t => !t.isResolved);
  }

  /**
   * Get unknown transaction by ID
   */
  getUnknownTransaction(id: string): UnknownTransaction | undefined {
    return this.unknownTransactions.find(t => t.id === id);
  }

  /**
   * Resolve unknown transaction by specifying what resource was stolen
   */
  resolveUnknownTransaction(
    id: string,
    resolvedResource: keyof ResourceObjectType
  ): boolean {
    const transaction = this.unknownTransactions.find(t => t.id === id);
    if (!transaction || transaction.isResolved) {
      console.warn(`Transaction ${id} not found or already resolved`);
      return false;
    }

    // Mark transaction as resolved
    transaction.isResolved = true;
    transaction.resolvedResource = resolvedResource;

    // Remove variant nodes that don't match the resolved resource
    const currentNodes = this.variantTree.getCurrentVariantNodes();
    for (const node of currentNodes) {
      if (node.transactionId === id) {
        // Check if this variant matches the resolved resource
        const matches = this.variantMatchesResolvedResource(
          node,
          transaction,
          resolvedResource
        );
        if (!matches) {
          this.variantTree.removeVariantNode(node);
        }
      }
    }

    this.variantTree.pruneInvalidNodes();
    console.log(
      `✅ Manually resolved transaction ${id}: ${transaction.thief} stole ${resolvedResource} from ${transaction.victim}`
    );
    return true;
  }

  /**
   * Check if a variant node matches the resolved resource for a transaction
   */
  variantMatchesResolvedResource(
    node: VariantNode,
    transaction: UnknownTransaction,
    resolvedResource: keyof ResourceObjectType
  ): boolean {
    // Use the stored stolen resource if available
    if (node.stolenResource) {
      return node.stolenResource === resolvedResource;
    }

    // Fallback to the old method for backward compatibility
    if (!node.parent) return true; // Root node always matches

    const parentState = node.parent.gameState;
    const currentState = node.gameState;

    // Check if the thief gained the resolved resource and victim lost it
    const thiefGained =
      currentState[transaction.thief]?.resources[resolvedResource] -
      parentState[transaction.thief]?.resources[resolvedResource];
    const victimLost =
      parentState[transaction.victim]?.resources[resolvedResource] -
      currentState[transaction.victim]?.resources[resolvedResource];

    return thiefGained === 1 && victimLost === 1;
  }

  /**
   * Get resource probabilities for a specific transaction
   */
  getTransactionResourceProbabilities(
    transactionId: string
  ): ResourceObjectType | null {
    const transaction = this.getUnknownTransaction(transactionId);
    if (!transaction || transaction.isResolved) {
      return null;
    }

    // Get all variant nodes associated with this transaction
    const currentNodes = this.variantTree.getCurrentVariantNodes();
    const transactionNodes = currentNodes.filter(
      node => node.transactionId === transactionId
    );

    if (transactionNodes.length === 0) {
      return null;
    }

    // Initialize result with all resources set to 0
    const result: ResourceObjectType = {
      tree: 0,
      brick: 0,
      sheep: 0,
      wheat: 0,
      ore: 0,
    };

    // Calculate probabilities for each resource based on variants
    const resourceProbabilities = new Map<keyof ResourceObjectType, number>();
    let totalProbability = 0;

    for (const node of transactionNodes) {
      // Calculate cumulative probability for this node
      let probability = node.probability;
      let parent = node.parent;
      while (parent) {
        probability *= parent.probability;
        parent = parent.parent;
      }

      totalProbability += probability;

      // Determine which resource this variant represents
      const resource = node.stolenResource;
      if (resource) {
        resourceProbabilities.set(
          resource,
          (resourceProbabilities.get(resource) || 0) + probability
        );
      }
    }

    // Normalize probabilities and populate result
    for (const [resource, probability] of resourceProbabilities.entries()) {
      result[resource] =
        totalProbability > 0 ? probability / totalProbability : 0;
    }

    return result;
  }
}
