// sections/cardFlowLedger.ts
// The card ledger with every source broken out: what each player gained and
// from where, what they lost and to what.
//
// It is the compact table's totals split apart, so the same arithmetic holds
// and can be read straight off the row:
//
//     GAINED(ALL) - LOST(ALL) = HAND
//
// Wide by nature, so it only fits a top or bottom bar; the shell refuses to
// place it anywhere it could not be read.

import type { CardFlowView, GameView } from '../view/types.js';
import { el, sectionHead } from './dom.js';
import type { SectionDefinition } from './types.js';

const STYLES = `
  .ledger-grid {
    display: grid;
    grid-template-columns:
      minmax(80px, 1.1fr)
      repeat(5, minmax(28px, .8fr))
      10px
      repeat(6, minmax(28px, .8fr))
      10px
      minmax(32px, .9fr);
    gap: 3px;
    align-items: center;
    min-width: 0;
  }
  .ledger-band {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--cc-mono);
    font-size: 10px;
    letter-spacing: .1em;
  }
  .ledger-band-rule { flex: 1; height: 1px; }
  .ledger-band--gain { color: var(--cc-good-text); }
  .ledger-band--gain .ledger-band-rule { background: rgba(143,224,196,.3); }
  .ledger-band--loss { color: var(--cc-loss-text); }
  .ledger-band--loss .ledger-band-rule { background: rgba(241,154,154,.3); }

  .ledger-head {
    font-family: var(--cc-mono);
    font-size: 10px;
    color: var(--cc-label-dim);
    text-align: center;
  }
  /* The two subtotal columns lead their band, so they read first. */
  .ledger-head--total { color: var(--cc-text-muted); }
  .ledger-name {
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 4px;
  }
  .ledger-total {
    border-radius: 4px;
    padding: 5px 0;
    text-align: center;
    font-family: var(--cc-mono);
    font-size: 13px;
    font-weight: 600;
  }
  .ledger-total--gain { background: rgba(94,200,160,.16); color: var(--cc-good-text); }
  .ledger-total--loss { background: rgba(227,91,91,.16); color: var(--cc-loss-text); }
  .ledger-part {
    text-align: center;
    font-family: var(--cc-mono);
    font-size: 12px;
    color: var(--cc-text-body);
  }
  .ledger-part--none { color: var(--cc-zero); }
  .ledger-hand {
    text-align: center;
    font-family: var(--cc-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--cc-text-body);
  }
`;

/** Sub-columns of each band, in display order. */
const GAINS: Array<{ label: string; value: (r: CardFlowView) => number }> = [
  { label: 'DICE', value: r => r.dice },
  { label: 'ROB', value: r => r.robGain },
  { label: 'DEV', value: r => r.devGain },
  { label: 'TRDE', value: r => r.tradeGain },
];
const LOSSES: Array<{ label: string; value: (r: CardFlowView) => number }> = [
  { label: '7s', value: r => r.sevens },
  { label: 'ROB', value: r => r.robLoss },
  { label: 'MONO', value: r => r.monoLoss },
  { label: 'TRDE', value: r => r.tradeLoss },
  { label: 'SPENT', value: r => r.spent },
];

interface RowNodes {
  name: HTMLElement;
  gained: HTMLElement;
  gains: HTMLElement[];
  lost: HTMLElement;
  losses: HTMLElement[];
  hand: HTMLElement;
}

function band(kind: 'gain' | 'loss', label: string, span: number): HTMLElement {
  const node = el('div', `ledger-band ledger-band--${kind}`);
  node.style.gridColumn = `span ${span}`;
  node.append(el('span', undefined, label), el('div', 'ledger-band-rule'));
  return node;
}

export const cardFlowLedgerSection: SectionDefinition = {
  id: 'card-flow-ledger',
  title: 'Card flow — full ledger',
  // Fourteen columns of numbers: only a wide bar can hold it.
  supports: ['horizontal'],
  min: { width: 0, height: 150 },
  styles: STYLES,

  mount(host: HTMLElement, view: GameView) {
    const { head, hintNode } = sectionHead(
      'Card flow · full ledger',
      'every gain and loss by source'
    );
    const grid = el('div', 'ledger-grid');
    const empty = el('div', 'section-empty', 'Nothing has moved yet.');

    // Band row: name spacer, GAINED over its five, gap, LOST over its six, HAND.
    grid.appendChild(el('div'));
    grid.appendChild(band('gain', 'GAINED', 5));
    grid.appendChild(el('div'));
    grid.appendChild(band('loss', 'LOST', 6));
    grid.appendChild(el('div'));
    grid.appendChild(el('div'));

    // Column labels.
    grid.appendChild(el('div'));
    grid.appendChild(el('div', 'ledger-head ledger-head--total', 'ALL'));
    for (const column of GAINS) {
      grid.appendChild(el('div', 'ledger-head', column.label));
    }
    grid.appendChild(el('div'));
    grid.appendChild(el('div', 'ledger-head ledger-head--total', 'ALL'));
    for (const column of LOSSES) {
      grid.appendChild(el('div', 'ledger-head', column.label));
    }
    grid.appendChild(el('div'));
    grid.appendChild(el('div', 'ledger-head ledger-head--total', 'HAND'));

    const headerCells = grid.children.length;
    host.append(head, grid, empty);

    let rows = new Map<string, RowNodes>();
    let seating = '';

    function render(next: GameView): void {
      hintNode.style.display = next.cardFlow.length > 0 ? '' : 'none';

      const names = next.cardFlow.map(row => row.name).join(' ');
      if (names !== seating) {
        seating = names;
        while (grid.children.length > headerCells) {
          grid.lastElementChild?.remove();
        }
        rows = new Map();

        for (const row of next.cardFlow) {
          const name = el('div', 'ledger-name');
          const gained = el('div', 'ledger-total ledger-total--gain');
          grid.append(name, gained);
          const gains = GAINS.map(() => {
            const cell = el('div', 'ledger-part');
            grid.appendChild(cell);
            return cell;
          });

          grid.appendChild(el('div'));
          const lost = el('div', 'ledger-total ledger-total--loss');
          grid.appendChild(lost);
          const losses = LOSSES.map(() => {
            const cell = el('div', 'ledger-part');
            grid.appendChild(cell);
            return cell;
          });

          grid.appendChild(el('div'));
          const hand = el('div', 'ledger-hand');
          grid.appendChild(hand);

          rows.set(row.name, { name, gained, gains, lost, losses, hand });
        }
      }

      for (const row of next.cardFlow) {
        const nodes = rows.get(row.name);
        if (!nodes) continue;
        nodes.name.textContent = row.name;
        nodes.name.style.color = row.color;
        nodes.gained.textContent = String(row.gained);
        nodes.lost.textContent = String(row.lost);
        nodes.hand.textContent = String(row.hand);

        const paint = (
          cells: HTMLElement[],
          columns: typeof GAINS | typeof LOSSES
        ) => {
          columns.forEach((column, index) => {
            const value = column.value(row);
            cells[index].textContent = String(value);
            cells[index].classList.toggle('ledger-part--none', value === 0);
          });
        };
        paint(nodes.gains, GAINS);
        paint(nodes.losses, LOSSES);
      }

      const hasPlayers = next.cardFlow.length > 0;
      empty.style.display = hasPlayers ? 'none' : '';
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
