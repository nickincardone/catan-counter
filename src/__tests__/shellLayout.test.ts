import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Shell } from '../ui/shell/shell';
import { _resetPageFrameForTesting, clampInset } from '../ui/shell/pageFrame';
import {
  DEFAULT_LAYOUT,
  cloneLayout,
  gutterThickness,
  parseLayout,
  COLLAPSED_SIZE,
} from '../ui/shell/layoutStore';
import type { V2Layout } from '../ui/shell/layoutStore';
import type {
  SectionDefinition,
  SectionId,
  GutterAxis,
} from '../ui/sections/types';
import type { SectionRegistry } from '../ui/sections/registry';
import type { GameView } from '../ui/view/types';
import { buildGameView } from '../ui/view/gameView';
import { rollDice } from '../gameActions';
import { game, resetGameState } from '../gameState';

interface Recorder {
  mounts: number;
  updates: number;
  destroys: number;
}

function fakeSection(
  id: SectionId,
  supports: GutterAxis[] = ['vertical', 'horizontal'],
  min = { width: 0, height: 0 }
): { definition: SectionDefinition; log: Recorder } {
  const log: Recorder = { mounts: 0, updates: 0, destroys: 0 };
  return {
    log,
    definition: {
      id,
      title: id,
      supports,
      min,
      styles: `.fake-${id} { color: red; }`,
      mount(host) {
        log.mounts++;
        host.innerHTML = `<p class="fake-${id}">${id}</p>`;
        return {
          update: () => {
            log.updates++;
          },
          destroy: () => {
            log.destroys++;
          },
        };
      },
    },
  };
}

function layoutWith(left: SectionId[], bottom: SectionId[] = []): V2Layout {
  const layout = cloneLayout(DEFAULT_LAYOUT);
  layout.left.sections = left.map(id => ({ id }));
  layout.bottom.sections = bottom.map(id => ({ id }));
  return layout;
}

const root = () => document.getElementById('catan-v2-root');
const shadow = (shell: Shell) => shell.getShadowRoot()!;
const gutter = (shell: Shell, name: string) =>
  shadow(shell).querySelector(`.gutter--${name}`);
const sectionHost = (shell: Shell, id: string) =>
  shadow(shell).querySelector(`[data-section="${id}"]`);

