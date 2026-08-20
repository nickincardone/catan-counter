// shell/pageFrame.ts
// Makes room for the gutters by shrinking colonist rather than covering it.
//
// Two halves. The viewport override lives in the MAIN world (pageViewport.ts)
// because colonist's layout math reads window.innerWidth/innerHeight, which the
// isolated world cannot change. The shift lives here, because it is only a
// stylesheet and content scripts already share the page's DOM.
//
// Everything this module does to the page is undone by release(), which is what
// lets the popup switch back to the overlay mid-game.

import {
  PAGE_VIEWPORT_SOURCE,
  ZERO_INSET,
  type ViewportInset,
  type ViewportReport,
} from '../../pageViewport.js';

const STYLE_ID = 'catan-v2-page-frame';

/** If the MAIN-world half never answers, stop waiting and carry on. */
const REPORT_TIMEOUT_MS = 750;

/** Below this the game is too cramped to be worth squeezing further. */
export const MIN_PAGE_WIDTH = 900;
export const MIN_PAGE_HEIGHT = 500;

let nonce = 0;
let installed = false;
/**
 * Whether the MAIN-world half is answering. It is injected at document_start,
 * well before any UI mounts, so if the first request goes unanswered it is not
 * coming — and every later call should skip the wait instead of stalling the
 * shell for a timeout each time.
 */
let bridgeResponsive: boolean | null = null;
let reportTimeoutMs = REPORT_TIMEOUT_MS;
let lastRequested: ViewportInset = { ...ZERO_INSET };

export interface PageFrameResult {
  /** Whether the MAIN-world half answered. False means gutters overlay. */
  applied: boolean;
  /** Free space actually left at each edge, when it could be measured. */
  free?: { left: number; bottom: number };
}

function post(
  type: 'set-inset' | 'release' | 'measure',
  inset?: ViewportInset
) {
  const id = ++nonce;
  window.postMessage(
    { source: PAGE_VIEWPORT_SOURCE, type, inset, nonce: id },
    window.location.origin
  );
  return id;
}

/** Wait for the report matching this command, or give up. */
function awaitReport(id: number): Promise<ViewportReport | null> {
  return new Promise(resolve => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', listener);
      resolve(null);
    }, reportTimeoutMs);

    function listener(event: MessageEvent<unknown>): void {
      if (event.source !== window || event.origin !== window.location.origin)
        return;
      const data = event.data as ViewportReport | null;
      if (
        !data ||
        data.source !== PAGE_VIEWPORT_SOURCE ||
        data.type !== 'report' ||
        data.nonce !== id
      )
        return;
      window.clearTimeout(timer);
      window.removeEventListener('message', listener);
      resolve(data);
    }

    window.addEventListener('message', listener);
  });
}

/**
 * Shift colonist's own elements out from under the gutters.
 *
 * Uses the independent CSS `translate` property, never `transform`: colonist
 * pairs `top: 50%` with `transform: translateY(-50%)` on its canvas, so writing
 * transform here would drop the board half a screen. `translate` composes with
 * it and colonist never sets it.
 */
function applyShift(left: number, top: number): void {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent =
    left === 0 && top === 0
      ? ''
      : `body > *:not(#catan-v2-root):not(#${STYLE_ID}) { translate: ${left}px ${top}px; }`;
}

function removeShift(): void {
  document.getElementById(STYLE_ID)?.remove();
}

/** Clamp so the game never gets squeezed into uselessness. */
export function clampInset(inset: ViewportInset): ViewportInset {
  const maxHorizontal = Math.max(0, window.innerWidth - MIN_PAGE_WIDTH);
  const maxVertical = Math.max(0, window.innerHeight - MIN_PAGE_HEIGHT);
  const horizontal = inset.left + inset.right;
  const vertical = inset.top + inset.bottom;

  const scale = (value: number, total: number, max: number): number =>
    total <= max || total === 0 ? value : Math.floor((value * max) / total);

  return {
    left: scale(inset.left, horizontal, maxHorizontal),
    right: scale(inset.right, horizontal, maxHorizontal),
    top: scale(inset.top, vertical, maxVertical),
    bottom: scale(inset.bottom, vertical, maxVertical),
  };
}

/**
 * Squeeze the page so the given edges are free, then shift it clear of the
 * left and top gutters.
 *
 * The inset frees exactly the space it asks for — colonist sizes its layers to
 * the viewport height it is told. But it also centers them, so half that space
 * lands above the game and half below, and asking for a 176px bottom gutter
 * leaves 88px at each end. Pinning the content to the top instead of trying to
 * ask for more is what makes this exact: the gap that was above moves to the
 * bottom, where the gutter is.
 *
 * The shift is cleared before measuring rather than compensated for, so each
 * call re-derives the offset from scratch and repeated calls land identically.
 */
export async function applyPageFrame(
  requested: ViewportInset
): Promise<PageFrameResult> {
  const target = clampInset(requested);
  lastRequested = target;
  installed = true;

  // Without the MAIN-world half the page cannot be squeezed at all; the gutters
  // still render, they just sit over the page instead of beside it.
  if (bridgeResponsive === false) {
    applyShift(0, 0);
    return { applied: false };
  }

  applyShift(0, 0);
  const report = await awaitReport(post('set-inset', target));

  // The MAIN-world half is missing (hook blocked, or an older build): the
  // gutters still render, they just overlay the page instead of framing it.
  if (!report) {
    bridgeResponsive = false;
    console.warn(
      '🎛️ The page-viewport hook did not answer — v2 will overlay the page instead of shrinking it'
    );
    return { applied: false };
  }
  bridgeResponsive = true;

  if (!report.content) {
    // Colonist has not drawn the board yet; the horizontal shift is safe on its
    // own, and the next call (or the next resize) will settle the vertical one.
    applyShift(target.left, 0);
    return { applied: true };
  }

  const shiftY = Math.round(target.top - report.content.top);
  applyShift(target.left, shiftY);

  return {
    applied: true,
    free: {
      left: report.content.left + target.left,
      bottom: report.real.height - (report.content.bottom + shiftY),
    },
  };
}

/** Put the page back exactly as it was. */
export async function releasePageFrame(): Promise<void> {
  removeShift();
  if (!installed) return;
  installed = false;
  lastRequested = { ...ZERO_INSET };
  if (bridgeResponsive === false) return;
  await awaitReport(post('release'));
}

/** Re-apply the current frame, e.g. after the window itself resized. */
export async function refreshPageFrame(): Promise<PageFrameResult> {
  if (!installed) return { applied: false };
  return applyPageFrame(lastRequested);
}

/** Test seam: the insets most recently asked for. */
export function _lastRequestedInsetForTesting(): ViewportInset {
  return { ...lastRequested };
}

/** Test seam: forget what calibration learned. */
export function _resetPageFrameForTesting(timeoutMs = REPORT_TIMEOUT_MS): void {
  nonce = 0;
  installed = false;
  bridgeResponsive = null;
  reportTimeoutMs = timeoutMs;
  lastRequested = { ...ZERO_INSET };
  removeShift();
}
