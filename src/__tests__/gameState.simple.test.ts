import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Game State - Simple Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Resource Calculations', () => {
    it('should calculate probability distributions correctly', () => {
      const victimResources = { sheep: 1, tree: 2, ore: 1, wheat: 0, brick: 0 };
      const totalCards = Object.values(victimResources).reduce((sum, count) => sum + count, 0);
      
      expect(totalCards).toBe(4);
      
      // Calculate probabilities
      const probabilities = {
        sheep: victimResources.sheep / totalCards,
        tree: victimResources.tree / totalCards,
        ore: victimResources.ore / totalCards,
        wheat: victimResources.wheat / totalCards,
        brick: victimResources.brick / totalCards
      };
      
      expect(probabilities.tree).toBeCloseTo(0.5);
      expect(probabilities.sheep).toBeCloseTo(0.25);
      expect(probabilities.ore).toBeCloseTo(0.25);
      expect(probabilities.wheat).toBe(0);
      expect(probabilities.brick).toBe(0);
      
      // Probabilities should sum to 1
      const sum = Object.values(probabilities).reduce((s, p) => s + p, 0);
      expect(sum).toBeCloseTo(1);
    });

    it('should handle edge cases in probability calculation', () => {
      // Empty resources
      const emptyResources = { sheep: 0, tree: 0, ore: 0, wheat: 0, brick: 0 };
      const emptyTotal = Object.values(emptyResources).reduce((sum, count) => sum + count, 0);
      expect(emptyTotal).toBe(0);

      // Single resource
      const singleResource = { sheep: 1, tree: 0, ore: 0, wheat: 0, brick: 0 };
      const singleTotal = Object.values(singleResource).reduce((sum, count) => sum + count, 0);
      const singleProbability = singleResource.sheep / singleTotal;
      expect(singleProbability).toBe(1);
    });
  });

  describe('Transaction Resolution Logic', () => {
    it('should identify resolvable transactions', () => {
      // Mock transaction scenario
      const transactions = [
        {
          id: 'steal_1',
          thief: 'Alice',
          victim: 'Bob',
          possibleResources: { sheep: 1, tree: 2, ore: 1, wheat: 0, brick: 0 },
          isResolved: false,
          type: 'steal' as const
        },
        {
          id: 'steal_2',
          thief: 'Alice',
          victim: 'Charlie',
          possibleResources: { sheep: 0, tree: 0, ore: 0, wheat: 1, brick: 2 },
          isResolved: false,
          type: 'steal' as const
        }
      ];

      // Find transactions where Alice could have stolen 'tree'
      const treeTransactions = transactions.filter(t => 
        t.thief === 'Alice' && 
        !t.isResolved && 
        t.possibleResources.tree > 0
      );

      expect(treeTransactions).toHaveLength(1);
      expect(treeTransactions[0].id).toBe('steal_1');

      // Find transactions where Alice could have stolen 'brick'
      const brickTransactions = transactions.filter(t => 
        t.thief === 'Alice' && 
        !t.isResolved && 
        t.possibleResources.brick > 0
      );

      expect(brickTransactions).toHaveLength(1);
      expect(brickTransactions[0].id).toBe('steal_2');
    });

    it('should prioritize most recent transactions', () => {
      const transactions = [
        {
          id: 'steal_1',
          timestamp: 1000,
          thief: 'Alice',
          possibleResources: { sheep: 1, tree: 1, ore: 0, wheat: 0, brick: 0 }
        },
        {
          id: 'steal_2',
          timestamp: 2000,
          thief: 'Alice',
          possibleResources: { sheep: 0, tree: 1, ore: 1, wheat: 0, brick: 0 }
        }
      ];

      // Sort by timestamp (most recent first)
      const sortedTransactions = transactions.sort((a, b) => b.timestamp - a.timestamp);
      
      expect(sortedTransactions[0].id).toBe('steal_2');
      expect(sortedTransactions[1].id).toBe('steal_1');
    });

    it('should resolve probabilities when resource eliminated (bank at 19)', () => {
      // Mock transaction with multiple possible resources
      const transaction = {
        id: 'steal_1',
        thief: 'Alice',
        victim: 'Bob',
        possibleResources: { sheep: 1, tree: 2, ore: 1, wheat: 0, brick: 0 },
        isResolved: false,
        type: 'steal' as const
      };

      // Mock player probabilities (matching the possible resources)
      const totalCards = Object.values(transaction.possibleResources).reduce((sum, count) => sum + count, 0);
      const thiefProbabilities = {
        sheep: transaction.possibleResources.sheep / totalCards, // 1/4 = 0.25
        tree: transaction.possibleResources.tree / totalCards,   // 2/4 = 0.5  
        ore: transaction.possibleResources.ore / totalCards,     // 1/4 = 0.25
        wheat: 0,
        brick: 0
      };

      expect(totalCards).toBe(4);
      expect(thiefProbabilities.tree).toBeCloseTo(0.5);
      expect(thiefProbabilities.sheep).toBeCloseTo(0.25);
      expect(thiefProbabilities.ore).toBeCloseTo(0.25);

      // Simulate eliminating 'tree' (bank reaches 19 trees)
      const eliminatedResource = 'tree';
      const eliminatedProbability = thiefProbabilities[eliminatedResource];
      
      // Remove tree from possible resources
      transaction.possibleResources.tree = 0;
      
      // Recalculate probabilities for remaining resources
      const remainingTotal = Object.values(transaction.possibleResources).reduce((sum, count) => sum + count, 0);
      
      expect(remainingTotal).toBe(2); // Only sheep (1) + ore (1) = 2 remaining
      
      const newProbabilities = {
        sheep: transaction.possibleResources.sheep / remainingTotal, // 1/2 = 0.5
        tree: 0, // eliminated
        ore: transaction.possibleResources.ore / remainingTotal,     // 1/2 = 0.5
        wheat: 0,
        brick: 0
      };

      expect(newProbabilities.sheep).toBeCloseTo(0.5);
      expect(newProbabilities.tree).toBe(0);
      expect(newProbabilities.ore).toBeCloseTo(0.5);
      
      // Verify the eliminated probability was redistributed
      const probabilityIncrease = {
        sheep: newProbabilities.sheep - thiefProbabilities.sheep, // 0.5 - 0.25 = 0.25
        ore: newProbabilities.ore - thiefProbabilities.ore        // 0.5 - 0.25 = 0.25
      };

      expect(probabilityIncrease.sheep).toBeCloseTo(0.25);
      expect(probabilityIncrease.ore).toBeCloseTo(0.25);
      
      // Total redistributed should equal eliminated probability
      const totalRedistributed = probabilityIncrease.sheep + probabilityIncrease.ore;
      expect(totalRedistributed).toBeCloseTo(eliminatedProbability);
    });
  });

  describe('Resource Validation', () => {
    it('should validate sufficient resources for building costs', () => {
      const playerResources = { sheep: 2, tree: 1, ore: 1, wheat: 1, brick: 2 };
      
      // Settlement cost: 1 sheep, 1 tree, 1 wheat, 1 brick
      const settlementCost = { sheep: 1, tree: 1, wheat: 1, brick: 1, ore: 0 };
      
      // Check if player can afford settlement
      const canAffordSettlement = Object.keys(settlementCost).every(resource => {
        const key = resource as keyof typeof playerResources;
        return playerResources[key] >= settlementCost[key];
      });
      
      expect(canAffordSettlement).toBe(true);

      // City cost: 3 ore, 2 wheat
      const cityCost = { sheep: 0, tree: 0, wheat: 2, brick: 0, ore: 3 };
      
      const canAffordCity = Object.keys(cityCost).every(resource => {
        const key = resource as keyof typeof playerResources;
        return playerResources[key] >= cityCost[key];
      });
      
      expect(canAffordCity).toBe(false); // Player only has 1 ore, needs 3
    });

    it('should calculate resource shortfalls', () => {
      const playerResources = { sheep: 1, tree: 0, ore: 1, wheat: 1, brick: 1 };
      const roadCost = { sheep: 0, tree: 1, wheat: 0, brick: 1, ore: 0 };
      
      const shortfalls: Record<string, number> = {};
      
      Object.keys(roadCost).forEach(resource => {
        const key = resource as keyof typeof playerResources;
        const needed = roadCost[key];
        const available = playerResources[key];
        
        if (needed > available) {
          shortfalls[key] = needed - available;
        }
      });
      
      expect(shortfalls.tree).toBe(1); // Needs 1 tree, has 0
      expect(shortfalls.brick).toBeUndefined(); // Has enough brick
    });
  });

  describe('Game Constants Validation', () => {
    it('should validate standard Catan resource counts', () => {
      const standardResources = {
        sheep: 19,
        wheat: 19,
        brick: 19,
        tree: 19,
        ore: 19
      };
      
      const totalResources = Object.values(standardResources).reduce((sum, count) => sum + count, 0);
      expect(totalResources).toBe(95);
      
      // Each resource type should have same count
      const uniqueCounts = new Set(Object.values(standardResources));
      expect(uniqueCounts.size).toBe(1);
      expect(uniqueCounts.has(19)).toBe(true);
    });

    it('should validate building costs are correct', () => {
      const buildingCosts = {
        settlement: { tree: 1, brick: 1, sheep: 1, wheat: 1, ore: 0 },
        city: { tree: 0, brick: 0, sheep: 0, wheat: 2, ore: 3 },
        road: { tree: 1, brick: 1, sheep: 0, wheat: 0, ore: 0 },
        devCard: { tree: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 }
      };
      
      // Settlement total cost: 4 resources
      const settlementTotal = Object.values(buildingCosts.settlement).reduce((sum, cost) => sum + cost, 0);
      expect(settlementTotal).toBe(4);
      
      // City total cost: 5 resources
      const cityTotal = Object.values(buildingCosts.city).reduce((sum, cost) => sum + cost, 0);
      expect(cityTotal).toBe(5);
      
      // Road total cost: 2 resources
      const roadTotal = Object.values(buildingCosts.road).reduce((sum, cost) => sum + cost, 0);
      expect(roadTotal).toBe(2);
      
      // Dev card total cost: 3 resources
      const devCardTotal = Object.values(buildingCosts.devCard).reduce((sum, cost) => sum + cost, 0);
      expect(devCardTotal).toBe(3);
    });
  });

  describe('Transaction ID Generation', () => {
    it('should generate unique transaction IDs', () => {
      const generateTransactionId = () => 
        `steal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const id1 = generateTransactionId();
      const id2 = generateTransactionId();
      
      expect(id1).toMatch(/^steal_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^steal_\d+_[a-z0-9]+$/);
      
      // IDs should be different (very high probability)
      expect(id1).not.toBe(id2);
    });
  });
}); 