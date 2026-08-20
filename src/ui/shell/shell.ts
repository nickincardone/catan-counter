// shell/shell.ts
// Builds the gutter frame, places sections into it from the layout, and keeps
// colonist squeezed to fit. The shell knows about gutters and never about what
// a section renders; a section knows what it renders and never about gutters.

import { buildGameView } from '../view/gameView.js';
import type { GameView } from '../view/types.js';
import { game } from '../../gameState.js';
import {
  getSection,
  registeredStyles,
  type SectionRegistry,
} from '../sections/registry.js';
import type {
  GutterAxis,
  SectionAction,
  SectionInstance,
} from '../sections/types.js';
import {
  COLLAPSED_SIZE,
  DEFAULT_LAYOUT,
  GUTTER_NAMES,
  MAX_RAIL_WIDTH,
  MIN_RAIL_WIDTH,
  cloneLayout,
  gutterThickness,
  readLayout,
  writeLayout,
  type GutterName,
  type V2Layout,
} from './layoutStore.js';
import { buildStyleSheet } from './styles.js';
import {
  applyPageFrame,
  refreshPageFrame,
  releasePageFrame,
} from './pageFrame.js';

declare const chrome: { runtime?: { getURL?: (path: string) => string } };

export const ROOT_ID = 'catan-v2-root';

const AXIS: Record<GutterName, GutterAxis> = {
  left: 'vertical',
  right: 'vertical',
  top: 'horizontal',
  bottom: 'horizontal',
};

/** Extension assets need an absolute URL; tests run without the API. */
function assetUrl(path: string): string {
  try {
    return chrome?.runtime?.getURL?.(path) ?? path;
  } catch {
    return path;
  }
}

interface MountedSection {
  instance: SectionInstance;
  host: HTMLElement;
}

interface ShellStatus {
  text: string;
  detail: string;
  spinner: boolean;
}

/**
 * Whether the gutters should show a status instead of the sections. Both cases
 * are moments when the tables would be actively misleading: during a history
 * replay the counts are still being rebuilt, and before the first roll the
 * tracker deliberately discards and rebuilds its variant tree.
 */
function statusFor(view: GameView): ShellStatus | null {
  if (view.isLoadingHistory) {
    return {
      text: 'Rebuilding game history',
      detail: 'Reading the chat back from the start of the game.',
      spinner: true,
    };
  }
  if (!view.hasStarted) {
    return {
      text: 'Waiting for the first dice roll',
      detail: 'Tracking begins with the first roll of the game.',
      spinner: false,
    };
  }
  return null;
}

function buildStatus(status: ShellStatus, withDetail: boolean): HTMLElement {
  const host = document.createElement('div');
  host.className = 'rail-status';
  if (status.spinner) {
    const spinner = document.createElement('div');
    spinner.className = 'rail-spinner';
    host.appendChild(spinner);
  }
  const text = document.createElement('div');
  text.textContent = status.text;
  host.appendChild(text);
  // Only the gutter carrying the header has room for the longer explanation.
  if (withDetail) {
    const detail = document.createElement('div');
    detail.className = 'rail-status-detail';
    detail.textContent = status.detail;
    host.appendChild(detail);
  }
  return host;
}

export interface ShellOptions {
  onAction(action: SectionAction): void;
  registry?: SectionRegistry;
}

export class Shell {
  private root: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private layout: V2Layout = cloneLayout(DEFAULT_LAYOUT);
  private gutters = new Map<GutterName, HTMLElement>();
  private mounted = new Map<string, MountedSection>();
  private historyLoading = false;
  /** Status text currently rendered, so update() can notice a transition. */
  private status = '';
  private disposers: Array<() => void> = [];
  private framePending = false;

  constructor(private readonly options: ShellOptions) {}

  isMounted(): boolean {
    return this.root !== null;
  }

  mount(): void {
    if (this.root) return;

    this.root = document.createElement('div');
    this.root.id = ROOT_ID;
    // documentElement, not body: colonist's own children get shifted, and this
    // must not be one of them.
    document.documentElement.appendChild(this.root);
    this.shadow = this.root.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = buildStyleSheet(assetUrl, registeredStyles());
    this.shadow.appendChild(style);

    this.render();

    // Colonist re-lays out on window resize; so must the frame.
    const onResize = () => void this.syncPageFrame();
    window.addEventListener('resize', onResize);
    this.disposers.push(() => window.removeEventListener('resize', onResize));

    // Storage answers after the first paint; re-render if it differs.
    void readLayout().then(stored => {
      if (!this.root) return;
      if (JSON.stringify(stored) === JSON.stringify(this.layout)) return;
      this.layout = stored;
      this.render();
    });
  }

