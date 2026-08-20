import {
  VariantTree,
  VariantNode,
  GameState,
  PlayerState,
  RESOURCE_TYPES,
} from './variants';
import { VariantTransactionProcessor } from './variantTransactions';
import { trackerConfig } from './trackerConfig';
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
  /**
   * Player set the tree was built for. Rebuilds start from these names with
   * empty hands, because the starting hands are already the first entries of
   * transactionHistory — seeding them twice would double every opening card.
   */
  private readonly initialPlayerNames: string[];
  /**
   * Operator decisions, in the order they were made. Auto-resolutions are not
   * recorded here: they are re-derived by replay, and are not undoable.
   */
  private manualResolutions: Array<{
    id: string;
    resource: keyof ResourceObjectType;
  }> = [];
  /** Observation times, so a rebuild doesn't restamp every steal. */
  private stealTimestamps = new Map<string, number>();

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

    this.initialPlayerNames = initialPlayers.map(player => player.name);
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
    const resolved = this.transactionProcessor.resolveUnknownTransaction(
      id,
      resolvedResource
    );
    if (resolved) {
      this.manualResolutions.push({ id, resource: resolvedResource });
    }
    return resolved;
  }

  /**
   * Every steal ever branched on, resolved or not — what the UI lists.
   */
  getAllUnknownTransactions(): UnknownTransaction[] {
    return this.transactionProcessor.getAllTransactions();
  }

  /** Whether this resolution was a person's call, and so can be taken back. */
  isManuallyResolved(id: string): boolean {
    return this.manualResolutions.some(resolution => resolution.id === id);
  }

  /**
   * Take back a manual resolution.
   *
   * Resolving prunes branches from the variant tree, and pruned branches cannot
   * be resurrected in place — so undo rebuilds: a fresh tree replays the whole
   * transaction history and then re-applies the manual resolutions that remain,
   * in their original order. That makes undo exact rather than approximate, and
   * it composes with everything else, because the rebuilt tree is derived from
   * the same evidence as the original.
   *
   * Hand-count pruning is not part of the rebuild — it comes from reading
   * colonist's panel, not from the chat — so immediately after an undo the tree
   * holds only what the chat proves. The next message re-applies it.
   *
   * Returns false for an id that was never manually resolved, which includes
   * anything the tracker resolved by itself: that was not a decision to undo.
   */
  unresolveUnknownTransaction(id: string): boolean {
    const index = this.manualResolutions.findIndex(
      resolution => resolution.id === id
    );
    if (index === -1) return false;

    this.manualResolutions.splice(index, 1);
    this.rebuild();
    return true;
  }

  /** Rebuild the variant tree from history plus the surviving resolutions. */
  private rebuild(): void {
    const history = this.transactionHistory;
    const resolutions = this.manualResolutions;

    const initialGameState: GameState = {};
    for (const name of this.initialPlayerNames) {
      const resources = {} as ResourceObjectType;
      for (const resourceType of RESOURCE_TYPES) resources[resourceType] = 0;
      initialGameState[name] = { resources };
    }

    this.variantTree = new VariantTree(initialGameState);
    this.transactionProcessor = new VariantTransactionProcessor(
      this.variantTree
    );
    this.manualResolutions = [];

    for (const transaction of history) this.applyTransaction(transaction);
    this.transactionProcessor.restoreTransactionTimestamps(
      this.stealTimestamps
    );
    // Re-applying through the public method re-records them in order.
    for (const resolution of resolutions) {
      this.resolveUnknownTransaction(resolution.id, resolution.resource);
    }
  }

  /** Remember when each steal was first seen, so rebuilds can restore it. */
  private rememberStealTimestamps(): void {
    for (const transaction of this.transactionProcessor.getAllTransactions()) {
      if (!this.stealTimestamps.has(transaction.id)) {
        this.stealTimestamps.set(transaction.id, transaction.timestamp);
      }
    }
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
   * Full refinement cycle for unknown transactions: resolve what's certain,
   * cull vanishingly-unlikely outcome branches, auto-resolve dominant ones,
   * then resolve again (culling can leave a transaction with one option).
   */
  private refineUnknownTransactions(): void {
    this.resolveAllUnknownTransactions();
    if (trackerConfig.approximateRefinements) {
      this.transactionProcessor.cullImprobableOutcomes();
      this.transactionProcessor.autoResolveDominantOutcomes();
    }
    // When every variant agrees on the current hands, remaining branches are
    // purely historical (e.g. a card that made a round trip) — collapse them
    // so stale steals stop showing as open questions.
    if (this.variantTree.collapseIfConverged()) {
      console.log(
        '🧹 All variants converged on one game state — retiring historical unknowns'
      );
    }
    this.resolveAllUnknownTransactions();
  }

  /**
   * Prune variants using known per-player hand sizes (read from colonist's
   * `[data-player-information-container]` panel). Any variant in which a player's
   * total resource cards doesn't match their known count is impossible and is
   * removed. This resolves steals the chat alone can't — notably after a monopoly,
   * when variants disagree on how many cards a player kept.
   *
   * Safe no-op unless a strict, non-empty subset of variants matches all the given
   * counts, so contradictory or non-discriminating data never empties or collapses
   * the tree (and we never try to remove the root).
   */
  pruneByHandCounts(handCounts: { [playerName: string]: number }): void {
    const nodes = this.variantTree.getCurrentVariantNodes();
    if (nodes.length <= 1) return; // nothing to disambiguate

    const matchesCounts = (node: VariantNode): boolean =>
      Object.entries(handCounts).every(([playerName, count]) => {
        const playerState = node.gameState[playerName];
        if (!playerState) return true; // unknown player -> no constraint
        const total = RESOURCE_TYPES.reduce(
          (sum, resourceType) => sum + playerState.resources[resourceType],
          0
        );
        return total === count;
      });

    const validNodes = nodes.filter(matchesCounts);

    // Ignore contradictory (none match) or non-discriminating (all match) data.
    if (validNodes.length === 0 || validNodes.length === nodes.length) return;

    for (const node of nodes) {
      if (!matchesCounts(node)) {
        this.variantTree.removeVariantNode(node);
      }
    }

    this.variantTree.pruneInvalidNodes();
    this.refineUnknownTransactions();
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
    this.transactionHistory.push(transaction);
    this.applyTransaction(transaction);
    this.rememberStealTimestamps();
  }

  /**
   * Apply a transaction to the tree without recording it. Replay uses this so
   * rebuilding does not append the history it is replaying back onto itself.
   */
  private applyTransaction(transaction: TransactionType): void {
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
    this.refineUnknownTransactions();
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

    const stealIsPossible = (node: VariantNode): boolean => {
      const victimState = node.gameState[victimName];
      return (
        !!victimState &&
        !!node.gameState[stealerName] &&
        getResourceAmount(victimState.resources, resourceType) > 0
      );
    };

    // The chat is ground truth: the steal happened. If it's impossible in
    // EVERY variant, our tracking is wrong (e.g. messages were missed after a
    // page refresh) — force-apply it (clamped at zero) rather than eliminating
    // every variant, which would throw on root removal.
    const anyPossible = currentNodes.some(stealIsPossible);
    if (!anyPossible) {
      console.warn(
        `⚠️ ${stealerName} stole ${resourceType} from ${victimName}, but no variant allows it — force-applying (messages may have been missed)`
      );
    }

    for (const node of currentNodes) {
      const gameState = node.gameState;
      const victimState = gameState[victimName];
      const stealerState = gameState[stealerName];

      if (stealIsPossible(node)) {
        // Execute the steal
        updateResourceAmount(victimState!.resources, resourceType, -1);
        updateResourceAmount(stealerState!.resources, resourceType, 1);
      } else if (anyPossible) {
        // This variant is invalid - victim doesn't have the resource
        this.variantTree.removeVariantNode(node);
      } else if (victimState && stealerState) {
        // Force-apply: victim can't go below zero
        if (getResourceAmount(victimState.resources, resourceType) > 0) {
          updateResourceAmount(victimState.resources, resourceType, -1);
        }
        updateResourceAmount(stealerState.resources, resourceType, 1);
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
  /**
   * Apply a change the player may not be able to afford, pruning the variants
   * where they cannot.
   *
   * The chat is ground truth: if it says someone built a road, they built it.
   * When NO variant can afford the cost our tracking is wrong — messages were
   * missed after a refresh, say — and pruning every variant cascades into
   * removing the tree's root, which throws mid-prune and takes the parser down
   * with it. So in that case keep every variant and force-apply with clamping,
   * exactly as trades and monopolies already do.
   */
  private applyAffordableChange(
    playerName: string,
    description: string,
    requires: Partial<ResourceObjectType>,
    mutate: (state: PlayerState, clamp: boolean) => void
  ): void {
    const currentNodes = this.variantTree.getCurrentVariantNodes();

    const canAfford = (node: VariantNode): boolean => {
      const state = node.gameState[playerName];
      if (!state) return false;
      for (const [resourceType, amount] of Object.entries(requires)) {
        if (typeof amount !== 'number' || !isValidResourceType(resourceType)) {
          continue;
        }
        if (getResourceAmount(state.resources, resourceType) < amount) {
          return false;
        }
      }
      return true;
    };

    const anyValid = currentNodes.some(canAfford);
    if (!anyValid) {
      console.warn(
        `⚠️ ${description} is impossible in every variant — force-applying (messages may have been missed)`
      );
    }

    for (const node of currentNodes) {
      const state = node.gameState[playerName];
      if (!state) continue;

      if (anyValid && !canAfford(node)) {
        this.variantTree.removeVariantNode(node);
        continue;
      }
      mutate(state, !anyValid);
    }

    this.variantTree.pruneInvalidNodes();
  }

  private processResourceLoss(
    playerName: string,
    resources: Partial<ResourceObjectType>
  ): void {
    this.applyAffordableChange(
      playerName,
      `${playerName} losing cards`,
      resources,
      (state, clamp) => {
        for (const [resourceType, amount] of Object.entries(resources)) {
          if (
            typeof amount !== 'number' ||
            !isValidResourceType(resourceType)
          ) {
            continue;
          }
          // Clamped so a force-applied loss can never go negative.
          const held = getResourceAmount(state.resources, resourceType);
          const taken = clamp ? Math.min(held, amount) : amount;
          updateResourceAmount(state.resources, resourceType, -taken);
        }
      }
    );
  }

  /**
   * Process bank trade (player trades resources with the bank)
   */
  private processBankTrade(
    playerName: string,
    resourceChanges: Partial<ResourceObjectType>
  ): void {
    // Only the negative side has to be affordable; the rest is what comes back.
    const requires: Partial<ResourceObjectType> = {};
    for (const [resourceType, amount] of Object.entries(resourceChanges)) {
      if (
        typeof amount === 'number' &&
        amount < 0 &&
        isValidResourceType(resourceType)
      ) {
        requires[resourceType] = Math.abs(amount);
      }
    }

    this.applyAffordableChange(
      playerName,
      `Bank trade by ${playerName}`,
      requires,
      (state, clamp) => {
        for (const [resourceType, amount] of Object.entries(resourceChanges)) {
          if (
            typeof amount !== 'number' ||
            !isValidResourceType(resourceType)
          ) {
            continue;
          }
          if (clamp && amount < 0) {
            const held = getResourceAmount(state.resources, resourceType);
            updateResourceAmount(
              state.resources,
              resourceType,
              -Math.min(held, Math.abs(amount))
            );
          } else {
            updateResourceAmount(state.resources, resourceType, amount);
          }
        }
      }
    );
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
