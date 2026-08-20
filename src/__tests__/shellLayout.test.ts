import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Shell } from '../ui/shell/shell';
import {
  _lastRequestedInsetForTesting,
  _resetPageFrameForTesting,
  applyPageFrame,
  clampInset,
  releasePageFrame,
} from '../ui/shell/pageFrame';
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
    const before = DEFAULT_LAYOUT.left.sections.length;
    const copy = cloneLayout(DEFAULT_LAYOUT);
    copy.left.sections.push({ id: 'dice' });
    copy.left.size = 1;

    expect(DEFAULT_LAYOUT.left.sections).toHaveLength(before);
    expect(DEFAULT_LAYOUT.left.size).not.toBe(1);
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

describe('bundled fonts', () => {
  // Chrome ignores @font-face inside a shadow root, so the faces have to be
  // registered on the document. That failure is invisible on a machine where
  // the fonts happen to be installed, which is how it got shipped once.
  it('registers its typefaces on the document, not in the shadow root', async () => {
    const added: unknown[] = [];
    const fakeFontFace = class {
      constructor(
        public family: string,
        public source: string,
        public descriptors: Record<string, string>
      ) {}
      load() {
        return Promise.resolve(this);
      }
    };
    (globalThis as any).FontFace = fakeFontFace;
    (document as any).fonts = {
      add: (face: unknown) => added.push(face),
      delete: () => true,
    };

    jest.resetModules();
    const { loadFonts, unloadFonts } = await import('../ui/shell/fonts');
    await loadFonts(path => `chrome-extension://abc/${path}`);

    expect(added).toHaveLength(2);
    const families = added.map(f => (f as { family: string }).family).sort();
    expect(families).toEqual(['JetBrains Mono', 'Manrope']);
    const sources = added.map(f => (f as { source: string }).source);
    expect(sources.every(src => src.includes('chrome-extension://abc/'))).toBe(
      true
    );
    expect(sources.every(src => src.endsWith(".woff2')"))).toBe(true);

    unloadFonts();
  });

  it('carries on when a face will not load', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (globalThis as any).FontFace = class {
      load() {
        return Promise.reject(new Error('404'));
      }
    };
    (document as any).fonts = { add: () => undefined, delete: () => true };

    jest.resetModules();
    const { loadFonts } = await import('../ui/shell/fonts');

    // The font stacks name a real fallback, so a missing file must not throw.
    await expect(loadFonts(path => path)).resolves.toBeUndefined();
    warn.mockRestore();
  });

  it('declares no @font-face in the shadow stylesheet, where it would be ignored', async () => {
    jest.resetModules();
    const { buildStyleSheet } = await import('../ui/shell/styles');
    expect(buildStyleSheet([])).not.toContain('@font-face');
  });
});

