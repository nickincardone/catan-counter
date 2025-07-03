import { game, setYouPlayer, markYouPlayerAsked } from './gameState.js';
import { ResourceObjectType } from './types.js';

// Chrome extension API type declaration
declare const chrome: {
  runtime: {
    getURL: (path: string) => string;
  };
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const RESOURCE_ICONS = {
  tree: 'tree.svg',
  brick: 'brick.svg',
  sheep: 'sheep.svg',
  wheat: 'wheat.svg',
  ore: 'ore.svg',
} as const;

const STYLES = {
  modalBackdrop: `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10002;
    display: flex;
    justify-content: center;
    align-items: center;
  `,
  modalDialog: `
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    max-width: 400px;
    width: 90%;
    font-family: Arial, sans-serif;
  `,
  primaryButton: `
    padding: 12px;
    border: 2px solid #3498db;
    background: #ecf0f1;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
    transition: all 0.2s;
  `,
  secondaryButton: `
    padding: 8px 16px;
    border: 1px solid #ccc;
    background: #f8f9fa;
    border-radius: 4px;
    cursor: pointer;
    color: #666;
  `,
  resolveButton: `
    position: absolute;
    top: 6px;
    right: 8px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 10px;
    cursor: pointer;
    opacity: 0.8;
  `,
};

/**
 * Format resource name with proper capitalization
 */
function formatResourceName(resource: string): string {
  return String(resource).charAt(0).toUpperCase() + String(resource).slice(1);
}

/**
 * Get resource icon URL
 */
function getResourceIconUrl(resource: keyof typeof RESOURCE_ICONS): string {
  return chrome.runtime.getURL(`assets/${RESOURCE_ICONS[resource]}`);
}

/**
 * Create a modal backdrop element
 */
function createModalBackdrop(): HTMLDivElement {
  const backdrop = document.createElement('div');
  backdrop.style.cssText = STYLES.modalBackdrop;
  return backdrop;
}

/**
 * Create a modal dialog element
 */
function createModalDialog(): HTMLDivElement {
  const dialog = document.createElement('div');
  dialog.style.cssText = STYLES.modalDialog;
  return dialog;
}

/**
 * Create a button element with hover effects
 */
function createButton(
  text: string,
  style: string,
  hoverStyle?: { background: string; color: string }
): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = text;
  button.style.cssText = style;

  if (hoverStyle) {
    button.addEventListener('mouseover', () => {
      button.style.background = hoverStyle.background;
      button.style.color = hoverStyle.color;
    });
    button.addEventListener('mouseout', () => {
      button.style.background = '#ecf0f1';
      button.style.color = 'black';
    });
  }

  return button;
}

/**
 * Create a resource button with icon and probability
 */
function createResourceButton(
  resource: string,
  probability: number,
  onClick: () => void
): HTMLButtonElement {
  const button = document.createElement('button');
  button.setAttribute('data-resource', resource);
  button.style.cssText = `
    ${STYLES.primaryButton}
    display: flex;
    align-items: center;
    gap: 10px;
  `;

  const iconUrl = getResourceIconUrl(resource as keyof typeof RESOURCE_ICONS);
  button.innerHTML = `
    <img src="${iconUrl}" 
         style="width: 20px; height: 20px;" 
         alt="${resource}" />
    <span>${formatResourceName(resource)}</span>
    <span style="margin-left: auto; font-size: 12px; opacity: 0.7;">${(probability * 100).toFixed(1)}%</span>
  `;

  // Add hover effects
  button.addEventListener('mouseover', () => {
    button.style.background = '#3498db';
    button.style.color = 'white';
  });
  button.addEventListener('mouseout', () => {
    button.style.background = '#ecf0f1';
    button.style.color = 'black';
  });

  button.addEventListener('click', onClick);
  return button;
}

/**
 * Format probability text from resource probabilities
 */
function formatProbabilityText(
  resourceProbabilities: ResourceObjectType
): string {
  return Object.entries(resourceProbabilities)
    .filter(([_, probability]) => probability > 0)
    .sort(([_, a], [__, b]) => b - a)
    .map(([resource, probability]) => `${resource}: ${probability.toFixed(2)}`)
    .join(', ');
}

