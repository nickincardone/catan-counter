// sections/cardFlow.ts
// Where each player's cards came from and went, at a glance.
//
// Unlike the hands table this is exact: it counts cards rather than resource
// types, and a steal moves one card whether or not anyone knows which.
//
// Two tables are built from the same rows. The default keeps the three columns
// that say what happened TO a player — what they picked up, what was taken, and
// what a seven cost them — because that is what gets read during a turn. The
// extended one adds the columns that complete the arithmetic:
//
//     GOT + DEV - ROBD - 7s - SPENT = HAND
//
// Both are registered, and the settings menu switches between them.

import type { CardFlowView, GameView } from '../view/types.js';
import { el, sectionHead } from './dom.js';
import type { SectionDefinition } from './types.js';

const STYLES = `
  .flow-grid {
    display: grid;
    /* Columns are set when the table is built; see createCardFlow. */
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

interface Column {
  label: string;
  tone: 'gain' | 'loss' | 'spend' | 'hand';
  /** Whether a zero should be dimmed rather than shown in the column's tone. */
  dimZero: boolean;
  value: (row: CardFlowView) => number;
}

const GOT: Column = {
  label: 'GOT',
  tone: 'gain',
  dimZero: false,
  value: r => r.got,
};
const DEV: Column = {
  label: 'DEV',
  tone: 'gain',
  dimZero: true,
  value: r => r.devGain,
};
const ROBD: Column = {
  label: 'ROBD',
  tone: 'loss',
  dimZero: true,
  value: r => r.robbed,
};
const SEVENS: Column = {
  label: '7s',
  tone: 'loss',
  dimZero: true,
  value: r => r.sevens,
};
const SPENT: Column = {
  label: 'SPENT',
  tone: 'spend',
  dimZero: false,
  value: r => r.spentAndTraded,
};
const HAND: Column = {
  label: 'HAND',
  tone: 'hand',
  dimZero: false,
  value: r => r.hand,
};

/** What happened to a player, which is what gets read mid-turn. */
const COMPACT_COLUMNS: Column[] = [GOT, ROBD, SEVENS];

/** Everything, so the row adds up. */
const FULL_COLUMNS: Column[] = [GOT, DEV, ROBD, SEVENS, SPENT, HAND];

const COMPACT_NOTE =
  'GOT is everything picked up: production, trades and steals. ROBD is what ' +
  'the robber or a monopoly took. 7s is what a seven made them discard.';

const FULL_NOTE =
  'GOT is everything picked up: production, trades and steals. ROBD is what ' +
  'the robber or a monopoly took. SPENT covers building, buying and trading ' +
  'away. GOT plus DEV, less ROBD, 7s and SPENT, is HAND.';

interface RowNodes {
  name: HTMLElement;
  cells: HTMLElement[];
}

/**
 * Both tables are the same code with a different column list; nothing about
 * the rendering depends on which columns it was handed.
 */
function createCardFlow(options: {
  id: SectionDefinition['id'];
  title: string;
  note: string;
  heading: string;
  columns: Column[];
  bodyNote: string;
  minWidth: number;
}): SectionDefinition {
  const COLUMNS = options.columns;
  return {
    id: options.id,
    title: options.title,
    note: options.note,
    supports: ['vertical', 'horizontal'],
    min: { width: options.minWidth, height: 120 },
    styles: STYLES,

    mount(host: HTMLElement, view: GameView) {
      const { head } = sectionHead(options.heading, 'whole game');
      const grid = el('div', 'flow-grid');
      const empty = el('div', 'section-empty', 'Nothing has moved yet.');
      const note = el('div', 'section-note', options.bodyNote);

      // The grid is sized to whatever columns this table was built with.
      grid.style.gridTemplateColumns = `minmax(78px, 1.2fr) repeat(${COLUMNS.length}, minmax(26px, 1fr))`;

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
}

export const cardFlowSection = createCardFlow({
  id: 'card-flow',
  title: 'Card flow',
  note: 'Picked up, robbed and discarded per player',
  heading: 'Card flow',
  columns: COMPACT_COLUMNS,
  bodyNote: COMPACT_NOTE,
  minWidth: 200,
});

export const cardFlowExtendedSection = createCardFlow({
  id: 'card-flow-extended',
  title: 'Card flow (extended)',
  note: 'Every column, so the row adds up to the hand',
  heading: 'Card flow · extended',
  columns: FULL_COLUMNS,
  bodyNote: FULL_NOTE,
  minWidth: 260,
});