describe('the settings menu', () => {
  let shell: Shell;

  beforeEach(() => {
    document.body.innerHTML = '';
    root()?.remove();
    resetGameState();
    game.youPlayerName = null;
    rollDice(6);
    _resetPageFrameForTesting(5);
  });

  afterEach(() => shell?.unmount());

  function mountWith(layout: V2Layout, registry: SectionRegistry): Shell {
    shell = new Shell({ registry, onAction: () => undefined });
    shell.setLayout(layout);
    shell.mount();
    return shell;
  }

  it('opens from the gear in the rail header', () => {
    const hands = fakeSection('hands');
    mountWith(layoutWith(['hands']), { hands: hands.definition });

    expect(shadow(shell).querySelector('.settings-panel')).toBeNull();
    (shadow(shell).querySelector('.rail-gear') as HTMLElement).click();
    expect(shadow(shell).querySelector('.settings-panel')).toBeTruthy();
  });

  it('floats the gear when no rail is on screen to hold it', () => {
    const dice = fakeSection('dice', ['horizontal']);
    mountWith(layoutWith([], ['dice']), { dice: dice.definition });

    // Nothing else offers a way back into settings in this arrangement.
    expect(shadow(shell).querySelector('.rail-gear')).toBeNull();
    const floating = shadow(shell).querySelector('.floating-gear');
    expect(floating).toBeTruthy();

    (floating as HTMLElement).click();
    expect(shadow(shell).querySelector('.settings-panel')).toBeTruthy();
  });

  it('keeps the gear in the header while a rail is showing', () => {
    const hands = fakeSection('hands');
    const dice = fakeSection('dice', ['horizontal']);
    mountWith(layoutWith(['hands'], ['dice']), {
      hands: hands.definition,
      dice: dice.definition,
    });

    expect(shadow(shell).querySelector('.rail-gear')).toBeTruthy();
    expect(shadow(shell).querySelector('.floating-gear')).toBeNull();
  });

  it('applies a placement change to the page behind it, live', () => {
    const hands = fakeSection('hands');
    const dice = fakeSection('dice');
    mountWith(layoutWith(['hands'], ['dice']), {
      hands: hands.definition,
      dice: dice.definition,
    });
    (shadow(shell).querySelector('.rail-gear') as HTMLElement).click();

    const diceRow = [...shadow(shell).querySelectorAll('.section-row')].find(
      row => row.querySelector('.section-row-name')?.textContent === 'dice'
    )!;
    const off = [...diceRow.querySelectorAll('.zone-button')].find(
      button => button.textContent === 'OFF'
    ) as HTMLButtonElement;
    off.click();

    expect(shell.getLayout().bottom.sections).toHaveLength(0);
    expect(
      shadow(shell).querySelector('.gutter [data-section="dice"]')
    ).toBeNull();
    // And the dialog is still open, showing the change it just made.
    expect(shadow(shell).querySelector('.settings-panel')).toBeTruthy();
  });

  it('refuses a zone the section cannot be read in, and says why', () => {
    const wide = fakeSection('card-flow-ledger', ['horizontal']);
    mountWith(layoutWith([], ['card-flow-ledger']), {
      'card-flow-ledger': wide.definition,
    });
    (shadow(shell).querySelector('.floating-gear') as HTMLElement).click();

    const left = [...shadow(shell).querySelectorAll('.zone-button')].find(
      button => button.textContent === 'LEFT'
    ) as HTMLButtonElement;
    expect(left.disabled).toBe(true);
    expect(left.title).toContain('too wide');
  });

  it('closes on Done and on Escape', () => {
    const hands = fakeSection('hands');
    mountWith(layoutWith(['hands']), { hands: hands.definition });
    const gear = () => shadow(shell).querySelector('.rail-gear') as HTMLElement;

    gear().click();
    (shadow(shell).querySelector('.settings-done') as HTMLElement).click();
    expect(shadow(shell).querySelector('.settings-panel')).toBeNull();

    gear().click();
    shadow(shell)
      .querySelector('.settings-backdrop')!
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    expect(shadow(shell).querySelector('.settings-panel')).toBeNull();
  });

  it('goes away with the interface', () => {
    const hands = fakeSection('hands');
    mountWith(layoutWith(['hands']), { hands: hands.definition });
    (shadow(shell).querySelector('.rail-gear') as HTMLElement).click();

    shell.unmount();
    expect(document.querySelector('.settings-panel')).toBeNull();
  });
});

