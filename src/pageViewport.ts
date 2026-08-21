/**
 * MAIN-world viewport control for the v2 gutter UI.
 *
 * Colonist has no single page root to pad: it absolutely-positions its canvas
 * layers and `#ui-game` on <body> and writes inline pixel sizes onto them,
 * recomputed from `window.innerWidth`/`innerHeight` whenever a resize fires.
 * The only way to make it lay out inside a smaller area — crisply, at native
 * resolution, without touching its own transforms — is to make it read smaller
 * numbers and tell it to re-measure.
 *
 * That has to happen in the page's own JavaScript world, so this module runs
 * alongside the transport hook and takes its commands from the isolated content
 * script over the same window.postMessage bridge.
 */

export const PAGE_VIEWPORT_SOURCE = 'catan-counter-page-viewport-v1';

export interface ViewportInset {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ViewportCommand {
  source: typeof PAGE_VIEWPORT_SOURCE;
  type: 'set-inset' | 'release' | 'measure';
  inset?: ViewportInset;
  /** Echoed back on the report so a stale reply can be ignored. */
  nonce?: number;
}

export interface ViewportReport {
  source: typeof PAGE_VIEWPORT_SOURCE;
  type: 'report';
  nonce: number;
  /** True viewport, before the override. */
  real: { width: number; height: number };
  /** What the page is being told it has. */
  reported: { width: number; height: number };
  /**
   * Union of colonist's own layers in real viewport coordinates, or null if it
   * has not rendered them yet. This is what the gutters are calibrated against:
   * the inset asked for and the space actually freed are not the same number.
   */
  content: { left: number; top: number; right: number; bottom: number } | null;
}

/** Elements colonist positions itself; the union of these is "the game". */
const CONTENT_SELECTORS = ['#game-canvas', '#ui-game'];

export const ZERO_INSET: ViewportInset = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};

export function isViewportCommand(value: unknown): value is ViewportCommand {
  const command = value as ViewportCommand | null;
  return (
    !!command &&
    command.source === PAGE_VIEWPORT_SOURCE &&
    (command.type === 'set-inset' ||
      command.type === 'release' ||
      command.type === 'measure')
  );
}

function measureContent(): ViewportReport['content'] {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let found = false;

  for (const selector of CONTENT_SELECTORS) {
    const element = document.querySelector(selector);
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    found = true;
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }

  return found ? { left, top, right, bottom } : null;
}

/**
 * Install the override. Safe to call more than once; only the first call wires
 * anything up. Returns immediately — nothing changes until an inset arrives.
 */
/**
 * Run a measurement once colonist has had a chance to re-lay out.
 *
 * A frame is the natural moment to measure, but requestAnimationFrame does not
 * fire at all in a background tab — and a game can easily be loaded, or left,
 * in one. Relying on it alone meant the reply never arrived there, the content
 * script timed out, and v2 silently fell back to covering the page for the rest
 * of the session.
 *
 * Racing the frame against a short timer fixed that only partly, because Chrome
 * throttles timers in a hidden tab to roughly one a second: a 48ms timer can
 * land well past the content script's 750ms patience, so the handshake failed
 * intermittently on loads that happened in the background. A hidden tab has
 * nothing to wait for anyway — it is not going to paint — so measure straight
 * away there, and keep the race for when the page can actually render.
 */
export function scheduleMeasurement(measure: () => void): void {
  if (document.hidden) {
    measure();
    return;
  }

  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    measure();
  };
  requestAnimationFrame(once);
  window.setTimeout(once, 48);
}

export function installViewportControl(): void {
  const flagged = window as Window & {
    __catanCounterViewportInstalled?: boolean;
  };
  if (flagged.__catanCounterViewportInstalled) return;
  flagged.__catanCounterViewportInstalled = true;

  // Captured before any override so release always restores the truth, even if
  // something else on the page redefines them later.
  const nativeWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth') as
    | PropertyDescriptor
    | undefined;
  const nativeHeight = Object.getOwnPropertyDescriptor(
    window,
    'innerHeight'
  ) as PropertyDescriptor | undefined;

  const realWidth = (): number =>
    nativeWidth?.get ? Number(nativeWidth.get.call(window)) : window.innerWidth;
  const realHeight = (): number =>
    nativeHeight?.get
      ? Number(nativeHeight.get.call(window))
      : window.innerHeight;

  let inset: ViewportInset = { ...ZERO_INSET };
  let overridden = false;

  function applyOverride(): void {
    if (overridden) return;
    overridden = true;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      get: () => Math.max(0, realWidth() - inset.left - inset.right),
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      get: () => Math.max(0, realHeight() - inset.top - inset.bottom),
    });
  }

  function removeOverride(): void {
    if (!overridden) return;
    overridden = false;
    if (nativeWidth) Object.defineProperty(window, 'innerWidth', nativeWidth);
    else delete (window as unknown as Record<string, unknown>).innerWidth;
    if (nativeHeight)
      Object.defineProperty(window, 'innerHeight', nativeHeight);
    else delete (window as unknown as Record<string, unknown>).innerHeight;
  }

  function report(nonce: number): void {
    const message: ViewportReport = {
      source: PAGE_VIEWPORT_SOURCE,
      type: 'report',
      nonce,
      real: { width: realWidth(), height: realHeight() },
      reported: { width: window.innerWidth, height: window.innerHeight },
      content: measureContent(),
    };
    window.postMessage(message, window.location.origin);
  }

  function scheduleReport(nonce: number): void {
    scheduleMeasurement(() => report(nonce));
  }

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== window.location.origin)
      return;
    if (!isViewportCommand(event.data)) return;
    const command = event.data;
    const nonce = typeof command.nonce === 'number' ? command.nonce : 0;

    if (command.type === 'release') {
      inset = { ...ZERO_INSET };
      removeOverride();
      window.dispatchEvent(new Event('resize'));
      scheduleReport(nonce);
      return;
    }

    if (command.type === 'measure') {
      report(nonce);
      return;
    }

    inset = { ...ZERO_INSET, ...(command.inset ?? ZERO_INSET) };
    applyOverride();
    window.dispatchEvent(new Event('resize'));
    scheduleReport(nonce);
  });
}
