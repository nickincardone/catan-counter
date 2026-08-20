// shell/theme.ts
// Design tokens for v2, read out of the mockup rather than eyeballed. Sections
// reference these names, never raw hex, so the palette can move in one place.

export const THEME = {
  /** Rail and bottom-bar background. */
  panel: '#0f2c46',
  hairline: 'rgba(255,255,255,.09)',
  /** Cards, player rows, dev tiles. */
  surface: 'rgba(255,255,255,.05)',
  /** A resource cell nobody can hold. */
  surfaceEmpty: 'rgba(255,255,255,.02)',
  accent: '#f4c542',
  /** Probability fractions, dice running hot, a confirmed resolution. */
  good: '#7fd4c1',
  goodText: '#a8e8da',
  goodTint: 'rgba(127,212,193,.09)',
  goodBorder: 'rgba(127,212,193,.45)',
  accentTint: 'rgba(244,197,66,.09)',
  accentBorder: 'rgba(244,197,66,.32)',
  danger: '#e35b5b',
  bar: '#4d7ea3',
  text: '#ffffff',
  textBody: '#dbe6ee',
  textMuted: '#9fb8cc',
  /** Section labels. */
  label: '#7fa8c9',
  /** Right-hand hints, e.g. "bank left". */
  labelDim: '#5b7f9c',
  monoDim: '#6f93ae',
  /** A zero that isn't really a holding. */
  zero: '#3f566b',
} as const;

export const RESOURCE_STYLE = {
  tree: { color: '#3f8f2f', tint: 'rgba(63,143,47,.22)', icon: 'tree.svg' },
  brick: { color: '#cf5b32', tint: 'rgba(207,91,50,.22)', icon: 'brick.svg' },
  sheep: { color: '#8dc63f', tint: 'rgba(141,198,63,.22)', icon: 'sheep.svg' },
  wheat: { color: '#e8b23a', tint: 'rgba(232,178,58,.22)', icon: 'wheat.svg' },
  ore: { color: '#9aa8ae', tint: 'rgba(154,168,174,.22)', icon: 'ore.svg' },
} as const;

/**
 * Nunito for names and headings, IBM Plex Mono for every number. Both are
 * bundled as web-accessible resources rather than fetched from Google, so they
 * do not depend on colonist's content security policy. The fallbacks matter:
 * if the files are ever missing the UI degrades to the system stack instead of
 * to a serif face.
 */
export const FONT_SANS =
  "'Nunito', system-ui, -apple-system, 'Segoe UI', Helvetica, sans-serif";
export const FONT_MONO =
  "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
