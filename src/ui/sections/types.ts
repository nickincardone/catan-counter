// sections/types.ts
// The contract every block of the v2 UI implements.
//
// The rules that keep a section movable, all of which the framework relies on:
//
//  1. It renders only inside the host element it is handed. No document.body,
//     no position: fixed, no ids — class names are scoped by the shadow root.
//  2. It never reads its own position. If it must adapt, it adapts to the shape
//     it was given (`axis`), not to "am I the left rail".
//  3. Interaction is delegated from the host with data attributes, so a full
//     re-render can never orphan a handler.
//  4. All mutation leaves through ctx.emit. A section never touches the tracker.

import type { GameView, ResourceKey } from '../view/types.js';

/** Re-exported so a section can narrow a data attribute without reaching into
 * the view model's module for a type. */
export type ResourceKeyLike = ResourceKey;

export type SectionId =
  | 'hands'
  | 'unknown-steals'
  | 'card-flow'
  | 'card-flow-ledger'
  | 'blocked-robber'
  | 'dice'
  | 'dev-deck'
  | 'players';

/** A gutter is either a tall column or a wide strip. */
export type GutterAxis = 'vertical' | 'horizontal';

export type SectionAction =
  | { type: 'resolve-steal'; id: string; resource: ResourceKey }
  | { type: 'undo-steal'; id: string };

export interface SectionContext {
  /** Which way the containing gutter runs. */
  axis: GutterAxis;
  /** Resolve a bundled asset to a URL usable inside the page. */
  assetUrl(path: string): string;
  /** Report a user intent. What happens next is the shell's business. */
  emit(action: SectionAction): void;
}

export interface SectionInstance {
  update(view: GameView): void;
  destroy(): void;
}

export interface SectionDefinition {
  id: SectionId;
  /** Human name, used by diagnostics and any future arrangement UI. */
  title: string;
  /** Gutter shapes this section can be read in. */
  supports: GutterAxis[];
  /** Below this it is illegible, so the shell refuses to place it. */
  min: { width: number; height: number };
  /**
   * CSS for this section, scoped by the shadow root. It lives with the section
   * rather than in a global sheet so that moving a section moves its styles too.
   */
  styles?: string;
  mount(
    host: HTMLElement,
    view: GameView,
    ctx: SectionContext
  ): SectionInstance;
}
