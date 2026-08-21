/**
 * Types and bridge code for capturing Colonist's replay payload.
 *
 * A replay is not played over the WebSocket the live game uses. Colonist
 * requests the whole game in one shot:
 *
 *     GET /api/replay/data-from-game-id?gameId=<id>&playerColor=<seat>
 *
 * and it is an XMLHttpRequest, not fetch. That request can only be observed as
 * the page makes it: asking for the same URL again from page script is refused
 * by Cloudflare with 403 and `cf-mitigated: token`, so there is no re-fetching
 * it later and no fetching it from the extension's own world. The MAIN-world
 * hook in pageReplayHook.ts therefore tees the response at document_start, and
 * this module validates what crosses the postMessage boundary.
 *
 * Payloads are far larger than a chat line, so they cross in chunks and are
 * reassembled here.
 */

export const PAGE_REPLAY_SOURCE = 'catan-counter-page-replay-v1';
export const REPLAY_CAPTURE_VERSION = 1 as const;

/** postMessage copies structured data; keep each hop modest. */
export const REPLAY_CHUNK_LENGTH = 262_144;

/** Refuse a payload large enough to suggest something other than a replay. */
const MAX_REPLAY_DATA_LENGTH = 32 * 1024 * 1024;

export interface ReplayCapture {
  captureVersion: typeof REPLAY_CAPTURE_VERSION;
  capturedAt: string;
  /** Origin + pathname only, matching the transport hook's convention. */
  url: string;
  gameId: string | null;
  /** Seat the replay was requested from, which fixes whose hand is visible. */
  playerColor: number | null;
  status: number;
  contentType: string | null;
  /** Base64 of the raw response bytes, before any format is assumed. */
  base64: string;
  byteLength: number;
}

export interface ReplayChunkEnvelope {
  source: typeof PAGE_REPLAY_SOURCE;
  /** Unique per captured response, so interleaved payloads cannot merge. */
  captureId: string;
  index: number;
  total: number;
  chunk: string;
  /** Present on the final chunk only; the base64 field arrives empty. */
  meta?: Omit<ReplayCapture, 'base64'>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Validate one untrusted chunk from the page's MAIN world. Colonist can post
 * to the same window, so nothing here may be taken on trust.
 */
export function parseReplayChunk(value: unknown): ReplayChunkEnvelope | null {
  if (!isRecord(value) || value.source !== PAGE_REPLAY_SOURCE) return null;
  if (typeof value.captureId !== 'string' || value.captureId.length > 200)
    return null;
  if (
    typeof value.index !== 'number' ||
    !Number.isSafeInteger(value.index) ||
    value.index < 0
  )
    return null;
  if (
    typeof value.total !== 'number' ||
    !Number.isSafeInteger(value.total) ||
    value.total <= 0 ||
    value.index >= value.total
  )
    return null;
  if (
    typeof value.chunk !== 'string' ||
    value.chunk.length > REPLAY_CHUNK_LENGTH * 2
  )
    return null;

  if (value.meta !== undefined) {
    const meta = value.meta;
    if (!isRecord(meta)) return null;
    if (meta.captureVersion !== REPLAY_CAPTURE_VERSION) return null;
    if (typeof meta.capturedAt !== 'string') return null;
    if (typeof meta.url !== 'string' || meta.url.length > 2_000) return null;
    if (
      meta.gameId !== null &&
      (typeof meta.gameId !== 'string' || meta.gameId.length > 64)
    )
      return null;
    if (
      meta.playerColor !== null &&
      (typeof meta.playerColor !== 'number' ||
        !Number.isSafeInteger(meta.playerColor))
    )
      return null;
    if (typeof meta.status !== 'number') return null;
    if (
      meta.contentType !== null &&
      (typeof meta.contentType !== 'string' || meta.contentType.length > 200)
    )
      return null;
    if (
      typeof meta.byteLength !== 'number' ||
      !Number.isSafeInteger(meta.byteLength) ||
      meta.byteLength < 0 ||
      meta.byteLength > MAX_REPLAY_DATA_LENGTH
    )
      return null;
  }

  return value as unknown as ReplayChunkEnvelope;
}

/**
 * Collect chunks until a payload is whole.
 *
 * The final chunk carries the metadata, so a payload is only complete once
 * every index has arrived AND the metadata has: a capture missing either is
 * still in flight, not broken.
 */
export class ReplayAssembler {
  private readonly pending = new Map<
    string,
    { chunks: Array<string | undefined>; meta?: Omit<ReplayCapture, 'base64'> }
  >();

  /** Returns the finished capture on the chunk that completes it. */
  accept(envelope: ReplayChunkEnvelope): ReplayCapture | null {
    let entry = this.pending.get(envelope.captureId);
    if (!entry) {
      entry = { chunks: new Array(envelope.total).fill(undefined) };
      this.pending.set(envelope.captureId, entry);
    }
    if (entry.chunks.length !== envelope.total) return null;

    entry.chunks[envelope.index] = envelope.chunk;
    if (envelope.meta) entry.meta = envelope.meta;

    if (!entry.meta) return null;
    if (entry.chunks.some(chunk => chunk === undefined)) return null;

    this.pending.delete(envelope.captureId);
    return { ...entry.meta, base64: entry.chunks.join('') };
  }
}

/** Start the isolated-world half of the bridge. */
export function startReplayCaptureBridge(
  onCapture: (capture: ReplayCapture) => void
): () => void {
  const assembler = new ReplayAssembler();

  const listener = (event: MessageEvent<unknown>) => {
    if (event.source !== window || event.origin !== window.location.origin)
      return;
    const envelope = parseReplayChunk(event.data);
    if (!envelope) return;
    const capture = assembler.accept(envelope);
    if (capture) onCapture(capture);
  };

  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
