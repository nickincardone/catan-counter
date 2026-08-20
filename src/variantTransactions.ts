import { ResourceObjectType, UnknownTransaction } from './types';
import {
  VariantTree,
  VariantNode,
  GameState,
  RESOURCE_TYPES,
} from './variants';

export class VariantTransactionProcessor {
  private unknownTransactions: UnknownTransaction[] = [];
  private transactionCounter: number = 0;

  constructor(private variantTree: VariantTree) {}

  processUnknownSteal(stealerName: string, victimName: string): void {
    const currentNodes = this.variantTree.getCurrentVariantNodes();
    // Deliberately free of wall-clock time: rebuilding the tree by replaying
    // history must mint the same id for the same steal, or manual resolutions
    // could not be re-applied and the UI's ids would change under it. The
    // counter alone is unique within a processor. Observation time lives on the
    // transaction's `timestamp`.
    const transactionId = `${stealerName}_${victimName}_${++this.transactionCounter}`;
    let shouldCreateTransaction = false;

    // The chat is ground truth: a steal happened, so the victim had at least
    // one card. If every variant says they had none, our tracking is wrong
    // (e.g. messages were missed after a page refresh) — skip the steal rather
    // than eliminating every variant (which would throw on root removal).
    const victimHasResources = (node: VariantNode): boolean => {
      const victimState = node.gameState[victimName];
      return (
        !!victimState &&
        RESOURCE_TYPES.some(
          resourceType => victimState.resources[resourceType] > 0
        )
      );
    };
    if (!currentNodes.some(victimHasResources)) {
      console.warn(
        `⚠️ ${stealerName} stole from ${victimName}, but ${victimName} has no resources in any variant — ignoring steal (messages may have been missed)`
      );
      return;
    }

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
      if (newVariants.length > 1) {
        shouldCreateTransaction = true;
      }

      // Add all possible steal variants as children
      node.addVariantNodes(newVariants);
    }

