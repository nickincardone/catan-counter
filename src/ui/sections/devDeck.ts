// sections/devDeck.ts
// What is left of the development deck, and who spent what.
//
// These counters fall when a card is played rather than when it is drawn, so
// "left" means not yet played — which is why an untouched deck shows 5/5
// victory points even though nobody could ever see them.

import type { GameView } from '../view/types.js';
import { el, img, sectionHead } from './dom.js';
import type { SectionContext, SectionDefinition } from './types.js';

const STYLES = `
  .dev-tiles {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 4px;
  }
  .dev-tile {
    min-width: 0;
    background: var(--cc-surface);
    border-radius: 7px;
    padding: 6px 2px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    text-align: center;
    overflow: hidden;
  }
  .dev-tile img { width: 26px; height: 35px; flex: none; border-radius: 2px; display: block; }
  .dev-ratio {
    font-family: var(--cc-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--cc-text);
    line-height: 1;
    white-space: nowrap;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dev-name {
    max-width: 100%;
    font-size: 10px;
    font-weight: 700;
    color: var(--cc-text-muted);
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dev-bar {
    width: 100%;
    height: 4px;
    background: rgba(255,255,255,.1);
    border-radius: 2px;
    overflow: hidden;
  }
  .dev-fill { height: 100%; background: var(--cc-accent); }
  .dev-tile--untouched .dev-fill { background: var(--cc-good); }
  .dev-caption {
    max-width: 100%;
    font-family: var(--cc-mono);
    font-size: 10px;
    color: var(--cc-mono-dim);
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

interface TileNodes {
  tile: HTMLElement;
  ratio: HTMLElement;
  fill: HTMLElement;
  caption: HTMLElement;
}

export const devDeckSection: SectionDefinition = {
  id: 'dev-deck',
  title: 'Dev deck',
  supports: ['horizontal', 'vertical'],
  min: { width: 240, height: 110 },
  styles: STYLES,

  mount(host: HTMLElement, view: GameView, ctx: SectionContext) {
    const { head, labelNode } = sectionHead('Dev deck', 'left / total');
    const tilesHost = el('div', 'dev-tiles');

    // The five card types are fixed for a standard game; only their numbers move.
    const tiles: TileNodes[] = view.devDeck.cards.map(card => {
      const tile = el('div', 'dev-tile');
      const ratio = el('div', 'dev-ratio');
      const bar = el('div', 'dev-bar');
      const fill = el('div', 'dev-fill');
      bar.appendChild(fill);
      const caption = el('div', 'dev-caption');
      tile.append(
        img(ctx.assetUrl(`assets/${card.icon}`), card.name),
        ratio,
        el('div', 'dev-name', card.name),
        bar,
        caption
      );
      tilesHost.appendChild(tile);
      return { tile, ratio, fill, caption };
    });

    host.append(head, tilesHost);

    function render(next: GameView): void {
      labelNode.textContent = `Dev deck · ${next.devDeck.remaining} left`;

      next.devDeck.cards.forEach((card, index) => {
        const nodes = tiles[index];
        if (!nodes) return;
        nodes.ratio.textContent = `${card.left}/${card.total}`;
        nodes.fill.style.width = `${card.leftPct}%`;
        nodes.caption.textContent = card.caption;
        nodes.caption.title = card.caption;
        nodes.tile.classList.toggle('dev-tile--untouched', card.untouched);
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
