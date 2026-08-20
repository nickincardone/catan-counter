import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  DEFAULT_UI_MODE,
  isUiMode,
  readUiMode,
  writeUiMode,
  subscribeUiMode,
  UI_MODE_STORAGE_KEY,
} from '../ui/uiMode';

type Listener = (
  changes: Record<string, { newValue?: unknown }>,
  area: string
) => void;

function fakeChrome(initial: Record<string, unknown> = {}) {
  const store = { ...initial };
  const listeners: Listener[] = [];
  return {
    store,
    listeners,
    api: {
      storage: {
        local: {
          get: async (key: string) => ({ [key]: store[key] }),
          set: async (items: Record<string, unknown>) => {
            Object.assign(store, items);
          },
        },
        onChanged: {
          addListener: (fn: Listener) => listeners.push(fn),
          removeListener: (fn: Listener) => {
            const i = listeners.indexOf(fn);
            if (i >= 0) listeners.splice(i, 1);
          },
        },
      },
    },
  };
}

describe('ui mode storage', () => {
  beforeEach(() => {
    delete (globalThis as any).chrome;
  });

  it('recognizes only the two real modes', () => {
    expect(isUiMode('v1')).toBe(true);
    expect(isUiMode('v2')).toBe(true);
    expect(isUiMode('v3')).toBe(false);
    expect(isUiMode(undefined)).toBe(false);
  });

  it('falls back to the default when storage is unavailable (jsdom, tests)', async () => {
    await expect(readUiMode()).resolves.toBe(DEFAULT_UI_MODE);
    // Writing must not throw either — the popup and content script both call it.
    await expect(writeUiMode('v2')).resolves.toBeUndefined();
  });

  it('round-trips a stored mode', async () => {
    const chrome = fakeChrome();
    (globalThis as any).chrome = chrome.api;

    await writeUiMode('v2');
    expect(chrome.store[UI_MODE_STORAGE_KEY]).toBe('v2');
    await expect(readUiMode()).resolves.toBe('v2');
  });

  it('ignores a corrupt stored value rather than rendering nothing', async () => {
    (globalThis as any).chrome = fakeChrome({
      [UI_MODE_STORAGE_KEY]: 'nonsense',
    }).api;
    await expect(readUiMode()).resolves.toBe(DEFAULT_UI_MODE);
  });

  it('survives a storage error', async () => {
    (globalThis as any).chrome = {
      storage: {
        local: {
          get: async () => {
            throw new Error('boom');
          },
          set: async () => {
            throw new Error('boom');
          },
        },
      },
    };
    await expect(readUiMode()).resolves.toBe(DEFAULT_UI_MODE);
    await expect(writeUiMode('v2')).resolves.toBeUndefined();
  });

  it('notifies subscribers when the popup changes the mode, until unsubscribed', () => {
    const chrome = fakeChrome();
    (globalThis as any).chrome = chrome.api;

    const seen: string[] = [];
    const unsubscribe = subscribeUiMode(mode => seen.push(mode));

    const fire = (value: unknown) =>
      chrome.listeners.forEach(fn =>
        fn({ [UI_MODE_STORAGE_KEY]: { newValue: value } }, 'local')
      );

    fire('v2');
    fire('bogus'); // not a mode — must not reach the subscriber
    expect(seen).toEqual(['v2']);

    unsubscribe();
    fire('v1');
    expect(seen).toEqual(['v2']);
  });

  it('subscribing is a no-op without the storage API', () => {
    expect(() => subscribeUiMode(jest.fn())()).not.toThrow();
  });
});
