/**
 * Types and bridge code for the Colonist transport-capture POC.
 *
 * `pageTransportHook.ts` runs in the page's MAIN JavaScript world so it can
 * observe WebSocket traffic. This module runs in the extension's ISOLATED
 * world, validates messages crossing the window.postMessage boundary, and
 * forwards them to the game logger.
 */

export const PAGE_TRANSPORT_SOURCE = 'catan-counter-page-transport-v1';
export const EXTENSION_BRIDGE_SOURCE = 'catan-counter-extension-bridge-v1';
export const TRANSPORT_CAPTURE_VERSION = 1 as const;

export type TransportDirection = 'incoming' | 'outgoing' | 'lifecycle';
export type TransportEncoding = 'text' | 'base64' | 'json' | 'none';

export interface TransportCapture {
  captureVersion: typeof TRANSPORT_CAPTURE_VERSION;
  /** Unique across page reloads; used to dedupe backlog replays. */
  id: string;
  pageSessionId: string;
  sequence: number;
  capturedAt: string;
  direction: TransportDirection;
  connectionId: number;
  /** Origin + pathname only. Query strings and fragments are intentionally removed. */
  connectionUrl: string;
  event: 'constructed' | 'open' | 'message' | 'close' | 'error';
  encoding: TransportEncoding;
  data: string | null;
  byteLength: number | null;
  truncated: boolean;
}

interface PageTransportEnvelope {
  source: typeof PAGE_TRANSPORT_SOURCE;
  capture: TransportCapture;
}

const MAX_BRIDGED_DATA_LENGTH = 350_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Validate the untrusted object received from the page's MAIN world. Colonist
 * can post messages to the same window, so the isolated content script must not
 * blindly persist arbitrary objects.
 */
export function parsePageTransportEnvelope(
  value: unknown
): TransportCapture | null {
  if (!isRecord(value) || value.source !== PAGE_TRANSPORT_SOURCE) return null;
  if (!isRecord(value.capture)) return null;

  const capture = value.capture;
  const directions: TransportDirection[] = [
    'incoming',
    'outgoing',
    'lifecycle',
  ];
  const events: TransportCapture['event'][] = [
    'constructed',
    'open',
    'message',
    'close',
    'error',
  ];
  const encodings: TransportEncoding[] = ['text', 'base64', 'json', 'none'];

  if (capture.captureVersion !== TRANSPORT_CAPTURE_VERSION) return null;
  if (typeof capture.id !== 'string' || capture.id.length > 200) return null;
  if (
    typeof capture.pageSessionId !== 'string' ||
    capture.pageSessionId.length > 100
  )
    return null;
  if (
    typeof capture.sequence !== 'number' ||
    !Number.isSafeInteger(capture.sequence) ||
    capture.sequence < 0
  )
    return null;
  if (typeof capture.capturedAt !== 'string') return null;
  if (!directions.includes(capture.direction as TransportDirection))
    return null;
  if (
    typeof capture.connectionId !== 'number' ||
    !Number.isSafeInteger(capture.connectionId) ||
    capture.connectionId < 0
  )
    return null;
  if (
    typeof capture.connectionUrl !== 'string' ||
    capture.connectionUrl.length > 2_000
  )
    return null;
  if (!events.includes(capture.event as TransportCapture['event'])) return null;
  if (!encodings.includes(capture.encoding as TransportEncoding)) return null;
  if (
    capture.data !== null &&
    (typeof capture.data !== 'string' ||
      capture.data.length > MAX_BRIDGED_DATA_LENGTH)
  )
    return null;
  if (
    capture.byteLength !== null &&
    (typeof capture.byteLength !== 'number' ||
      !Number.isSafeInteger(capture.byteLength) ||
      capture.byteLength < 0)
  )
    return null;
  if (typeof capture.truncated !== 'boolean') return null;

  return capture as unknown as TransportCapture;
}

/**
 * Start the isolated-world half of the bridge. The ready message asks the MAIN
 * world hook to replay anything captured during the tiny startup race.
 */
export function startTransportCaptureBridge(
  onCapture: (capture: TransportCapture) => void
): () => void {
  const listener = (event: MessageEvent<unknown>) => {
    if (event.source !== window || event.origin !== window.location.origin)
      return;
    const capture = parsePageTransportEnvelope(event.data);
    if (capture) onCapture(capture);
  };

  window.addEventListener('message', listener);
  window.postMessage(
    { source: EXTENSION_BRIDGE_SOURCE, type: 'ready' },
    window.location.origin
  );

  return () => window.removeEventListener('message', listener);
}

export type { PageTransportEnvelope };
