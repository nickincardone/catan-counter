/**
 * @jest-environment jsdom
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  REPLAY_STORAGE_PREFIX,
  buildReplayBundle,
  captureToText,
  clearStoredReplays,
  listStoredReplays,
  storeReplayCapture,
} from '../replayStore';
import { REPLAY_CAPTURE_VERSION, type ReplayCapture } from '../replayCapture';

/** A stand-in for chrome.storage.local, backed by a plain object. */
function installStorage(): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: async (keys: string | string[] | null) => {
          if (keys === null) return { ...data };
          const list = Array.isArray(keys) ? keys : [keys];
          const out: Record<string, unknown> = {};
          for (const key of list) if (key in data) out[key] = data[key];
          return out;
        },
        set: async (items: Record<string, unknown>) => {
          Object.assign(data, items);
        },
        remove: async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys])
            delete data[key];
        },
      },
    },
  };
  return data;
}

/**
 * Base64 of the UTF-8 bytes, which is what the hook actually produces: it
 * encodes what came off the network, not a JavaScript string. Going through
 * btoa on the string instead would quietly mangle any non-ASCII, and colonist
 * usernames and chat are full of it.
 */
function bodyToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function capture(
  body: unknown,
  overrides: Partial<ReplayCapture> = {}
): ReplayCapture {
  const text = JSON.stringify(body);
  return {
    captureVersion: REPLAY_CAPTURE_VERSION,
    capturedAt: '2026-08-20T00:00:00.000Z',
    url: 'https://colonist.io/api/replay/data-from-game-id',
    gameId: '251323211',
    playerColor: 5,
    status: 200,
    contentType: 'application/json',
    base64: bodyToBase64(text),
    byteLength: new TextEncoder().encode(text).length,
    ...overrides,
  };
}

let store: Record<string, unknown>;
beforeEach(() => {
  store = installStorage();
});

describe('deciding what is worth keeping', () => {
  it('keeps a successful capture', async () => {
    expect(await storeReplayCapture(capture({ ok: 1 }))).toBe('stored');
    expect(Object.keys(store)).toEqual([`${REPLAY_STORAGE_PREFIX}251323211`]);
  });

  it('ignores the 403 Colonist answers before it retries', async () => {
    const failed = capture(
      {},
      { status: 403, byteLength: 0, base64: '', gameId: '251323211' }
    );
    expect(await storeReplayCapture(failed)).toBe('ignored');
    expect(Object.keys(store)).toHaveLength(0);
  });

  it('ignores a capture that names no game, since it could not be filed', async () => {
    expect(await storeReplayCapture(capture({ ok: 1 }, { gameId: null }))).toBe(
      'ignored'
    );
    expect(Object.keys(store)).toHaveLength(0);
  });

  it('refreshes a game rather than storing it twice', async () => {
    await storeReplayCapture(capture({ take: 1 }));
    expect(await storeReplayCapture(capture({ take: 2 }))).toBe('replaced');

    expect(await listStoredReplays()).toHaveLength(1);
    const bundle = await buildReplayBundle();
    expect(bundle.replays[0].payload).toEqual({ take: 2 });
  });
});

describe('listing what is held', () => {
  it('reports each game without carrying its payload', async () => {
    await storeReplayCapture(capture({ a: 1 }));
    await storeReplayCapture(
      capture({ b: 2 }, { gameId: '999', playerColor: 1 })
    );

    const listed = await listStoredReplays();
    expect(listed.map(r => r.gameId).sort()).toEqual(['251323211', '999']);
    expect(listed.every(r => !('json' in r))).toBe(true);
  });

  it('orders by when each was captured', async () => {
    await storeReplayCapture(
      capture({}, { gameId: 'b', capturedAt: '2026-08-20T02:00:00.000Z' })
    );
    await storeReplayCapture(
      capture({}, { gameId: 'a', capturedAt: '2026-08-20T01:00:00.000Z' })
    );
    expect((await listStoredReplays()).map(r => r.gameId)).toEqual(['a', 'b']);
  });
});

describe('exporting a harvest', () => {
  it('puts every game in one bundle', async () => {
    await storeReplayCapture(capture({ n: 1 }, { gameId: 'a' }));
    await storeReplayCapture(capture({ n: 2 }, { gameId: 'b' }));

    const bundle = await buildReplayBundle();
    expect(bundle.count).toBe(2);
    expect(bundle.replays.map(r => r.payload)).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('skips an entry that no longer parses instead of losing the harvest', async () => {
    await storeReplayCapture(capture({ good: true }, { gameId: 'a' }));
    // Corrupt one entry in place, as a truncated write would.
    store[`${REPLAY_STORAGE_PREFIX}b`] = {
      gameId: 'b',
      playerColor: null,
      capturedAt: '2026-08-20T03:00:00.000Z',
      byteLength: 5,
      json: '{not json',
    };

    const bundle = await buildReplayBundle();
    expect(bundle.count).toBe(1);
    expect(bundle.replays[0].gameId).toBe('a');
  });

  it('reports an empty harvest as empty rather than failing', async () => {
    const bundle = await buildReplayBundle();
    expect(bundle.count).toBe(0);
    expect(bundle.replays).toEqual([]);
  });
});

describe('clearing', () => {
  it('removes the replays and leaves everything else alone', async () => {
    await storeReplayCapture(capture({ n: 1 }, { gameId: 'a' }));
    await storeReplayCapture(capture({ n: 2 }, { gameId: 'b' }));
    store.catanUiMode = 'v2';

    expect(await clearStoredReplays()).toBe(2);
    expect(await listStoredReplays()).toEqual([]);
    expect(store.catanUiMode).toBe('v2');
  });
});

describe('decoding a captured body', () => {
  it('returns exactly the text Colonist sent, non-ASCII included', () => {
    // Names and chat carry accents and emoji; decoding must be UTF-8 aware
    // rather than byte-for-character.
    const body = { name: 'Grzegorz Brzęczyszczykiewicz', chat: 'gg 🎲 ünd' };
    expect(captureToText(capture(body))).toBe(JSON.stringify(body));
  });
});
