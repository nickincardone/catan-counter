/**
 * @jest-environment jsdom
 *
 * How long an update takes, and where the time goes.
 *
 * The interface refreshes once per chat message, so the cost that matters is
 * one message in to one repaint out. This splits that into the three stages it
 * actually passes through — tracking the transaction, building the view, and
 * updating the mounted sections — because a total alone does not say what to
 * fix. Numbers are printed rather than asserted tightly; the assertions are
 * loose ceilings meant to catch a collapse, not to police normal variation
 * between machines.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  buildRoad,
  buyDevCard,
  placeSettlement,
  playerGetResources,
  playerTrade,
  rollDice,
  unknownSteal,
} from '../gameActions';
import { game, resetGameState } from '../gameState';
import { PropbableGameState } from '../probableGameState';
import { buildGameView } from '../ui/view/gameView';
import { Shell } from '../ui/shell/shell';
import { _resetPageFrameForTesting } from '../ui/shell/pageFrame';
import { handsSection } from '../ui/sections/hands';
import { cardFlowSection } from '../ui/sections/cardFlow';
import { unknownStealsSection } from '../ui/sections/unknownSteals';
import { blockedRobberSection } from '../ui/sections/blockedRobber';
import { diceSection } from '../ui/sections/dice';
import { devDeckSection } from '../ui/sections/devDeck';

const PLAYERS = ['NickTheSwift', 'Beagle77', 'Hobbie6244', '88ym88'];
const RESOURCES = ['sheep', 'wheat', 'brick', 'tree', 'ore'] as const;

function only(resource: (typeof RESOURCES)[number], amount = 1) {
  const out = { sheep: 0, wheat: 0, brick: 0, tree: 0, ore: 0 };
  out[resource] = amount;
  return out;
}

/** A game of roughly the length and shape of a real one. */
function playGame(turns: number, steals = 4): void {
  resetGameState();
  for (const name of PLAYERS) placeSettlement(name);
  game.probableGameState = new PropbableGameState(game.players);

  for (let turn = 0; turn < turns; turn++) {
    rollDice((turn % 11) + 2);
    // Production: most players collect something most turns.
    for (let p = 0; p < PLAYERS.length; p++) {
      playerGetResources(PLAYERS[p], only(RESOURCES[(turn + p) % 5], 1));
    }
    // A trade every few turns, which mixes hands together. The changes are a
    // delta for the named player: one card in, a different one out.
    if (turn % 3 === 0) {
      const gained = RESOURCES[turn % 5];
      const given = RESOURCES[(turn + 2) % 5];
      if (gained !== given) {
        playerTrade(PLAYERS[turn % 4], PLAYERS[(turn + 1) % 4], {
          [gained]: 1,
          [given]: -1,
        });
      }
    }
    // Unknown steals are what make the tracker branch, so how many are left
    // open is the dominant term. Real games sit at a handful; see the scaling
    // test below for what happens as that number climbs.
    if (steals > 0 && turn > 0 && turn % Math.ceil(turns / steals) === 0) {
      unknownSteal(PLAYERS[(turn + 1) % 4], PLAYERS[turn % 4]);
    }
    if (turn % 5 === 0) buyDevCard(PLAYERS[turn % 4]);
    if (turn % 6 === 0) buildRoad(PLAYERS[turn % 4]);
  }
}

/** Median is steadier than a mean when one run hits a garbage collection. */
function timeMedian(runs: number, work: () => void): number {
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    work();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

const registry = {
  hands: handsSection,
  'card-flow': cardFlowSection,
  'unknown-steals': unknownStealsSection,
  'blocked-robber': blockedRobberSection,
  dice: diceSection,
  'dev-deck': devDeckSection,
};

describe('update cost', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.getElementById('catan-v2-root')?.remove();
    _resetPageFrameForTesting(1);
    jest.restoreAllMocks();
  });

  it('reports where the time goes for one update', () => {
    playGame(80, 4);

    const viewMs = timeMedian(30, () => {
      buildGameView(game);
    });

    const shell = new Shell({ registry, onAction: () => {} });
    shell.mount();
    // A first update mounts the sections; measure the steady state after that.
    shell.update();
    const updateMs = timeMedian(30, () => shell.update());

    const openSteals = buildGameView(game).steals.filter(
      s => !s.resolved
    ).length;

    // eslint-disable-next-line no-console
    console.log(
      `\n  buildGameView : ${viewMs.toFixed(2)} ms` +
        `\n  shell.update  : ${updateMs.toFixed(2)} ms  (view + all sections)` +
        `\n  sections only : ${(updateMs - viewMs).toFixed(2)} ms` +
        `\n  open steals   : ${openSteals}\n`
    );

    shell.unmount();

    // Generous ceilings: a repaint per chat message has a whole frame to work
    // with, and these run on jsdom, which is slower than a real browser.
    expect(viewMs).toBeLessThan(100);
    expect(updateMs).toBeLessThan(200);
  });

  it('reports the cost of tracking a whole game', () => {
    const totalMs = timeMedian(3, () => playGame(80, 4));
    // eslint-disable-next-line no-console
    console.log(`\n  tracking 80 turns : ${totalMs.toFixed(2)} ms\n`);
    expect(totalMs).toBeLessThan(20_000);
  });

  it('shows how the cost scales with unresolved steals', () => {
    const rows: string[] = [];
    let worstViewMs = 0;
    let worstVariants = 0;
    for (const steals of [0, 1, 2, 3, 4, 5, 6]) {
      const started = performance.now();
      playGame(40, steals);
      const trackMs = performance.now() - started;
      const variants = game.probableGameState.getVariantCount();
      const viewMs = timeMedian(5, () => {
        buildGameView(game);
      });
      if (variants > worstVariants) {
        worstVariants = variants;
        worstViewMs = viewMs;
      }
      rows.push(
        `  ${String(steals).padStart(2)} steals  ` +
          `${String(variants).padStart(8)} variants  ` +
          `track ${trackMs.toFixed(1).padStart(8)} ms  ` +
          `view ${viewMs.toFixed(2).padStart(7)} ms`
      );
    }
    // eslint-disable-next-line no-console
    console.log('\n' + rows.join('\n') + '\n');

    // The guard that matters. Merging variants was once quadratic, with two
    // JSON.stringify calls per comparison, and this same case took eleven
    // seconds. Anything remotely like that is a regression to the old shape,
    // not slow hardware, so the ceiling is set far above the real figure and
    // far below the broken one.
    expect(worstVariants).toBeGreaterThan(1000);
    expect(worstViewMs).toBeLessThan(500);
  });
});