  unmount(): void {
    if (!this.root) return;
    this.destroySections();
    this.disposers.forEach(dispose => dispose());
    this.disposers = [];
    this.gutters.clear();
    this.root.remove();
    this.root = null;
    this.shadow = null;
    void releasePageFrame();
  }

  setHistoryLoading(loading: boolean): void {
    if (this.historyLoading === loading) return;
    this.historyLoading = loading;
    this.render();
  }

  update(): void {
    if (!this.root) return;
    const view = this.currentView();

    // Crossing into or out of a status state swaps what the gutters hold, so it
    // needs a full render rather than an update of sections that aren't mounted.
    const status = statusFor(view)?.text ?? '';
    if (status !== this.status) {
      this.render();
      return;
    }

    // A section that throws must not take the rest of the UI down with it.
    for (const [id, section] of this.mounted) {
      try {
        section.instance.update(view);
      } catch (error) {
        console.warn(`🎛️ Section "${id}" failed to update:`, error);
      }
    }
  }

  private currentView(): GameView {
    return buildGameView(game, { isLoadingHistory: this.historyLoading });
  }

  /** Rebuild the whole frame. Used on mount and whenever the layout changes. */
  private render(): void {
    if (!this.shadow) return;
    this.destroySections();
    this.gutters.forEach(gutter => gutter.remove());
    this.gutters.clear();

    const view = this.currentView();
    const headerGutter = this.headerGutter();
    this.status = statusFor(view)?.text ?? '';

    for (const name of GUTTER_NAMES) {
      const config = this.layout[name];
      if (config.sections.length === 0) continue;

      const gutter = document.createElement('div');
      const collapsed = config.collapsed;
      gutter.className = [
        'gutter',
        `gutter--${name}`,
        `gutter--${AXIS[name]}`,
        collapsed ? 'gutter--collapsed' : '',
      ]
        .filter(Boolean)
        .join(' ');
      this.sizeGutter(gutter, name);

      if (name === headerGutter)
        gutter.appendChild(this.buildHeader(collapsed));

      if (!collapsed) {
        const body = document.createElement('div');
        body.className = 'gutter-body';
        gutter.appendChild(body);
        const status = statusFor(view);
        // While the counts are being rebuilt, or before tracking has begun,
        // showing the tables would show numbers that are about to change.
        if (status) {
          body.appendChild(buildStatus(status, name === headerGutter));
        } else {
          this.fillGutter(body, name, view);
        }
        gutter.appendChild(this.buildResizeHandle(name));
      }

      this.shadow.appendChild(gutter);
      this.gutters.set(name, gutter);
    }

    void this.syncPageFrame();
  }

  /** The header lives in the first gutter that exists, preferring the rail. */
  private headerGutter(): GutterName | null {
    return (
      GUTTER_NAMES.find(name => this.layout[name].sections.length > 0) ?? null
    );
  }

  private sizeGutter(gutter: HTMLElement, name: GutterName): void {
    const thickness = gutterThickness(this.layout[name]);
    const inset = this.insets();
    if (AXIS[name] === 'vertical') {
      gutter.style.width = `${thickness}px`;
    } else {
      gutter.style.height = `${thickness}px`;
      // Horizontal gutters stop at the vertical ones, so the corners belong to
      // the rail — matching the mockup, where the rail runs the full height.
      gutter.style.left = `${inset.left}px`;
      gutter.style.right = `${inset.right}px`;
    }
  }

  private insets() {
    return {
      left: gutterThickness(this.layout.left),
      right: gutterThickness(this.layout.right),
      top: gutterThickness(this.layout.top),
      bottom: gutterThickness(this.layout.bottom),
    };
  }

  private buildHeader(collapsed: boolean): HTMLElement {
    const header = document.createElement('div');
    header.className = 'rail-header';

    const brand = document.createElement('div');
    brand.className = 'rail-brand';
    const logo = document.createElement('div');
    logo.className = 'rail-logo';
    logo.textContent = 'CC';
    const titles = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'rail-title';
    title.textContent = 'Counter';
    titles.appendChild(title);
    brand.append(logo, titles);

    const toggle = document.createElement('button');
    toggle.className = 'rail-collapse';
    toggle.type = 'button';
    toggle.textContent = collapsed ? '›' : '‹';
    toggle.title = collapsed ? 'Expand the counter' : 'Collapse the counter';
    toggle.setAttribute(
      'aria-label',
      collapsed ? 'Expand the counter' : 'Collapse the counter'
    );
    toggle.addEventListener('click', () => this.toggleCollapse());

    header.append(collapsed ? toggle : brand);
    if (!collapsed) header.appendChild(toggle);
    return header;
  }

