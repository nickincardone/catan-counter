import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  placeSettlement,
  playerGetResources,
  unknownSteal,
} from '../gameActions';
import { game, resetGameState } from '../gameState';
import { PropbableGameState } from '../probableGameState';

const PLAYERS = ['Alice', 'Bob', 'Charlie', 'Diana'];

function seatPlayers(): void {
  resetGameState();
  game.youPlayerName = null;
  PLAYERS.forEach(name => placeSettlement(name));
  game.probableGameState = new PropbableGameState(game.players);
}

/** Everything the UI can observe about the tracker's beliefs. */
function snapshot(): string {
  return JSON.stringify(
    PLAYERS.map(name =>
      game.probableGameState.getPlayerResourceProbabilities(name)
    )
  );
}

/** A steal from a player holding several resource types, so it must branch. */
function setUpOpenSteal(): string {
  playerGetResources('Bob', { wheat: 1, ore: 1, brick: 2 });
  unknownSteal('Alice', 'Bob');
  const [transaction] = game.probableGameState.getUnknownTransactions();
  expect(transaction).toBeDefined();
  return transaction.id;
}

describe('undoing a manual resolution', () => {
  beforeEach(seatPlayers);

  it('restores the exact distribution the tracker had before resolving', () => {
    const id = setUpOpenSteal();
    const before = snapshot();

    expect(game.probableGameState.resolveUnknownTransaction(id, 'ore')).toBe(
      true
    );
    expect(snapshot()).not.toBe(before); // resolving really did narrow things

    expect(game.probableGameState.unresolveUnknownTransaction(id)).toBe(true);
    expect(snapshot()).toBe(before);
    expect(game.probableGameState.getUnknownTransactions()).toHaveLength(1);
  });

  it('resolve → undo → resolve differently equals resolving differently first', () => {
    const id = setUpOpenSteal();

    game.probableGameState.resolveUnknownTransaction(id, 'ore');
    game.probableGameState.unresolveUnknownTransaction(id);
    game.probableGameState.resolveUnknownTransaction(id, 'brick');
    const viaUndo = snapshot();

    // Same game, same steal, resolved to brick the first time.
    seatPlayers();
    const freshId = setUpOpenSteal();
    game.probableGameState.resolveUnknownTransaction(freshId, 'brick');

    expect(freshId).toBe(id); // ids are deterministic, so the UI's keys are stable
    expect(viaUndo).toBe(snapshot());
  });

  it('keeps everything that happened after the resolution', () => {
    const id = setUpOpenSteal();
    game.probableGameState.resolveUnknownTransaction(id, 'ore');

    // Play continues while the resolution stands.
    playerGetResources('Charlie', { sheep: 3 });
    playerGetResources('Alice', { tree: 1 });

    game.probableGameState.unresolveUnknownTransaction(id);

    const charlie =
      game.probableGameState.getPlayerResourceProbabilities('Charlie');
    const alice =
      game.probableGameState.getPlayerResourceProbabilities('Alice');
    expect(charlie.minimumResources.sheep).toBe(3);
    expect(alice.minimumResources.tree).toBe(1);
  });

  it('does not restamp the steal with the time of the undo', () => {
    const id = setUpOpenSteal();
    const original =
      game.probableGameState.getUnknownTransaction(id)!.timestamp;

    game.probableGameState.resolveUnknownTransaction(id, 'ore');
    game.probableGameState.unresolveUnknownTransaction(id);

    expect(game.probableGameState.getUnknownTransaction(id)!.timestamp).toBe(
      original
    );
  });

  it('refuses to undo something the tracker worked out for itself', () => {
    // Only one resource type to take, so this resolves without anyone deciding.
    playerGetResources('Bob', { wheat: 1 });
    unknownSteal('Alice', 'Bob');

    const auto = game.probableGameState
      .getAllUnknownTransactions()
      .find(transaction => transaction.isResolved);

    if (auto) {
      expect(game.probableGameState.isManuallyResolved(auto.id)).toBe(false);
      expect(game.probableGameState.unresolveUnknownTransaction(auto.id)).toBe(
        false
      );
    }
    expect(
      game.probableGameState.unresolveUnknownTransaction('no-such-id')
    ).toBe(false);
  });

  it("tracks which resolutions were a person's call", () => {
    const id = setUpOpenSteal();
    expect(game.probableGameState.isManuallyResolved(id)).toBe(false);

    game.probableGameState.resolveUnknownTransaction(id, 'ore');
    expect(game.probableGameState.isManuallyResolved(id)).toBe(true);

    game.probableGameState.unresolveUnknownTransaction(id);
    expect(game.probableGameState.isManuallyResolved(id)).toBe(false);
  });

  it('undoes one of several resolutions, leaving the others standing', () => {
    playerGetResources('Bob', { wheat: 1, ore: 1 });
    playerGetResources('Charlie', { sheep: 1, tree: 1 });
    unknownSteal('Alice', 'Bob');
    unknownSteal('Diana', 'Charlie');

    const [first, second] = game.probableGameState.getUnknownTransactions();
    game.probableGameState.resolveUnknownTransaction(first.id, 'ore');
    game.probableGameState.resolveUnknownTransaction(second.id, 'sheep');

    game.probableGameState.unresolveUnknownTransaction(first.id);

    expect(game.probableGameState.isManuallyResolved(second.id)).toBe(true);
    const diana =
      game.probableGameState.getPlayerResourceProbabilities('Diana');
    expect(diana.minimumResources.sheep).toBe(1); // the surviving resolution held
  });

  it('lists resolved steals as well as open ones', () => {
    const id = setUpOpenSteal();
    game.probableGameState.resolveUnknownTransaction(id, 'ore');

    expect(game.probableGameState.getUnknownTransactions()).toHaveLength(0);

    const all = game.probableGameState.getAllUnknownTransactions();
    expect(all).toHaveLength(1);
    expect(all[0].isResolved).toBe(true);
    expect(all[0].resolvedResource).toBe('ore');
  });
});
