// shell/fonts.ts
// Registers the bundled typefaces.
//
// These cannot be declared as @font-face inside the shadow root: Chrome ignores
// font-face rules that live in one, so the files are never even fetched and the
// UI quietly falls back to whatever the machine happens to have installed. That
// failure is invisible on a developer's machine if the fonts are installed
// locally, which is exactly how it slipped through the first time.
//
// The FontFace API registers them on the document instead, which works from the
// isolated world and can be undone precisely when v2 unmounts.

import { FONT_MONO, FONT_SANS } from './theme.js';

interface BundledFont {
  family: string;
  file: string;
  /** Variable fonts: one file covers the whole axis. */
  weight: string;
}

const BUNDLED: BundledFont[] = [
  {
    family: 'Manrope',
    file: 'assets/fonts/manrope-latin-var.woff2',
    weight: '200 800',
  },
  {
    family: 'JetBrains Mono',
    file: 'assets/fonts/jetbrains-mono-latin-var.woff2',
    weight: '100 800',
  },
];

let loaded: FontFace[] = [];
let pending: Promise<void> | null = null;

/**
 * Load the typefaces onto the document. Safe to call repeatedly; the work
 * happens once. Failures are swallowed — the font stacks in `theme.ts` name a
 * real fallback, so the worst case is the system face rather than no interface.
 */
export function loadFonts(assetUrl: (path: string) => string): Promise<void> {
  if (pending) return pending;
  if (typeof FontFace === 'undefined' || !document.fonts) {
    return Promise.resolve();
  }

  pending = Promise.all(
    BUNDLED.map(async font => {
      try {
        const face = new FontFace(
          font.family,
          `url('${assetUrl(font.file)}')`,
          { weight: font.weight, display: 'swap' }
        );
        await face.load();
        document.fonts.add(face);
        loaded.push(face);
      } catch (error) {
        console.warn(`🎛️ Could not load ${font.family}:`, error);
      }
    })
  ).then(() => undefined);

  return pending;
}

/** Take them off the document again, so unmounting leaves nothing behind. */
export function unloadFonts(): void {
  for (const face of loaded) {
    try {
      document.fonts.delete(face);
    } catch {
      // Already gone, or the document is being torn down.
    }
  }
  loaded = [];
  pending = null;
}

/** Exported for the stylesheet, so the families stay named in one place. */
export const FONT_STACKS = { sans: FONT_SANS, mono: FONT_MONO };
