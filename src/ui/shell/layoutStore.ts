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
}

export const GUTTER_NAMES: GutterName[] = ['left', 'right', 'top', 'bottom'];

/** Width the rail collapses to — enough for the reopen chevron. */
export const COLLAPSED_SIZE = 28;
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
  right: { size: 0, collapsed: true, sections: [] },
  top: { size: 0, collapsed: true, sections: [] },
};

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
  return cloneLayout(layout);
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
