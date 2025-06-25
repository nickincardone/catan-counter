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
  type: 'steal' | 'trade'; // Can extend for other transaction types
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