describe('shell layout', () => {
  let shell: Shell;
  let actions: unknown[];

  beforeEach(() => {
    document.body.innerHTML = '';
    root()?.remove();
    resetGameState();
    game.youPlayerName = null;
    // The shell shows a status instead of sections until tracking begins, so
    // get past the first roll for the placement tests.
    rollDice(6);
    _resetPageFrameForTesting(5);
    actions = [];
  });

  afterEach(() => {
    shell?.unmount();
  });

  function mountShell(layout: V2Layout, registry: SectionRegistry): Shell {
    shell = new Shell({ registry, onAction: action => actions.push(action) });
    shell.setLayout(layout);
    shell.mount();
    return shell;
  }

  it('places each section in the gutter the layout names', () => {
    const hands = fakeSection('hands');
    const dice = fakeSection('dice');
    mountShell(layoutWith(['hands'], ['dice']), {
      hands: hands.definition,
      dice: dice.definition,
    });

    expect(gutter(shell, 'left')!.contains(sectionHost(shell, 'hands'))).toBe(
      true
    );
    expect(gutter(shell, 'bottom')!.contains(sectionHost(shell, 'dice'))).toBe(
      true
    );
    expect(hands.log.mounts).toBe(1);
  });

  // The exit gate for "sections are independent": moving one is a config edit.
  it('moves a section to another gutter by configuration alone', () => {
    const dice = fakeSection('dice');
    const registry = { dice: dice.definition };
    mountShell(layoutWith([], ['dice']), registry);
    expect(gutter(shell, 'bottom')!.contains(sectionHost(shell, 'dice'))).toBe(
      true
    );

    shell.setLayout(layoutWith(['dice'], []));

    expect(gutter(shell, 'left')!.contains(sectionHost(shell, 'dice'))).toBe(
      true
    );
    expect(gutter(shell, 'bottom')).toBeNull(); // the empty gutter disappears
    expect(dice.log.destroys).toBe(1); // and the old instance was cleaned up
  });

  it('gives an empty gutter no space at all', () => {
    const hands = fakeSection('hands');
    mountShell(layoutWith(['hands']), { hands: hands.definition });

    expect(gutter(shell, 'right')).toBeNull();
    expect(gutter(shell, 'top')).toBeNull();
    expect(gutterThickness(shell.getLayout().right)).toBe(0);
  });

  it('shares a horizontal gutter by weight', () => {
    const dice = fakeSection('dice');
    const dev = fakeSection('dev-deck');
    const layout = layoutWith([], []);
    layout.bottom.sections = [
      { id: 'dice', weight: 1.6 },
      { id: 'dev-deck', weight: 1 },
    ];
    mountShell(layout, { dice: dice.definition, 'dev-deck': dev.definition });

    // jsdom normalizes the shorthand's flex-basis to a length.
    expect((sectionHost(shell, 'dice') as HTMLElement).style.flex).toBe(
      '1.6 1 0px'
    );
    expect((sectionHost(shell, 'dev-deck') as HTMLElement).style.flex).toBe(
      '1 1 0px'
    );
  });

  it('refuses a placement the section cannot be read in', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const dice = fakeSection('dice', ['horizontal']); // strip only
    mountShell(layoutWith(['dice']), { dice: dice.definition });

    expect(sectionHost(shell, 'dice')).toBeNull();
    expect(dice.log.mounts).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('refuses a placement in a gutter too thin for the section', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const hands = fakeSection('hands', ['vertical'], { width: 999, height: 0 });
    mountShell(layoutWith(['hands']), { hands: hands.definition });

    expect(sectionHost(shell, 'hands')).toBeNull();
    warn.mockRestore();
  });

  it('collapses to a strip and expands again, keeping the toggle reachable', () => {
    const hands = fakeSection('hands');
    mountShell(layoutWith(['hands']), { hands: hands.definition });

    const toggle = () =>
      shadow(shell).querySelector('.rail-collapse') as HTMLButtonElement;
    toggle().click();

    expect(shell.getLayout().left.collapsed).toBe(true);
    expect((gutter(shell, 'left') as HTMLElement).style.width).toBe(
      `${COLLAPSED_SIZE}px`
    );
    expect(sectionHost(shell, 'hands')).toBeNull(); // nothing rendered while shut
    expect(toggle()).toBeTruthy();

    toggle().click();
    expect(shell.getLayout().left.collapsed).toBe(false);
    expect(sectionHost(shell, 'hands')).toBeTruthy();
  });

  it('forwards every update to each mounted section', () => {
    const hands = fakeSection('hands');
    const dice = fakeSection('dice');
    mountShell(layoutWith(['hands'], ['dice']), {
      hands: hands.definition,
      dice: dice.definition,
    });

    shell.update();
    shell.update();

    expect(hands.log.updates).toBe(2);
    expect(dice.log.updates).toBe(2);
  });

  it('keeps rendering when one section throws', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const good = fakeSection('hands');
    const bad: SectionDefinition = {
      id: 'dice',
      title: 'bad',
      supports: ['vertical', 'horizontal'],
      min: { width: 0, height: 0 },
      mount: () => ({
        update: () => {
          throw new Error('boom');
        },
        destroy: () => undefined,
      }),
    };
    mountShell(layoutWith(['hands'], ['dice']), {
      hands: good.definition,
      dice: bad,
    });

    expect(() => shell.update()).not.toThrow();
    expect(good.log.updates).toBe(1);
    warn.mockRestore();
  });

  it('leaves nothing behind when unmounted', () => {
    const hands = fakeSection('hands');
    mountShell(layoutWith(['hands']), { hands: hands.definition });
    expect(root()).toBeTruthy();

    shell.unmount();

    expect(root()).toBeNull();
    expect(hands.log.destroys).toBe(1);
    expect(document.getElementById('catan-v2-page-frame')).toBeNull();
  });

  it('waits rather than showing counts that are about to change', () => {
    resetGameState(); // back to before the first roll
    game.youPlayerName = null;
    const hands = fakeSection('hands');
    mountShell(layoutWith(['hands']), { hands: hands.definition });

    expect(sectionHost(shell, 'hands')).toBeNull();
    expect(hands.log.mounts).toBe(0);
    expect(shadow(shell).querySelector('.rail-status')!.textContent).toContain(
      'Waiting for the first dice roll'
    );
  });

  it('mounts the sections once the first roll lands', () => {
    resetGameState();
    game.youPlayerName = null;
    const hands = fakeSection('hands');
    mountShell(layoutWith(['hands']), { hands: hands.definition });
    expect(hands.log.mounts).toBe(0);

    rollDice(8);
    shell.update();

    expect(sectionHost(shell, 'hands')).toBeTruthy();
    expect(shadow(shell).querySelector('.rail-status')).toBeNull();
  });

  it('shows a spinner while history is being rebuilt, then puts it away', () => {
    const hands = fakeSection('hands');
    mountShell(layoutWith(['hands']), { hands: hands.definition });

    shell.setHistoryLoading(true);
    expect(shadow(shell).querySelector('.rail-spinner')).toBeTruthy();
    expect(sectionHost(shell, 'hands')).toBeNull();

    shell.setHistoryLoading(false);
    expect(shadow(shell).querySelector('.rail-spinner')).toBeNull();
    expect(sectionHost(shell, 'hands')).toBeTruthy();
  });

  it('keeps the header reachable while showing a status', () => {
    shell = new Shell({ registry: {}, onAction: () => undefined });
    shell.setLayout(layoutWith(['hands']));
    shell.mount();
    shell.setHistoryLoading(true);

    expect(shadow(shell).querySelector('.rail-collapse')).toBeTruthy();
  });

  it('hands sections a view built from live game state', () => {
    let seen: GameView | null = null;
    const spy: SectionDefinition = {
      id: 'hands',
      title: 'spy',
      supports: ['vertical'],
      min: { width: 0, height: 0 },
      mount: (_host, view) => {
        seen = view;
        return { update: () => undefined, destroy: () => undefined };
      },
    };
    mountShell(layoutWith(['hands']), { hands: spy });

    expect(seen).toEqual(buildGameView(game));
  });
});

