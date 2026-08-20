// sections/blockedRobber.ts
// Production the robber denied: which number was blocked, on what resource,
// and how often.

import { RESOURCE_STYLE } from '../shell/theme.js';
import type { GameView } from '../view/types.js';
import { el, img, sectionHead } from './dom.js';
import type { SectionContext, SectionDefinition } from './types.js';

const STYLES = `
  .blocked-row {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--cc-surface);
    border-radius: 6px;
    padding: 6px 9px;
  }
  .blocked-number {
    width: 20px;
    height: 20px;
    flex: none;
    border-radius: 50%;
    background: var(--cc-well);
    border: 1px solid rgba(255,255,255,.16);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--cc-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--cc-text-body);
  }
  .blocked-row img { width: 12px; height: 17px; border-radius: 1px; display: block; flex: none; }
  .blocked-spacer { flex: 1; }
  .blocked-count { font-family: var(--cc-mono); font-size: 13px; color: var(--cc-accent); }
`;

export const blockedRobberSection: SectionDefinition = {
  id: 'blocked-robber',
  title: 'Blocked by robber',
  supports: ['vertical'],
  min: { width: 200, height: 0 },
  styles: STYLES,

  mount(host: HTMLElement, view: GameView, ctx: SectionContext) {
    const { head, hintNode } = sectionHead('Blocked by robber');
    const rows = el('div', 'section-rows');
    const empty = el('div', 'section-empty', 'The robber has cost nobody yet.');
    host.append(head, rows, empty);

    let rendered = '';

    function render(next: GameView): void {
      hintNode.textContent = `${next.blockedTotal} denied`;
      hintNode.style.display = next.blockedTotal > 0 ? '' : 'none';
      empty.style.display = next.blocked.length === 0 ? '' : 'none';

      const signature = next.blocked
        .map(entry => `${entry.diceNumber}${entry.resource}${entry.count}`)
        .join('|');
      if (signature === rendered) return;
      rendered = signature;

      rows.textContent = '';
      for (const entry of next.blocked) {
        const row = el('div', 'blocked-row');
        row.append(
          el('div', 'blocked-number', String(entry.diceNumber)),
          img(
            ctx.assetUrl(`assets/${RESOURCE_STYLE[entry.resource].icon}`),
            entry.resource
          ),
          el('div', 'blocked-spacer'),
          el('span', 'blocked-count', `\u00d7${entry.count}`)
        );
        rows.appendChild(row);
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
