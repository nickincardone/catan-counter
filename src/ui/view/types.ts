// view/types.ts
// The shape every section renders from. This is deliberately plain data: no
// DOM, no chrome APIs, no references back into the tracker. A section that only
// ever sees a GameView can be mounted in any gutter, rendered in a test, and
// later moved without touching its code.

import type { ResourceObjectType } from '../../types.js';

export type ResourceKey = keyof ResourceObjectType;

/** Display order used everywhere in v2 (matches the mockup). */
export const RESOURCE_ORDER: ResourceKey[] = [
  'tree',
  'brick',
  'sheep',
  'wheat',
  'ore',
];

export type DevCardKey =
  | 'knights'
  | 'monopolies'
  | 'roadBuilders'
  | 'yearOfPlenties'
  | 'victoryPoints';

export interface ResourceCellView {
  resource: ResourceKey;
  /** Guaranteed in every surviving variant. */
  known: number;
  /** Probability (0–1) of holding more than `known`. */
  probability: number;
  /** '+50%', or '' when there is no uncertainty to show. */
  probabilityLabel: string;
  /** Whether the player has or might have any — drives the tinted cell. */
  hasAny: boolean;
}

export interface PlayerView {
  name: string;
  color: string;
  /** Total guaranteed cards, i.e. the '5 known' summary. */
  knownCards: number;
  cells: ResourceCellView[];
  victoryPoints: number;
  knights: number;
  settlements: number;
  cities: number;
  roads: number;
  isYou: boolean;
}

export interface BankView {
  resource: ResourceKey;
  left: number;
  total: number;
}

export interface StealCandidateView {
  resource: ResourceKey;
  probability: number;
  /** 'wheat 50%', or 'wheat · confirmed' once resolved. */
  label: string;
}

export interface StealView {
  id: string;
  thief: string;
  thiefColor: string;
  victim: string;
  victimColor: string;
  /** Local wall-clock time the steal was seen, e.g. '6:35:45 PM'. */
  time: string;
  resolved: boolean;
  resolvedResource: ResourceKey | null;
  /** Only a person's own resolution can be taken back. */
  canUndo: boolean;
  /** Sorted by descending probability; a single entry once resolved. */
  candidates: StealCandidateView[];
}

export type DiceTone = 'seven' | 'hot' | 'normal';

export interface DiceBarView {
  n: number;
  count: number;
  /** Bar height as a percentage of the tallest bar. */
  heightPct: number;
  /** Where the expected-rate tick sits inside the bar, from its top. */
  expectedTopPct: number;
  expected: number;
  tone: DiceTone;
}

export interface DiceView {
  totalRolls: number;
  bars: DiceBarView[];
}

/**
 * One player's row in either card-flow table. The compact table reads
 * got/devGain/robbed/sevens/spentAndTraded; the full ledger breaks the same
 * totals down by source. Both balance to `hand`.
 */
export interface CardFlowView {
  name: string;
  color: string;

  /** Picked up other than through a development card. */
  got: number;
  /** Taken by the robber or a monopoly. */
  robbed: number;
  /** Spent building or buying, plus given away in trades. */
  spentAndTraded: number;

  gained: number;
  dice: number;
  robGain: number;
  devGain: number;
  tradeGain: number;

  lost: number;
  sevens: number;
  robLoss: number;
  monoLoss: number;
  tradeLoss: number;
  spent: number;

  /** Cards actually held — exact, even while steals are unresolved. */
  hand: number;
}

export interface BlockedView {
  diceNumber: number;
  resource: ResourceKey;
  count: number;
}

export interface DevCardView {
  key: DevCardKey;
  /** Short label under the card, e.g. 'Vic. Pt'. */
  name: string;
  icon: string;
  /** Cards of this type not yet played. */
  left: number;
  total: number;
  /** `left / total` as a percentage, for the tile's bar. */
  leftPct: number;
  /** 'emipaco', '2 played', or '5 unseen'. */
  caption: string;
  /** True while nothing of this type has been played. */
  untouched: boolean;
}

export interface DevDeckView {
  /** Sum of unplayed cards across all types. */
  remaining: number;
  cards: DevCardView[];
}

export interface GameView {
  players: PlayerView[];
  bank: BankView[];
  /** Open steals, plus any a person resolved by hand so they can undo it. */
  steals: StealView[];
  /** How many are still open — what the section header counts. */
  openStealCount: number;
  blocked: BlockedView[];
  blockedTotal: number;
  dice: DiceView;
  devDeck: DevDeckView;
  /** Per-player card ledger, in the same order as `players`. */
  cardFlow: CardFlowView[];
  youPlayerName: string | null;
  /** Tracking only starts at the first roll; before that v2 shows a hint. */
  hasStarted: boolean;
  isLoadingHistory: boolean;
}
