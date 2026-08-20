import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  bankTrade,
  buildCity,
  buildRoad,
  buildSettlement,
  buyDevCard,
  knownSteal,
  monopolySteal,
  placeSettlement,
  playerDiscard,
  playerGetResources,
  playerTrade,
  receiveStartingResources,
  rollDice,
  stealFromYou,
  unknownSteal,
  yearOfPlentyTake,
} from '../gameActions';
import { game, resetGameState } from '../gameState';
import { PropbableGameState } from '../probableGameState';
import { getLedger, totalsFor } from '../cardLedger';

const PLAYERS = ['Alice', 'Bob', 'Charlie', 'Diana'];

function seatPlayers(): void {
  resetGameState();
  game.youPlayerName = null;
  PLAYERS.forEach(name => placeSettlement(name));
  game.probableGameState = new PropbableGameState(game.players);
}

/** The invariant both card-flow tables rest on. */
function expectBalanced(name: string): void {
  const t = totalsFor(name);
  expect(t.got + t.devGain - t.robbed - t.sevens - t.spentAndTraded).toBe(
    t.hand
  );
  expect(t.gained - t.lost).toBe(t.hand);
}

describe('card ledger', () => {
  beforeEach(seatPlayers);

  it('starts empty and reads empty for a player nobody has seen', () => {
    expect(getLedger('Nobody')).toEqual({
      dice: 0,
      robGain: 0,
      devGain: 0,
      tradeGain: 0,
      sevens: 0,
      robLoss: 0,
      monoLoss: 0,
      tradeLoss: 0,
      spent: 0,
    });
    expect(totalsFor('Alice').hand).toBe(0);
  });

  it('counts the opening hand, since it covers the whole game', () => {
    receiveStartingResources('Alice', { wheat: 1, sheep: 1 });
    expect(getLedger('Alice').dice).toBe(2);
    expect(totalsFor('Alice').hand).toBe(2);
  });

  it('counts production', () => {
    playerGetResources('Alice', { wheat: 2, ore: 1 });
    expect(getLedger('Alice').dice).toBe(3);
  });

  it('records both halves of a player trade', () => {
    playerGetResources('Alice', { wheat: 3 });
    playerGetResources('Bob', { ore: 2 });
    // Alice gives 2 wheat, gets 1 ore.
    playerTrade('Alice', 'Bob', { wheat: -2, ore: 1 });

    expect(getLedger('Alice').tradeGain).toBe(1);
    expect(getLedger('Alice').tradeLoss).toBe(2);
    expect(getLedger('Bob').tradeGain).toBe(2);
    expect(getLedger('Bob').tradeLoss).toBe(1);
    expectBalanced('Alice');
    expectBalanced('Bob');
  });

  it('records a bank trade against one player only', () => {
    playerGetResources('Alice', { wheat: 4 });
    bankTrade('Alice', { wheat: -4, ore: 1 });

    expect(getLedger('Alice').tradeLoss).toBe(4);
    expect(getLedger('Alice').tradeGain).toBe(1);
    expect(totalsFor('Alice').hand).toBe(1);
  });

  it('counts a steal as one card each way, known or not', () => {
    playerGetResources('Bob', { wheat: 1 });
    knownSteal('Alice', 'Bob', 'wheat');

    expect(getLedger('Alice').robGain).toBe(1);
    expect(getLedger('Bob').robLoss).toBe(1);
  });

  it('counts an unresolved steal exactly, where the hands table cannot', () => {
    playerGetResources('Bob', { wheat: 1, ore: 1, brick: 1 });
    unknownSteal('Alice', 'Bob');

    // Nobody knows which card moved...
    expect(game.probableGameState.getUnknownTransactions()).toHaveLength(1);
    // ...but exactly one card did.
    expect(getLedger('Alice').robGain).toBe(1);
    expect(getLedger('Bob').robLoss).toBe(1);
    expect(totalsFor('Alice').hand).toBe(1);
    expect(totalsFor('Bob').hand).toBe(2);
  });

  it('does not double-count a steal it managed to deduce', () => {
    // One resource type, so unknownSteal resolves it through knownSteal.
    playerGetResources('Bob', { wheat: 1 });
    unknownSteal('Alice', 'Bob');

    expect(getLedger('Alice').robGain).toBe(1);
    expect(getLedger('Bob').robLoss).toBe(1);
  });

  it('counts a steal from you', () => {
    playerGetResources('Alice', { ore: 1 });
    stealFromYou('Bob', 'Alice', 'ore');

    expect(getLedger('Bob').robGain).toBe(1);
    expect(getLedger('Alice').robLoss).toBe(1);
  });

  it('counts discards from a seven', () => {
    playerGetResources('Alice', { wheat: 4, ore: 4 });
    playerDiscard('Alice', { wheat: 2, ore: 2 });

    expect(getLedger('Alice').sevens).toBe(4);
    expect(totalsFor('Alice').hand).toBe(4);
  });

  it('counts what each build and purchase costs', () => {
    playerGetResources('Alice', {
      tree: 2,
      brick: 2,
      sheep: 2,
      wheat: 4,
      ore: 4,
    });
    buildRoad('Alice'); // 2
    buildSettlement('Alice'); // 4
    buildCity('Alice'); // 5
    buyDevCard('Alice'); // 3

    expect(getLedger('Alice').spent).toBe(14);
    expectBalanced('Alice');
  });

  it('counts year of plenty as a dev-card gain', () => {
    yearOfPlentyTake('Alice', { ore: 1, wheat: 1 });
    expect(getLedger('Alice').devGain).toBe(2);
  });

  it('counts a monopoly haul as a dev-card gain and charges the victims', () => {
    playerGetResources('Bob', { wheat: 3 });
    playerGetResources('Charlie', { wheat: 2 });
    playerGetResources('Diana', { ore: 1 }); // holds none of it

    monopolySteal('Alice', 'wheat', 5);

    expect(getLedger('Alice').devGain).toBe(5);
    expect(getLedger('Bob').monoLoss).toBe(3);
    expect(getLedger('Charlie').monoLoss).toBe(2);
    expect(getLedger('Diana').monoLoss).toBe(0);
  });

  describe('the compact table', () => {
    it('groups every gain and every loss into exactly one column', () => {
      playerGetResources('Alice', { wheat: 5, ore: 5, sheep: 2 });
      playerGetResources('Bob', { tree: 3 });
      playerTrade('Alice', 'Bob', { wheat: -2, tree: 1 });
      knownSteal('Alice', 'Bob', 'tree');
      buyDevCard('Alice');
      playerDiscard('Alice', { ore: 2 });

      const t = totalsFor('Alice');
      // got = production + trades in + steals; spentAndTraded = spend + trades out
      expect(t.got).toBe(t.dice + t.robGain + t.tradeGain);
      expect(t.robbed).toBe(t.robLoss + t.monoLoss);
      expect(t.spentAndTraded).toBe(t.spent + t.tradeLoss);
      expectBalanced('Alice');
    });
  });

  it('balances for every player after a busy game', () => {
    // Opening hands are dealt before the first roll, and it is that roll's
    // rebuild that carries them into the variant tree.
    receiveStartingResources('Alice', { wheat: 1, sheep: 1 });
    receiveStartingResources('Bob', { tree: 1, brick: 1 });
    rollDice(6);

    playerGetResources('Alice', { wheat: 3, ore: 3, sheep: 2, brick: 2 });
    playerGetResources('Bob', { tree: 4, brick: 4 });
    playerGetResources('Charlie', { sheep: 4, wheat: 3 });
    playerGetResources('Diana', { ore: 2 });

    playerTrade('Alice', 'Bob', { wheat: -1, tree: 2 });
    bankTrade('Charlie', { sheep: -3, ore: 1 });
    unknownSteal('Diana', 'Alice');
    knownSteal('Bob', 'Charlie', 'wheat');
    buildRoad('Bob');
    buildSettlement('Alice');
    buyDevCard('Charlie');
    yearOfPlentyTake('Diana', { brick: 1, tree: 1 });
    playerDiscard('Bob', { tree: 2 });
    monopolySteal('Diana', 'ore', 4);

    for (const name of PLAYERS) expectBalanced(name);
  });

  it('survives the rebuild the first dice roll performs', () => {
    receiveStartingResources('Alice', { wheat: 2 });
    playerGetResources('Alice', { ore: 1 });
    expect(totalsFor('Alice').hand).toBe(3);

    // The first roll throws away the variant tree and starts it again; the
    // ledger is deliberately kept outside that.
    rollDice(8);

    expect(totalsFor('Alice').hand).toBe(3);
    expect(getLedger('Alice').dice).toBe(3);
  });

  it('clears when the game is reset for a reprocess', () => {
    playerGetResources('Alice', { wheat: 3 });
    expect(totalsFor('Alice').hand).toBe(3);

    resetGameState();
    expect(totalsFor('Alice').hand).toBe(0);
  });
});