  private toggleCollapse(): void {
    const name = this.headerGutter();
    if (!name) return;
    this.layout[name].collapsed = !this.layout[name].collapsed;
    void writeLayout(this.layout);
    this.render();
  }

  /** Mount each section the layout puts in this gutter. */
  private fillGutter(
    body: HTMLElement,
    name: GutterName,
    view: GameView
  ): void {
    const axis = AXIS[name];
    const thickness = gutterThickness(this.layout[name]);

    for (const placement of this.layout[name].sections) {
      const definition = getSection(placement.id, this.options.registry);
      if (!definition) {
        console.warn(`🎛️ No section registered as "${placement.id}"`);
        continue;
      }
      if (!definition.supports.includes(axis)) {
        console.warn(
          `🎛️ Section "${placement.id}" cannot render in a ${axis} gutter — skipping`
        );
        continue;
      }
      // Only the gutter's thickness is knowable here; its long axis is shared.
      const available =
        axis === 'vertical' ? definition.min.width : definition.min.height;
      const measured = axis === 'vertical' ? thickness : thickness;
      if (measured < available) {
        console.warn(
          `🎛️ Section "${placement.id}" needs ${available}px but the ${name} gutter is ${measured}px — skipping`
        );
        continue;
      }

      const host = document.createElement('div');
      host.className = 'section';
      host.dataset.section = placement.id;
      if (axis === 'horizontal') {
        host.style.flex = `${placement.weight ?? 1} 1 0`;
      }
      body.appendChild(host);

      try {
        const instance = definition.mount(host, view, {
          axis,
          assetUrl,
          emit: action => this.options.onAction(action),
        });
        this.mounted.set(placement.id, { instance, host });
      } catch (error) {
        console.warn(`🎛️ Section "${placement.id}" failed to mount:`, error);
        host.remove();
      }
    }
  }

  private destroySections(): void {
    for (const [id, section] of this.mounted) {
      try {
        section.instance.destroy();
      } catch (error) {
        console.warn(`🎛️ Section "${id}" failed to unmount:`, error);
      }
    }
    this.mounted.clear();
  }

  private buildResizeHandle(name: GutterName): HTMLElement {
    const handle = document.createElement('div');
    handle.className = 'gutter-resize';
    handle.addEventListener('pointerdown', event => {
      event.preventDefault();
      const vertical = AXIS[name] === 'vertical';
      const start = vertical ? event.clientX : event.clientY;
      const startSize = this.layout[name].size;
      handle.setPointerCapture(event.pointerId);

      const onMove = (move: PointerEvent) => {
        const delta = (vertical ? move.clientX : move.clientY) - start;
        // Left and top gutters grow with the pointer; right and bottom shrink.
        const signed = name === 'left' || name === 'top' ? delta : -delta;
        const next = Math.round(
          Math.min(MAX_RAIL_WIDTH, Math.max(MIN_RAIL_WIDTH, startSize + signed))
        );
        if (next === this.layout[name].size) return;
        this.layout[name].size = next;
        this.applySizes();
      };
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        void writeLayout(this.layout);
        // One squeeze at the end rather than on every pointer move.
        void this.syncPageFrame();
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    });
    return handle;
  }

  /** Cheap path used while dragging: resize boxes without remounting anything. */
  private applySizes(): void {
    for (const [name, gutter] of this.gutters) this.sizeGutter(gutter, name);
  }

  private async syncPageFrame(): Promise<void> {
    if (!this.root || this.framePending) return;
    this.framePending = true;
    try {
      await applyPageFrame(this.insets());
    } finally {
      this.framePending = false;
    }
  }

  /** Test seam: the layout the shell is currently rendering. */
  getLayout(): V2Layout {
    return cloneLayout(this.layout);
  }

  /** Replace the layout wholesale — the seam a future arrangement UI uses. */
  setLayout(layout: V2Layout): void {
    this.layout = cloneLayout(layout);
    void writeLayout(this.layout);
    if (this.root) this.render();
  }

  /** Test seam: the shadow root, so tests can assert on rendered structure. */
  getShadowRoot(): ShadowRoot | null {
    return this.shadow;
  }
}

export { COLLAPSED_SIZE, MIN_RAIL_WIDTH, MAX_RAIL_WIDTH, refreshPageFrame };
