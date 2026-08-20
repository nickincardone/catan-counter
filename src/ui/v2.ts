// v2.ts
// The gutter interface. Placeholder shell for now — the layout engine and
// sections land in later phases; this proves mode switching mounts and unmounts
// cleanly against a live game.

import type { UiImpl } from './uiImpl.js';

const ROOT_ID = 'catan-v2-root';

let root: HTMLDivElement | null = null;

function mount(): void {
  if (root) return;
  root = document.createElement('div');
  root.id = ROOT_ID;
  root.style.cssText = [
    'position: fixed',
    'left: 0',
    'top: 0',
    'bottom: 0',
    'width: 290px',
    'background: #0f2c46',
    'color: #dbe6ee',
    'font: 12px/1.4 system-ui, sans-serif',
    'padding: 12px',
    'z-index: 2147483646',
  ].join('; ');
  root.textContent = 'Catan Counter v2 — gutter UI under construction';
  document.documentElement.appendChild(root);
}

function unmount(): void {
  root?.remove();
  root = null;
}

export const v2Ui: UiImpl = {
  mount,
  unmount,
  update: () => undefined,
  setHistoryLoading: () => undefined,
  showYouPlayerDialog: () => undefined,
};
