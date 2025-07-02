// Variant system for tracking uncertain game states

import { ResourceObjectType } from './types.js';

export interface GameState {
  [playerName: string]: PlayerState;
}

export interface PlayerState {
  resources: ResourceObjectType;
}

export const RESOURCE_TYPES: (keyof ResourceObjectType)[] = [
  'tree',
  'brick',
  'sheep',
  'wheat',
  'ore',
];

/**
 * Represents a single possible game state with its probability
 */
export class Variant {
  constructor(
    public probability: number,
    public gameState: GameState
  ) {}
}

/**
 * A node in the variant tree with parent/child relationships
 */
export class VariantNode {
  public children: VariantNode[] = [];

  constructor(
    public parent: VariantNode | null,
    public probability: number,
    public gameState: GameState,
    public transactionId?: string,
    public stolenResource?: keyof ResourceObjectType
  ) {}

  /**
   * Get all transaction IDs that led to this node (including parent transactions)
   */
  getTransactionChain(): string[] {
    const chain: string[] = [];
    let current: VariantNode | null = this;

    while (current) {
      if (current.transactionId) {
        chain.unshift(current.transactionId); // Add to beginning to maintain chronological order
      }
      current = current.parent;
    }

    return chain;
  }

  /**
   * Check if this node was created as part of a specific transaction
   */
  hasTransactionId(transactionId: string): boolean {
    return this.getTransactionChain().includes(transactionId);
  }

  /**
   * Add multiple variant nodes as children
   */
  addVariantNodes(variants: VariantNode[]): void {
    if (variants.length === 0) return;

    this.validateProbabilities(variants);
    for (const variant of variants) {
      this.children.push(variant);
    }
  }

  /**
   * Validate that probabilities sum to 1 (within tolerance)
   */
  private validateProbabilities(variants: VariantNode[]): void {
    const sum = variants.reduce(
      (total, variant) => total + variant.probability,
      0
    );
    const tolerance = 1e-8;

    if (Math.abs(sum - 1) > tolerance) {
      throw new Error(`Sum of variant probabilities must be 1, got ${sum}`);
    }
  }

  /**
   * Remove a child variant node and rebalance probabilities
   */
  removeVariantNode(nodeToRemove: VariantNode): void {
    const index = this.children.indexOf(nodeToRemove);
    if (index === -1) return;

    this.children.splice(index, 1);
    this.rebalanceProbabilities(nodeToRemove.probability);

    // If this node has no children and has a parent, remove it from parent
    if (this.children.length === 0 && this.parent) {
      this.parent.removeVariantNode(this);
    }
  }

  /**
   * Rebalance probabilities after removing a node
   */
  private rebalanceProbabilities(removedProbability: number): void {
    const currentSum = this.children.reduce(
      (sum, child) => sum + child.probability,
      0
    );
    const scaleFactor = removedProbability / currentSum;

    for (const child of this.children) {
      child.probability += child.probability * scaleFactor;
    }
  }
}

/**
 * Manages the complete tree of possible game states
 */
export class VariantTree {
  public root: VariantNode;

  constructor(initialGameState: GameState) {
    this.root = new VariantNode(null, 1.0, initialGameState);
  }

  /**
   * Remove a variant node from the tree
   */
  removeVariantNode(node: VariantNode): void {
    if (node === this.root) {
      throw new Error('Cannot remove root node');
    }

    if (node.parent) {
      node.parent.removeVariantNode(node);
    }

    // If tree becomes unary (single path), simplify it
    if (this.isUnary()) {
      const leafNodes = this.getCurrentVariantNodes();
      this.root = leafNodes[0];
      this.root.parent = null;
    }
  }

  /**
   * Get all current possible game states with their probabilities
   */
  getCurrentVariants(): Variant[] {
    const leafNodes = this.getCurrentVariantNodes();
    const variants: Variant[] = [];

    for (const node of leafNodes) {
      // Calculate cumulative probability from root to leaf
      let probability = node.probability;
      let parent = node.parent;

      while (parent) {
        probability *= parent.probability;
        parent = parent.parent;
      }

      variants.push(new Variant(probability, node.gameState));
    }

    // Merge variants with identical game states
    const mergedVariants: Variant[] = [];
    for (const variant of variants) {
      const existing = mergedVariants.find(
        v => JSON.stringify(v.gameState) === JSON.stringify(variant.gameState)
      );

      if (existing) {
        existing.probability += variant.probability;
      } else {
        mergedVariants.push(variant);
      }
    }

    // Sort by probability (highest first)
    return mergedVariants.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Get all leaf nodes (nodes with no children)
   */
  getCurrentVariantNodes(
    node: VariantNode = this.root,
    result: VariantNode[] = []
  ): VariantNode[] {
    if (node.children.length === 0) {
      result.push(node);
    } else {
      for (const child of node.children) {
        this.getCurrentVariantNodes(child, result);
      }
    }
    return result;
  }

  /**
   * Get all nodes with a specific transaction ID (not just leaf nodes)
   * This includes nodes that were created as part of the transaction chain
   */
  getNodesWithTransactionId(
    transactionId: string,
    node: VariantNode = this.root,
    result: VariantNode[] = []
  ): VariantNode[] {
    if (node.hasTransactionId(transactionId)) {
      result.push(node);
    }

    for (const child of node.children) {
      this.getNodesWithTransactionId(transactionId, child, result);
    }

    return result;
  }

  /**
   * Check if the tree is unary (single path from root to leaf)
   */
  private isUnary(): boolean {
    let current = this.root;
    while (current.children.length === 1) {
      current = current.children[0];
    }
    return current.children.length === 0;
  }

  /**
   * Remove any nodes that have impossible game states (negative resources, etc.)
   */
  pruneInvalidNodes(): void {
    const leafNodes = this.getCurrentVariantNodes();

    for (const node of leafNodes) {
      if (this.isInvalidGameState(node.gameState)) {
        this.removeVariantNode(node);
      }
    }
  }

  /**
   * Check if a game state is invalid
   */
  private isInvalidGameState(gameState: GameState): boolean {
    for (const playerName in gameState) {
      const player = gameState[playerName];
      for (const resourceType of RESOURCE_TYPES) {
        if (player.resources[resourceType] < 0) {
          return true;
        }
      }
    }
    return false;
  }
}
