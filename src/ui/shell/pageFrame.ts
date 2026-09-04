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
 * Put colonist's layout inside the space the gutters leave, by shrinking the
 * box its own positioning is measured against.
 *
 * Colonist absolutely-positions its layers on <body>, which is normally
 * `position: static` — so their offsets resolve against the viewport. Give body
 * a position and a smaller box and those same offsets resolve against IT: the
 * canvas's `top: 50%` centres the board in the reduced area instead of the
 * window, and its `left` starts from body's edge. Colonist puts itself in the
 * right place; nothing has to be moved afterwards.
 *
 * This replaced translating everything, which worked but dragged colonist's own
 * popups along with it — a menu anchored near the top of the game was pushed off
 * the top of the screen by the same offset that made room at the bottom.
 *
 * `html > body` outranks colonist's own `html, body` rule without !important.
 */
function applyPageBox(
  inset: ViewportInset,
  real: { width: number; height: number }
): void {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }

  const width = Math.max(0, real.width - inset.left - inset.right);
  const height = Math.max(0, real.height - inset.top - inset.bottom);

  style.textContent = `html > body {
    position: relative;
    box-sizing: border-box;
    margin-left: ${inset.left}px;
    margin-top: ${inset.top}px;
    width: ${width}px;
    height: ${height}px;
  }
  /* Colonist writes the canvas's viewport-space top onto #ui-game. Body
     already supplies the top gutter offset, so subtract that origin once.
     Keep native sizing and transforms intact for menus and pointer targets. */
  html > body > #ui-game {
    margin-top: ${-inset.top}px;
  }`;
}

function removePageBox(): void {
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
 * Squeeze the page into the space the gutters leave.
 *
 * Two halves, and both are needed. The viewport lie makes colonist SIZE itself
 * to the free area; the page box makes it POSITION itself there. Sizing alone
 * left the board centred in the whole window, with the freed space split above
 * and below rather than where the gutter is.
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
    removePageBox();
    return { applied: false };
  }

  // The box goes on FIRST, and the order matters. Colonist only recomputes the
  // offsets it positions its layers with when a resize fires, and the resize is
  // fired by set-inset below — so a box applied afterwards would not be read
  // until something else happened to resize the window.
  //
  // The real viewport is safe to read here: the override lives in the page's
  // world, and this code runs in the extension's, where it never took effect.
  applyPageBox(target, {
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const report = await awaitReport(post('set-inset', target));

  // The MAIN-world half is missing (hook blocked, or an older build): without
  // the viewport lie the page must not be left in a shrunken box either, so the
  // gutters simply overlay the page.
  if (!report) {
    bridgeResponsive = false;
    removePageBox();
    console.warn(
      '🎛️ The page-viewport hook did not answer — v2 will overlay the page instead of shrinking it'
    );
    return { applied: false };
  }
  bridgeResponsive = true;

  return {
    applied: true,
    free: { left: target.left, bottom: target.bottom },
  };
}

/** Put the page back exactly as it was. */
export async function releasePageFrame(): Promise<void> {
  removePageBox();
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
  removePageBox();
}
