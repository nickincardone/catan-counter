// shell/layoutStore.ts
// Where each section lives, and how big the gutters are.
//
// This is the file that makes sections movable. Nothing about a section's code
// says which gutter it belongs to — only this configuration does, so moving the
// dice chart to the rail is an edit here rather than a rewrite there. Drag and
// drop is not built yet; when it is, it edits this and nothing else.

import type { SectionId } from '../sections/types.js';

export type GutterName = 'left' | 'right' | 'top' | 'bottom';

export interface Placement {
  id: SectionId;
  /** Share of the gutter's long axis, for gutters holding several sections. */
  weight?: number;
}

export interface GutterConfig {
  /** Thickness in px: width for left/right, height for top/bottom. */
  size: number;
  collapsed: boolean;
  sections: Placement[];
}

export interface V2Layout {
  version: 1;
  left: GutterConfig;
  right: GutterConfig;
  top: GutterConfig;
  bottom: GutterConfig;
  /**
   * Sections switched off, remembered in the order they were hidden.
   *
   * Explicit rather than "everything not placed": a section missing from a
   * stored layout is otherwise ambiguous between hidden on purpose and added
   * since that layout was saved. Optional, so older stored layouts still parse.
   */
  off?: Placement[];
}

export const GUTTER_NAMES: GutterName[] = ['left', 'right', 'top', 'bottom'];

/** Where a section can be put. 'off' is a real choice, not the absence of one. */
export type Zone = GutterName | 'off';

/** Zone order, which is also the order the settings menu lists sections in. */
export const ZONES: Zone[] = ['left', 'top', 'bottom', 'right', 'off'];

/** Width the rail collapses to — enough for the reopen chevron. */
export const COLLAPSED_SIZE = 28;

/** Fallback thickness for a gutter stored without a usable one. */
const DEFAULT_SIZE: Record<GutterName, number> = {
  left: 365,
  right: 365,
  top: 210,
  bottom: 210,
};
export const MIN_RAIL_WIDTH = 280;
export const MAX_RAIL_WIDTH = 420;

export const LAYOUT_STORAGE_KEY = 'catanUiLayout';

export const DEFAULT_LAYOUT: V2Layout = {
  version: 1,
  left: {
    size: 365,
    collapsed: false,
    sections: [
      { id: 'hands' },
      { id: 'unknown-steals' },
      { id: 'card-flow' },
      { id: 'blocked-robber' },
    ],
  },
  bottom: {
    size: 210,
    collapsed: false,
    sections: [
      { id: 'dice', weight: 1 },
      { id: 'dev-deck', weight: 1 },
    ],
  },
  // Empty, but with a real size ready for the day something is put here.
  // Emptiness is what makes a gutter take no room (see gutterThickness) —
  // marking one collapsed instead would make it a 28px sliver the moment a
  // section landed in it, with no chevron to open it.
  right: { size: 365, collapsed: false, sections: [] },
  top: { size: 210, collapsed: false, sections: [] },
  off: [{ id: 'card-flow-ledger' }, { id: 'players' }],
};

export interface LayoutPreset {
  name: string;
  note: string;
  build(): V2Layout;
}

/**
 * Presets set placement only. Gutter sizes are deliberately left alone, so
 * picking one does not undo a rail you had sized to taste.
 */
export const PRESETS: LayoutPreset[] = [
  {
    name: 'Full read',
    note: 'Everything, left rail and bottom bar',
    build: () => cloneLayout(DEFAULT_LAYOUT),
  },
  {
    name: 'Competitive',
    note: 'Dice and card flow, bottom bar only',
    build: () => ({
      version: 1,
      left: { ...DEFAULT_LAYOUT.left, sections: [] },
      right: { ...DEFAULT_LAYOUT.right, sections: [] },
      top: { ...DEFAULT_LAYOUT.top, sections: [] },
      bottom: {
        ...DEFAULT_LAYOUT.bottom,
        sections: [{ id: 'dice' }, { id: 'card-flow' }],
      },
      off: [
        { id: 'hands' },
        { id: 'unknown-steals' },
        { id: 'blocked-robber' },
        { id: 'dev-deck' },
        { id: 'card-flow-ledger' },
        { id: 'players' },
      ],
    }),
  },
];

declare const chrome:
  | {
      storage?: {
        local: {
          get(keys: string | string[] | null): Promise<Record<string, unknown>>;
          set(items: Record<string, unknown>): Promise<void>;
        };
      };
    }
  | undefined;

export function cloneLayout(layout: V2Layout): V2Layout {
  return {
    version: layout.version,
    left: {
      ...layout.left,
      sections: layout.left.sections.map(s => ({ ...s })),
    },
    right: {
      ...layout.right,
      sections: layout.right.sections.map(s => ({ ...s })),
    },
    top: { ...layout.top, sections: layout.top.sections.map(s => ({ ...s })) },
    bottom: {
      ...layout.bottom,
      sections: layout.bottom.sections.map(s => ({ ...s })),
    },
    off: (layout.off ?? []).map(s => ({ ...s })),
  };
}

function isGutterConfig(value: unknown): value is GutterConfig {
  const gutter = value as GutterConfig | null;
  return (
    !!gutter &&
    typeof gutter.size === 'number' &&
    Number.isFinite(gutter.size) &&
    typeof gutter.collapsed === 'boolean' &&
    Array.isArray(gutter.sections) &&
    gutter.sections.every(
      placement =>
        !!placement &&
        typeof placement.id === 'string' &&
        (placement.weight === undefined ||
          (typeof placement.weight === 'number' && placement.weight > 0))
    )
  );
}

/**
 * A stored layout is only honored if it is entirely well-formed. A partially
 * valid layout is worse than none: it would leave sections silently unplaced.
 */
