// messageOrderBuffer.ts
// Guarantees chat rows are handed to the parser in strict data-index order.
//
// The parser's dedup (game.chatsProcessed) is a monotonic high-water mark, so
// processing row 244 before rows 68–243 locks the earlier rows out FOREVER —
// this is why dice/resource stats never caught up after a reconnect, where
// colonist's virtual scroller can render the bottom of the chat before the
// history sweep has covered the middle. This buffer captures rows in whatever
// order they render and only feeds the parser the contiguous prefix; rows
// after a gap wait until the gap fills (or until flush() gives up on it).
//
// Rows are captured as deep clones: virtual scrollers recycle DOM nodes, so a
// held reference may be rewritten to show a different message by the time the
// gap before it fills.

/**
 * A row that carries nothing: no text, no icons.
 *
 * Two very different things look like this. A turn separator, which colonist
 * renders between turns and never fills because there is nothing to put in it;
 * and a row the virtual scroller has minted but not yet filled in. They are
 * told apart by circumstance rather than by looks — see drain().
 */
export function isEmptyChatRow(element: HTMLElement): boolean {
  return !element.textContent?.trim() && element.querySelector('img') === null;
}

export class MessageOrderBuffer {
  private pending = new Map<number, HTMLElement>();
  private lastProcessed = -1;

  /**
   * @param processRow  hand a row to the parser.
   * @param resolveRow  look an index up in the live chat, so drain can tell a
   *   gap that will never close from one that simply has not arrived. Optional:
   *   without it the buffer behaves as it always did and waits for every gap.
   */
  constructor(
    private processRow: (element: HTMLElement) => void,
    private resolveRow?: (index: number) => HTMLElement | null
  ) {}

  /**
   * Buffer one rendered chat row. Safe to call repeatedly with the same row
   * (dedups by data-index); rows at or below the high-water mark are ignored.
   */
  capture(element: HTMLElement): void {
    const dataIndexAttr = element.getAttribute('data-index');
    if (dataIndexAttr === null) return;
    const index = parseInt(dataIndexAttr, 10);
    if (isNaN(index) || index <= this.lastProcessed || this.pending.has(index))
      return;
    this.pending.set(index, element.cloneNode(true) as HTMLElement);
  }

  /**
   * Process the contiguous run of buffered rows starting right after the last
   * processed index. Returns how many were processed.
   *
   * A gap stops it, unless the live chat can account for the missing index:
   *
   *  - the row is on screen and carries nothing, and something later is already
   *    waiting. The scroller has rendered past it, so it is a turn separator
   *    and there is nothing to read. Step over it.
   *  - the row is on screen with content the observer never handed over, which
   *    happens when the scroller replaces a subtree wholesale. Read it now.
   *  - the row is not on screen at all. Its message may still be coming, so
   *    wait, and let the blocked flush give up on it eventually.
   *
   * The "something later is waiting" condition is what keeps this safe. An
   * unfilled row is only stepped over when a message after it has already
   * arrived, and it is re-checked against the DOM at that moment rather than
   * assumed from when it was first seen.
   */
  drain(): number {
    let count = 0;
    for (;;) {
      const next = this.lastProcessed + 1;

      const buffered = this.pending.get(next);
      if (buffered) {
        this.pending.delete(next);
        this.lastProcessed = next;
        this.processRow(buffered);
        count++;
        continue;
      }

      if (!this.resolveRow || this.pending.size === 0) break;
      const element = this.resolveRow(next);
      if (!element) break;

      this.lastProcessed = next;
      if (isEmptyChatRow(element)) continue;
      this.processRow(element.cloneNode(true) as HTMLElement);
      count++;
    }
    return count;
  }

  /**
   * Process everything still buffered in ascending order, accepting gaps.
   * Call once history loading has done its best — rows lost to a gap can't be
   * recovered, but everything captured after the gap still counts.
   */
  flush(): number {
    const indices = Array.from(this.pending.keys()).sort((a, b) => a - b);
    for (const index of indices) {
      const element = this.pending.get(index)!;
      this.pending.delete(index);
      this.lastProcessed = Math.max(this.lastProcessed, index);
      this.processRow(element);
    }
    return indices.length;
  }

  /** True when captured rows are stuck behind a gap (drain can't reach them). */
  hasPending(): boolean {
    return this.pending.size > 0;
  }
}