// =============================================================================
// MAIN OVERLAY FUNCTIONALITY
// =============================================================================

// Create draggable overlay for game state display
let gameStateOverlay: HTMLDivElement | null = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let isMinimized = false;
let isResizing = false;
let currentScale = 1;
let resizeStartData = { x: 0, y: 0, scale: 1 };
let youPlayerSelectedCallback: (() => void) | null = null;

function createGameStateOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.id = 'catan-game-state-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 450px;
    max-height: 1000px;
    background: white;
    border: 2px solid #333;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    overflow: visible;
    z-index: 10000;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    color: black;
    transform-origin: top left;
    transform: scale(${currentScale});
  `;

  // Add drag and resize functionality
  overlay.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', stopDragAndResize);

  // Initial content
  updateOverlayContent(overlay);

  return overlay;
}

function startDrag(e: MouseEvent): void {
  if (!gameStateOverlay) return;

  const target = e.target as HTMLElement;

  // Check if clicking on resize handle
  if (target.classList.contains('resize-handle')) {
    isResizing = true;
    resizeStartData = {
      x: e.clientX,
      y: e.clientY,
      scale: currentScale,
    };
    e.preventDefault();
    return;
  }

  // Only allow dragging from the header
  const header = gameStateOverlay.querySelector('#overlay-header');
  if (!header?.contains(target) || target.id === 'minimize-btn') return;

  isDragging = true;
  const rect = gameStateOverlay.getBoundingClientRect();
  dragOffset.x = e.clientX - rect.left;
  dragOffset.y = e.clientY - rect.top;

  // Prevent text selection while dragging
  e.preventDefault();
}

function handleMouseMove(e: MouseEvent): void {
  if (isResizing && gameStateOverlay) {
    const deltaX = e.clientX - resizeStartData.x;
    const deltaY = e.clientY - resizeStartData.y;
    const avgDelta = (deltaX + deltaY) / 2;

    // Calculate new scale (minimum 0.5, maximum 2.0)
    const scaleFactor = avgDelta / 300; // Adjust sensitivity
    currentScale = Math.max(
      0.5,
      Math.min(2.0, resizeStartData.scale + scaleFactor)
    );

    // Apply the new scale
    gameStateOverlay.style.transform = `scale(${currentScale})`;
    e.preventDefault();
    return;
  }

  if (!isDragging || !gameStateOverlay) return;

  const x = e.clientX - dragOffset.x;
  const y = e.clientY - dragOffset.y;

  // Keep overlay within viewport (accounting for scale)
  const scaledWidth = gameStateOverlay.offsetWidth * currentScale;
  const scaledHeight = gameStateOverlay.offsetHeight * currentScale;
  const maxX = window.innerWidth - scaledWidth;
  const maxY = window.innerHeight - scaledHeight;

  gameStateOverlay.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
  gameStateOverlay.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
  gameStateOverlay.style.right = 'auto'; // Remove right positioning when dragging
}

function stopDragAndResize(): void {
  isDragging = false;
  isResizing = false;
}

function getOrderedPlayers() {
  if (!game.youPlayerName) {
    return game.players;
  }

  const youPlayerIndex = game.players.findIndex(
    player => player.name === game.youPlayerName
  );

  if (youPlayerIndex === -1) {
    return game.players;
  }

  // Create ordered array: players after youPlayer, then players before youPlayer, then youPlayer
  const playersAfter = game.players.slice(youPlayerIndex + 1);
  const playersBefore = game.players.slice(0, youPlayerIndex);
  const youPlayer = game.players[youPlayerIndex];

  return [...playersAfter, ...playersBefore, youPlayer];
}

function generateResourceProbabilityTable(): string {
  if (!game.probableGameState || game.players.length === 0) {
    return '';
  }

  const resourceNames = ['tree', 'brick', 'sheep', 'wheat', 'ore'] as const;
  const resourceColors = [
    '#38c61b22',
    '#cc7b6422',
    '#8fb50e22',
    '#f4bb2522',
    '#9fa4a122',
  ];

  let table =
    '<div style="margin-top: 15px;"><h4 style="margin: 0 0 10px 0; text-align: center;">Resource Probabilities</h4>';
  table +=
    '<table style="width: 100%; border-collapse: collapse; margin: 10px 0;">';

  // Header row
  table += '<thead><tr style="background: #f5f5f5;">';
  table +=
    '<th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Player</th>';

  resourceNames.forEach((resource, index) => {
    const cardsInPlay = game.gameResources[resource];
    const totalPossible = 19;

    table += `<th style="padding: 8px; border: 1px solid #ddd; text-align: center; background: ${resourceColors[index]};">
      <img src="${getResourceIconUrl(resource)}" 
           style="width: 14.5px; height: 20px;" 
           alt="${resource}" 
           title="${resource}" /><br>
      <small style="font-size: 9px; color: #666;">${cardsInPlay}/${totalPossible}</small>
    </th>`;
  });

  table += '</tr></thead><tbody>';

  // Player rows - using ordered players with youPlayer last
  const orderedPlayers = getOrderedPlayers();
  orderedPlayers.forEach(player => {
    const probabilities =
      game.probableGameState!.getPlayerResourceProbabilities(player.name);

    table += '<tr>';
    table += `<td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: ${player.color};">${player.name}</td>`;

    resourceNames.forEach((resource, index) => {
      const resourceKey =
        resource as keyof typeof probabilities.minimumResources;
      const minCount = probabilities.minimumResources[resourceKey];
      const additionalProb =
        probabilities.additionalResourceProbabilities[resourceKey];

      // Format: "minimum + probability%"
      let displayText = minCount.toString();
      if (additionalProb > 0) {
        displayText += ` <span style="color:rgb(47, 120, 23); font-size: 10px;">+${additionalProb.toFixed(2)}</span>`;
      }

      table += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center; width: 65px;background: ${resourceColors[index]}; font-weight: bold;">
        ${displayText}
      </td>`;
    });

    table += '</tr>';
  });

  table += '</tbody></table></div>';
  return table;
}

function generateDevCardsDisplay(): string {
  const devCardTypes = [
    { key: 'knights', name: 'Knight', icon: 'knight.svg' },
    { key: 'monopolies', name: 'Monopoly', icon: 'mono.svg' },
    { key: 'roadBuilders', name: 'Road Building', icon: 'rb.svg' },
    { key: 'yearOfPlenties', name: 'Year of Plenty', icon: 'yop.svg' },
    { key: 'victoryPoints', name: 'Victory Point', icon: 'vp.svg' },
  ];

  /**
   * Get dev card icon URL
   */
  const getDevCardIconUrl = (icon: string): string =>
    chrome.runtime.getURL(`assets/${icon}`);

  let display = '<div style="margin: 15px 0;">';
  display += `<h4 style="margin: 0 0 10px 0; text-align: center;">Development Cards Remaining: ${game.devCards}</h4>`;
  display +=
    '<div style="display: flex; justify-content: space-around; align-items: center; padding: 10px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e9ecef;">';

  devCardTypes.forEach(cardType => {
    const remaining = game[cardType.key as keyof typeof game] as number;
    const total =
      cardType.key === 'knights'
        ? 14
        : cardType.key === 'victoryPoints'
          ? 5
          : 2;

    display += `
      <div style="display: flex; flex-direction: column; align-items: center; min-width: 60px;">
        <div style="width: 32px; height: 40px; margin-bottom: 5px; display: flex; align-items: center; justify-content: center; background: white; border-radius: 4px; border: 1px solid #ddd;">
          <img src="${getDevCardIconUrl(cardType.icon)}" 
               style="width: 24px; height: 32px;" 
               alt="${cardType.name}" 
               title="${cardType.name}" />
        </div>
        <div style="font-size: 12px; font-weight: bold; color: #2c3e50;">
          ${remaining}/${total}
        </div>
        <div style="font-size: 9px; color: #666; text-align: center; line-height: 1.1;">
          ${cardType.name}
        </div>
      </div>
    `;
  });

  display += '</div></div>';
  return display;
}

function generateDiceChart(): string {
  const maxRolls = Math.max(...Object.values(game.diceRolls), 1);
  const chartHeight = 120;

  let chart =
    '<div style="margin: 15px 0;"><h4 style="margin: 0 0 10px 0; text-align: center;">Dice Roll Frequency</h4>';
  chart +=
    '<div style="display: flex; align-items: end; justify-content: space-between; height: ' +
    chartHeight +
    'px; border-bottom: 2px solid #333; padding: 0 5px;">';

  for (let i = 2; i <= 12; i++) {
    const rolls = game.diceRolls[i as keyof typeof game.diceRolls];
    const barHeight =
      maxRolls > 0 ? (rolls / maxRolls) * (chartHeight - 20) : 0;
    const barColor =
      i === 7 ? '#ff6b6b' : i === 6 || i === 8 ? '#4ecdc4' : '#45b7d1';

    chart += `
      <div style="display: flex; flex-direction: column; align-items: center; min-width: 25px;">
        <div style="font-size: 10px; font-weight: bold; margin-bottom: 2px;">${rolls}</div>
        <div style="
          width: 20px; 
          height: ${barHeight}px; 
          background: ${barColor}; 
          border-radius: 2px 2px 0 0;
          display: flex;
          align-items: end;
          justify-content: center;
          margin-bottom: 2px;
        "></div>
        <div style="font-size: 10px; font-weight: bold;">${i}</div>
      </div>
    `;
  }

  chart += '</div></div>';
  return chart;
}

function generateBlockedDiceDisplay(): string {
  // Check if there are any blocked dice rolls
  const hasBlockedRolls = Object.keys(game.blockedDiceRolls).length > 0;

  if (!hasBlockedRolls) {
    return '';
  }

  let display =
    '<div style="margin: 15px 0;"><h4 style="margin: 0 0 10px 0; text-align: center;">🔒 Blocked by Robber</h4>';
  display +=
    '<div style="background: #f8f9fa; padding: 10px; border-radius: 6px; font-size: 12px; line-height: 1.4;">';

  // Collect all blocked entries
  const blockedEntries: Array<{
    number: number;
    resource: string;
    count: number;
  }> = [];

  Object.entries(game.blockedDiceRolls).forEach(([diceNumber, resources]) => {
    Object.entries(resources).forEach(([resource, count]) => {
      if (count > 0) {
        blockedEntries.push({
          number: parseInt(diceNumber),
          resource,
          count,
        });
      }
    });
  });

  // Sort by dice number, then by resource
  blockedEntries.sort((a, b) => {
    if (a.number !== b.number) {
      return a.number - b.number;
    }
    return a.resource.localeCompare(b.resource);
  });

  // Generate the display text
  const blockedTexts = blockedEntries.map(
    entry => `${entry.number} ${entry.resource}: ${entry.count}`
  );

  display += blockedTexts.join('<br>');
  display += '</div></div>';

  return display;
}

function generateUnknownTransactionsDisplay(): string {
  const unresolvedTransactions = game.probableGameState
    .getUnknownTransactions()
    .filter(t => !t.isResolved);

  if (unresolvedTransactions.length === 0) {
    return '';
  }

  let display =
    '<div style="margin: 15px 0; padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px;">';
  display +=
    '<h4 style="margin: 0 0 10px 0; color: #856404;">🔍 Unknown Transactions</h4>';

  unresolvedTransactions.forEach(transaction => {
    const timestamp = new Date(transaction.timestamp).toLocaleTimeString();
    display += `<div 
      class="unknown-transaction-item" 
      data-transaction-id="${transaction.id}"
      style="
        margin-bottom: 8px; 
        padding: 8px; 
        background: white; 
        border-radius: 4px; 
        font-size: 11px; 
        cursor: pointer;
        transition: background-color 0.2s ease;
        border: 1px solid transparent;
      "
      onmouseover="this.style.backgroundColor='#f8f9fa'; this.style.borderColor='#007bff';"
      onmouseout="this.style.backgroundColor='white'; this.style.borderColor='transparent';"
      title="Click to resolve this transaction"
    >`;
    display += `<strong>${transaction.thief}</strong> stole from <strong>${transaction.victim}</strong> `;
    display += `<span style="color: #666;">(${timestamp})</span><br>`;

    const transactionResourceProbabilities =
      game.probableGameState.getTransactionResourceProbabilities(
        transaction.id
      );

    if (transactionResourceProbabilities) {
      const probabilityText = formatProbabilityText(
        transactionResourceProbabilities
      );

      if (probabilityText) {
        display += `<small style="color: #666;">Could be: ${probabilityText}</small>`;
      }
    }

    display += '</div>';
  });

  display += '</div>';
  return display;
}

/**
 * Show modal for manually resolving an unknown transaction
 */
function showTransactionResolutionModal(transactionId: string): void {
  const transaction =
    game.probableGameState.getUnknownTransaction(transactionId);
  if (!transaction) {
    console.error(`Transaction ${transactionId} not found`);
    return;
  }

  const transactionResourceProbabilities =
    game.probableGameState.getTransactionResourceProbabilities(transactionId);

  if (!transactionResourceProbabilities) {
    console.error(
      `No resource probabilities found for transaction ${transactionId}`
    );
    return;
  }

  // Get only the resources that are possible (probability > 0)
  const possibleResources = Object.entries(transactionResourceProbabilities)
    .filter(([_, probability]) => probability > 0)
    .sort(([_, a], [__, b]) => b - a); // Sort by probability descending

  if (possibleResources.length === 0) {
    console.error(
      `No possible resources found for transaction ${transactionId}`
    );
    return;
  }

  const backdrop = createModalBackdrop();
  const dialog = createModalDialog();

  dialog.innerHTML = `
    <h3 style="margin: 0 0 15px 0; color: #2c3e50;">🔍 Resolve Unknown Transaction</h3>
    <p style="margin: 0 0 15px 0; color: #555;">
      <strong>${transaction.thief}</strong> stole from <strong>${transaction.victim}</strong><br>
      <small style="color: #666;">What resource was stolen?</small>
    </p>
    <div id="resource-buttons" style="display: flex; flex-direction: column; gap: 10px;">
    </div>
    <div style="margin-top: 15px; display: flex; justify-content: flex-end;">
      <button 
        id="cancel-resolve-btn"
        style="${STYLES.secondaryButton}"
      >Cancel</button>
    </div>
  `;

  const resourceButtonsContainer = dialog.querySelector('#resource-buttons');

  // Create resource buttons
  possibleResources.forEach(([resource, probability]) => {
    const button = createResourceButton(resource, probability, () => {
      resolveTransaction(transactionId, resource as keyof ResourceObjectType);
      document.body.removeChild(backdrop);
    });
    resourceButtonsContainer?.appendChild(button);
  });

  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  // Add cancel button handler
  const cancelBtn = dialog.querySelector('#cancel-resolve-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(backdrop);
    });
  }

  // Close on backdrop click
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) {
      document.body.removeChild(backdrop);
    }
  });
}

/**
 * Resolve a transaction with the specified resource
 */
function resolveTransaction(
  transactionId: string,
  resource: keyof ResourceObjectType
): void {
  const success = game.probableGameState.resolveUnknownTransaction(
    transactionId,
    resource
  );

  if (success) {
    console.log(
      `✅ Manually resolved transaction ${transactionId} with resource: ${resource}`
    );
    // Update the display to reflect the resolution
    updateGameStateDisplay();
  } else {
    console.error(
      `❌ Failed to resolve transaction ${transactionId} with resource: ${resource}`
    );
  }
}

function generateMainContent(): string {
  return `
    ${generateResourceProbabilityTable()}
    <div style="font-size: 12px; color: #666; text-align: center; line-height: 1.1;">Numbers shown are guaranteed resources, additional resources are shown as a probability</div>
    ${generateUnknownTransactionsDisplay()}
    ${generateDevCardsDisplay()}
    <div style="font-size: 12px; color: #666; text-align: center; line-height: 1.1;">Cards in your hand are currently not counted</div>
    ${generateDiceChart()}
    ${generateBlockedDiceDisplay()}
  `;
}

function generateWaitingContent(): string {
  return `
    <div style="
      text-align: center; 
      padding: 40px 20px; 
      color: #666;
      font-size: 14px;
      line-height: 1.5;
    ">
      <div style="font-size: 48px; margin-bottom: 20px;">🎲</div>
      <div style="font-weight: bold; margin-bottom: 10px; color: #2c3e50;">
        Waiting for first dice roll...
      </div>
      <div>
        The counter will start tracking resources once the first dice is rolled in the game.
      </div>
    </div>
  `;
}

function updateOverlayContent(overlay: HTMLDivElement): void {
  const contentDisplay = isMinimized ? 'none' : 'block';
  const mainContent = game.hasRolledFirstDice
    ? generateMainContent()
    : generateWaitingContent();

  overlay.innerHTML = `
    <div id="overlay-header" style="
      background: #2c3e50; 
      color: white; 
      padding: 10px; 
      border-radius: 6px 6px ${isMinimized ? '6px 6px' : '0 0'}; 
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      cursor: move;
      user-select: none;
    ">
      <div style="font-weight: bold;">🎲 Catan Counter</div>
      <button id="minimize-btn" style="
        background: none; 
        border: none; 
        color: white; 
        cursor: pointer; 
        font-size: 16px; 
        padding: 2px 6px;
        border-radius: 3px;
      " title="${isMinimized ? 'Expand' : 'Minimize'}">${isMinimized ? '□' : '−'}</button>
    </div>
    
    <div id="overlay-content" style="display: ${contentDisplay}; padding: 15px; max-height: 800px; overflow-y: auto; position: relative;">
      ${mainContent}
      <div class="resize-handle" style="
        position: absolute;
        bottom: 0;
        right: 0;
        width: 20px;
        height: 20px;
        cursor: nw-resize;
        background: linear-gradient(-45deg, transparent 0%, transparent 30%, #ccc 30%, #ccc 40%, transparent 40%, transparent 60%, #ccc 60%, #ccc 70%, transparent 70%);
        border-radius: 0 0 6px 0;
      " title="Drag to resize"></div>
    </div>
  `;

  // Add minimize button functionality
  const minimizeBtn = overlay.querySelector(
    '#minimize-btn'
  ) as HTMLButtonElement;
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', e => {
      e.stopPropagation(); // Prevent dragging when clicking minimize
      toggleMinimize();
    });
  }

  // Add event listeners for transaction items
  const transactionItems = overlay.querySelectorAll(
    '.unknown-transaction-item'
  );
  transactionItems.forEach(item => {
    item.addEventListener('click', e => {
      const transactionId = item.getAttribute('data-transaction-id');
      if (transactionId) {
        showTransactionResolutionModal(transactionId);
      }
    });
  });
}

function toggleMinimize(): void {
  isMinimized = !isMinimized;
  if (gameStateOverlay) {
    updateOverlayContent(gameStateOverlay);
  }
}

export function showGameStateOverlay(): void {
  if (!gameStateOverlay) {
    gameStateOverlay = createGameStateOverlay();
    document.body.appendChild(gameStateOverlay);
  } else {
    updateOverlayContent(gameStateOverlay);
    gameStateOverlay.style.display = 'block';
  }
}

export function hideGameStateOverlay(): void {
  if (gameStateOverlay) {
    gameStateOverlay.style.display = 'none';
  }
}

export function updateGameStateDisplay(): void {
  if (gameStateOverlay && gameStateOverlay.style.display !== 'none') {
    updateOverlayContent(gameStateOverlay);
    // Reapply the current scale after updating content
    gameStateOverlay.style.transform = `scale(${currentScale})`;
  }
}

export function setYouPlayerSelectedCallback(callback: () => void): void {
  youPlayerSelectedCallback = callback;
}
