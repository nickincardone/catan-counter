/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest } from '@jest/globals';

/**
 * The module resolves its base once at import, so each case needs a fresh
 * module registry with `chrome` already in whatever state is being tested.
 */
async function loadWith(runtime: unknown): Promise<{
  assetUrl: (path: string) => string;
  hasBase: () => boolean;
}> {
  let mod!: typeof import('../ui/assetUrl');
  await jest.isolateModulesAsync(async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = runtime;
    mod = await import('../ui/assetUrl');
  });
  return { assetUrl: mod.assetUrl, hasBase: mod._hasExtensionBaseForTesting };
}

const EXT = 'chrome-extension://abcdefghijklmnop/';

describe('resolving extension assets', () => {
  it('builds an absolute URL from the extension base', async () => {
    const { assetUrl } = await loadWith({
      runtime: { getURL: (p: string) => EXT + p },
    });
    expect(assetUrl('assets/tree.svg')).toBe(`${EXT}assets/tree.svg`);
  });

  it('keeps working after the extension context is invalidated', async () => {
    // Reloading the extension leaves an open page's content script with a
    // getURL that throws. The base was captured while it still worked, and the
    // files are still at those URLs, so icons must keep loading.
    let live = true;
    const { assetUrl } = await loadWith({
      runtime: {
        getURL: (p: string) => {
          if (!live) throw new Error('Extension context invalidated.');
          return EXT + p;
        },
      },
    });

    live = false;
    expect(assetUrl('assets/knight.svg')).toBe(`${EXT}assets/knight.svg`);
  });

  it('never returns a relative path when a base exists', async () => {
    // A relative path resolves against colonist.io and 404s, which is what
    // turned every icon into its alt text.
    const { assetUrl } = await loadWith({
      runtime: { getURL: (p: string) => EXT + p },
    });
    for (const file of ['assets/ore.svg', 'assets/vp.svg']) {
      expect(assetUrl(file).startsWith('chrome-extension://')).toBe(true);
    }
  });

  it('falls back outside the extension, and says so once', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { assetUrl, hasBase } = await loadWith(undefined);

    expect(hasBase()).toBe(false);
    expect(assetUrl('assets/tree.svg')).toBe('assets/tree.svg');
    assetUrl('assets/ore.svg');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('treats an empty base as no base rather than building a relative URL', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { hasBase } = await loadWith({ runtime: { getURL: () => '' } });
    expect(hasBase()).toBe(false);
    warn.mockRestore();
  });
});
