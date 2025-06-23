import { ResourceObjectType } from './types.js';

export const RESOURCE_STRING =
  'img[alt="grain"], img[alt="wool"], img[alt="lumber"], img[alt="brick"], img[alt="ore"]';

export function findChatContainer(): HTMLDivElement | null {
  const divs = document.querySelectorAll<HTMLDivElement>('div');

  for (const outerDiv of Array.from(divs)) {
    const firstChild = outerDiv.firstElementChild;

    if (firstChild?.tagName === 'DIV') {
      for (const child of Array.from(firstChild.children)) {
        if (child.tagName === 'SPAN') {
          const anchor = child.querySelector<HTMLAnchorElement>(
            'a[href="#open-rulebook"]'
          );
          if (anchor) {
            return outerDiv;
          }
        }
      }
    }
  }

  return null;
}

export function getPlayerName(element: HTMLElement): string | null {
  const playerSpan = element.querySelector('span[style*="font-weight:600"]');
  return playerSpan ? playerSpan.textContent || null : null;
}

export function getDiceRollTotal(element: HTMLElement): number | null {
  const diceImages = element.querySelectorAll('img[alt^="dice_"]');
  if (diceImages.length === 2) {
    const dice1 = parseInt(
      diceImages[0].getAttribute('alt')?.replace('dice_', '') || '0'
    );
    const dice2 = parseInt(
      diceImages[1].getAttribute('alt')?.replace('dice_', '') || '0'
    );
    return dice1 + dice2;
  }
  return null;
}

export function getResourceType(
  element: HTMLElement
): keyof ResourceObjectType | null {
  const resourceImg = element.querySelector(RESOURCE_STRING);
  if (resourceImg) {
    const alt = resourceImg.getAttribute('alt');
    return getResourceTypeFromAlt(alt);
  }
  return null;
}

export function getResourceTypeFromAlt(
  alt: string | null
): keyof ResourceObjectType | null {
  switch (alt) {
    case 'grain':
      return 'wheat';
    case 'wool':
      return 'sheep';
    case 'lumber':
      return 'tree';
    case 'brick':
      return 'brick';
    case 'ore':
      return 'ore';
    default:
      return null;
  }
}

export function getTradePartner(element: HTMLElement): string | null {
  const spans = element.querySelectorAll('span[style*="font-weight:600"]');
  return spans.length > 1 ? spans[1].textContent || null : null;
}

export function getResourcesFromImages(
  element: HTMLElement,
  selector: string,
  stopAt?: string
): { [key in keyof ResourceObjectType]: number } {
  const resources = { sheep: 0, wheat: 0, brick: 0, tree: 0, ore: 0 };
  
  let targetElement = element;
  
  // If stopAt is provided, create a truncated element
  if (stopAt) {
    const htmlContent = element.innerHTML;
    const stopIndex = htmlContent.indexOf(stopAt);
    if (stopIndex !== -1) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent.substring(0, stopIndex);
      targetElement = tempDiv;
    }
  }
  
  const images = targetElement.querySelectorAll(selector);

  images.forEach(img => {
    const alt = img.getAttribute('alt');
    switch (alt) {
      case 'grain':
        resources.wheat++;
        break;
      case 'wool':
        resources.sheep++;
        break;
      case 'lumber':
        resources.tree++;
        break;
      case 'brick':
        resources.brick++;
        break;
      case 'ore':
        resources.ore++;
        break;
    }
  });

  return resources;
} 