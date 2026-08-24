/**
 * @jest-environment jsdom
 *
 * How long a message waits before the interface knows about it.
 *
 * The view is fast (see performance.test.ts), so a visible delay after a roll
 * is not rendering — it is the message sitting in the order buffer. Rows must
 * reach the parser in data-index order, because its duplicate check is a
 * monotonic high-water mark, so anything after a gap waits for the gap.
 *
 * Colonist's chat carries a separator row at every turn boundary: no text, no
 * icons, and it never fills, because there is nothing to put in it. That is a
 * gap that never closes, so every message after it waits out the blocked-flush
 * timer instead of being read when it arrives.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MessageOrderBuffer } from '../messageOrderBuffer';

function row(index: number, text: string): HTMLElement {
  const node = document.createElement('div');
  node.setAttribute('data-index', String(index));
  node.innerHTML = `<span>${text}</span>`;
  return node;
}

/** A turn separator: rendered, but carrying nothing and never filled. */
function separator(index: number): HTMLElement {
  const node = document.createElement('div');
  node.setAttribute('data-index', String(index));
  return node;
}

function isEmpty(element: HTMLElement): boolean {
  return !element.textContent?.trim() && element.querySelector('img') === null;
}

/** Stands in for colonist's chat container. */
function chat(): {
  container: HTMLElement;
  add: (element: HTMLElement) => void;
  resolve: (index: number) => HTMLElement | null;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return {
    container,
    add: element => container.appendChild(element),
    resolve: index =>
      container.querySelector<HTMLElement>(`[data-index="${index}"]`),
  };
}

describe('a message arriving behind a turn separator', () => {
  let processed: string[];
  beforeEach(() => {
    document.body.innerHTML = '';
    processed = [];
  });

  /** What content.ts does per row: skip the empty ones, buffer the rest. */
  function capture(buffer: MessageOrderBuffer, element: HTMLElement): void {
    if (isEmpty(element)) return;
    buffer.capture(element);
  }

  it('reaches the parser without waiting, rather than stalling behind it', () => {
    const feed = chat();
    const buffer = new MessageOrderBuffer(
      element => processed.push(element.textContent ?? ''),
      feed.resolve
    );

    // Turn 1: a roll, read straight away.
    feed.add(row(0, 'Alice rolled 6'));
    capture(buffer, feed.container.lastElementChild as HTMLElement);
    buffer.drain();
    expect(processed).toEqual(['Alice rolled 6']);

    // The turn ends: colonist renders a separator, which carries nothing.
    feed.add(separator(1));
    capture(buffer, feed.container.lastElementChild as HTMLElement);
    buffer.drain();

    // Turn 2: the roll everyone is waiting to see.
    feed.add(row(2, 'Bob got 3 sheep'));
    capture(buffer, feed.container.lastElementChild as HTMLElement);
    buffer.drain();

    // This is the whole point: no timer, no flush, no wait.
    expect(processed).toEqual(['Alice rolled 6', 'Bob got 3 sheep']);
  });

  it('still waits for a row that has not rendered at all', () => {
    const feed = chat();
    const buffer = new MessageOrderBuffer(
      element => processed.push(element.textContent ?? ''),
      feed.resolve
    );

    feed.add(row(0, 'Alice rolled 6'));
    capture(buffer, feed.container.lastElementChild as HTMLElement);
    buffer.drain();

    // Index 1 is missing from the DOM entirely — not a separator, just not
    // rendered yet. Its message may still be coming, so it must not be skipped.
    feed.add(row(2, 'Bob got 3 sheep'));
    capture(buffer, feed.container.lastElementChild as HTMLElement);
    buffer.drain();

    expect(processed).toEqual(['Alice rolled 6']);
    expect(buffer.hasPending()).toBe(true);
  });

  it('reads a row the observer missed but which is on screen', () => {
    const feed = chat();
    const buffer = new MessageOrderBuffer(
      element => processed.push(element.textContent ?? ''),
      feed.resolve
    );

    feed.add(row(0, 'Alice rolled 6'));
    capture(buffer, feed.container.lastElementChild as HTMLElement);
    buffer.drain();

    // Rendered, but never handed to capture — a mutation record can be missed
    // when the scroller replaces a subtree wholesale.
    feed.add(row(1, 'Alice got wheat'));
    feed.add(row(2, 'Bob got 3 sheep'));
    capture(buffer, feed.container.lastElementChild as HTMLElement);
    buffer.drain();

    expect(processed).toEqual([
      'Alice rolled 6',
      'Alice got wheat',
      'Bob got 3 sheep',
    ]);
  });

  it('is what separates reading a game live from waiting on a timer', () => {
    // The same 80-turn feed through both behaviours. Without gap resolution a
    // message only reaches the parser once the blocked flush fires, three
    // seconds after it arrived; with it, every message is read on arrival.
    function run(withResolver: boolean): { read: number; delayed: number } {
      document.body.innerHTML = '';
      const feed = chat();
      const seen: string[] = [];
      const buffer = new MessageOrderBuffer(
        element => seen.push(element.textContent ?? ''),
        withResolver ? feed.resolve : undefined
      );

      let index = 0;
      let delayed = 0;
      for (let turn = 0; turn < 80; turn++) {
        feed.add(separator(index));
        capture(buffer, feed.container.lastElementChild as HTMLElement);
        index++;
        for (let m = 0; m < 5; m++) {
          feed.add(row(index, `t${turn}m${m}`));
          capture(buffer, feed.container.lastElementChild as HTMLElement);
          index++;
          const before = seen.length;
          buffer.drain();
          if (seen.length === before) delayed++;
        }
      }
      return { read: seen.length, delayed };
    }

    const before = run(false);
    const after = run(true);

    // eslint-disable-next-line no-console
    console.log(
      `\n  without gap resolution : ${before.read} read on arrival, ` +
        `${before.delayed} left waiting for the 3s flush` +
        `\n  with gap resolution    : ${after.read} read on arrival, ` +
        `${after.delayed} left waiting\n`
    );

    expect(before.delayed).toBeGreaterThan(300);
    expect(after.delayed).toBe(0);
    expect(after.read).toBe(400);
  });

  it('measures how many separators a game puts in the way', () => {
    const feed = chat();
    const buffer = new MessageOrderBuffer(
      element => processed.push(element.textContent ?? ''),
      feed.resolve
    );

    // 80 turns, each a separator followed by a handful of messages.
    let index = 0;
    let stalls = 0;
    for (let turn = 0; turn < 80; turn++) {
      feed.add(separator(index));
      capture(buffer, feed.container.lastElementChild as HTMLElement);
      index++;
      for (let m = 0; m < 5; m++) {
        feed.add(row(index, `turn ${turn} message ${m}`));
        capture(buffer, feed.container.lastElementChild as HTMLElement);
        index++;
        buffer.drain();
        if (buffer.hasPending()) stalls++;
      }
    }

    // Every message read as it arrived: nothing was ever left waiting.
    expect(stalls).toBe(0);
    expect(processed).toHaveLength(80 * 5);
  });
});
