// shell/settings.ts
// The settings dialog: which sections are shown, where they sit, in what order,
// and how big the gutters are.
//
// It edits the layout directly — every change applies to the page behind it, so
// you can see what you are choosing. There is no cancel for that reason; Done
// closes, and Reset to default puts everything back.

import type { SectionDefinition, SectionId } from '../sections/types.js';
import { el } from '../sections/dom.js';
import {
  MAX_RAIL_WIDTH,
  MIN_RAIL_WIDTH,
  PRESETS,
  ZONES,
  listSections,
  placeSection,
  reorderSection,
  zoneOf,
  type V2Layout,
  type Zone,
} from './layoutStore.js';

const ZONE_LABEL: Record<Zone, string> = {
  left: 'LEFT',
  top: 'TOP',
  bottom: 'BTM',
  right: 'RIGHT',
  off: 'OFF',
};

/** Which zones a section can actually be read in. */
function allowedZones(definition: SectionDefinition): Zone[] {
  return ZONES.filter(zone => {
    if (zone === 'off') return true;
    const axis =
      zone === 'left' || zone === 'right' ? 'vertical' : 'horizontal';
    return definition.supports.includes(axis);
  });
}

export const SETTINGS_STYLES = `
  .settings-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  }
  .settings-scrim { position: absolute; inset: 0; background: rgba(6,7,9,.72); }
  .settings-panel {
    position: relative;
    width: 560px;
    max-width: calc(100vw - 40px);
    max-height: calc(100vh - 60px);
    overflow-y: auto;
    background: var(--cc-panel);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 12px;
    box-shadow: 0 30px 70px rgba(0,0,0,.6);
  }
  .settings-header {
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--cc-hairline);
    position: sticky;
    top: 0;
    background: var(--cc-panel);
    z-index: 1;
  }
  /* Focused programmatically so Escape works; the ring would be noise. */
  .settings-panel:focus { outline: none; }
  .settings-title { font-size: 18px; font-weight: 800; color: var(--cc-text); }
  .settings-close {
    font-family: var(--cc-mono);
    font-size: 18px;
    color: var(--cc-mono-dim);
    background: none;
    border: 0;
    cursor: pointer;
    padding: 0 4px;
  }
  .settings-close:hover { color: var(--cc-text); }

  .settings-group { padding: 18px 20px 8px; }
  .settings-group-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .settings-legend {
    font-family: var(--cc-mono);
    font-size: 11px;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--cc-accent);
  }
  .settings-hint {
    font-family: var(--cc-mono);
    font-size: 11px;
    color: var(--cc-label-dim);
  }

  .preset-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .preset {
    background: var(--cc-surface);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 7px;
    padding: 9px 13px;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    min-width: 0;
  }
  .preset:hover { border-color: var(--cc-accent); }
  .preset--active {
    background: var(--cc-accent-tint);
    border-color: var(--cc-accent);
  }
  .preset-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--cc-text-body);
    line-height: 1.2;
  }
  .preset--active .preset-name { color: var(--cc-accent); }
  .preset-note {
    font-size: 11px;
    color: var(--cc-label-dim);
    line-height: 1.3;
    margin-top: 2px;
  }

  .section-list { display: flex; flex-direction: column; gap: 6px; }
  .section-row {
    background: var(--cc-surface);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .section-row--off { border-color: transparent; }
  .section-row-text { flex: 1; min-width: 0; }
  .section-row-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--cc-text-body);
    line-height: 1.2;
  }
  .section-row--off .section-row-name { color: var(--cc-label-dim); }
  .section-row-note {
    font-size: 11px;
    color: var(--cc-label-dim);
    line-height: 1.3;
    margin-top: 2px;
  }

  .zone-picker {
    display: flex;
    gap: 2px;
    background: rgba(0,0,0,.35);
    border-radius: 7px;
    padding: 2px;
  }
  .zone-button {
    font-family: var(--cc-mono);
    font-size: 11px;
    padding: 5px 8px;
    border-radius: 5px;
    border: 0;
    background: none;
    color: var(--cc-mono-dim);
    cursor: pointer;
  }
  .zone-button:hover:not(:disabled) { color: var(--cc-text); }
  .zone-button--active {
    background: var(--cc-accent);
    color: var(--cc-panel);
    font-weight: 700;
  }
  .zone-button:disabled { color: var(--cc-zero); cursor: not-allowed; }

  .reorder { display: flex; flex-direction: column; gap: 2px; }
  .reorder button {
    width: 22px;
    height: 15px;
    border: 0;
    border-radius: 4px;
    background: rgba(255,255,255,.07);
    color: var(--cc-chevron);
    font-size: 9px;
    line-height: 1;
    cursor: pointer;
  }
  .reorder button:hover:not(:disabled) { background: rgba(255,255,255,.16); color: var(--cc-text); }
  .reorder button:disabled { color: var(--cc-zero); cursor: default; }

  .size-row { display: flex; align-items: center; gap: 14px; margin-top: 10px; }
  .size-row:first-of-type { margin-top: 0; }
  .size-label { font-size: 13px; color: var(--cc-text-muted); width: 92px; }
  .size-row input { flex: 1; accent-color: var(--cc-accent); }
  .size-value {
    font-family: var(--cc-mono);
    font-size: 12px;
    color: var(--cc-text-muted);
    width: 52px;
    text-align: right;
  }

  .settings-footer {
    padding: 18px 20px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .settings-reset {
    font-family: var(--cc-mono);
    font-size: 11px;
    color: var(--cc-mono-dim);
    background: none;
    border: 0;
    cursor: pointer;
    padding: 0;
  }
  .settings-reset:hover { color: var(--cc-text); }
  .settings-done {
    background: var(--cc-accent);
    color: var(--cc-panel);
    font-family: inherit;
    font-size: 14px;
    font-weight: 800;
    border: 0;
    border-radius: 8px;
    padding: 9px 18px;
    cursor: pointer;
  }
  .settings-done:hover { filter: brightness(1.08); }
`;

