import { ResourceObjectType } from './types';
import {
  VariantTree,
  VariantNode,
  GameState,
  RESOURCE_TYPES,
} from './variants';

/**
 * Transaction handlers using the variant system
 */
export class VariantTransactionProcessor {
  constructor(private variantTree: VariantTree) {}

  /**
   * Handle a steal from unknown resources
   * Creates branches for each possible resource that could have been stolen
   */
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

          newVariants.push(new VariantNode(node, probability, newGameState));
        }
      }

      // Add all possible steal variants as children
      node.addVariantNodes(newVariants);
    }

    // Clean up invalid states
    this.variantTree.pruneInvalidNodes();
  }

  /**
   * Handle a monopoly card play where we know the total amount stolen
   * This eliminates branches that don't match the known total
   */
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

  /**
   * Handle a trade where we know the exact resources exchanged
   */
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

  /**
   * Handle a trade offer that eliminates branches where the player can't afford it
   */
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

  /**
   * Get the most likely current game state
   */
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

  /**
   * Get all possible game states with their probabilities
   */
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
}
