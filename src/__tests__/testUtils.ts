import { expect } from '@jest/globals';
import { ResourceObjectType } from '../types';

/**
 * Helper function to check only non-zero resources in tests
 * Usage: expectNonZeroResources(actualResources, { brick: 1, wheat: 2 })
 * This will only check that brick=1 and wheat=2, ignoring other resource values
 */
export function expectNonZeroResources(
  actual: ResourceObjectType,
  expected: Partial<ResourceObjectType>
): void {
  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key as keyof ResourceObjectType];
    expect(actualValue).toBe(expectedValue);
  }
}

/**
 * Helper function to create a minimal ResourceObjectType with only specified values
 * All other resources default to 0
 */
export function createResources(
  resources: Partial<ResourceObjectType>
): ResourceObjectType {
  return {
    tree: 0,
    brick: 0,
    sheep: 0,
    wheat: 0,
    ore: 0,
    ...resources,
  };
}

/**
 * Helper function to get total resource count
 */
export function getTotalResources(resources: ResourceObjectType): number {
  return (
    resources.tree +
    resources.brick +
    resources.sheep +
    resources.wheat +
    resources.ore
  );
}

/**
 * Type for expected player resource combinations with optional probability
 */
export type ExpectedVariantCombination = {
  resources: {
    [playerName: string]: Partial<ResourceObjectType>;
  };
  probability?: number;
};

/**
 * Type for possible game states (matches the structure from VariantTree.getAllPossibleGameStates())
 */
export type PossibleGameState = {
  gameState: {
    [playerName: string]: {
      resources: ResourceObjectType;
    };
  };
  probability: number;
};

/**
 * Helper function to match expected variant combinations with possible game states in any order
 * This handles the common test pattern where we have multiple expected outcomes but
 * the order of variants is not guaranteed.
 *
 * @param expectedCombinations Array of expected variant combinations (resources + optional probability)
 * @param possibleGameStates Array of possible game states from getAllPossibleGameStates()
 */
export function expectMatchingVariantCombinations(
  expectedCombinations: ExpectedVariantCombination[],
  possibleGameStates: PossibleGameState[]
): void {
  expect(possibleGameStates.length).toBe(expectedCombinations.length);

  // Track which combinations we've found
  const foundCombinations = new Set<number>();

  // For each game state, find its matching expected combination
  for (const gameState of possibleGameStates) {
    let matchFound = false;

    for (let i = 0; i < expectedCombinations.length; i++) {
      if (foundCombinations.has(i)) continue;

      try {
        // Try to match all players in this combination
        const expectedCombination = expectedCombinations[i];
        let combinationMatches = true;

        // Check probability if specified
        if (expectedCombination.probability !== undefined) {
          expect(gameState.probability).toBe(expectedCombination.probability);
        }

        // Check player resources
        for (const [playerName, expectedResources] of Object.entries(
          expectedCombination.resources
        )) {
          const actualResources = gameState.gameState[playerName]?.resources;
          if (!actualResources) {
            combinationMatches = false;
            break;
          }
          expectNonZeroResources(actualResources, expectedResources);
        }

        if (combinationMatches) {
          foundCombinations.add(i);
          matchFound = true;
          break;
        }
      } catch (error) {
        // This combination doesn't match, continue to next
        continue;
      }
    }

    expect(matchFound).toBe(true);
  }

  // Ensure all expected combinations were found
  expect(foundCombinations.size).toBe(expectedCombinations.length);
}
