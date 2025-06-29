import { game, setYouPlayer, markYouPlayerAsked } from './gameState.js';

// Chrome extension API type declaration
declare const chrome: {
  runtime: {
    getURL: (path: string) => string;
  };
};

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

function generateResourceProbabilityTable(): string {
  if (!game.probableGameState || game.players.length === 0) {
    return '';
  }

  const resourceNames = ['tree', 'brick', 'sheep', 'wheat', 'ore'];
  const resourceEmojis = ['🌲', '🧱', '🐑', '🌾', '⛰️'];
  const resourceColors = [
    '#a8e6cf',
    '#ffeaa7',
    '#f0f8ff',
    '#fff8dc',
    '#ddd6fe',
  ];

  let table =
    '<div style="margin: 15px 0;"><h4 style="margin: 0 0 10px 0; text-align: center;">🎯 Resource Probabilities</h4>';
  table +=
    '<table style="width: 100%; border-collapse: collapse; margin: 10px 0;">';

  // Header row
  table += '<thead><tr style="background: #f5f5f5;">';
  table +=
    '<th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Player</th>';

  resourceNames.forEach((resource, index) => {
    table += `<th style="padding: 8px; border: 1px solid #ddd; text-align: center; background: ${resourceColors[index]};">
      ${resourceEmojis[index]}<br>
      <small>Min / +Prob</small>
    </th>`;
  });

  table += '</tr></thead><tbody>';

  // Player rows
  game.players.forEach(player => {
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

      table += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center; background: ${resourceColors[index]}; font-weight: bold;">
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

  let display = '<div style="margin: 15px 0;">';
  display +=
    '<h4 style="margin: 0 0 10px 0; text-align: center;">Development Cards Remaining</h4>';
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
                     <img src="${chrome.runtime.getURL(`assets/${cardType.icon}`)}" 
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

function updateOverlayContent(overlay: HTMLDivElement): void {
  const contentDisplay = isMinimized ? 'none' : 'block';

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
       ${generateResourceProbabilityTable()}
       ${generateDevCardsDisplay()}
       ${generateDiceChart()}
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

// old function, not used anymore
// you player is automatically detected.
export function showYouPlayerDialog(): void {
  if (game.players.length === 0) return;

  // Mark that we've asked to prevent multiple dialogs
  markYouPlayerAsked();

  // Create modal backdrop
  const backdrop = document.createElement('div');
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10001;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  // Create dialog
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    max-width: 400px;
    width: 90%;
    font-family: Arial, sans-serif;
  `;

  dialog.innerHTML = `
    <h3 style="margin: 0 0 15px 0; color: #2c3e50;">🎲 Catan Counter Setup</h3>
    <p style="margin: 0 0 20px 0; color: #555;">
      Which player are you? This helps the extension track when resources are stolen "from you".
    </p>
    <div id="player-buttons" style="display: flex; flex-direction: column; gap: 10px;">
      ${game.players
        .map(
          player => `
        <button 
          data-player="${player.name}" 
          style="
            padding: 12px; 
            border: 2px solid #3498db; 
            background: #ecf0f1; 
            border-radius: 6px; 
            cursor: pointer; 
            font-weight: bold;
            transition: all 0.2s;
          "
          onmouseover="this.style.background='#3498db'; this.style.color='white';"
          onmouseout="this.style.background='#ecf0f1'; this.style.color='black';"
        >
          ${player.name}
        </button>
      `
        )
        .join('')}
    </div>
  `;

  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  // Add click handlers
  const buttons = dialog.querySelectorAll('[data-player]');
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const playerName = button.getAttribute('data-player');
      if (playerName) {
        setYouPlayer(playerName);
        console.log(`🎯 "You" player set to: ${playerName}`);
        document.body.removeChild(backdrop);

        // Trigger reprocessing callback if provided
        if (youPlayerSelectedCallback) {
          youPlayerSelectedCallback();
        }
      }
    });
  });

  // Close on backdrop click
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) {
      document.body.removeChild(backdrop);
    }
  });
}