describe('every gutter actually renders', () => {
  let shell: Shell;

  beforeEach(() => {
    document.body.innerHTML = '';
    root()?.remove();
    resetGameState();
    game.youPlayerName = null;
    rollDice(6);
    _resetPageFrameForTesting(5);
  });

  afterEach(() => shell?.unmount());

  // The reported bug: a section moved to the right gutter disappeared. The
  // gutter came out of the default layout marked collapsed with a size of zero
  // as shorthand for "unused", so it rendered as an empty 28px sliver and the
  // section never mounted at all.
  it.each(['left', 'right', 'top', 'bottom'] as const)(
    'shows a section placed in the %s gutter',
    zone => {
      const section = fakeSection('hands');
      const layout = cloneLayout(DEFAULT_LAYOUT);
      for (const name of ['left', 'right', 'top', 'bottom'] as const) {
        layout[name].sections = [];
      }
      layout[zone].sections = [{ id: 'hands' }];
      layout.off = [];

      shell = new Shell({
        registry: { hands: section.definition },
        onAction: () => undefined,
      });
      shell.setLayout(layout);
      shell.mount();

      const gutter = shadow(shell).querySelector(`.gutter--${zone}`);
      expect(gutter).toBeTruthy();
      expect(gutter!.querySelector('[data-section="hands"]')).toBeTruthy();
      expect(section.log.mounts).toBe(1);

      const size =
        zone === 'left' || zone === 'right'
          ? (gutter as HTMLElement).style.width
          : (gutter as HTMLElement).style.height;
      expect(size).not.toBe('0px');
      expect(size).not.toBe(`${COLLAPSED_SIZE}px`);
    }
  );

  it('repairs a stored layout that would strand a section', () => {
    const hands = fakeSection('hands');
    const players = fakeSection('players');
    const broken = cloneLayout(DEFAULT_LAYOUT);
    // The left rail keeps the header, so the right one has no chevron: a
    // collapse there could never be undone, which is what stranded the section.
    broken.left.sections = [{ id: 'hands' }];
    broken.right = { size: 0, collapsed: true, sections: [{ id: 'players' }] };
    broken.bottom.sections = [];
    broken.off = [];

    shell = new Shell({
      registry: { hands: hands.definition, players: players.definition },
      onAction: () => undefined,
    });
    shell.setLayout(broken);
    shell.mount();

    expect(
      shadow(shell).querySelector('.gutter--right [data-section="players"]')
    ).toBeTruthy();
    expect(players.log.mounts).toBe(1);
  });

  it('still lets the header rail be collapsed, since its chevron reopens it', () => {
    const hands = fakeSection('hands');
    const layout = cloneLayout(DEFAULT_LAYOUT);
    layout.left = { size: 365, collapsed: true, sections: [{ id: 'hands' }] };
    layout.bottom.sections = [];
    layout.off = [];

    shell = new Shell({
      registry: { hands: hands.definition },
      onAction: () => undefined,
    });
    shell.setLayout(layout);
    shell.mount();

    const rail = shadow(shell).querySelector('.gutter--left') as HTMLElement;
    expect(rail.style.width).toBe(`${COLLAPSED_SIZE}px`);
    expect(shadow(shell).querySelector('.rail-collapse')).toBeTruthy();
  });
});