describe('layout storage', () => {
  it('accepts the default layout', () => {
    expect(parseLayout(cloneLayout(DEFAULT_LAYOUT))).toEqual(DEFAULT_LAYOUT);
  });

  it('rejects anything malformed rather than partially placing sections', () => {
    expect(parseLayout(null)).toBeNull();
    expect(parseLayout({ version: 99 })).toBeNull();

    const missingGutter = cloneLayout(DEFAULT_LAYOUT) as any;
    delete missingGutter.right;
    expect(parseLayout(missingGutter)).toBeNull();

    const badSize = cloneLayout(DEFAULT_LAYOUT) as any;
    badSize.left.size = 'wide';
    expect(parseLayout(badSize)).toBeNull();

    const badWeight = cloneLayout(DEFAULT_LAYOUT) as any;
    badWeight.bottom.sections[0].weight = -1;
    expect(parseLayout(badWeight)).toBeNull();
  });

  it('does not alias the default layout', () => {
    const copy = cloneLayout(DEFAULT_LAYOUT);
    copy.left.sections.push({ id: 'dice' });
    expect(DEFAULT_LAYOUT.left.sections).toHaveLength(3);
  });

  it('reports a collapsed gutter as a thin strip and an empty one as nothing', () => {
    expect(
      gutterThickness({
        size: 290,
        collapsed: false,
        sections: [{ id: 'hands' }],
      })
    ).toBe(290);
    expect(
      gutterThickness({
        size: 290,
        collapsed: true,
        sections: [{ id: 'hands' }],
      })
    ).toBe(COLLAPSED_SIZE);
    expect(gutterThickness({ size: 290, collapsed: false, sections: [] })).toBe(
      0
    );
  });
});

describe('page frame insets', () => {
  /** jsdom defaults to 1024x768; the gutters are designed for a real screen. */
  function setViewport(width: number, height: number): void {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: height,
    });
  }

  beforeEach(() => setViewport(2056, 1038));

  it('passes through insets the viewport can afford', () => {
    expect(clampInset({ left: 290, right: 0, top: 0, bottom: 176 })).toEqual({
      left: 290,
      right: 0,
      top: 0,
      bottom: 176,
    });
  });

  it('scales insets down rather than squeezing the game into uselessness', () => {
    setViewport(1100, 700);
    const clamped = clampInset({ left: 290, right: 0, top: 0, bottom: 176 });

    expect(clamped.left).toBeLessThanOrEqual(1100 - 900);
    expect(clamped.left).toBeGreaterThan(0);
    expect(clamped.bottom).toBeLessThanOrEqual(700 - 500);
  });

  it('keeps the ratio between two gutters on the same axis', () => {
    setViewport(1100, 1038);
    const clamped = clampInset({ left: 600, right: 300, top: 0, bottom: 0 });

    expect(clamped.left).toBeGreaterThan(clamped.right);
    expect(clamped.left + clamped.right).toBeLessThanOrEqual(1100 - 900);
  });

  it('never squeezes at all on a screen already too small', () => {
    setViewport(800, 400);
    expect(clampInset({ left: 290, right: 0, top: 0, bottom: 176 })).toEqual({
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    });
  });
});