export interface SettingsOptions {
  layout(): V2Layout;
  sections(): SectionDefinition[];
  onLayout(next: V2Layout): void;
  onSize(gutter: 'rail' | 'bar', size: number): void;
  onReset(): void;
  onClose(): void;
}

export class SettingsDialog {
  private root: HTMLElement | null = null;
  private body: HTMLElement | null = null;

  constructor(private readonly options: SettingsOptions) {}

  isOpen(): boolean {
    return this.root !== null;
  }

  open(parent: ParentNode): void {
    if (this.root) return;

    const backdrop = el('div', 'settings-backdrop');
    const scrim = el('div', 'settings-scrim');
    scrim.addEventListener('click', () => this.options.onClose());

    const panel = el('div', 'settings-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Counter settings');

    const header = el('div', 'settings-header');
    header.append(el('div', 'settings-title', 'Counter settings'));
    const close = el('button', 'settings-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close settings');
    close.addEventListener('click', () => this.options.onClose());
    header.appendChild(close);

    const body = el('div');
    panel.append(header, body);
    backdrop.append(scrim, panel);
    parent.appendChild(backdrop);

    this.root = backdrop;
    this.body = body;
    this.render();

    // Escape closes, as a dialog should.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.options.onClose();
    };
    backdrop.addEventListener('keydown', onKey);
    panel.tabIndex = -1;
    panel.focus();
  }

  close(): void {
    this.root?.remove();
    this.root = null;
    this.body = null;
  }

  /** Rebuild the dialog's contents from the current layout. */
  render(): void {
    if (!this.body) return;
    const layout = this.options.layout();
    const definitions = this.options.sections();
    const byId = new Map(definitions.map(d => [d.id, d]));

    this.body.textContent = '';
    this.body.append(
      this.buildPresets(layout),
      this.buildSections(layout, byId),
      this.buildSizes(layout),
      this.buildFooter()
    );
  }

  private group(legend: string, hint?: string): HTMLElement {
    const group = el('div', 'settings-group');
    const head = el('div', 'settings-group-head');
    head.appendChild(el('span', 'settings-legend', legend));
    if (hint) head.appendChild(el('span', 'settings-hint', hint));
    group.appendChild(head);
    return group;
  }

  private buildPresets(layout: V2Layout): HTMLElement {
    const group = this.group('Presets');
    const row = el('div', 'preset-row');

    for (const preset of PRESETS) {
      const built = preset.build();
      const active = samePlacement(built, layout);
      const button = el('button', active ? 'preset preset--active' : 'preset');
      button.type = 'button';
      button.append(
        el('div', 'preset-name', preset.name),
        el('div', 'preset-note', preset.note)
      );
      button.addEventListener('click', () => {
        // Presets set placement only; the current gutter sizes are kept.
        const next = preset.build();
        next.left.size = layout.left.size;
        next.right.size = layout.right.size;
        next.top.size = layout.top.size;
        next.bottom.size = layout.bottom.size;
        this.options.onLayout(next);
      });
      row.appendChild(button);
    }

    group.appendChild(row);
    return group;
  }

  private buildSections(
    layout: V2Layout,
    byId: Map<SectionId, SectionDefinition>
  ): HTMLElement {
    const group = this.group('Sections', 'place · reorder · hide');
    const list = el('div', 'section-list');

    const rows = listSections(
      layout,
      [...byId.keys()].filter((id): id is SectionId => byId.has(id))
    );

    rows.forEach(({ id, zone }, index) => {
      const definition = byId.get(id);
      if (!definition) return;

      const row = el(
        'div',
        zone === 'off' ? 'section-row section-row--off' : 'section-row'
      );
      // Deliberately not data-section: that identifies a MOUNTED section in a
      // gutter, and sharing it makes every selector ambiguous.
      row.dataset.settingsRow = id;

      const text = el('div', 'section-row-text');
      text.append(el('div', 'section-row-name', definition.title));
      if (definition.note) {
        text.append(el('div', 'section-row-note', definition.note));
      }
      row.appendChild(text);
      row.appendChild(this.buildZonePicker(layout, definition, zone));
      row.appendChild(this.buildReorder(layout, rows, id, zone, index));
      list.appendChild(row);
    });

    group.appendChild(list);
    return group;
  }

  private buildZonePicker(
    layout: V2Layout,
    definition: SectionDefinition,
    zone: Zone
  ): HTMLElement {
    const picker = el('div', 'zone-picker');
    const allowed = allowedZones(definition);

    for (const candidate of ZONES) {
      const button = el(
        'button',
        candidate === zone ? 'zone-button zone-button--active' : 'zone-button',
        ZONE_LABEL[candidate]
      );
      button.type = 'button';
      button.dataset.zone = candidate;

      if (!allowed.includes(candidate)) {
        // Saying why beats a control that silently does nothing.
        button.disabled = true;
        button.title = `${definition.title} is too wide to read in a side rail`;
      } else {
        button.addEventListener('click', () =>
          this.options.onLayout(placeSection(layout, definition.id, candidate))
        );
      }
      picker.appendChild(button);
    }
    return picker;
  }

  private buildReorder(
    layout: V2Layout,
    rows: Array<{ id: SectionId; zone: Zone }>,
    id: SectionId,
    zone: Zone,
    index: number
  ): HTMLElement {
    const inZone = rows.filter(row => row.zone === zone);
    const position = inZone.findIndex(row => row.id === id);

    const wrap = el('div', 'reorder');
    const step = (direction: -1 | 1, label: string, disabled: boolean) => {
      const button = el('button', undefined, label);
      button.type = 'button';
      button.disabled = disabled;
      button.setAttribute(
        'aria-label',
        direction === -1 ? 'Move up' : 'Move down'
      );
      if (!disabled) {
        button.addEventListener('click', () =>
          this.options.onLayout(reorderSection(layout, id, direction))
        );
      }
      return button;
    };

    wrap.append(
      step(-1, '▲', position <= 0),
      step(1, '▼', position < 0 || position >= inZone.length - 1)
    );
    return wrap;
  }

  private buildSizes(layout: V2Layout): HTMLElement {
    const group = this.group('Gutter size');

    const slider = (
      label: string,
      value: number,
      min: number,
      max: number,
      onInput: (next: number) => void
    ) => {
      const row = el('div', 'size-row');
      const input = el('input');
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = '5';
      input.value = String(value);
      input.setAttribute('aria-label', label);

      const readout = el('span', 'size-value', `${value}px`);
      input.addEventListener('input', () => {
        const next = Number(input.value);
        readout.textContent = `${next}px`;
        onInput(next);
      });

      row.append(el('span', 'size-label', label), input, readout);
      return row;
    };

    group.append(
      slider('Side rail', layout.left.size, MIN_RAIL_WIDTH, MAX_RAIL_WIDTH, n =>
        this.options.onSize('rail', n)
      ),
      slider('Bottom bar', layout.bottom.size, 150, 320, n =>
        this.options.onSize('bar', n)
      )
    );
    return group;
  }

  private buildFooter(): HTMLElement {
    const footer = el('div', 'settings-footer');

    const reset = el('button', 'settings-reset', 'RESET TO DEFAULT');
    reset.type = 'button';
    reset.addEventListener('click', () => this.options.onReset());

    const done = el('button', 'settings-done', 'Done');
    done.type = 'button';
    done.addEventListener('click', () => this.options.onClose());

    footer.append(reset, done);
    return footer;
  }
}

/** Whether two layouts place every section the same way, sizes aside. */
function samePlacement(a: V2Layout, b: V2Layout): boolean {
  const ids = new Set<SectionId>();
  for (const layout of [a, b]) {
    for (const zone of ZONES) {
      const list = zone === 'off' ? (layout.off ?? []) : layout[zone].sections;
      for (const placement of list) ids.add(placement.id);
    }
  }
  for (const id of ids) {
    if (zoneOf(a, id) !== zoneOf(b, id)) return false;
  }
  return true;
}
