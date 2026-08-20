// sections/players.ts
// Victory points, knights played, and pieces left to build.
//
// The tracker has kept all of this since long before v2, but no interface ever
// showed it. It is registered and unplaced by default: drop its id into any
// gutter in the layout to turn it on. It also serves as the proof that the
// section system handles more than the four blocks the mockup drew.

import type { GameView, PlayerView } from '../view/types.js';
import { el, sectionHead } from './dom.js';
import type { SectionDefinition } from './types.js';

const STYLES = `
  .players-row {
    background: var(--cc-surface);
    border-left: 3px solid var(--cc-mono-dim);
    border-radius: 6px;
    padding: 7px 9px;
  }
  .players-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  .players-name {
    font-size: 14px;
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .players-vp { font-family: var(--cc-mono); font-size: 12px; color: var(--cc-text-muted); }
  .players-stats {
    display: flex;
    gap: 10px;
    margin-top: 5px;
    font-family: var(--cc-mono);
    font-size: 12px;
    color: var(--cc-mono-dim);
  }
  .players-stat strong { color: var(--cc-text-body); font-weight: 600; }
`;

interface RowNodes {
  row: HTMLElement;
  name: HTMLElement;
  vp: HTMLElement;
  stats: HTMLElement;
}

function paintRow(nodes: RowNodes, player: PlayerView): void {
  nodes.row.style.borderLeftColor = player.color;
  nodes.name.textContent = player.name;
  nodes.name.style.color = player.color;
  nodes.vp.textContent = `${player.victoryPoints} vp`;

  const stats: Array<[string, number]> = [
    ['knights', player.knights],
    ['set', player.settlements],
    ['cit', player.cities],
    ['rd', player.roads],
  ];
  nodes.stats.textContent = '';
  for (const [label, value] of stats) {
    const stat = el('span', 'players-stat');
    const strong = el('strong', undefined, String(value));
    stat.append(strong, document.createTextNode(` ${label}`));
    nodes.stats.appendChild(stat);
  }
}

export const playersSection: SectionDefinition = {
  id: 'players',
  title: 'Players',
  note: 'Victory points, knights and pieces left',
  supports: ['vertical'],
  min: { width: 220, height: 0 },
  styles: STYLES,

  mount(host: HTMLElement, view: GameView) {
    const { head } = sectionHead('Players', 'vp / pieces left');
    const rows = el('div', 'section-rows');
    const empty = el('div', 'section-empty', 'Waiting for players.');
    host.append(head, rows, empty);

    let nodes = new Map<string, RowNodes>();
    let seating = '';

    function render(next: GameView): void {
      empty.style.display = next.players.length === 0 ? '' : 'none';

      const names = next.players.map(player => player.name).join(' ');
      if (names !== seating) {
        seating = names;
        rows.textContent = '';
        nodes = new Map();
        for (const player of next.players) {
          const row = el('div', 'players-row');
          const rowHead = el('div', 'players-head');
          const name = el('span', 'players-name');
          const vp = el('span', 'players-vp');
          rowHead.append(name, vp);
          const stats = el('div', 'players-stats');
          row.append(rowHead, stats);
          rows.appendChild(row);
          nodes.set(player.name, { row, name, vp, stats });
        }
      }

      for (const player of next.players) {
        const target = nodes.get(player.name);
        if (target) paintRow(target, player);
      }
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
