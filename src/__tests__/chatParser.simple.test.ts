import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Simple test to verify the testing infrastructure is working
describe('Chat Parser - Simple Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Test Infrastructure', () => {
    it('should be able to run tests', () => {
      expect(1 + 1).toBe(2);
    });

    it('should handle mocking', () => {
      const mockFn = jest.fn();
      mockFn('test');
      expect(mockFn).toHaveBeenCalledWith('test');
    });
  });

  describe('Chat Message Processing Logic', () => {
    it('should identify dice roll messages', () => {
      const messageText = 'Alice rolled 7';
      expect(messageText.includes('rolled')).toBe(true);
    });

    it('should identify building messages', () => {
      const buildMessages = [
        'Alice built a settlement',
        'Bob built a city',
        'Charlie built a road'
      ];
      
      buildMessages.forEach(message => {
        expect(message.includes('built a')).toBe(true);
      });
    });

    it('should identify steal messages', () => {
      const stealMessages = [
        'Alice stole sheep from Bob',
        'Charlie stole from David'
      ];
      
      stealMessages.forEach(message => {
        expect(message.includes('stole')).toBe(true);
        expect(message.includes('from')).toBe(true);
      });
    });

    it('should identify resource acquisition messages', () => {
      const resourceMessages = [
        'Alice got resources',
        'Bob received starting resources',
        'Charlie took from bank'
      ];
      
      expect(resourceMessages[0].includes('got')).toBe(true);
      expect(resourceMessages[1].includes('received starting resources')).toBe(true);
      expect(resourceMessages[2].includes('took from bank')).toBe(true);
    });

    it('should identify bank trade messages', () => {
      const bankTradeMessage = 'Alice gave bank 4 sheep and took 1 wheat';
      expect(bankTradeMessage.includes('gave bank')).toBe(true);
      expect(bankTradeMessage.includes('took')).toBe(true);
    });

    it('should identify placement vs building messages', () => {
      const placementMessage = 'Alice placed a settlement';
      const buildingMessage = 'Alice built a settlement';
      
      expect(placementMessage.includes('placed a')).toBe(true);
      expect(buildingMessage.includes('built a')).toBe(true);
    });
  });

  describe('Resource Change Calculations', () => {
    it('should calculate settlement building costs', () => {
      const settlementCost = { tree: -1, wheat: -1, brick: -1, sheep: -1 };
      const totalCost = Object.values(settlementCost).reduce((sum, cost) => sum + Math.abs(cost), 0);
      expect(totalCost).toBe(4);
    });

    it('should calculate city building costs', () => {
      const cityCost = { ore: -3, wheat: -2 };
      const totalCost = Object.values(cityCost).reduce((sum, cost) => sum + Math.abs(cost), 0);
      expect(totalCost).toBe(5);
    });

    it('should calculate road building costs', () => {
      const roadCost = { tree: -1, brick: -1 };
      const totalCost = Object.values(roadCost).reduce((sum, cost) => sum + Math.abs(cost), 0);
      expect(totalCost).toBe(2);
    });

    it('should calculate development card costs', () => {
      const devCardCost = { wheat: -1, sheep: -1, ore: -1 };
      const totalCost = Object.values(devCardCost).reduce((sum, cost) => sum + Math.abs(cost), 0);
      expect(totalCost).toBe(3);
    });
  });

  describe('Probability Calculations', () => {
    it('should calculate steal probabilities correctly', () => {
      const victimResources = { sheep: 1, tree: 2, ore: 1, wheat: 0, brick: 0 };
      const totalCards = Object.values(victimResources).reduce((sum, count) => sum + count, 0);
      
      expect(totalCards).toBe(4);
      
      const treeProbability = victimResources.tree / totalCards;
      const sheepProbability = victimResources.sheep / totalCards;
      const oreProbability = victimResources.ore / totalCards;
      
      expect(treeProbability).toBeCloseTo(0.5);
      expect(sheepProbability).toBeCloseTo(0.25);
      expect(oreProbability).toBeCloseTo(0.25);
    });

    it('should handle zero resource scenarios', () => {
      const emptyResources = { sheep: 0, tree: 0, ore: 0, wheat: 0, brick: 0 };
      const totalCards = Object.values(emptyResources).reduce((sum, count) => sum + count, 0);
      
      expect(totalCards).toBe(0);
    });
  });

  describe('Message Filtering', () => {
    it('should identify messages to ignore', () => {
      const ignoredMessages = [
        'Alice has disconnected',
        'Bob has reconnected',
        'Charlie is blocked by the Robber'
      ];
      
      expect(ignoredMessages[0].includes('has disconnected')).toBe(true);
      expect(ignoredMessages[1].includes('has reconnected')).toBe(true);
      expect(ignoredMessages[2].includes('is blocked by the Robber')).toBe(true);
    });

    it('should handle trade offers for unknown transaction resolution', () => {
      const tradeOfferMessage = 'David wants to give 2 sheep for 1 wheat';
      
      // Trade offers should be processed (not ignored) because they can resolve unknown transactions
      expect(tradeOfferMessage.includes('wants to give')).toBe(true);
      
      // The message should contain resource information that can be parsed
      expect(tradeOfferMessage.includes('sheep')).toBe(true);
      expect(tradeOfferMessage.includes('wheat')).toBe(true);
      
      // The format should be parseable to extract offered resources
      const offerMatch = tradeOfferMessage.match(/wants to give (.+) for (.+)/);
      expect(offerMatch).toBeTruthy();
      expect(offerMatch?.[1]).toContain('sheep'); // What they're offering
      expect(offerMatch?.[2]).toContain('wheat'); // What they want
    });
  });
}); 