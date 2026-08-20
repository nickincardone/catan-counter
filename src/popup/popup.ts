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
}

void main();
