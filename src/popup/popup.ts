// popup.ts
// The extension's toolbar popup: picks which interface the content script
// renders. Writing to storage is the whole mechanism — the content script
// watches the same key and swaps interfaces live, without a reload (reloading
// colonist mid-game hands your seat to a bot).

import {
  DEFAULT_UI_MODE,
  isUiMode,
  readUiMode,
  writeUiMode,
  type UiMode,
} from '../ui/uiMode.js';
import {
  buildReplayBundle,
  clearStoredReplays,
  listStoredReplays,
} from '../replayStore.js';

function paint(mode: UiMode): void {
  document
    .querySelectorAll<HTMLLabelElement>('label[data-mode]')
    .forEach(el => {
      const selected = el.dataset.mode === mode;
      el.classList.toggle('selected', selected);
      const input = el.querySelector<HTMLInputElement>('input');
      if (input) input.checked = selected;
    });
}

function setStatus(text: string): void {
  const status = document.getElementById('status');
  if (status) status.textContent = text;
}

/** Bytes, in the units a person reads. */
function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Save the whole harvest as one file.
 *
 * One download rather than one per game is the entire point: Chrome allows a
 * site a single automatic download and then blocks the rest without telling the
 * page, so a per-game save quietly loses most of a harvest. This runs on an
 * extension page, from a real click, and moves everything at once.
 */
async function exportReplays(): Promise<void> {
  const bundle = await buildReplayBundle();
  if (bundle.count === 0) {
    setStatus('Nothing to export yet.');
    return;
  }

  const stamp = bundle.exportedAt.slice(0, 10);
  const blob = new Blob([JSON.stringify(bundle)], {
    type: 'application/json',
  });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `colonist-replays-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 30_000);

  setStatus(`Exported ${bundle.count} replay${bundle.count === 1 ? '' : 's'}.`);
}

/** Show what is held, and enable the buttons only when there is something. */
async function paintReplays(): Promise<void> {
  const stored = await listStoredReplays();
  const count = document.getElementById('replay-count');
  const exportButton = document.getElementById(
    'export-replays'
  ) as HTMLButtonElement | null;
  const clearButton = document.getElementById(
    'clear-replays'
  ) as HTMLButtonElement | null;

  const total = stored.reduce((sum, replay) => sum + replay.byteLength, 0);
  if (count) {
    count.textContent =
      stored.length === 0
        ? 'None captured yet. Open a replay to collect one.'
        : `${stored.length} game${stored.length === 1 ? '' : 's'} held · ${readableSize(total)}`;
  }
  if (exportButton) exportButton.disabled = stored.length === 0;
  if (clearButton) clearButton.disabled = stored.length === 0;
}

async function main(): Promise<void> {
  paint(await readUiMode().catch(() => DEFAULT_UI_MODE));

  document.getElementById('modes')?.addEventListener('change', event => {
    const value = (event.target as HTMLInputElement | null)?.value;
    if (!isUiMode(value)) return;
    paint(value);
    void writeUiMode(value).then(() => {
      setStatus('Applied to any open colonist.io tab.');
    });
  });

  await paintReplays();

  document.getElementById('export-replays')?.addEventListener('click', () => {
    void exportReplays();
  });

  document.getElementById('clear-replays')?.addEventListener('click', () => {
    void clearStoredReplays().then(async removed => {
      await paintReplays();
      setStatus(`Cleared ${removed} replay${removed === 1 ? '' : 's'}.`);
    });
  });
}

void main();
