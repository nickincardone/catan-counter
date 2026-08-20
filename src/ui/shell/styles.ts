// shell/styles.ts
// The shadow root's stylesheet: tokens, gutter frame, and shared primitives.
// Section-specific rules live with their sections and are appended by the shell.
//
// Everything here is inside a shadow root, so these class names cannot collide
// with colonist's and colonist's cannot leak in. That is what lets v2 use plain
// class names at all — the original overlay has to inline every rule on every
// element to survive the page's stylesheet.

import { FONT_MONO, FONT_SANS, RESOURCE_STYLE, THEME } from './theme.js';

function tokens(): string {
  const resourceVars = Object.entries(RESOURCE_STYLE)
    .map(
      ([key, style]) =>
        `--cc-${key}: ${style.color}; --cc-${key}-tint: ${style.tint};`
    )
    .join('\n      ');

  return `
    :host {
      --cc-panel: ${THEME.panel};
      --cc-hairline: ${THEME.hairline};
      --cc-surface: ${THEME.surface};
      --cc-surface-empty: ${THEME.surfaceEmpty};
      --cc-accent: ${THEME.accent};
      --cc-accent-tint: ${THEME.accentTint};
      --cc-accent-border: ${THEME.accentBorder};
      --cc-good: ${THEME.good};
      --cc-good-text: ${THEME.goodText};
      --cc-good-tint: ${THEME.goodTint};
      --cc-good-border: ${THEME.goodBorder};
      --cc-probable: ${THEME.probable};
      --cc-danger: ${THEME.danger};
      --cc-loss-text: ${THEME.lossText};
      --cc-spend-text: ${THEME.spendText};
      --cc-bar: ${THEME.bar};
      --cc-text: ${THEME.text};
      --cc-text-body: ${THEME.textBody};
      --cc-text-muted: ${THEME.textMuted};
      --cc-label-dim: ${THEME.labelDim};
      --cc-mono-dim: ${THEME.monoDim};
      --cc-zero: ${THEME.zero};
      --cc-well: ${THEME.well};
      --cc-chevron: ${THEME.chevron};
      --cc-font: ${FONT_SANS};
      --cc-mono: ${FONT_MONO};
      ${resourceVars}
    }
  `;
}

