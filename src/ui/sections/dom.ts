// sections/dom.ts
// Small helpers so a section reads as the structure it renders rather than as
// a wall of createElement calls.

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A section header: label on the left, hint on the right. */
export function sectionHead(
  label: string,
  hint = ''
): { head: HTMLElement; labelNode: HTMLElement; hintNode: HTMLElement } {
  const head = el('div', 'section-head');
  const labelNode = el('span', 'section-label', label);
  const hintNode = el('span', 'section-hint', hint);
  head.append(labelNode, hintNode);
  return { head, labelNode, hintNode };
}

export function img(
  src: string,
  alt: string,
  className?: string
): HTMLImageElement {
  const node = el('img', className);
  node.src = src;
  node.alt = alt;
  // Everything referenced here is a bundled asset, never a network fetch.
  node.decoding = 'async';
  return node;
}

/** Replace children in one shot. */
export function replaceChildren(host: HTMLElement, children: Node[]): void {
  host.textContent = '';
  for (const child of children) host.appendChild(child);
}
