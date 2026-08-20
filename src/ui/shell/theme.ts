// shell/theme.ts
// Design tokens for v2, read out of the mockup rather than eyeballed. Sections
// reference these names, never raw hex, so the palette can move in one place.

export const THEME = {
  /** Rail and bottom-bar background. */
  panel: '#16181c',
  hairline: 'rgba(255,255,255,.09)',
  /** Cards, player rows, dev tiles. */
  surface: 'rgba(255,255,255,.05)',
  /** A resource cell nobody can hold. */
  surfaceEmpty: 'rgba(255,255,255,.02)',
  /** Every section label, the logo, and the robber's tally. */
  accent: '#e8a33d',
  accentTint: 'rgba(232,163,61,.09)',
  accentBorder: 'rgba(232,163,61,.32)',
  /** Dice running hot, an untouched dev pile, a confirmed resolution. */
  good: '#5ec8a0',
  goodText: '#8fe0c4',
  goodTint: 'rgba(94,200,160,.09)',
  goodBorder: 'rgba(94,200,160,.45)',
  /** Probable holdings, which sit against a resource tint rather than a panel. */
  probable: '#6fdcae',
  danger: '#e35b5b',
  bar: '#5b6775',
  text: '#ffffff',
  textBody: '#eef1f4',
  textMuted: '#c3ccd4',
  /** Right-hand hints, e.g. "bank left". */
  labelDim: '#8a939d',
  monoDim: '#949da6',
  /** A zero that isn't really a holding. */
  zero: '#4b5158',
  /** The circle behind a blocked dice number. */
  well: '#24272d',
  /** The collapse chevron. */
  chevron: '#b9c2cc',
} as const;

export const RESOURCE_STYLE = {
  tree: { color: '#3f8f2f', tint: 'rgba(63,143,47,.22)', icon: 'tree.svg' },
  brick: { color: '#cf5b32', tint: 'rgba(207,91,50,.22)', icon: 'brick.svg' },
  sheep: { color: '#8dc63f', tint: 'rgba(141,198,63,.22)', icon: 'sheep.svg' },
  wheat: { color: '#e8b23a', tint: 'rgba(232,178,58,.22)', icon: 'wheat.svg' },
  ore: { color: '#9aa8ae', tint: 'rgba(154,168,174,.22)', icon: 'ore.svg' },
} as const;

/**
 * Manrope for names and headings, JetBrains Mono for every number. Both are
 * bundled as web-accessible resources rather than fetched from Google, so they
 * do not depend on colonist's content security policy. The fallbacks matter:
 * if the files are ever missing the UI degrades to the system stack instead of
 * to a serif face.
 */
export const FONT_SANS =
  "'Manrope', system-ui, -apple-system, 'Segoe UI', Helvetica, sans-serif";
export const FONT_MONO =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
