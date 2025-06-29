import { PropbableGameState } from './gameStateWithVariants';

export interface ResourceObjectType {
  sheep: number;
  wheat: number;
  brick: number;
  tree: number;
  ore: number;
}

export interface DiscoveryCardType {
  knights: number;
  victoryPoints: number;
  yearOfPlenties: number;
  roadBuilders: number;
  monopolies: number;
}

// New type for tracking unknown transactions
export interface UnknownTransaction {
  id: string;
  timestamp: number;
  thief: string;
  victim: string;
  possibleResources: ResourceObjectType; // The resources the victim had that could be stolen
  isResolved: boolean;
  resolvedResource?: keyof ResourceObjectType;
}

export interface PlayerType {
  name: string;
  resources: ResourceObjectType;
  resourceProbabilities: ResourceObjectType;
  settlements: number;
  cities: number;
  roads: number;
  knights: number;
  victoryPoints: number;
  discoveryCards: DiscoveryCardType;
  discoveryCardProbabilities: DiscoveryCardType;
  totalRobbers: number;
  color: string;
  totalCards: number;
}

export interface GameType {
  players: PlayerType[];
  // type todo in the future we want to be able to handle nonstandard games
  gameResources: ResourceObjectType;
  devCards: number;
  knights: number;
  victoryPoints: number;
  yearOfPlenties: number;
  roadBuilders: number;
  monopolies: number;
  diceRolls: DiceRollsType;
  remainingDiscoveryCardsProbabilities: DiscoveryCardType;
  unknownTransactions: UnknownTransaction[];
  probableGameState: PropbableGameState;
  hasRolledFirstDice: boolean;
}

export interface DiceRollsType {
  2: number;
  3: number;
  4: number;
  5: number;
  6: number;
  7: number;
  8: number;
  9: number;
  10: number;
  11: number;
  12: number;
}

// Game State Types
export enum TransactionTypeEnum {
  ROBBER_STEAL = 'ROBBER_STEAL',
  MONOPOLY = 'MONOPOLY',
  TRADE = 'TRADE',
  TRADE_OFFER = 'TRADE_OFFER',
  DICE_ROLL = 'DICE_ROLL',
  RESOURCE_GAIN = 'RESOURCE_GAIN',
  RESOURCE_LOSS = 'RESOURCE_LOSS',
}

// Discriminated union - each transaction type has specific attributes
export type TransactionType =
  | {
      type: TransactionTypeEnum.ROBBER_STEAL;
      stealerName: string;
      victimName: string;
      stolenResource: keyof ResourceObjectType | null;
    }
  | {
      type: TransactionTypeEnum.MONOPOLY;
      playerName: string;
      resourceType: keyof ResourceObjectType;
      totalStolen: number;
    }
  | {
      type: TransactionTypeEnum.TRADE;
      player1: string;
      player2: string;
      resourceChanges: Partial<ResourceObjectType>;
    }
  | {
      type: TransactionTypeEnum.TRADE_OFFER;
      playerName: string;
      offeredResources: Partial<ResourceObjectType>;
    }
  | {
      type: TransactionTypeEnum.RESOURCE_GAIN;
      playerName: string;
      resources: Partial<ResourceObjectType>;
    }
  | {
      type: TransactionTypeEnum.RESOURCE_LOSS;
      playerName: string;
      resources: Partial<ResourceObjectType>;
    };
