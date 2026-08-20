// v1Adapter.ts
// Wraps the original overlay in the UiImpl contract. overlay.ts is deliberately
// left untouched by the v2 work — it is the shipping interface, and the adapter
// is the only thing that knows its shape.

import {
  showGameStateOverlay,
  hideGameStateOverlay,
  updateGameStateDisplay,
  setHistoryLoading,
  showYouPlayerDialog,
} from '../overlay.js';
import type { UiImpl } from './uiImpl.js';

export const v1Ui: UiImpl = {
  mount: showGameStateOverlay,
  unmount: hideGameStateOverlay,
  update: updateGameStateDisplay,
  setHistoryLoading,
  showYouPlayerDialog,
};
