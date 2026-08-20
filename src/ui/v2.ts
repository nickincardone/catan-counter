// v2.ts
// The gutter interface: a shell that frames the page, and sections that fill
// it. This module is the only place that connects a user action in a section
// back to the tracker — sections themselves emit intents and nothing more.

import { game } from '../gameState.js';
import { showYouPlayerDialog as showV1YouPlayerDialog } from '../overlay.js';
import { Shell } from './shell/shell.js';
import './sections/index.js';
import type { SectionAction } from './sections/types.js';
import type { UiImpl } from './uiImpl.js';

const shell = new Shell({
  onAction: handleAction,
});

function handleAction(action: SectionAction): void {
  switch (action.type) {
    case 'resolve-steal':
      game.probableGameState.resolveUnknownTransaction(
        action.id,
        action.resource
      );
      break;
    case 'undo-steal':
      game.probableGameState.unresolveUnknownTransaction(action.id);
      break;
    default: {
      const exhaustive: never = action;
      console.warn('🎛️ Unhandled section action:', exhaustive);
      return;
    }
  }
  // The tracker's beliefs just changed; every section reads from the same view.
  shell.update();
}

export const v2Ui: UiImpl = {
  mount: () => shell.mount(),
  unmount: () => shell.unmount(),
  update: () => shell.update(),
  setHistoryLoading: loading => shell.setHistoryLoading(loading),
  // The seat-picker is a modal rather than a gutter, and v1's works in either
  // mode. Giving it a v2 treatment is deliberately left for later.
  showYouPlayerDialog: showV1YouPlayerDialog,
};

export { shell as v2Shell };
