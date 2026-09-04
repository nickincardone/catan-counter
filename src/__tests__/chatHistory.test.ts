import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { loadChatHistory } from '../chatHistory';
import { updateGameFromChat } from '../chatParser';
import { game, resetGameState } from '../gameState';

jest.mock('../ui/index', () => ({
  updateGameStateDisplay: jest.fn(),
  showYouPlayerDialog: jest.fn(),
}));

function row(index: number, html: string): HTMLElement {
  const element = document.createElement('div');
  element.dataset.index = String(index);
  element.innerHTML = html;
  return element;
}

/** A virtual scroller that replaces its DOM window after each scroll request. */
function scroller(history: HTMLElement[]) {
  const scroll = document.createElement('div');
  const container = document.createElement('div');
  scroll.append(container);
  document.body.append(scroll);
  let position = Math.max(0, history.length * 20 - 120);
  const targets: number[] = [];
  Object.defineProperties(scroll, {
    clientHeight: { value: 120 },
    scrollHeight: { configurable: true, get: () => history.length * 20 },
    scrollTop: {
      get: () => position,
      set: value => {
        position = value;
        targets.push(value);
      },
    },
  });
  function render(at = position) {
    const start = Math.max(0, Math.floor(at / 20) - 1);
    container.replaceChildren(
      ...history.slice(start, start + 9).map(row => row.cloneNode(true))
    );
  }
  render();
  return {
    scroll,
    container,
    targets,
    render,
    jump: (to: number) => {
      position = to;
      render();
    },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  resetGameState();
});

describe('rebuilding virtualized chat after a refresh', () => {
  it('rebuilds all 66 rolls despite repeated jumps to the live tail', async () => {
    // Final distribution from the reported game, which the broken recovery
    // displayed as only 32 rolls. Include a real HR separator after each roll.
    const counts = [0, 6, 6, 10, 7, 11, 7, 8, 7, 2, 2];
    const history: HTMLElement[] = [];
    counts.forEach((count, offset) => {
      const total = offset + 2;
      for (let n = 0; n < count; n++) {
        const first = Math.min(6, total - 1);
        history.push(
          row(
            history.length,
            `Alice rolled <img alt="dice_${first}"><img alt="dice_${total - first}">`
          )
        );
        history.push(row(history.length, '<hr>'));
      }
    });
    const feed = scroller(history);
    let waits = 0;
    let jumps = 0;
    const processed: number[] = [];
    await loadChatHistory(
      feed.container,
      element => {
        processed.push(Number(element.dataset.index));
        updateGameFromChat(element);
      },
      {
        wait: async () => {
          if (++waits % 8 === 0) {
            jumps++;
            feed.jump(feed.scroll.scrollHeight - feed.scroll.clientHeight);
          } else feed.render();
        },
      }
    );
    expect(jumps).toBeGreaterThan(2);
    expect(processed).toEqual(history.map((_, index) => index));
    expect(Object.values(game.diceRolls)).toEqual(counts);
    expect(Object.values(game.diceRolls).reduce((a, b) => a + b, 0)).toBe(66);
  });

  it('captures late-filled rows and separators before virtual recycling', async () => {
    const feed = scroller([row(0, 'first'), row(1, '<hr>'), row(2, 'last')]);
    feed.container.replaceChildren(
      row(0, '<img alt="Player avatar">'),
      row(1, ''),
      row(2, 'last')
    );
    const processed: string[] = [];
    await loadChatHistory(
      feed.container,
      row => processed.push(row.innerHTML),
      {
        wait: async () => {
          feed.container.children[0].innerHTML = 'first';
          feed.container.children[1].innerHTML = '<hr>';
          // Observer must capture these before the next poll sees only the tail.
          await Promise.resolve();
          feed.container.replaceChildren(row(2, 'last'));
        },
      }
    );
    expect(processed).toEqual(['first', '<hr>', 'last']);
  });

  it('retries a gap instead of advancing the parser past it', async () => {
    const history = Array.from({ length: 25 }, (_, i) =>
      row(i, `message ${i}`)
    );
    const feed = scroller(history);
    let passes = 0;
    const processed: number[] = [];
    await loadChatHistory(
      feed.container,
      row => processed.push(Number(row.dataset.index)),
      {
        wait: async () => {
          if (feed.scroll.scrollTop === 0) passes++;
          feed.render();
          if (passes === 1)
            feed.container
              .querySelector('[data-index="10"]')
              ?.replaceChildren();
        },
      }
    );
    expect(passes).toBe(2);
    expect(processed).toEqual(history.map((_, i) => i));
  });

  it('refuses to publish partial counts when a row never renders', async () => {
    const feed = scroller([row(0, 'first'), row(1, ''), row(2, 'last')]);
    const process = jest.fn();
    const logged = new Set<number>();
    await expect(
      loadChatHistory(feed.container, process, {
        onCapture: row => {
          logged.add(Number(row.dataset.index));
        },
        wait: async () => feed.render(),
      })
    ).rejects.toThrow('captured 2 of 3 rows');
    expect(process).not.toHaveBeenCalled();
    expect([...logged]).toEqual([0, 2]);
  });

  it('handles a changing height estimate and overlapping windows without duplicates', async () => {
    const history = Array.from({ length: 40 }, (_, i) =>
      row(i, `message ${i}`)
    );
    const feed = scroller(history);
    let measured = false;
    Object.defineProperty(feed.scroll, 'scrollHeight', {
      get: () => (measured ? 800 : 1400),
    });
    const seen: number[] = [];
    await loadChatHistory(
      feed.container,
      row => seen.push(Number(row.dataset.index)),
      {
        wait: async () => {
          measured = true;
          feed.render();
        },
      }
    );
    expect(seen).toEqual(history.map((_, i) => i));
  });
});
