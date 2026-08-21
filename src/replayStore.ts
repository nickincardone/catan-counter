// replayStore.ts
// Keeps captured replays in extension storage until they are exported.
//
// The point is to make harvesting survive Chrome's download rules. Saving one
// file per game means one download per game, and a site only gets a single
// automatic download before Chrome starts blocking the rest — silently, from
// the page's side, so a harvest can report success while nothing reaches disk.
// Accumulating here instead turns any number of games into ONE download,
// triggered from the popup, which is an extension page rather than colonist.io
// and is a real click rather than a script.
//
// Games are keyed by id, so revisiting a replay refreshes it rather than
// storing it twice. The manifest asks for unlimitedStorage, which matters:
// replays are around 200 KB each and the default quota is 5 MB.

import type { ReplayCapture } from './replayCapture.js';

export const REPLAY_STORAGE_PREFIX = 'catanReplay:';
export const REPLAY_BUNDLE_VERSION = 1 as const;

/** One stored replay. `json` is the response body, untouched. */
export interface StoredReplay {
  gameId: string;
  playerColor: number | null;
  capturedAt: string;
  byteLength: number;
  json: string;
}

/** A stored replay without its payload, for listing. */
export type StoredReplaySummary = Omit<StoredReplay, 'json'>;

/** What an export writes out. */
export interface ReplayBundle {
  bundleVersion: typeof REPLAY_BUNDLE_VERSION;
  exportedAt: string;
  count: number;
  replays: Array<{
    gameId: string;
    playerColor: number | null;
    capturedAt: string;
    /** The replay payload, parsed. */
    payload: unknown;
  }>;
}

// Minimal typing for the pieces of the extension API we use — the project
// doesn't depend on @types/chrome, and `chrome` is undefined under Jest/jsdom.
declare const chrome:
  | {
      storage?: {
        local: {
          get(keys: string | string[] | null): Promise<Record<string, unknown>>;
          set(items: Record<string, unknown>): Promise<void>;
          remove(keys: string | string[]): Promise<void>;
        };
      };
    }
  | undefined;

function storageAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.storage?.local;
}

function isStoredReplay(value: unknown): value is StoredReplay {
  const replay = value as StoredReplay | null;
  return (
    !!replay &&
    typeof replay.gameId === 'string' &&
    typeof replay.capturedAt === 'string' &&
    typeof replay.json === 'string' &&
    typeof replay.byteLength === 'number'
  );
}

/** Decode a capture's base64 body back into the text Colonist sent. */
export function captureToText(capture: ReplayCapture): string {
  const binary = atob(capture.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

export type StoreOutcome = 'stored' | 'replaced' | 'ignored';

/**
 * Keep a capture, if it is one worth keeping.
 *
 * Colonist's first request for a replay is answered 403 and retried, so most
 * page loads produce a failure alongside the real thing; only the successful
 * one is worth storing, and only if it names a game.
 */
export async function storeReplayCapture(
  capture: ReplayCapture
): Promise<StoreOutcome> {
  if (capture.status !== 200 || !capture.gameId || capture.byteLength === 0) {
    return 'ignored';
  }
  if (!storageAvailable()) return 'ignored';

  const key = REPLAY_STORAGE_PREFIX + capture.gameId;
  try {
    const existing = await chrome!.storage!.local.get(key);
    const replaced = isStoredReplay(existing[key]);

    const record: StoredReplay = {
      gameId: capture.gameId,
      playerColor: capture.playerColor,
      capturedAt: capture.capturedAt,
      byteLength: capture.byteLength,
      json: captureToText(capture),
    };
    await chrome!.storage!.local.set({ [key]: record });
    return replaced ? 'replaced' : 'stored';
  } catch (error) {
    console.warn('📼 Could not store the replay:', error);
    return 'ignored';
  }
}

async function readAll(): Promise<StoredReplay[]> {
  if (!storageAvailable()) return [];
  try {
    const all = await chrome!.storage!.local.get(null);
    return Object.entries(all)
      .filter(([key]) => key.startsWith(REPLAY_STORAGE_PREFIX))
      .map(([, value]) => value)
      .filter(isStoredReplay)
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  } catch (error) {
    console.warn('📼 Could not read stored replays:', error);
    return [];
  }
}

/** Everything held, without the payloads. */
export async function listStoredReplays(): Promise<StoredReplaySummary[]> {
  return (await readAll()).map(({ json: _json, ...summary }) => summary);
}

/**
 * Everything held, as one bundle.
 *
 * A replay whose stored text no longer parses is left out rather than allowed
 * to break the export — one bad entry should not cost the whole harvest.
 */
export async function buildReplayBundle(): Promise<ReplayBundle> {
  const stored = await readAll();
  const replays: ReplayBundle['replays'] = [];

  for (const replay of stored) {
    try {
      replays.push({
        gameId: replay.gameId,
        playerColor: replay.playerColor,
        capturedAt: replay.capturedAt,
        payload: JSON.parse(replay.json),
      });
    } catch {
      console.warn(`📼 Stored replay ${replay.gameId} did not parse; skipping`);
    }
  }

  return {
    bundleVersion: REPLAY_BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    count: replays.length,
    replays,
  };
}

/** Forget every stored replay. Returns how many were removed. */
export async function clearStoredReplays(): Promise<number> {
  if (!storageAvailable()) return 0;
  try {
    const all = await chrome!.storage!.local.get(null);
    const keys = Object.keys(all).filter(key =>
      key.startsWith(REPLAY_STORAGE_PREFIX)
    );
    if (keys.length > 0) await chrome!.storage!.local.remove(keys);
    return keys.length;
  } catch (error) {
    console.warn('📼 Could not clear stored replays:', error);
    return 0;
  }
}
