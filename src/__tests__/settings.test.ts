import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  DEFAULT_LAYOUT,
  PRESETS,
  cloneLayout,
  gutterThickness,
  headerGutterOf,
  listSections,
  placeSection,
  reorderSection,
  parseLayout,
  repairLayout,
  withKnownSections,
  zoneOf,
} from '../ui/shell/layoutStore';
import type { V2Layout } from '../ui/shell/layoutStore';
import type { SectionId } from '../ui/sections/types';

const ALL: SectionId[] = [
  'hands',
  'unknown-steals',
  'card-flow',
  'card-flow-extended',
  'card-flow-ledger',
  'blocked-robber',
  'dice',
  'dev-deck',
  'players',
];

describe('placing sections', () => {
  let layout: V2Layout;
  beforeEach(() => {
    layout = cloneLayout(DEFAULT_LAYOUT);
  });

  it('knows where each section sits', () => {
    expect(zoneOf(layout, 'hands')).toBe('right');
    expect(zoneOf(layout, 'dice')).toBe('bottom');
    expect(zoneOf(layout, 'players')).toBe('off');
  });

  it('moves a section between gutters, leaving the old one', () => {
    const next = placeSection(layout, 'dice', 'left');

    expect(zoneOf(next, 'dice')).toBe('left');
    expect(next.bottom.sections.some(s => s.id === 'dice')).toBe(false);
    expect(next.left.sections.map(s => s.id)).toEqual(['dice']);
  });

  it('switches a section off and back on again', () => {
    const off = placeSection(layout, 'hands', 'off');
    expect(zoneOf(off, 'hands')).toBe('off');
    expect(off.right.sections.some(s => s.id === 'hands')).toBe(false);

    const on = placeSection(off, 'hands', 'right');
    expect(zoneOf(on, 'hands')).toBe('right');
    expect(on.off?.some(s => s.id === 'hands')).toBe(false);
  });

  it('leaves the layout alone when a section is already there', () => {
    const next = placeSection(layout, 'hands', 'right');
    expect(next.right.sections.map(s => s.id)).toEqual(
      layout.right.sections.map(s => s.id)
    );
  });

  it('never places a section in two zones at once', () => {
    /** How many of the five lists mention this section. */
    const appearances = (l: V2Layout, id: SectionId): number =>
      [
        l.left.sections,
        l.right.sections,
        l.top.sections,
        l.bottom.sections,
        l.off ?? [],
      ].filter(list => list.some(placement => placement.id === id)).length;

    let next = layout;
    for (const zone of ['top', 'bottom', 'left', 'off', 'right'] as const) {
      next = placeSection(next, 'hands', zone);
      expect(appearances(next, 'hands')).toBe(1);
      expect(zoneOf(next, 'hands')).toBe(zone);
    }
  });

  it('does not mutate the layout it was given', () => {
    const before = JSON.stringify(layout);
    placeSection(layout, 'dice', 'top');
    reorderSection(layout, 'hands', 1);
    expect(JSON.stringify(layout)).toBe(before);
  });
});

describe('reordering within a zone', () => {
  it('swaps a section with its neighbour', () => {
    const layout = cloneLayout(DEFAULT_LAYOUT);
    const next = reorderSection(layout, 'unknown-steals', -1);

    expect(next.right.sections.map(s => s.id)).toEqual([
      'unknown-steals',
      'hands',
      'card-flow',
      'blocked-robber',
    ]);
  });

  it('stops at the ends rather than wrapping', () => {
    const layout = cloneLayout(DEFAULT_LAYOUT);
    const order = layout.right.sections.map(s => s.id);

    expect(
      reorderSection(layout, 'hands', -1).right.sections.map(s => s.id)
    ).toEqual(order);
    expect(
      reorderSection(layout, 'blocked-robber', 1).right.sections.map(s => s.id)
    ).toEqual(order);
  });

  it('never moves a section into a different zone', () => {
    const layout = cloneLayout(DEFAULT_LAYOUT);
    const next = reorderSection(layout, 'dice', -1);
    expect(zoneOf(next, 'dice')).toBe('bottom');
  });
});

describe('listing sections for the settings menu', () => {
  it('groups by zone, in zone order, keeping each zone in its own order', () => {
    const rows = listSections(cloneLayout(DEFAULT_LAYOUT), ALL);

    expect(rows.map(r => r.id)).toEqual([
      'hands',
      'unknown-steals',
      'card-flow',
      'blocked-robber',
      'dice',
      'dev-deck',
      'card-flow-extended',
      'card-flow-ledger',
      'players',
    ]);
    expect(rows.map(r => r.zone)).toEqual([
      'right',
      'right',
      'right',
      'right',
      'bottom',
      'bottom',
      'off',
      'off',
      'off',
    ]);
  });

  it('lists every known section exactly once', () => {
    const rows = listSections(cloneLayout(DEFAULT_LAYOUT), ALL);
    expect(rows).toHaveLength(ALL.length);
    expect(new Set(rows.map(r => r.id)).size).toBe(ALL.length);
  });
});

