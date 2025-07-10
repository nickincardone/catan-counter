import { ResourceObjectType } from './types.js';

export const RESOURCE_STRING =
  'img[alt="grain"], img[alt="wool"], img[alt="lumber"], img[alt="brick"], img[alt="ore"], img[alt="Grain"], img[alt="Wool"], img[alt="Lumber"], img[alt="Brick"], img[alt="Ore"]';

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
  const playerSpan = element.querySelector(
    'span[style*="font-weight:600"], span[style*="font-weight: 600"]'
  );
  return playerSpan ? playerSpan.textContent || null : null;
}

export function getPlayerColor(element: HTMLElement): string {
  const playerSpan = element.querySelector(
    'span[style*="font-weight:600"], span[style*="font-weight: 600"]'
  ) as HTMLElement;
  return playerSpan ? playerSpan.style.color || '#000' : '#000';
}

/**
 * Automatically detects the current player from the header profile username
 * This eliminates the need for user input popups
 */
export function getCurrentPlayerFromHeader(): string | null {
  const headerElement = document.getElementById('header_profile_username');
  if (!headerElement) {
    console.log('🔍 header_profile_username element not found');
    return null;
  }

  const currentPlayer = headerElement.textContent?.trim() || null;
  if (currentPlayer) {
    console.log(`🎯 Auto-detected current player: ${currentPlayer}`);
  } else {
    console.log('🔍 header_profile_username element found but empty');
  }

  return currentPlayer;
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
  if (!alt) return null;

  switch (alt.toLowerCase()) {
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
  const spans = element.querySelectorAll(
    'span[style*="font-weight:600"], span[style*="font-weight: 600"]'
  );
  return spans.length > 1 ? spans[1].textContent || null : null;
}

export function getResourcesFromImages(
  element: HTMLElement,
  stopAt?: string
): { [key in keyof ResourceObjectType]: number } {
  const resources = { sheep: 0, wheat: 0, brick: 0, tree: 0, ore: 0 };
  const selector = RESOURCE_STRING;

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
    const alt = img.getAttribute('alt')?.toLowerCase();
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

/**
 * Parse trade resources from HTML element by splitting on text markers
 */
export function parseTradeResources(element: HTMLElement): {
  gave: Partial<ResourceObjectType>;
  got: Partial<ResourceObjectType>;
} | null {
  const elementHTML = element.innerHTML;

  const gaveEndIndex = elementHTML.indexOf(' and got ');
  const fromIndex = elementHTML.indexOf(' from ');

  if (gaveEndIndex === -1 || fromIndex === -1) return null;

  // Extract the "gave" section (before " and got ")
  const gaveDiv = document.createElement('div');
  gaveDiv.innerHTML = elementHTML.substring(0, gaveEndIndex);

  // Extract the "got" section (between " and got " and " from ")
  const gotDiv = document.createElement('div');
  const gotStartIndex = gaveEndIndex + ' and got '.length;
  gotDiv.innerHTML = elementHTML.substring(gotStartIndex, fromIndex);

  // Count resources in each section
  const gave: Partial<ResourceObjectType> = {};
  const got: Partial<ResourceObjectType> = {};

  // Count gave resources
  gaveDiv.querySelectorAll('img').forEach(img => {
    const resourceType = getResourceTypeFromAlt(img.getAttribute('alt'));
    if (resourceType) {
      gave[resourceType] = (gave[resourceType] || 0) + 1;
    }
  });

  // Count got resources
  gotDiv.querySelectorAll('img').forEach(img => {
    const resourceType = getResourceTypeFromAlt(img.getAttribute('alt'));
    if (resourceType) {
      got[resourceType] = (got[resourceType] || 0) + 1;
    }
  });

  return { gave, got };
}

/**
 * Get the victim name from a steal message
 */
export function getStealVictim(element: HTMLElement): string | null {
  // Get the victim (second span with font-weight:600, after "from")
  // Handle both "font-weight:600" and "font-weight: 600" formats
  const victimSpans = element.querySelectorAll(
    'span[style*="font-weight:600"], span[style*="font-weight: 600"]'
  );
  // if there are not two spans then the first user is "you"
  return victimSpans.length >= 2
    ? victimSpans[1].textContent || null
    : victimSpans[0].textContent || null;
}

/**
 * Parse bank trade resources from HTML element
 */
export function parseBankTrade(
  element: HTMLElement
): Partial<ResourceObjectType> | null {
  const elementHTML = element.innerHTML;

  const tookIndex = elementHTML.indexOf(' and took ');
  if (tookIndex === -1) return null;

  // Extract the "gave" section (before " and took ")
  const gaveDiv = document.createElement('div');
  gaveDiv.innerHTML = elementHTML.substring(0, tookIndex);

  // Extract the "took" section (after " and took ")
  const tookDiv = document.createElement('div');
  const tookStartIndex = tookIndex + ' and took '.length;
  tookDiv.innerHTML = elementHTML.substring(tookStartIndex);

  // Count resources in each section using the same approach as parseTradeResources
  const resourceChanges: Partial<ResourceObjectType> = {};

  // Count gave resources (subtract them)
  gaveDiv.querySelectorAll('img').forEach(img => {
    const resourceType = getResourceTypeFromAlt(img.getAttribute('alt'));
    if (resourceType) {
      resourceChanges[resourceType] = (resourceChanges[resourceType] || 0) - 1;
    }
  });

  // Count took resources (add them)
  tookDiv.querySelectorAll('img').forEach(img => {
    const resourceType = getResourceTypeFromAlt(img.getAttribute('alt'));
    if (resourceType) {
      resourceChanges[resourceType] = (resourceChanges[resourceType] || 0) + 1;
    }
  });

  return resourceChanges;
}

/**
 * Parse offered resources from counter offer HTML element
 */
export function parseCounterOfferResources(
  element: HTMLElement
): Partial<ResourceObjectType> {
  const resources: Partial<ResourceObjectType> = {};

  const innerHTML = element.innerHTML;
  const forIndex = innerHTML.indexOf(' for ');

  let htmlBeforeFor: string;
  if (forIndex === -1) {
    htmlBeforeFor = innerHTML;
  } else {
    htmlBeforeFor = innerHTML.substring(0, forIndex);
  }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlBeforeFor;

  // Find all resource images in the offering part only
  const resourceImages = tempDiv.querySelectorAll(RESOURCE_STRING);

  resourceImages.forEach(img => {
    const resourceType = getResourceTypeFromAlt(img.getAttribute('alt'));
    if (resourceType) {
      resources[resourceType] = (resources[resourceType] || 0) + 1;
    }
  });

  return resources;
}

/**
 * Extract dice number from blocked dice message
 * Example: <img alt="prob_6"> -> 6
 */
export function getBlockedDiceNumber(element: HTMLElement): number | null {
  const diceImg = element.querySelector('img[alt^="prob_"]');
  if (diceImg) {
    const alt = diceImg.getAttribute('alt');
    const match = alt?.match(/prob_(\d+)/);
    return match ? parseInt(match[1]) : null;
  }
  return null;
}

/**
 * Extract resource type from blocked dice message
 * Example: <img alt="wool tile"> -> sheep
 */
export function getBlockedResourceType(element: HTMLElement): string | null {
  const tileImg = element.querySelector('img[alt$=" tile"]');
  if (tileImg) {
    const alt = tileImg.getAttribute('alt');
    const match = alt?.match(/(\w+) tile/);
    if (match) {
      const resourceName = match[1];
      // Convert tile resource names to our internal names
      switch (resourceName) {
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
          return resourceName;
      }
    }
  }
  return null;
}