export function parseLayout(value: unknown): V2Layout | null {
  const layout = value as V2Layout | null;
  if (!layout || layout.version !== DEFAULT_LAYOUT.version) return null;
  if (!GUTTER_NAMES.every(name => isGutterConfig(layout[name]))) return null;
  if (
    layout.off !== undefined &&
    (!Array.isArray(layout.off) ||
      layout.off.some(
        placement => !placement || typeof placement.id !== 'string'
      ))
  ) {
    return null;
  }
  return repairLayout(layout);
}

function storageAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.storage?.local;
}

export async function readLayout(): Promise<V2Layout> {
  if (!storageAvailable()) return cloneLayout(DEFAULT_LAYOUT);
  try {
    const stored = await chrome!.storage!.local.get(LAYOUT_STORAGE_KEY);
    return (
      parseLayout(stored[LAYOUT_STORAGE_KEY]) ?? cloneLayout(DEFAULT_LAYOUT)
    );
  } catch (error) {
    console.warn('🎛️ Could not read the stored v2 layout:', error);
    return cloneLayout(DEFAULT_LAYOUT);
  }
}

export async function writeLayout(layout: V2Layout): Promise<void> {
  if (!storageAvailable()) return;
  try {
    await chrome!.storage!.local.set({ [LAYOUT_STORAGE_KEY]: layout });
  } catch (error) {
    console.warn('🎛️ Could not store the v2 layout:', error);
  }
}

/** Effective thickness of a gutter, accounting for collapse and emptiness. */
export function gutterThickness(gutter: GutterConfig): number {
  if (gutter.sections.length === 0) return 0;
  return gutter.collapsed ? COLLAPSED_SIZE : gutter.size;
}

/** Which zone a section currently sits in, or null if the layout omits it. */
export function zoneOf(layout: V2Layout, id: SectionId): Zone | null {
  for (const name of GUTTER_NAMES) {
    if (layout[name].sections.some(placement => placement.id === id)) {
      return name;
    }
  }
  if ((layout.off ?? []).some(placement => placement.id === id)) return 'off';
  return null;
}

function listFor(layout: V2Layout, zone: Zone): Placement[] {
  if (zone === 'off') {
    if (!layout.off) layout.off = [];
    return layout.off;
  }
  return layout[zone].sections;
}

/**
 * Move a section to a zone, appending it at the end. Returns a new layout;
 * moving a section to the zone it already occupies changes nothing.
 */
export function placeSection(
  layout: V2Layout,
  id: SectionId,
  zone: Zone
): V2Layout {
  const next = cloneLayout(layout);
  const current = zoneOf(next, id);
  if (current === zone) return next;

  if (current) {
    const list = listFor(next, current);
    const index = list.findIndex(placement => placement.id === id);
    if (index >= 0) list.splice(index, 1);
  }
  listFor(next, zone).push({ id });
  // A gutter being switched on must be usable, or the section vanishes into it.
  return repairLayout(next);
}

/** Move a section one step up or down within its own zone. */
export function reorderSection(
  layout: V2Layout,
  id: SectionId,
  direction: -1 | 1
): V2Layout {
  const next = cloneLayout(layout);
  const zone = zoneOf(next, id);
  if (!zone) return next;

  const list = listFor(next, zone);
  const index = list.findIndex(placement => placement.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= list.length) return next;

  const moved = list[index];
  list[index] = list[target];
  list[target] = moved;
  return next;
}

/**
 * Fold in any section the stored layout predates, at its default position.
 *
 * A section absent from a stored layout has never been decided about — it was
 * added in a later version — so it takes the place it was designed for rather
 * than staying invisible forever. One that was switched off is in `off`, and
 * stays there.
 */
export function withKnownSections(
  layout: V2Layout,
  knownIds: SectionId[]
): V2Layout {
  let next = cloneLayout(layout);
  for (const id of knownIds) {
    if (zoneOf(next, id)) continue;
    next = placeSection(next, id, zoneOf(DEFAULT_LAYOUT, id) ?? 'off');
  }
  return next;
}

/** Every known section with its zone, in the order the settings menu lists. */
export function listSections(
  layout: V2Layout,
  knownIds: SectionId[]
): Array<{ id: SectionId; zone: Zone }> {
  const full = withKnownSections(layout, knownIds);
  const rows: Array<{ id: SectionId; zone: Zone }> = [];

  for (const zone of ZONES) {
    for (const placement of listFor(full, zone)) {
      if (knownIds.includes(placement.id)) {
        rows.push({ id: placement.id, zone });
      }
    }
  }
  return rows;
}

/** Which gutter carries the header — the only one with a collapse chevron. */
export function headerGutterOf(layout: V2Layout): GutterName | null {
  if (layout.left.sections.length > 0) return 'left';
  if (layout.right.sections.length > 0) return 'right';
  return null;
}

/**
 * Make a layout renderable, whatever state it arrived in.
 *
 * Two ways a gutter can be unreachable, both of which stranded sections:
 *
 *  - a size of zero, so it renders as nothing however much is in it;
 *  - collapsed, on a gutter with no header and therefore no chevron to undo
 *    it. Only the header rail can be collapsed, because only it can be opened
 *    again.
 *
 * Applied when a layout is read and after anything is placed, so a layout
 * already stored in the broken shape repairs itself rather than needing a reset.
 */
export function repairLayout(layout: V2Layout): V2Layout {
  const next = cloneLayout(layout);
  const header = headerGutterOf(next);

  for (const name of GUTTER_NAMES) {
    const gutter = next[name];
    if (!Number.isFinite(gutter.size) || gutter.size <= 0) {
      gutter.size = DEFAULT_SIZE[name];
    }
    if (gutter.collapsed && name !== header) gutter.collapsed = false;
  }
  return next;
}
