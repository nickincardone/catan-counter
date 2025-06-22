import { game } from './gameState.js';

// Create draggable overlay for game state display
let gameStateOverlay: HTMLDivElement | null = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

function createGameStateOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.id = 'catan-game-state-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 400px;
    max-height: 500px;
    background: white;
    border: 2px solid #333;
    border-radius: 8px;
    padding: 10px;
    font-family: monospace;
    font-size: 12px;
    overflow-y: auto;
    z-index: 10000;
    cursor: move;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    resize: both;
    color: black;
    font-size: 8px;
  `;

  // Add drag functionality
  overlay.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', stopDrag);

  // Initial content
  updateOverlayContent(overlay);

  return overlay;
}

function startDrag(e: MouseEvent): void {
  if (!gameStateOverlay) return;

  isDragging = true;
  const rect = gameStateOverlay.getBoundingClientRect();
  dragOffset.x = e.clientX - rect.left;
  dragOffset.y = e.clientY - rect.top;

  // Prevent text selection while dragging
  e.preventDefault();
}

function drag(e: MouseEvent): void {
  if (!isDragging || !gameStateOverlay) return;

  const x = e.clientX - dragOffset.x;
  const y = e.clientY - dragOffset.y;

  // Keep overlay within viewport
  const maxX = window.innerWidth - gameStateOverlay.offsetWidth;
  const maxY = window.innerHeight - gameStateOverlay.offsetHeight;

  gameStateOverlay.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
  gameStateOverlay.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
  gameStateOverlay.style.right = 'auto'; // Remove right positioning when dragging
}

function stopDrag(): void {
  isDragging = false;
}

function updateOverlayContent(overlay: HTMLDivElement): void {
  const gameStateJson = JSON.stringify(game, null, 2);
  overlay.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 10px; cursor: move;">
      🎲 Catan Game State
      <button id="close-overlay" style="float: right; cursor: pointer; background: #ff4444; color: white; border: none; border-radius: 3px; padding: 2px 6px;">×</button>
    </div>
    <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word;">${gameStateJson}</pre>
  `;

  // Add close button functionality
  const closeBtn = overlay.querySelector('#close-overlay') as HTMLButtonElement;
  if (closeBtn) {
    closeBtn.addEventListener('click', e => {
      e.stopPropagation(); // Prevent dragging when clicking close
      hideGameStateOverlay();
    });
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
  }
} 