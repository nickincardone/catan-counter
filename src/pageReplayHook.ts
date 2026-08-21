/**
 * MAIN-world capture of Colonist's replay payload.
 *
 * Runs at document_start, before Colonist's bundle exists, because the replay
 * arrives once during page load and cannot be asked for again: repeating the
 * request from page script comes back 403 with `cf-mitigated: token`, from both
 * fetch and XHR, even for a game that tab never opened. A browser that is not
 * signed in gets 401. So the payload is teed as it passes or it is lost.
 *
 * Colonist uses XMLHttpRequest for this endpoint; fetch is wrapped too so a
 * change of transport does not silently end the capture.
 *
 * What lands here is one JSON document holding the entire game: the board, all
 * 500-700 events as state diffs, the structured game log, player chat, and the
 * end-game stats. Roughly 200 KB.
 */

import {
  PAGE_REPLAY_SOURCE,
  REPLAY_CAPTURE_VERSION,
  REPLAY_CHUNK_LENGTH,
  type ReplayCapture,
} from './replayCapture.js';

const REPLAY_PATH = '/api/replay/';

/** Captures kept in memory for the page API; a page rarely loads more than one. */
const MAX_RETAINED = 8;

declare global {
  interface Window {
    __catanCounterReplayHookInstalled?: boolean;
    __catanCounterReplay?: ReplayPageApi;
  }
}

/** Metadata only — the payload itself is fetched deliberately, never listed. */
export interface ReplayCaptureMeta {
  index: number;
  status: number;
  byteLength: number;
  gameId: string | null;
  playerColor: number | null;
  capturedAt: string;
}

export interface ReplayPageApi {
  version: 1;
  /** What has been captured so far, without the bytes. */
  meta(): ReplayCaptureMeta[];
  /** Whether a successful payload has arrived. */
  ready(): boolean;
  /**
   * Resolve once a successful payload exists, or when the wait runs out.
   *
   * Colonist's first request is answered 403 and retried, so a fixed sleep
   * races the retry; callers should await this instead.
   */
  whenReady(timeoutMs?: number): Promise<boolean>;
  /** The parsed payload, defaulting to the first successful one. */
  data(index?: number): unknown;
  /** Save a payload to the browser's download folder. Returns the filename. */
  save(index?: number): string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...Array.from(bytes.subarray(offset, offset + chunkSize))
    );
  }
  return window.btoa(binary);
}

function isReplayUrl(value: string): boolean {
  try {
    return new URL(value, window.location.href).pathname.startsWith(
      REPLAY_PATH
    );
  } catch {
    return false;
  }
}

/** Origin + pathname only, matching the transport hook's convention. */
function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value, window.location.href);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return value.split(/[?#]/, 1)[0].slice(0, 2_000);
  }
}

/**
 * gameId names the record and playerColor records which seat's link produced
 * it, so both are read off the query string before it is dropped. The seat does
 * not change what the payload reveals — every hand is in there either way — but
 * it is worth keeping to show where a file came from.
 */
function identify(value: string): {
  gameId: string | null;
  playerColor: number | null;
} {
  try {
    const params = new URL(value, window.location.href).searchParams;
    const gameId = params.get('gameId');
    const raw = params.get('playerColor');
    const playerColor = raw === null ? null : Number(raw);
    return {
      gameId: gameId && gameId.length <= 64 ? gameId : null,
      playerColor:
        playerColor !== null && Number.isSafeInteger(playerColor)
          ? playerColor
          : null,
    };
  } catch {
    return { gameId: null, playerColor: null };
  }
}

const captures: ReplayCapture[] = [];
const waiters: Array<() => void> = [];
let nextCaptureId = 0;

function successful(): ReplayCapture | undefined {
  return captures.find(capture => capture.status === 200);
}

