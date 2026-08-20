// sections/cardFlow.ts
// Where each player's cards came from and went, at a glance.
//
// Unlike the hands table this is exact: it counts cards rather than resource
// types, and a steal moves one card whether or not anyone knows which. Every
// gain lands in exactly one column and every loss in exactly one, so each row
// reads across as arithmetic that checks out:
//
//     GOT + DEV - ROBD - 7s - SPENT = HAND

import type { CardFlowView, GameView } from '../view/types.js';
import { el, sectionHead } from './dom.js';
import type { SectionDefinition } from './types.js';

const STYLES = `
  .flow-grid {
    display: grid;
    grid-template-columns: minmax(78px, 1.2fr) repeat(6, minmax(26px, 1fr));
    gap: 3px;
    align-items: center;
    min-width: 0;
  }
  .flow-head {
    font-family: var(--cc-mono);
    font-size: 10px;
    color: var(--cc-label-dim);
    text-align: center;
  }
  .flow-name {
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 4px;
  }
  .flow-cell {
    border-radius: 4px;
    padding: 5px 0;
    text-align: center;
    font-family: var(--cc-mono);
    font-size: 13px;
    font-weight: 600;
  }
  .flow-cell--gain { background: rgba(94,200,160,.12); color: var(--cc-good-text); }
  .flow-cell--loss { background: rgba(227,91,91,.12); color: var(--cc-loss-text); }
  .flow-cell--spend { background: rgba(232,163,61,.12); color: var(--cc-spend-text); }
  .flow-cell--hand { color: var(--cc-text-body); min-width: 0; }
  /* A column that never happened should not read as a number worth weighing. */
  .flow-cell--none { color: var(--cc-zero); }
`;

const NOTE =
  'GOT is everything picked up: production, trades and steals. ROBD is what ' +
  'the robber or a monopoly took. SPENT covers building, buying and trading away.';

/** Column definitions, in display order. */
const COLUMNS: Array<{
  label: string;
  tone: 'gain' | 'loss' | 'spend' | 'hand';
  /** Whether a zero should be dimmed rather than shown in the column's tone. */
  dimZero: boolean;
  value: (row: CardFlowView) => number;
}> = [
  { label: 'GOT', tone: 'gain', dimZero: false, value: r => r.got },
  { label: 'DEV', tone: 'gain', dimZero: true, value: r => r.devGain },
  { label: 'ROBD', tone: 'loss', dimZero: true, value: r => r.robbed },
  { label: '7s', tone: 'loss', dimZero: true, value: r => r.sevens },
  {
    label: 'SPENT',
    tone: 'spend',
    dimZero: false,
    value: r => r.spentAndTraded,
  },
  { label: 'HAND', tone: 'hand', dimZero: false, value: r => r.hand },
];

interface RowNodes {
  name: HTMLElement;
  cells: HTMLElement[];
}

export const cardFlowSection: SectionDefinition = {
  id: 'card-flow',
  title: 'Card flow',
  supports: ['vertical', 'horizontal'],
  min: { width: 260, height: 120 },
  styles: STYLES,

  mount(host: HTMLElement, view: GameView) {
    const { head } = sectionHead('Card flow', 'whole game');
    const grid = el('div', 'flow-grid');
    const empty = el('div', 'section-empty', 'Nothing has moved yet.');
    const note = el('div', 'section-note', NOTE);

    grid.appendChild(el('div')); // spacer above the player-name column
    for (const column of COLUMNS) {
      grid.appendChild(el('div', 'flow-head', column.label));
    }

    host.append(head, grid, empty, note);

    let rows = new Map<string, RowNodes>();
    let seating = '';

    function render(next: GameView): void {
      const names = next.cardFlow.map(row => row.name).join(' ');
      if (names !== seating) {
        seating = names;
        // Rebuild the body but keep the header cells that lead the grid.
        while (grid.children.length > COLUMNS.length + 1) {
          grid.lastElementChild?.remove();
        }
        rows = new Map();
        for (const row of next.cardFlow) {
          const name = el('div', 'flow-name');
          grid.appendChild(name);
          const cells = COLUMNS.map(column => {
            const cell = el(
              'div',
              column.tone === 'hand'
                ? 'flow-cell flow-cell--hand'
                : `flow-cell flow-cell--${column.tone}`
            );
            grid.appendChild(cell);
            return cell;
          });
          rows.set(row.name, { name, cells });
        }
      }

      for (const row of next.cardFlow) {
        const nodes = rows.get(row.name);
        if (!nodes) continue;
        nodes.name.textContent = row.name;
        nodes.name.style.color = row.color;

        COLUMNS.forEach((column, index) => {
          const value = column.value(row);
          const cell = nodes.cells[index];
          cell.textContent = String(value);
          cell.classList.toggle(
            'flow-cell--none',
            column.dimZero && value === 0
          );
        });
      }

      const hasPlayers = next.cardFlow.length > 0;
      empty.style.display = hasPlayers ? 'none' : '';
      note.style.display = hasPlayers ? '' : 'none';
      grid.style.display = hasPlayers ? 'grid' : 'none';
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