describe('keeping the page squeezed to the gutters', () => {
  let shell: Shell;

  beforeEach(() => {
    document.body.innerHTML = '';
    root()?.remove();
    resetGameState();
    game.youPlayerName = null;
    rollDice(6);
    _resetPageFrameForTesting(5);
    // An earlier suite shrinks the jsdom viewport to prove the clamp works,
    // and that leaks across describes — on an 800px window every inset
    // correctly clamps to zero and these assertions become meaningless.
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 2056,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1038,
    });
  });

  afterEach(() => shell?.unmount());

  /** Let the frame's round trip (and its coalesced re-run) settle. */
  const settle = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 30));
  };

  it('squeezes for the gutters that are actually on screen', async () => {
    const hands = fakeSection('hands');
    const layout = cloneLayout(DEFAULT_LAYOUT);
    layout.left.sections = [];
    layout.bottom.sections = [];
    layout.right.sections = [{ id: 'hands' }];
    layout.off = [];

    shell = new Shell({
      registry: { hands: hands.definition },
      onAction: () => undefined,
    });
    shell.setLayout(layout);
    shell.mount();
    await settle();

    const inset = _lastRequestedInsetForTesting();
    expect(inset.right).toBeGreaterThan(0);
    expect(inset.left).toBe(0);
  });

  // The bug this guards: a squeeze requested while one was in flight used to be
  // dropped. Mount squeezes for the default layout and awaits a round trip to
  // the page world; when storage answered with a different layout moments later
  // that request was thrown away, so the gutters moved and the page did not.
  it('coalesces a change made while a squeeze is still running', async () => {
    const hands = fakeSection('hands');
    const dice = fakeSection('dice', ['horizontal']);
    const registry = { hands: hands.definition, dice: dice.definition };

    shell = new Shell({ registry, onAction: () => undefined });
    shell.setLayout(layoutWith(['hands'], ['dice']));
    shell.mount();

    // Immediately, without waiting: exactly the race that dropped it.
    const moved = cloneLayout(DEFAULT_LAYOUT);
    moved.left.sections = [];
    moved.bottom.sections = [];
    moved.right.sections = [{ id: 'hands' }];
    moved.top.sections = [{ id: 'dice' }];
    moved.off = [];
    shell.setLayout(moved);
    await settle();

    const inset = _lastRequestedInsetForTesting();
    expect(inset.left).toBe(0);
    expect(inset.right).toBeGreaterThan(0);
    expect(inset.top).toBeGreaterThan(0);
    expect(inset.bottom).toBe(0);
  });

  it('ends up matching the gutters after a burst of changes', async () => {
    const hands = fakeSection('hands');
    shell = new Shell({
      registry: { hands: hands.definition },
      onAction: () => undefined,
    });
    shell.setLayout(layoutWith(['hands']));
    shell.mount();

    for (const zone of ['right', 'left', 'right'] as const) {
      const next = cloneLayout(DEFAULT_LAYOUT);
      next.left.sections = zone === 'left' ? [{ id: 'hands' }] : [];
      next.right.sections = zone === 'right' ? [{ id: 'hands' }] : [];
      next.bottom.sections = [];
      next.off = [];
      shell.setLayout(next);
    }
    await settle();

    // Whatever the ordering, the last word belongs to the layout on screen.
    const inset = _lastRequestedInsetForTesting();
    expect(inset.right).toBeGreaterThan(0);
    expect(inset.left).toBe(0);
  });
});

describe('how the page is framed', () => {
  const boxCss = () =>
    document.getElementById('catan-v2-page-frame')?.textContent ?? '';

  beforeEach(() => {
    document.body.innerHTML = '';
    _resetPageFrameForTesting(5);
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1000,
    });
  });

  // Colonist's layers are absolutely positioned on <body>, so shrinking body's
  // box is what makes them lay out inside the gutters. Translating them instead
  // dragged colonist's own popups along, pushing a menu anchored near the top of
  // the game off the top of the screen.
  it('never translates the page', async () => {
    await applyPageFrame({ left: 290, right: 0, top: 0, bottom: 210 });
    expect(boxCss()).not.toContain('translate');
    expect(boxCss()).not.toContain('transform');
  });

  it('leaves nothing behind when released', async () => {
    await applyPageFrame({ left: 290, right: 0, top: 0, bottom: 210 });
    await releasePageFrame();
    expect(document.getElementById('catan-v2-page-frame')).toBeNull();
  });
});

describe('the order the page frame is applied in', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    _resetPageFrameForTesting(5);
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1000,
    });
  });

  // Colonist recalculates where it puts its layers only when a resize fires,
  // and that resize is fired by the set-inset command. A box applied after it
  // would not be read until something else happened to resize the window, so
  // the page kept the placement it had before the gutters moved.
  it('shrinks the box before asking the page to re-measure', async () => {
    const order: string[] = [];
    const observer = new MutationObserver(() => order.push('box'));
    observer.observe(document.head, { childList: true, subtree: true });
    window.addEventListener('message', event => {
      const data = event.data as { type?: string } | null;
      if (data?.type === 'set-inset') order.push('set-inset');
    });

    await applyPageFrame({ left: 290, right: 0, top: 0, bottom: 210 });
    observer.disconnect();

    expect(order[0]).toBe('box');
  });

  it('leaves the page unshrunken when the page world never answers', async () => {
    await applyPageFrame({ left: 290, right: 0, top: 0, bottom: 210 });
    // The hook does not answer in jsdom, so a box must not be left behind —
    // a shrunken body with no viewport lie is worse than not framing at all.
    expect(document.getElementById('catan-v2-page-frame')).toBeNull();
  });
});