    if (shouldCreateTransaction) {
      const transaction: UnknownTransaction = {
        id: transactionId,
        timestamp: Date.now(),
        thief: stealerName,
        victim: victimName,
        isResolved: false,
      };

      this.unknownTransactions.push(transaction);
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

    const monopolyMatches = (node: VariantNode): boolean => {
      // How many of this resource all OTHER players have in this variant
      let actualTotal = 0;
      for (const [name, playerState] of Object.entries(node.gameState)) {
        if (name !== playerName) {
          actualTotal += playerState.resources[resourceType];
        }
      }
      return actualTotal === totalStolen;
    };

    // The chat is ground truth: if no variant matches the announced total, our
    // tracking is wrong (e.g. messages were missed after a page refresh). Keep
    // every variant rather than emptying the tree (which would throw on root
    // removal); the update below force-applies the announced result anyway.
    const anyMatch = currentNodes.some(monopolyMatches);
    if (!anyMatch) {
      console.warn(
        `⚠️ Monopoly by ${playerName} (${totalStolen} ${resourceType}) matches no variant — force-applying (messages may have been missed)`
      );
    }

    for (const node of currentNodes) {
      // If this branch doesn't match the known total, eliminate it
      if (anyMatch && !monopolyMatches(node)) {
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
    const player1Gives = Object.fromEntries(
      Object.entries(resourceChanges)
        .filter(([_, value]) => value < 0)
        .map(([key, value]) => [key, -value])
    );
    const player2Gives = Object.fromEntries(
      Object.entries(resourceChanges).filter(([_, value]) => value > 0)
    );

    const tradeIsValid = (node: VariantNode): boolean =>
      this.canAffordTrade(node.gameState[player1], player1Gives) &&
      this.canAffordTrade(node.gameState[player2], player2Gives);

    // The chat is ground truth: if the trade is impossible in EVERY variant,
    // our tracking is wrong (e.g. messages were missed after a page refresh).
    // Eliminating all variants would cascade into removing the tree's root and
    // throw mid-prune, so instead keep every variant and force-apply the trade
    // with clamping.
    const anyValid = currentNodes.some(tradeIsValid);
    if (!anyValid) {
      console.warn(
        `⚠️ Trade between ${player1} and ${player2} is impossible in every variant — force-applying (messages may have been missed)`
      );
    }

    for (const node of currentNodes) {
      const gameState = node.gameState;

      if (anyValid && !tradeIsValid(node)) {
        this.variantTree.removeVariantNode(node);
        continue;
      }

      // Execute the trade (clamped so a force-applied trade can't go negative)
      const clamp = !anyValid;
      this.executeResourceTransfer(gameState[player1], player1Gives, -1, clamp);
      this.executeResourceTransfer(gameState[player1], player2Gives, 1, clamp);
      this.executeResourceTransfer(gameState[player2], player2Gives, -1, clamp);
      this.executeResourceTransfer(gameState[player2], player1Gives, 1, clamp);
    }

    this.variantTree.pruneInvalidNodes();
  }

  processTradeOffer(
    playerName: string,
    offeredResources: Partial<ResourceObjectType>
  ): void {
    const currentNodes = this.variantTree.getCurrentVariantNodes();

    const offerIsValid = (node: VariantNode): boolean => {
      const playerState = node.gameState[playerName];
      return (
        !!playerState && this.canAffordTrade(playerState, offeredResources)
      );
    };

    // The chat is ground truth: if the offer is impossible in EVERY variant,
    // our tracking is wrong (e.g. messages were missed after a page refresh).
    // Keep the tree intact rather than emptying it (which would throw on root
    // removal); an offer moves no resources, so there is nothing to apply.
    if (!currentNodes.some(offerIsValid)) {
      console.warn(
        `⚠️ Trade offer by ${playerName} is impossible in every variant — ignoring (messages may have been missed)`
      );
      return;
    }

    for (const node of currentNodes) {
      if (!offerIsValid(node)) {
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
    multiplier: number,
    clamp = false
  ): void {
    for (const [resourceType, amount] of Object.entries(resources)) {
      if (amount) {
        const updated =
          playerState.resources[resourceType] + amount * multiplier;
        playerState.resources[resourceType] = clamp
          ? Math.max(0, updated)
          : updated;
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
   * Every steal ever branched on, resolved or not. The UI needs the resolved
   * ones so a manual resolution can be shown as confirmed and undone.
   */
  getAllTransactions(): UnknownTransaction[] {
    return [...this.unknownTransactions];
  }

  /**
   * Restore original observation times after a rebuild. Replay re-creates each
   * transaction with the current clock, which would otherwise stamp a whole
   * game's steals with the moment someone pressed undo.
   */
  restoreTransactionTimestamps(timestamps: Map<string, number>): void {
    for (const transaction of this.unknownTransactions) {
      const original = timestamps.get(transaction.id);
      if (original !== undefined) transaction.timestamp = original;
    }
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
    const transactionNodes = currentNodes.filter(node =>
      node.hasTransactionId(transactionId)
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

      // Determine which resource this variant represents for this specific transaction
      const resource = this.findStolenResourceInChain(node, transactionId);
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

  /**
   * Cull outcome branches whose probability has dropped below epsilon.
   *
   * Steal trees compound: a few unknown steals in a row leave outcome options
   * like "wheat: 0.02" alive forever (sub-3% is far below any actionable odds), cluttering the display and multiplying
   * the variant count (each surviving branch re-branches on every later
   * steal). Dropping a sub-epsilon outcome accepts a tiny chance of being
   * wrong in exchange for a much tighter tree — and if reality later
   * contradicts the cull, the processors force-apply the observation instead
   * of crashing, so the tracker self-heals.
   *
   * Never culls every outcome of a transaction: at least the most likely
   * option always survives.
   */
  cullImprobableOutcomes(epsilon = 0.03): void {
    for (const transaction of this.getUnresolvedTransactions()) {
      const probabilities = this.getTransactionResourceProbabilities(
        transaction.id
      );
      if (!probabilities) continue;

      const options = Object.entries(probabilities).filter(([, p]) => p > 0);
      if (options.length <= 1) continue;
      const toCull = options.filter(([, p]) => p < epsilon);
      if (toCull.length === 0 || toCull.length === options.length) continue;

      for (const [resource] of toCull) {
        for (const node of this.variantTree.getCurrentVariantNodes()) {
          if (
            this.findStolenResourceInChain(node, transaction.id) === resource
          ) {
            this.variantTree.removeVariantNode(node);
          }
        }
      }
      this.variantTree.pruneInvalidNodes();
    }
  }

  /**
   * Auto-resolve transactions where one outcome has become dominant
   * (>= threshold). A 96%-certain steal is more useful resolved than shown as
   * an open question; the rare miss is self-healing (see
   * cullImprobableOutcomes). Exact certainties (probability 1) are handled by
   * resolveAllUnknownTransactions already.
   */
  autoResolveDominantOutcomes(threshold = 0.95): void {
    for (const transaction of this.getUnresolvedTransactions()) {
      const probabilities = this.getTransactionResourceProbabilities(
        transaction.id
      );
      if (!probabilities) continue;

      const [bestResource, bestProbability] = Object.entries(
        probabilities
      ).reduce((best, entry) => (entry[1] > best[1] ? entry : best));

      if (bestProbability >= threshold) {
        console.log(
          `🎯 Auto-resolving ${transaction.thief} steal from ${transaction.victim} as ${bestResource} (${(bestProbability * 100).toFixed(0)}% likely)`
        );
        this.resolveUnknownTransaction(
          transaction.id,
          bestResource as keyof ResourceObjectType
        );
      }
    }
  }
}
