// sections/hands.ts
// Who holds what: the bank's remaining cards, then one row per player showing
// guaranteed counts and the probability of holding more.

import { RESOURCE_STYLE } from '../shell/theme.js';
import type { GameView, PlayerView } from '../view/types.js';
import { el, img, sectionHead } from './dom.js';
import type { SectionContext, SectionDefinition } from './types.js';

const STYLES = `
  .hands-body { padding: 0 10px; }

  .hands-bank {
    display: grid;
    grid-template-columns: 76px repeat(5, 1fr);
    gap: 6px 3px;
    align-items: center;
  }
  .bank-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }
  .bank-cell img { width: 22px; height: 31px; border-radius: 2px; display: block; }
  .bank-count { font-family: var(--cc-mono); font-size: 10px; color: var(--cc-label-dim); }

  .player-row {
    margin-top: 6px;
    background: var(--cc-surface);
    border-left: 3px solid var(--cc-mono-dim);
    border-radius: 6px;
    padding: 7px 8px;
  }
  .player-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .player-name {
    font-size: 14px;
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .player-summary {
    font-family: var(--cc-mono);
    font-size: 12px;
    color: var(--cc-text-muted);
    white-space: nowrap;
  }
  .player-cells { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px; }
  .cell {
    border-top: 3px solid transparent;
    border-radius: 4px;
    padding: 4px 0 5px;
    text-align: center;
  }
  .cell-count {
    font-family: var(--cc-mono);
    font-size: 16px;
    font-weight: 600;
    line-height: 1.1;
    color: var(--cc-text);
  }
  /* A zero reads as dim even when the cell is tinted by a probable holding. */
  .cell--zero .cell-count { color: var(--cc-zero); }
  .cell-probability {
    font-family: var(--cc-mono);
    font-size: 11px;
    line-height: 1.2;
    min-height: 13px;
    color: var(--cc-probable);
  }
`;

const NOTE =
  'Solid numbers are guaranteed. Green fractions are probable holdings from unresolved steals.';

interface RowNodes {
  row: HTMLElement;
  name: HTMLElement;
  summary: HTMLElement;
  cells: Array<{
    cell: HTMLElement;
    count: HTMLElement;
    probability: HTMLElement;
  }>;
}

function buildRow(player: PlayerView): RowNodes {
  const row = el('div', 'player-row');
  const head = el('div', 'player-head');
  const name = el('span', 'player-name');
  const summary = el('span', 'player-summary');
  head.append(name, summary);

  const cellsHost = el('div', 'player-cells');
  const cells = player.cells.map(cellView => {
    const cell = el('div', 'cell');
    cell.style.borderTopColor = RESOURCE_STYLE[cellView.resource].color;
    const count = el('div', 'cell-count');
    const probability = el('div', 'cell-probability');
    cell.append(count, probability);
    cellsHost.appendChild(cell);
    return { cell, count, probability };
  });

  row.append(head, cellsHost);
  return { row, name, summary, cells };
}

function paintRow(nodes: RowNodes, player: PlayerView): void {
  nodes.row.style.borderLeftColor = player.color;
  nodes.name.textContent = player.name;
  nodes.name.style.color = player.color;
  nodes.summary.textContent = `${player.knownCards} known`;

  player.cells.forEach((cellView, index) => {
    const target = nodes.cells[index];
    if (!target) return;
    // Tint follows "could hold any of this"; the number's weight follows what
    // is actually guaranteed, so a 0 stays quiet under a green fraction.
    target.cell.classList.toggle('cell--zero', cellView.known === 0);
    target.cell.style.background = cellView.hasAny
      ? RESOURCE_STYLE[cellView.resource].tint
      : 'var(--cc-surface-empty)';
    target.count.textContent = String(cellView.known);
    target.probability.textContent = cellView.probabilityLabel;
  });
}

export const handsSection: SectionDefinition = {
  id: 'hands',
  title: 'Hands',
  note: 'Per-player card counts and probabilities',
  supports: ['vertical'],
  min: { width: 220, height: 0 },
  styles: STYLES,

  mount(host: HTMLElement, view: GameView, ctx: SectionContext) {
    const { head } = sectionHead('Hands');
    const body = el('div', 'hands-body');
    const bank = el('div', 'hands-bank');
    bank.appendChild(el('div')); // spacer above the player-name column
    const empty = el('div', 'section-empty', 'Waiting for players.');
    const note = el('div', 'section-note', NOTE);

    const bankCounts = view.bank.map(entry => {
      const cell = el('div', 'bank-cell');
      const icon = img(
        ctx.assetUrl(`assets/${RESOURCE_STYLE[entry.resource].icon}`),
        entry.resource
      );
      const count = el('span', 'bank-count');
      cell.append(icon, count);
      bank.appendChild(cell);
      return count;
    });

    body.appendChild(bank);
    host.append(head, body, empty, note);

    // Rows are rebuilt only when the seating changes; otherwise values are
    // patched in place, so images never reload and the rail never flickers.
    let rows = new Map<string, RowNodes>();
    let seating = '';

    function render(next: GameView): void {
      next.bank.forEach((entry, index) => {
        bankCounts[index].textContent = `${entry.left}/${entry.total}`;
      });

      const names = next.players.map(player => player.name).join(' ');
      if (names !== seating) {
        seating = names;
        rows.forEach(node => node.row.remove());
        rows = new Map();
        for (const player of next.players) {
          const nodes = buildRow(player);
          rows.set(player.name, nodes);
          body.appendChild(nodes.row);
        }
      }

      for (const player of next.players) {
        const nodes = rows.get(player.name);
        if (nodes) paintRow(nodes, player);
      }

      const hasPlayers = next.players.length > 0;
      empty.style.display = hasPlayers ? 'none' : '';
      note.style.display = hasPlayers ? '' : 'none';
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
