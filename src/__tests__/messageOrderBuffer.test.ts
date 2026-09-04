import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MessageOrderBuffer } from '../messageOrderBuffer';

function row(index: number, text = `msg ${index}`): HTMLElement {
  const element = document.createElement('div');
  element.setAttribute('data-index', String(index));
  element.textContent = text;
  return element;
}

describe('MessageOrderBuffer', () => {
  let processed: string[];
  let buffer: MessageOrderBuffer;

  beforeEach(() => {
    processed = [];
    buffer = new MessageOrderBuffer(element => {
      processed.push(element.getAttribute('data-index')!);
    });
  });

  it('drains contiguous rows in order regardless of capture order', () => {
    buffer.capture(row(1));
    buffer.capture(row(0));
    buffer.capture(row(2));
    expect(buffer.drain()).toBe(3);
    expect(processed).toEqual(['0', '1', '2']);
  });

  it('holds rows behind a gap until the gap fills (reconnect scenario)', () => {
    // After a reconnect the virtual scroller can render the BOTTOM of the chat
    // before the history sweep reaches the middle. The parser's monotonic
    // dedup would lock out the middle forever if row 5 were parsed first.
    buffer.capture(row(0));
    buffer.capture(row(1));
    buffer.capture(row(5)); // bottom row rendered early
    buffer.drain();
    expect(processed).toEqual(['0', '1']); // 5 waits behind the gap

    // A later sweep renders the middle rows — everything catches up, in order.
    buffer.capture(row(3));
    buffer.capture(row(4));
    buffer.capture(row(2));
    buffer.drain();
    expect(processed).toEqual(['0', '1', '2', '3', '4', '5']);
    expect(buffer.hasPending()).toBe(false);
  });

  it('flush processes remaining rows in order, accepting gaps', () => {
    buffer.capture(row(0));
    buffer.capture(row(7));
    buffer.capture(row(5));
    buffer.drain();
    expect(processed).toEqual(['0']);
    expect(buffer.flush()).toBe(2);
    expect(processed).toEqual(['0', '5', '7']);
  });

  it('never re-processes a row after flush advanced the high-water mark', () => {
    buffer.capture(row(3));
    buffer.flush();
    buffer.capture(row(3)); // scroller re-renders an old row
    buffer.capture(row(2)); // gap row appears too late — must stay locked out
    buffer.drain();
    buffer.flush();
    expect(processed).toEqual(['3']);
  });

  it('captures a clone, so later mutation of the live node is harmless', () => {
    const liveRow = row(0, 'original');
    buffer.capture(liveRow);
    // Virtual scrollers recycle DOM nodes: the live node may be rewritten to
    // show a different message before the buffer gets to process it.
    liveRow.textContent = 'recycled by the virtual scroller';
    liveRow.setAttribute('data-index', '9');
    buffer.drain();
    expect(processed).toEqual(['0']);
  });

  it('ignores elements without a data-index', () => {
    buffer.capture(document.createElement('div'));
    expect(buffer.drain()).toBe(0);
    expect(buffer.hasPending()).toBe(false);
  });

  it('dedups repeated captures of the same index', () => {
    const spy = jest.fn();
    const b = new MessageOrderBuffer(spy);
    b.capture(row(0));
    b.capture(row(0));
    b.drain();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not skip an unfinished row just because a later row is ready', () => {
    const first = row(0, '');
    const second = row(1, 'later');
    const feed = document.createElement('div');
    feed.append(first, second);
    const seen: string[] = [];
    const buffer = new MessageOrderBuffer(
      row => seen.push(row.textContent!),
      index => feed.querySelector(`[data-index="${index}"]`)
    );
    buffer.capture(first);
    buffer.capture(second);
    buffer.drain();
    expect(seen).toEqual([]);
    first.textContent = 'now ready';
    buffer.drain();
    expect(seen).toEqual(['now ready', 'later']);
  });
});
