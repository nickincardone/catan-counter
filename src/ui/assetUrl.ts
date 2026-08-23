// ui/assetUrl.ts
// Absolute URLs for the extension's own image files.
//
// The base is resolved once, at load, and kept. chrome.runtime.getURL stops
// working the moment the extension is reloaded while a page is still open —
// the page's content script is left with an invalidated context, and every
// later call throws. That happens routinely during development, and the old
// behaviour was to quietly fall back to a relative path, which the browser
// resolved against colonist.io: every icon 404'd and rendered as its alt text
// while the rest of the interface carried on working.
//
// A resolved base survives that, because the extension keeps its id across a
// reload and the files are still where the URL says they are. Holding the
// string means no API call is needed once the page is running.

declare const chrome:
  | { runtime?: { getURL?: (path: string) => string } }
  | undefined;

/**
 * Resolved while the context is certainly valid: this module is imported by
 * the content script at document_start, long before anything can invalidate it.
 */
const BASE: string | null = (() => {
  try {
    const base = chrome?.runtime?.getURL?.('');
    return typeof base === 'string' && base.length > 0 ? base : null;
  } catch {
    return null;
  }
})();

let warned = false;

/**
 * An extension file's URL. Falls back to the bare path outside the extension
 * (the tests and the dev preview harness both run there), and says so once
 * rather than leaving a page full of broken images unexplained.
 */
export function assetUrl(path: string): string {
  if (BASE) return BASE + path;
  if (!warned) {
    warned = true;
    console.warn(
      `🖼️ Extension assets could not be resolved; "${path}" and others will not load.`
    );
  }
  return path;
}

/** Test seam: whether a real extension base was found. */
export function _hasExtensionBaseForTesting(): boolean {
  return BASE !== null;
}
