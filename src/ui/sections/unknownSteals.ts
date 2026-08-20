// sections/unknownSteals.ts
// Steals whose card nobody saw. Each candidate resource is a chip; clicking one
// tells the tracker what was actually taken, and a resolution made by hand can
// be taken back.
//
// The section never touches the tracker itself — it emits an intent and lets
// the shell decide what that means.

import { RESOURCE_STYLE } from '../shell/theme.js';
import type { GameView, StealView } from '../view/types.js';
import { el, img, sectionHead } from './dom.js';
import type {
  ResourceKeyLike,
  SectionContext,
  SectionDefinition,
} from './types.js';

const STYLES = `
  .steal {
    background: var(--cc-accent-tint);
    border: 1px solid var(--cc-accent-border);
    border-radius: 6px;
    padding: 8px 9px;
  }
  .steal--resolved {
    background: var(--cc-good-tint);
    border-color: var(--cc-good-border);
  }
  .steal-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px;
  }
  .steal-who { font-size: 13px; color: var(--cc-text-body); line-height: 1.35; }
  .steal-who strong { font-weight: 800; }
  .steal-time {
    font-family: var(--cc-mono);
    font-size: 11px;
    color: var(--cc-mono-dim);
    white-space: nowrap;
  }
  .steal-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 7px;
    align-items: center;
  }
  .chip {
    display: flex;
    align-items: center;
    gap: 5px;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 20px;
    padding: 3px 8px 3px 4px;
    cursor: pointer;
    font-family: inherit;
  }
  .chip:hover { border-color: var(--cc-good); }
  .chip:focus-visible { outline: 2px solid var(--cc-good); outline-offset: 1px; }
  .chip img { width: 12px; height: 17px; border-radius: 1px; display: block; flex: none; }
  .chip-label {
    font-family: var(--cc-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--cc-text-body);
  }
  .chip--confirmed {
    background: rgba(94,200,160,.16);
    border-color: rgba(94,200,160,.5);
    cursor: default;
  }
  .chip--confirmed .chip-label { color: var(--cc-good-text); }
  .chip-undo {
    font-family: var(--cc-mono);
    font-size: 11px;
    color: var(--cc-mono-dim);
    background: none;
    border: 0;
    padding: 2px 4px;
    margin-left: 2px;
    cursor: pointer;
  }
  .chip-undo:hover { color: var(--cc-text); }
`;

function buildSteal(steal: StealView, ctx: SectionContext): HTMLElement {
  const row = el(
    'div',
    steal.resolved ? 'steal steal--resolved' : 'steal steal--open'
  );

  const head = el('div', 'steal-head');
  const who = el('div', 'steal-who');
  const thief = el('strong', undefined, steal.thief);
  thief.style.color = steal.thiefColor;
  const victim = el('strong', undefined, steal.victim);
  victim.style.color = steal.victimColor;
  who.append(thief, document.createTextNode(' stole from '), victim);
  head.append(who, el('span', 'steal-time', steal.time));

  const chips = el('div', 'steal-chips');
  for (const candidate of steal.candidates) {
    const chip = el('button', steal.resolved ? 'chip chip--confirmed' : 'chip');
    chip.type = 'button';
    if (!steal.resolved) {
      chip.dataset.stealId = steal.id;
      chip.dataset.resource = candidate.resource;
      chip.title = `Record that ${candidate.resource} was stolen`;
    } else {
      chip.disabled = true;
    }
    chip.append(
      img(
        ctx.assetUrl(`assets/${RESOURCE_STYLE[candidate.resource].icon}`),
        candidate.resource
      ),
      el('span', 'chip-label', candidate.label)
    );
    chips.appendChild(chip);
  }

  if (steal.canUndo) {
    const undo = el('button', 'chip-undo', 'UNDO');
    undo.type = 'button';
    undo.dataset.undoId = steal.id;
    undo.title = 'Take back this resolution';
    chips.appendChild(undo);
  }

  row.append(head, chips);
  return row;
}

/** Changes only when something visible changed, so we can skip re-rendering. */
function signature(view: GameView): string {
  return view.steals
    .map(
      steal =>
        `${steal.id}:${steal.resolved}:${steal.canUndo}:` +
        steal.candidates.map(c => `${c.resource}${c.label}`).join(',')
    )
    .join('|');
}

export const unknownStealsSection: SectionDefinition = {
  id: 'unknown-steals',
  title: 'Unknown steals',
  supports: ['vertical'],
  min: { width: 220, height: 0 },
  styles: STYLES,

  mount(host: HTMLElement, view: GameView, ctx: SectionContext) {
    const { head, labelNode, hintNode } = sectionHead(
      'Unknown steals',
      'click to resolve'
    );
    const rows = el('div', 'section-rows');
    const empty = el(
      'div',
      'section-empty',
      'Nothing unaccounted for right now.'
    );
    host.append(head, rows, empty);

    // Delegated from the host, so a full re-render can never orphan a handler.
    const onClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const chip = target?.closest<HTMLElement>('[data-resource]');
      if (chip?.dataset.stealId && chip.dataset.resource) {
        ctx.emit({
          type: 'resolve-steal',
          id: chip.dataset.stealId,
          resource: chip.dataset.resource as ResourceKeyLike,
        });
        return;
      }
      const undo = target?.closest<HTMLElement>('[data-undo-id]');
      if (undo?.dataset.undoId) {
        ctx.emit({ type: 'undo-steal', id: undo.dataset.undoId });
      }
    };
    host.addEventListener('click', onClick);

    let rendered = '';

    function render(next: GameView): void {
      labelNode.textContent = `Unknown steals · ${next.openStealCount}`;
      hintNode.style.display = next.openStealCount > 0 ? '' : 'none';
      empty.style.display = next.steals.length === 0 ? '' : 'none';

      const current = signature(next);
      if (current === rendered) return;
      rendered = current;

      rows.textContent = '';
      for (const steal of next.steals) rows.appendChild(buildSteal(steal, ctx));
    }

    render(view);

    return {
      update: render,
      destroy: () => {
        host.removeEventListener('click', onClick);
        host.textContent = '';
      },
    };
  },
};
