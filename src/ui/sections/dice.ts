// sections/dice.ts
// How the dice have actually fallen. Each bar carries a tick at the rate you
// would expect by now, so a number reads as running hot or cold at a glance
// rather than needing the counts compared in your head.

import type { GameView } from '../view/types.js';
import { el, sectionHead } from './dom.js';
import type { SectionDefinition } from './types.js';

const STYLES = `
  .dice-bars { flex: 1; display: flex; align-items: flex-end; gap: 6px; min-height: 0; }
  .dice-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    height: 100%;
  }
  .dice-count {
    font-family: var(--cc-mono);
    font-size: 12px;
    margin-bottom: 3px;
    color: var(--cc-mono-dim);
  }
  .dice-column--hot .dice-count { color: var(--cc-good); }
  .dice-bar {
    width: 100%;
    background: var(--cc-bar);
    border-radius: 3px 3px 0 0;
    position: relative;
  }
  .dice-column--hot .dice-bar { background: var(--cc-good); }
  .dice-column--seven .dice-bar { background: var(--cc-danger); }
  .dice-tick {
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background: rgba(255,255,255,.5);
  }
  .dice-axis { display: flex; gap: 6px; margin-top: 5px; }
  .dice-axis span {
    flex: 1;
    text-align: center;
    font-family: var(--cc-mono);
    font-size: 12px;
    color: var(--cc-mono-dim);
  }
`;

interface ColumnNodes {
  column: HTMLElement;
  count: HTMLElement;
  bar: HTMLElement;
  tick: HTMLElement;
}

export const diceSection: SectionDefinition = {
  id: 'dice',
  title: 'Dice rolls',
  note: 'Distribution against the expected rate',
  supports: ['horizontal', 'vertical'],
  min: { width: 260, height: 110 },
  styles: STYLES,

  mount(host: HTMLElement, view: GameView) {
    const { head, labelNode } = sectionHead(
      'Dice',
      'white tick = expected rate'
    );
    const bars = el('div', 'dice-bars');
    const axis = el('div', 'dice-axis');

    // The eleven columns never change, so they are built once and only their
    // heights and colors are touched afterwards.
    const columns: ColumnNodes[] = view.dice.bars.map(barView => {
      const column = el('div', 'dice-column');
      const count = el('span', 'dice-count');
      const bar = el('div', 'dice-bar');
      const tick = el('div', 'dice-tick');
      bar.appendChild(tick);
      column.append(count, bar);
      bars.appendChild(column);
      axis.appendChild(el('span', undefined, String(barView.n)));
      return { column, count, bar, tick };
    });

    host.append(head, bars, axis);

    function render(next: GameView): void {
      labelNode.textContent = `Dice · ${next.dice.totalRolls} rolls`;

      next.dice.bars.forEach((barView, index) => {
        const nodes = columns[index];
        if (!nodes) return;
        nodes.count.textContent = String(barView.count);
        nodes.bar.style.height = `${barView.heightPct}%`;
        nodes.tick.style.top = `${barView.expectedTopPct}%`;
        // A bar with nothing in it has no rate to compare against.
        nodes.tick.style.display = barView.count === 0 ? 'none' : '';
        nodes.column.classList.toggle(
          'dice-column--hot',
          barView.tone === 'hot'
        );
        nodes.column.classList.toggle(
          'dice-column--seven',
          barView.tone === 'seven'
        );
        nodes.column.title = `${barView.n}: rolled ${barView.count}, expected ${barView.expected.toFixed(1)}`;
      });
    }

    render(view);

    return {
      update: render,
      destroy: () => {
        host.textContent = '';
      },
    };
  },
};
