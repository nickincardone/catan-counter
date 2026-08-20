import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  DEFAULT_LAYOUT,
  PRESETS,
  cloneLayout,
  listSections,
  placeSection,
  reorderSection,
  parseLayout,
  withKnownSections,
  zoneOf,
} from '../ui/shell/layoutStore';
import type { V2Layout } from '../ui/shell/layoutStore';
import type { SectionId } from '../ui/sections/types';

const ALL: SectionId[] = [
  'hands',
  'unknown-steals',
  'card-flow',
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
    expect(zoneOf(layout, 'hands')).toBe('left');
    expect(zoneOf(layout, 'dice')).toBe('bottom');
    expect(zoneOf(layout, 'players')).toBe('off');
  });

  it('moves a section between gutters, leaving the old one', () => {
    const next = placeSection(layout, 'dice', 'right');

    expect(zoneOf(next, 'dice')).toBe('right');
    expect(next.bottom.sections.some(s => s.id === 'dice')).toBe(false);
    expect(next.right.sections.map(s => s.id)).toEqual(['dice']);
  });

  it('switches a section off and back on again', () => {
    const off = placeSection(layout, 'hands', 'off');
    expect(zoneOf(off, 'hands')).toBe('off');
    expect(off.left.sections.some(s => s.id === 'hands')).toBe(false);

    const on = placeSection(off, 'hands', 'left');
    expect(zoneOf(on, 'hands')).toBe('left');
    expect(on.off?.some(s => s.id === 'hands')).toBe(false);
  });

  it('leaves the layout alone when a section is already there', () => {
    const next = placeSection(layout, 'hands', 'left');
    expect(next.left.sections.map(s => s.id)).toEqual(
      layout.left.sections.map(s => s.id)
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
    for (const zone of ['top', 'bottom', 'right', 'off', 'left'] as const) {
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

    expect(next.left.sections.map(s => s.id)).toEqual([
      'unknown-steals',
      'hands',
      'card-flow',
      'blocked-robber',
    ]);
  });

  it('stops at the ends rather than wrapping', () => {
    const layout = cloneLayout(DEFAULT_LAYOUT);
    const order = layout.left.sections.map(s => s.id);

    expect(
      reorderSection(layout, 'hands', -1).left.sections.map(s => s.id)
    ).toEqual(order);
    expect(
      reorderSection(layout, 'blocked-robber', 1).left.sections.map(s => s.id)
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
      'card-flow-ledger',
      'players',
    ]);
    expect(rows.map(r => r.zone)).toEqual([
      'left',
      'left',
      'left',
      'left',
      'bottom',
      'bottom',
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
    layout.left.sections = [{ id: 'hands' }, { id: 'unknown-steals' }];
    layout.off = [];
    return layout;
  }

  it('adopts the new section at the place it was designed for', () => {
    const merged = withKnownSections(oldLayout(), ALL);

    // card-flow is in the default left rail, so it appears there...
    expect(zoneOf(merged, 'card-flow')).toBe('left');
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