const FRAME = `
  :host {
    all: initial;
    position: fixed;
    inset: 0;
    /* The frame itself must never eat clicks meant for the game. */
    pointer-events: none;
    z-index: 2147483646;
    font-family: var(--cc-font);
    color: var(--cc-text-body);
  }

  *, *::before, *::after { box-sizing: border-box; }

  .gutter {
    position: fixed;
    background: var(--cc-panel);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: auto;
  }
  .gutter--left   { left: 0; top: 0; bottom: 0; border-right: 1px solid var(--cc-hairline); }
  .gutter--right  { right: 0; top: 0; bottom: 0; border-left: 1px solid var(--cc-hairline); }
  .gutter--top    { top: 0; border-bottom: 1px solid var(--cc-hairline); }
  .gutter--bottom { bottom: 0; border-top: 1px solid var(--cc-hairline); }

  /* Body scrolls in a column gutter; a strip gutter lays sections side by side. */
  .gutter-body {
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
  }
  .gutter--vertical .gutter-body {
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: 18px;
  }
  .gutter--horizontal .gutter-body {
    flex-direction: row;
    overflow: hidden;
  }
  .gutter--horizontal .section + .section {
    border-left: 1px solid var(--cc-hairline);
  }
  .gutter--horizontal .section {
    min-width: 0;
    overflow: hidden;
    padding: 12px 18px 14px;
    display: flex;
    flex-direction: column;
  }

  .gutter--collapsed .gutter-body,
  .gutter--collapsed .rail-brand { display: none; }

  /* ---- rail header ---- */
  .rail-header {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--cc-hairline);
  }
  .gutter--collapsed .rail-header {
    padding: 12px 0;
    justify-content: center;
    border-bottom: none;
  }
  .rail-brand { display: flex; align-items: center; gap: 9px; min-width: 0; }
  .rail-logo {
    width: 24px; height: 24px; flex: none;
    border-radius: 6px;
    background: var(--cc-accent);
    color: var(--cc-panel);
    font-weight: 800;
    font-size: 14px;
    display: flex; align-items: center; justify-content: center;
  }
  .rail-title {
    font-weight: 800; font-size: 18px; color: var(--cc-text); line-height: 1.1;
  }
  .rail-controls { display: flex; align-items: center; gap: 2px; }
  .rail-gear {
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--cc-chevron);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
  }
  .rail-gear:hover { background: rgba(255,255,255,.08); color: var(--cc-text); }

  /* Shown only when neither rail is on screen to hold the header. */
  .floating-gear {
    position: fixed;
    top: 14px;
    right: 14px;
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 8px;
    background: rgba(14,16,19,.85);
    color: var(--cc-text-body);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: auto;
    padding: 0;
  }
  .floating-gear:hover { background: var(--cc-panel); }

  .rail-collapse {
    font-family: var(--cc-mono);
    font-size: 16px;
    line-height: 1;
    color: var(--cc-chevron);
    background: none;
    border: 0;
    padding: 4px;
    cursor: pointer;
  }
  .rail-collapse:hover { color: var(--cc-text); }

  /* ---- resize handle ---- */
  .gutter-resize { position: absolute; z-index: 2; }
  .gutter-resize:hover { background: var(--cc-accent-border); }
  .gutter--left .gutter-resize   { top: 0; bottom: 0; right: -2px; width: 5px; cursor: ew-resize; }
  .gutter--right .gutter-resize  { top: 0; bottom: 0; left: -2px; width: 5px; cursor: ew-resize; }
  .gutter--bottom .gutter-resize { left: 0; right: 0; top: -2px; height: 5px; cursor: ns-resize; }
  .gutter--top .gutter-resize    { left: 0; right: 0; bottom: -2px; height: 5px; cursor: ns-resize; }

  /* ---- shared section primitives ---- */
  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .gutter--vertical .section-head { padding: 14px 14px 8px; }
  .gutter--horizontal .section-head { margin-bottom: 10px; }
  .section-label {
    font-family: var(--cc-mono);
    font-size: 11px;
    letter-spacing: .14em;
    color: var(--cc-accent);
    text-transform: uppercase;
    white-space: nowrap;
  }
  .section-hint {
    font-family: var(--cc-mono);
    font-size: 11px;
    color: var(--cc-label-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .section-note {
    padding: 14px 14px 0;
    font-size: 12px;
    color: var(--cc-label-dim);
    line-height: 1.45;
  }
  .section-empty {
    padding: 4px 14px 0;
    font-size: 12px;
    color: var(--cc-mono-dim);
  }
  .section-rows { padding: 0 10px; display: flex; flex-direction: column; gap: 6px; }

  /* ---- loading + placeholder states ---- */
  .rail-status {
    padding: 22px 14px;
    text-align: center;
    color: var(--cc-text-muted);
    font-size: 13px;
    line-height: 1.5;
  }
  .rail-status-detail {
    margin-top: 6px;
    font-size: 12px;
    color: var(--cc-label-dim);
  }
  .rail-spinner {
    width: 22px; height: 22px;
    margin: 0 auto 10px;
    border: 2px solid var(--cc-hairline);
    border-top-color: var(--cc-accent);
    border-radius: 50%;
    animation: cc-spin 0.9s linear infinite;
  }
  @keyframes cc-spin { to { transform: rotate(360deg); } }

  @media (prefers-reduced-motion: reduce) {
    .rail-spinner { animation-duration: 4s; }
  }
`;

export function buildStyleSheet(sectionStyles: string[]): string {
  // No @font-face here: Chrome ignores those inside a shadow root. The bundled
  // faces are registered on the document by shell/fonts.ts instead.
  return [tokens(), FRAME, ...sectionStyles].join('\n');
}