describe('a layout stored before a section existed', () => {
  /** What a stored layout looked like before card flow was added. */
  function oldLayout(): V2Layout {
    const layout = cloneLayout(DEFAULT_LAYOUT);
    layout.right.sections = [{ id: 'hands' }, { id: 'unknown-steals' }];
    layout.off = [];
    return layout;
  }

  it('adopts the new section at the place it was designed for', () => {
    const merged = withKnownSections(oldLayout(), ALL);

    // card-flow is in the default rail, so it appears there...
    expect(zoneOf(merged, 'card-flow')).toBe('right');
    // ...and one that defaults to off stays off rather than barging in.
    expect(zoneOf(merged, 'players')).toBe('off');
  });

  it('leaves a section the user switched off switched off', () => {
    const chosen = placeSection(oldLayout(), 'hands', 'off');
    const merged = withKnownSections(chosen, ALL);
    expect(zoneOf(merged, 'hands')).toBe('off');
  });

  it('still parses, since the off list is optional', () => {
    const stored = cloneLayout(DEFAULT_LAYOUT) as Partial<V2Layout>;
    delete stored.off;
    expect(parseLayout(stored)).not.toBeNull();
  });

  it('rejects a malformed off list rather than half-applying it', () => {
    const stored = cloneLayout(DEFAULT_LAYOUT) as any;
    stored.off = [{ nope: true }];
    expect(parseLayout(stored)).toBeNull();
  });
});

describe('presets', () => {
  it('offers the two built-ins', () => {
    expect(PRESETS.map(p => p.name)).toEqual(['Full read', 'Competitive']);
  });

  it('full read is the default layout', () => {
    expect(PRESETS[0].build()).toEqual(cloneLayout(DEFAULT_LAYOUT));
  });

  it('competitive leaves only the bottom bar, and accounts for everything', () => {
    const competitive = PRESETS[1].build();

    expect(competitive.bottom.sections.map(s => s.id)).toEqual([
      'dice',
      'card-flow',
    ]);
    expect(competitive.left.sections).toHaveLength(0);
    expect(competitive.right.sections).toHaveLength(0);
    expect(competitive.top.sections).toHaveLength(0);

    // Nothing may be silently unplaced: every section is somewhere.
    for (const id of ALL) expect(zoneOf(competitive, id)).not.toBeNull();
  });

  it('places every known section in both presets', () => {
    for (const preset of PRESETS) {
      const layout = preset.build();
      for (const id of ALL) {
        expect(zoneOf(layout, id)).not.toBeNull();
      }
    }
  });
});

describe('a gutter being switched on', () => {
  // The bug this guards: right and top were stored as collapsed with a size of
  // zero, meaning "unused". gutterThickness reads collapsed as a 28px strip and
  // the shell skips a collapsed gutter's body, so the first section moved there
  // vanished into a sliver — with no chevron on a non-header rail to open it.
  it('is usable the moment a section lands in it', () => {
    for (const zone of ['right', 'top', 'bottom', 'left'] as const) {
      const next = placeSection(cloneLayout(DEFAULT_LAYOUT), 'players', zone);
      expect(next[zone].size).toBeGreaterThan(0);
      expect(next[zone].collapsed).toBe(false);
    }
  });

  it('takes no room while it is empty, but keeps a size ready', () => {
    const layout = cloneLayout(DEFAULT_LAYOUT);
    expect(gutterThickness(layout.left)).toBe(0);
    expect(gutterThickness(layout.top)).toBe(0);
    // Emptiness is what hides them — not a flag that means something else.
    expect(layout.left.size).toBeGreaterThan(0);
    expect(layout.left.collapsed).toBe(false);
  });
});

describe('repairing a layout', () => {
  it('gives a gutter with no usable size one', () => {
    const broken = cloneLayout(DEFAULT_LAYOUT);
    broken.left = { size: 0, collapsed: false, sections: [{ id: 'players' }] };

    const fixed = repairLayout(broken);
    expect(fixed.left.size).toBeGreaterThan(0);
    expect(gutterThickness(fixed.left)).toBeGreaterThan(0);
  });

  it('uncollapses a bar, since only a rail can carry the header', () => {
    const broken = cloneLayout(DEFAULT_LAYOUT);
    broken.bottom.collapsed = true;

    // The header lives on a rail, so a collapsed bar has no chevron to reopen
    // it and would strand everything inside.
    expect(headerGutterOf(broken)).toBe('right');
    expect(repairLayout(broken).bottom.collapsed).toBe(false);
  });

  it('leaves the header rail collapsed, because its chevron can undo it', () => {
    const collapsed = cloneLayout(DEFAULT_LAYOUT);
    collapsed.right.collapsed = true;

    expect(headerGutterOf(collapsed)).toBe('right');
    expect(repairLayout(collapsed).right.collapsed).toBe(true);
  });

  it('uncollapses the rail that did not get the header', () => {
    // Both rails hold something, so the left one takes the header and the
    // right is left without a chevron to reopen it.
    const layout = placeSection(cloneLayout(DEFAULT_LAYOUT), 'players', 'left');
    layout.right.collapsed = true;

    expect(headerGutterOf(layout)).toBe('left');
    expect(repairLayout(layout).right.collapsed).toBe(false);
  });

  it('repairs a layout as it is read back from storage', () => {
    const stored = cloneLayout(DEFAULT_LAYOUT) as any;
    // Both faults at once, on a bar that can never hold the header.
    stored.bottom = { size: 0, collapsed: true, sections: [{ id: 'dice' }] };

    const parsed = parseLayout(stored)!;
    expect(parsed.bottom.size).toBeGreaterThan(0);
    expect(parsed.bottom.collapsed).toBe(false);
  });
});
