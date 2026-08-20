// cardLedger.ts
// A running count of every resource card each player has picked up and lost,
// by source.
//
// This cannot be derived from the transaction history: RESOURCE_LOSS is emitted
// for a seven-discard, a dev-card purchase and all three building types alike,
// so by the time a transaction exists the reason is gone. The ledger is
// therefore recorded up in gameActions, where the chat message's meaning is
// still known.
//
// It counts CARDS, not resource types, which makes it exact where the hands
// table can only be probabilistic: a steal moves one card whether or not anyone
// knows which. The single approximate entry is a monopoly's per-victim split —
// see recordMonopoly.
//
// It lives on `game` rather than inside PropbableGameState on purpose: the
// first dice roll deliberately throws that away and rebuilds it, which would
// take the whole game's history with it.

import { game } from './gameState.js';

export interface PlayerLedger {
  /** Production rolls and the opening hand. */
  dice: number;
  /** Cards this player took off someone with the robber. */
  robGain: number;
  /** Cards gained through a development card: year of plenty, monopoly. */
  devGain: number;
  /** Cards received in trades, with players or the bank. */
  tradeGain: number;

  /** Discarded because someone rolled a seven. */
  sevens: number;
  /** Taken off this player by the robber. */
  robLoss: number;
  /** Taken off this player by someone's monopoly. */
  monoLoss: number;
  /** Given away in trades, with players or the bank. */
  tradeLoss: number;
  /** Spent building, or buying a development card. */
  spent: number;
}

export type LedgerGain = 'dice' | 'robGain' | 'devGain' | 'tradeGain';
export type LedgerLoss =
  | 'sevens'
  | 'robLoss'
  | 'monoLoss'
  | 'tradeLoss'
  | 'spent';

export function emptyLedger(): PlayerLedger {
  return {
    dice: 0,
    robGain: 0,
    devGain: 0,
    tradeGain: 0,
    sevens: 0,
    robLoss: 0,
    monoLoss: 0,
    tradeLoss: 0,
    spent: 0,
  };
}

function ledgerFor(playerName: string): PlayerLedger {
  let ledger = game.cardLedger[playerName];
  if (!ledger) {
    ledger = emptyLedger();
    game.cardLedger[playerName] = ledger;
  }
  return ledger;
}

/** Read a player's ledger. Players nobody has seen act as read yet read empty. */
export function getLedger(playerName: string): PlayerLedger {
  return game.cardLedger[playerName] ?? emptyLedger();
}

export function recordGain(
  playerName: string | null,
  kind: LedgerGain,
  cards: number
): void {
  if (!playerName || cards <= 0) return;
  ledgerFor(playerName)[kind] += cards;
}

export function recordLoss(
  playerName: string | null,
  kind: LedgerLoss,
  cards: number
): void {
  if (!playerName || cards <= 0) return;
  ledgerFor(playerName)[kind] += cards;
}

/** Total cards in a set of resource changes, counting only the given sign. */
export function countCards(
  changes: Partial<Record<string, number>>,
  sign: 'positive' | 'negative'
): number {
  let total = 0;
  for (const value of Object.values(changes)) {
    if (typeof value !== 'number') continue;
    if (sign === 'positive' && value > 0) total += value;
    if (sign === 'negative' && value < 0) total += -value;
  }
  return total;
}

/**
 * Record both halves of a trade. `changes` is net for `playerName`; the partner
 * gets the mirror image. Passing no partner records a bank trade.
 */
export function recordTrade(
  playerName: string | null,
  partnerName: string | null,
  changes: Partial<Record<string, number>>
): void {
  const received = countCards(changes, 'positive');
  const given = countCards(changes, 'negative');

  recordGain(playerName, 'tradeGain', received);
  recordLoss(playerName, 'tradeLoss', given);
  // The partner's side is the mirror: what one gave, the other received.
  recordGain(partnerName, 'tradeGain', given);
  recordLoss(partnerName, 'tradeLoss', received);
}

/**
 * Record a monopoly.
 *
 * The caster's haul is ground truth — the chat states it — so it is recorded
 * exactly. The per-victim split is not in the chat at all, so each victim is
 * charged what the tracker believes they were holding. That is the one entry in
 * the ledger that can be wrong, and it can only be wrong about WHICH victims
 * lost cards, never about how many the caster gained.
 */
export function recordMonopoly(
  casterName: string | null,
  totalStolen: number,
  perVictim: Array<{ name: string; cards: number }>
): void {
  recordGain(casterName, 'devGain', totalStolen);
  for (const victim of perVictim) {
    recordLoss(victim.name, 'monoLoss', victim.cards);
  }
}

/** A steal moves exactly one card, whether or not anyone knows which. */
export function recordSteal(
  thiefName: string | null,
  victimName: string | null
): void {
  recordGain(thiefName, 'robGain', 1);
  recordLoss(victimName, 'robLoss', 1);
}

export interface LedgerTotals extends PlayerLedger {
  /** Everything picked up, from any source. */
  gained: number;
  /** Everything lost, to any cause. */
  lost: number;
  /** Cards actually held: gained minus lost, exact even with steals open. */
  hand: number;

  /** Compact view: picked up other than through a development card. */
  got: number;
  /** Compact view: taken by the robber or a monopoly. */
  robbed: number;
  /** Compact view: spent building or buying, plus given away in trades. */
  spentAndTraded: number;
}

/**
 * Fold a ledger into the numbers both card-flow tables show.
 *
 * Every gain lands in exactly one of `got`/`devGain` and every loss in exactly
 * one of `robbed`/`sevens`/`spentAndTraded`, so the compact table balances:
 * got + devGain - robbed - sevens - spentAndTraded === hand.
 */
export function totalsFor(playerName: string): LedgerTotals {
  const ledger = getLedger(playerName);
  const gained =
    ledger.dice + ledger.robGain + ledger.devGain + ledger.tradeGain;
  const lost =
    ledger.sevens +
    ledger.robLoss +
    ledger.monoLoss +
    ledger.tradeLoss +
    ledger.spent;

  return {
    ...ledger,
    gained,
    lost,
    hand: gained - lost,
    got: ledger.dice + ledger.robGain + ledger.tradeGain,
    robbed: ledger.robLoss + ledger.monoLoss,
    spentAndTraded: ledger.spent + ledger.tradeLoss,
  };
}
