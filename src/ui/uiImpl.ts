// uiImpl.ts
// The contract both interfaces implement. The router (./index.ts) talks only to
// this, so v1 and v2 stay independent of each other.

export interface UiImpl {
  /** Create and show the interface. */
  mount(): void;
  /** Remove it and undo anything it did to the page. Must leave no residue. */
  unmount(): void;
  /** Re-render from current game state. */
  update(): void;
  /** Show or hide the "rebuilding history" state. */
  setHistoryLoading(loading: boolean, error?: string): void;
  /** Ask the player which seat is theirs. */
  showYouPlayerDialog(): void;
}
