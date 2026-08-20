// uiMode.ts
// Which user interface the extension renders. v1 is the original floating
// overlay; v2 is the gutter layout. The choice lives in chrome.storage so the
// popup can change it from outside the page, and so it survives a refresh.

export type UiMode = 'v1' | 'v2';

/**
 * The gutter interface is what the extension shows unless someone has chosen
 * otherwise. The overlay stays available from the popup.
 */
export const DEFAULT_UI_MODE: UiMode = 'v2';
export const UI_MODE_STORAGE_KEY = 'catanUiMode';

// Minimal typing for the pieces of the extension API we use — the project
// doesn't depend on @types/chrome, and `chrome` is undefined under Jest/jsdom.
declare const chrome:
  | {
      storage?: {
        local: {
          get(keys: string | string[] | null): Promise<Record<string, unknown>>;
          set(items: Record<string, unknown>): Promise<void>;
        };
        onChanged?: {
          addListener(
            listener: (
              changes: Record<string, { newValue?: unknown }>,
              areaName: string
            ) => void
          ): void;
          removeListener(listener: (...args: never[]) => void): void;
        };
      };
    }
  | undefined;

export function isUiMode(value: unknown): value is UiMode {
  return value === 'v1' || value === 'v2';
}

function storageAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.storage?.local;
}

/** Read the stored mode, falling back to the default on anything unexpected. */
export async function readUiMode(): Promise<UiMode> {
  if (!storageAvailable()) return DEFAULT_UI_MODE;
  try {
    const stored = await chrome!.storage!.local.get(UI_MODE_STORAGE_KEY);
    const value = stored[UI_MODE_STORAGE_KEY];
    return isUiMode(value) ? value : DEFAULT_UI_MODE;
  } catch (error) {
    console.warn('🎛️ Could not read the stored UI mode:', error);
    return DEFAULT_UI_MODE;
  }
}

export async function writeUiMode(mode: UiMode): Promise<void> {
  if (!storageAvailable()) return;
  try {
    await chrome!.storage!.local.set({ [UI_MODE_STORAGE_KEY]: mode });
  } catch (error) {
    console.warn('🎛️ Could not store the UI mode:', error);
  }
}

/**
 * Watch for mode changes made elsewhere (the popup). Returns an unsubscribe
 * function. Colonist hands your seat to a bot if the page reloads mid-game, so
 * the switch has to apply live rather than asking for a refresh.
 */
export function subscribeUiMode(onChange: (mode: UiMode) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>): void => {
    const change = changes[UI_MODE_STORAGE_KEY];
    if (change && isUiMode(change.newValue)) onChange(change.newValue);
  };

  if (typeof chrome === 'undefined' || !chrome?.storage?.onChanged) {
    return () => undefined;
  }
  chrome.storage.onChanged.addListener(listener);
  return () => chrome!.storage!.onChanged!.removeListener(listener as never);
}