function decodeText(capture: ReplayCapture): string {
  const binary = window.atob(capture.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function bridge(capture: ReplayCapture): void {
  const captureId = `${Date.now().toString(36)}-${nextCaptureId++}`;
  const { base64, ...meta } = capture;
  const total = Math.max(1, Math.ceil(base64.length / REPLAY_CHUNK_LENGTH));

  for (let index = 0; index < total; index++) {
    window.postMessage(
      {
        source: PAGE_REPLAY_SOURCE,
        captureId,
        index,
        total,
        chunk: base64.slice(
          index * REPLAY_CHUNK_LENGTH,
          (index + 1) * REPLAY_CHUNK_LENGTH
        ),
        // The metadata rides the last chunk, so a payload counts as whole only
        // once every byte of it has arrived.
        ...(index === total - 1 ? { meta } : {}),
      },
      window.location.origin
    );
  }
}

function deliver(capture: ReplayCapture): void {
  captures.push(capture);
  while (captures.length > MAX_RETAINED) captures.shift();

  console.info(
    `[Catan Counter] Replay ${capture.gameId ?? '?'}: status ${capture.status}, ${capture.byteLength} bytes`
  );

  bridge(capture);

  if (capture.status === 200) {
    const pending = waiters.splice(0, waiters.length);
    for (const resolve of pending) resolve();
  }
}

function record(
  rawUrl: string,
  status: number,
  contentType: string | null,
  bytes: Uint8Array
): void {
  const { gameId, playerColor } = identify(rawUrl);
  deliver({
    captureVersion: REPLAY_CAPTURE_VERSION,
    capturedAt: new Date().toISOString(),
    url: sanitizeUrl(rawUrl),
    gameId,
    playerColor,
    status,
    contentType,
    base64: bytesToBase64(bytes),
    byteLength: bytes.byteLength,
  });
}

/**
 * XHR hands back whatever shape responseType asked for, and Colonist may change
 * that; normalise every shape to bytes rather than assuming text.
 */
function bodyToBytes(request: XMLHttpRequest): Uint8Array | null {
  const body: unknown = request.response;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) {
    const view = body as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  if (typeof body === 'string') return new TextEncoder().encode(body);
  if (body === null || body === undefined) {
    try {
      // responseType 'json' leaves response null when the body did not parse;
      // responseText still holds it for the text-ish types.
      if (request.responseText) {
        return new TextEncoder().encode(request.responseText);
      }
    } catch {
      /* responseText throws for binary response types */
    }
    return null;
  }
  try {
    return new TextEncoder().encode(JSON.stringify(body));
  } catch {
    return null;
  }
}

function installPageApi(): void {
  const api: ReplayPageApi = {
    version: 1,

    meta: () =>
      captures.map((capture, index) => ({
        index,
        status: capture.status,
        byteLength: capture.byteLength,
        gameId: capture.gameId,
        playerColor: capture.playerColor,
        capturedAt: capture.capturedAt,
      })),

    ready: () => successful() !== undefined,

    whenReady: (timeoutMs = 20_000) =>
      new Promise<boolean>(resolve => {
        if (successful()) {
          resolve(true);
          return;
        }
        let settled = false;
        const done = (value: boolean) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        waiters.push(() => done(true));
        window.setTimeout(() => done(successful() !== undefined), timeoutMs);
      }),

    data(index?: number) {
      const capture = index === undefined ? successful() : captures[index];
      if (!capture) return null;
      return JSON.parse(decodeText(capture));
    },

    save(index?: number) {
      const capture = index === undefined ? successful() : captures[index];
      if (!capture) throw new Error('No replay payload has been captured yet');

      const name = `colonist-replay-${capture.gameId ?? 'unknown'}.json`;
      const blob = new Blob([decodeText(capture)], {
        type: 'application/json',
      });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Give the download a turn to start before the blob goes away.
      window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
      return name;
    },
  };

  window.__catanCounterReplay = api;
}

export function installReplayHook(): void {
  if (window.__catanCounterReplayHookInstalled) return;
  window.__catanCounterReplayHookInstalled = true;

  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;
  const watched = new WeakMap<XMLHttpRequest, string>();

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ): void {
    const raw = String(url);
    if (isReplayUrl(raw)) watched.set(this, raw);
    // The remaining arguments are optional and positional; pass them through
    // untouched rather than reconstructing the overload set.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (nativeOpen as any).call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (
    body?: Document | XMLHttpRequestBodyInit | null
  ): void {
    const raw = watched.get(this);
    if (raw) {
      this.addEventListener('load', () => {
        try {
          const bytes = bodyToBytes(this);
          if (bytes) {
            record(
              raw,
              this.status,
              this.getResponseHeader('content-type'),
              bytes
            );
          }
        } catch (error) {
          console.warn('[Catan Counter] Replay capture failed:', error);
        }
      });
    }
    return nativeSend.call(this, body ?? null);
  };

  const nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    window.fetch = function (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const raw =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const response = nativeFetch.call(window, input, init);
      if (isReplayUrl(String(raw))) {
        void response
          .then(result =>
            // Clone, so Colonist still gets to read its own body.
            result
              .clone()
              .arrayBuffer()
              .then(buffer =>
                record(
                  String(raw),
                  result.status,
                  result.headers.get('content-type'),
                  new Uint8Array(buffer)
                )
              )
          )
          .catch(() => {
            /* a request that failed is not a capture */
          });
      }
      return response;
    };
  }

  installPageApi();
  console.info('[Catan Counter] Replay capture installed');
}
