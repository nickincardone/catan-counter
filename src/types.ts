import { PropbableGameState } from './probableGameState';

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

export enum GameTypeEnum {
  STANDARD = 'STANDARD',
}

export interface GameType {
  players: PlayerType[];
  gameType: GameTypeEnum;
  gameResources: ResourceObjectType;
  devCards: number;
  knights: number;
  victoryPoints: number;
  yearOfPlenties: number;
  roadBuilders: number;
  monopolies: number;
  diceRolls: DiceRollsType;
  remainingDiscoveryCardsProbabilities: DiscoveryCardType;
  probableGameState: PropbableGameState;
  hasRolledFirstDice: boolean;
  youPlayerName: string | null;
  blockedDiceRolls: {
    [diceNumber: number]: {
      [resourceType: string]: number;
    };
  };
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
  BANK_TRADE = 'BANK_TRADE',
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
    }
  | {
      type: TransactionTypeEnum.BANK_TRADE;
      playerName: string;
      resourceChanges: Partial<ResourceObjectType>;
    };
