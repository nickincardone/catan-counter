(function () {
    'use strict';

    function getDefaultGame() {
        return {
            players: [],
            gameResources: {
                sheep: 19,
                wheat: 19,
                brick: 19,
                tree: 19,
                ore: 19,
            },
            devCards: 25,
            knights: 14,
            victoryPoints: 5,
            yearOfPlenties: 2,
            roadBuilders: 2,
            monopolies: 2,
            diceRolls: {
                2: 0,
                3: 0,
                4: 0,
                5: 0,
                6: 0,
                7: 0,
                8: 0,
                9: 0,
                10: 0,
                11: 0,
                12: 0,
            },
            remainingDiscoveryCardsProbabilities: {
                knights: 0,
                victoryPoints: 0,
                yearOfPlenties: 0,
                roadBuilders: 0,
                monopolies: 0,
            },
        };
    }
    let game = getDefaultGame();
    // Track the "you" player
    let youPlayerName = null;
    let hasAskedForYouPlayer = false;
    let isWaitingForYouPlayerSelection = false;
    function setYouPlayer(playerName) {
        youPlayerName = playerName;
        isWaitingForYouPlayerSelection = false;
    }
    function markYouPlayerAsked() {
        hasAskedForYouPlayer = true;
        isWaitingForYouPlayerSelection = true;
    }
    function resetGameState() {
        // Reset game state but keep "you" player info
        const previousYouPlayer = youPlayerName;
        const previousAskedStatus = hasAskedForYouPlayer;
        const previousWaitingStatus = isWaitingForYouPlayerSelection;
        game = getDefaultGame();
        // Restore "you" player info
        youPlayerName = previousYouPlayer;
        hasAskedForYouPlayer = previousAskedStatus;
        isWaitingForYouPlayerSelection = previousWaitingStatus;
        console.log('🔄 Game state reset, reprocessing messages...');
    }
    function ensurePlayerExists(playerName) {
        const existingPlayer = game.players.find(p => p.name === playerName);
        if (!existingPlayer) {
            const newPlayer = {
                name: playerName,
                resources: { sheep: 0, wheat: 0, brick: 0, tree: 0, ore: 0 },
                resourceProbabilities: { sheep: 0, wheat: 0, brick: 0, tree: 0, ore: 0 },
                settlements: 5,
                cities: 4,
                roads: 15,
                knights: 0,
                victoryPoints: 0,
                discoveryCards: {
                    knights: 0,
                    victoryPoints: 0,
                    yearOfPlenties: 0,
                    roadBuilders: 0,
                    monopolies: 0,
                },
                discoveryCardProbabilities: {
                    knights: 0,
                    victoryPoints: 0,
                    yearOfPlenties: 0,
                    roadBuilders: 0,
                    monopolies: 0,
                },
                totalRobbers: 0,
            };
            game.players.push(newPlayer);
        }
    }
    function updateResources(playerName, resourceChanges) {
        ensurePlayerExists(playerName);
        const player = game.players.find(p => p.name === playerName);
        if (player) {
            Object.keys(resourceChanges).forEach(resource => {
                const key = resource;
                const change = resourceChanges[key];
                if (change !== undefined) {
                    // Update player resources
                    player.resources[key] += change;
                    // Update game resources (opposite of player change)
                    game.gameResources[key] -= change;
                }
            });
        }
    }

    const RESOURCE_STRING = 'img[alt="grain"], img[alt="wool"], img[alt="lumber"], img[alt="brick"], img[alt="ore"]';
    function findChatContainer() {
        const divs = document.querySelectorAll('div');
        for (const outerDiv of Array.from(divs)) {
            const firstChild = outerDiv.firstElementChild;
            if ((firstChild === null || firstChild === void 0 ? void 0 : firstChild.tagName) === 'DIV') {
                for (const child of Array.from(firstChild.children)) {
                    if (child.tagName === 'SPAN') {
                        const anchor = child.querySelector('a[href="#open-rulebook"]');
                        if (anchor) {
                            return outerDiv;
                        }
                    }
                }
            }
        }
        return null;
    }
    function getPlayerName(element) {
        const playerSpan = element.querySelector('span[style*="font-weight:600"]');
        return playerSpan ? playerSpan.textContent || null : null;
    }
    function getDiceRollTotal(element) {
        var _a, _b;
        const diceImages = element.querySelectorAll('img[alt^="dice_"]');
        if (diceImages.length === 2) {
            const dice1 = parseInt(((_a = diceImages[0].getAttribute('alt')) === null || _a === void 0 ? void 0 : _a.replace('dice_', '')) || '0');
            const dice2 = parseInt(((_b = diceImages[1].getAttribute('alt')) === null || _b === void 0 ? void 0 : _b.replace('dice_', '')) || '0');
            return dice1 + dice2;
        }
        return null;
    }
    function getResourceType(element) {
        const resourceImg = element.querySelector(RESOURCE_STRING);
        if (resourceImg) {
            const alt = resourceImg.getAttribute('alt');
            return getResourceTypeFromAlt(alt);
        }
        return null;
    }
    function getResourceTypeFromAlt(alt) {
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
    function getTradePartner(element) {
        const spans = element.querySelectorAll('span[style*="font-weight:600"]');
        return spans.length > 1 ? spans[1].textContent || null : null;
    }
    function getResourcesFromImages(element, selector) {
        const resources = { sheep: 0, wheat: 0, brick: 0, tree: 0, ore: 0 };
        const images = element.querySelectorAll(selector);
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

    // Create draggable overlay for game state display
    let gameStateOverlay = null;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let isMinimized = false;
    let isResizing = false;
    let currentScale = 1;
    let resizeStartData = { x: 0, y: 0, scale: 1 };
    let youPlayerSelectedCallback = null;
    function createGameStateOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'catan-game-state-overlay';
        overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 450px;
    max-height: 600px;
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
    function startDrag(e) {
        if (!gameStateOverlay)
            return;
        const target = e.target;
        // Check if clicking on resize handle
        if (target.classList.contains('resize-handle')) {
            isResizing = true;
            resizeStartData = {
                x: e.clientX,
                y: e.clientY,
                scale: currentScale
            };
            e.preventDefault();
            return;
        }
        // Only allow dragging from the header
        const header = gameStateOverlay.querySelector('#overlay-header');
        if (!(header === null || header === void 0 ? void 0 : header.contains(target)) || target.id === 'minimize-btn')
            return;
        isDragging = true;
        const rect = gameStateOverlay.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        // Prevent text selection while dragging
        e.preventDefault();
    }
    function handleMouseMove(e) {
        if (isResizing && gameStateOverlay) {
            const deltaX = e.clientX - resizeStartData.x;
            const deltaY = e.clientY - resizeStartData.y;
            const avgDelta = (deltaX + deltaY) / 2;
            // Calculate new scale (minimum 0.5, maximum 2.0)
            const scaleFactor = avgDelta / 300; // Adjust sensitivity
            currentScale = Math.max(0.5, Math.min(2.0, resizeStartData.scale + scaleFactor));
            // Apply the new scale
            gameStateOverlay.style.transform = `scale(${currentScale})`;
            e.preventDefault();
            return;
        }
        if (!isDragging || !gameStateOverlay)
            return;
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
    function stopDragAndResize() {
        isDragging = false;
        isResizing = false;
    }
    function generateResourceTable() {
        if (game.players.length === 0) {
            return '<div style="padding: 20px; text-align: center; color: #666;">No players found</div>';
        }
        const resourceNames = ['sheep', 'wheat', 'brick', 'tree', 'ore'];
        const resourceEmojis = ['🐑', '🌾', '🧱', '🌲', '⛰️'];
        const resourceColors = ['#f0f8ff', '#fff8dc', '#ffeaa7', '#a8e6cf', '#ddd6fe'];
        let table = '<table style="width: 100%; border-collapse: collapse; margin: 10px 0;">';
        // Header row with resource totals
        table += '<thead><tr style="background: #f5f5f5;">';
        table += '<th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Player</th>';
        resourceNames.forEach((resource, index) => {
            const remaining = game.gameResources[resource];
            const total = 19; // Standard Catan has 19 of each resource
            table += `<th style="padding: 8px; border: 1px solid #ddd; text-align: center; background: ${resourceColors[index]};">
      ${resourceEmojis[index]}<br>
      <small>${remaining}/${total}</small>
    </th>`;
        });
        table += '</tr></thead><tbody>';
        // Player rows
        game.players.forEach(player => {
            table += '<tr>';
            table += `<td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${player.name}</td>`;
            resourceNames.forEach((resource, index) => {
                const count = player.resources[resource];
                table += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center; background: ${resourceColors[index]}; font-weight: bold;">
        ${count}
      </td>`;
            });
            table += '</tr>';
        });
        table += '</tbody></table>';
        return table;
    }
    function generateDiceChart() {
        const maxRolls = Math.max(...Object.values(game.diceRolls), 1);
        const chartHeight = 120;
        let chart = '<div style="margin: 15px 0;"><h4 style="margin: 0 0 10px 0; text-align: center;">Dice Roll Frequency</h4>';
        chart += '<div style="display: flex; align-items: end; justify-content: space-between; height: ' + chartHeight + 'px; border-bottom: 2px solid #333; padding: 0 5px;">';
        for (let i = 2; i <= 12; i++) {
            const rolls = game.diceRolls[i];
            const barHeight = maxRolls > 0 ? (rolls / maxRolls) * (chartHeight - 20) : 0;
            const barColor = i === 7 ? '#ff6b6b' : (i === 6 || i === 8) ? '#4ecdc4' : '#45b7d1';
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
    function updateOverlayContent(overlay) {
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
    
         <div id="overlay-content" style="display: ${contentDisplay}; padding: 15px; max-height: 500px; overflow-y: auto; position: relative;">
       ${generateResourceTable()}
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
        const minimizeBtn = overlay.querySelector('#minimize-btn');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', e => {
                e.stopPropagation(); // Prevent dragging when clicking minimize
                toggleMinimize();
            });
        }
    }
    function toggleMinimize() {
        isMinimized = !isMinimized;
        if (gameStateOverlay) {
            updateOverlayContent(gameStateOverlay);
        }
    }
    function showGameStateOverlay() {
        if (!gameStateOverlay) {
            gameStateOverlay = createGameStateOverlay();
            document.body.appendChild(gameStateOverlay);
        }
        else {
            updateOverlayContent(gameStateOverlay);
            gameStateOverlay.style.display = 'block';
        }
    }
    function updateGameStateDisplay() {
        if (gameStateOverlay && gameStateOverlay.style.display !== 'none') {
            updateOverlayContent(gameStateOverlay);
            // Reapply the current scale after updating content
            gameStateOverlay.style.transform = `scale(${currentScale})`;
        }
    }
    function setYouPlayerSelectedCallback(callback) {
        youPlayerSelectedCallback = callback;
    }
    function showYouPlayerDialog() {
        if (game.players.length === 0)
            return;
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
      ${game.players.map(player => `
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
      `).join('')}
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
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                document.body.removeChild(backdrop);
            }
        });
    }

    function updateGameFromChat(element) {
        // If we're waiting for "you" player selection, don't process new messages
        if (isWaitingForYouPlayerSelection) {
            return;
        }
        const messageText = element.textContent || '';
        let playerName = getPlayerName(element);
        // getting correct player name when it says "You stole"
        if (messageText.includes('You stole') && messageText.includes('from')) {
            // Get the previous sibling element to find the actual player name
            const previousElement = element.previousElementSibling;
            if (previousElement) {
                const actualPlayerName = getPlayerName(previousElement);
                if (actualPlayerName) {
                    // Override the playerName with the actual player from previous element
                    playerName = actualPlayerName;
                }
            }
        }
        // Handle "[Player] stole [resource] from you" scenario
        if (messageText.includes('stole') && messageText.includes('from you')) {
            const stolenResource = getResourceType(element);
            if (stolenResource && playerName && youPlayerName) {
                // Player stole from "you"
                updateResources(playerName, { [stolenResource]: 1 });
                updateResources(youPlayerName, { [stolenResource]: -1 });
                console.log(`🦹 ${playerName} stole ${stolenResource} from you (${youPlayerName})`);
                updateGameStateDisplay();
                return; // Exit early since we've handled this message
            }
        }
        // Scenario 1: Place settlement (keyword: "placed a")
        if (messageText.includes('placed a') &&
            element.querySelector('img[alt="settlement"]')) {
            if (playerName) {
                ensurePlayerExists(playerName);
                const player = game.players.find(p => p.name === playerName);
                if (player && player.settlements > 0) {
                    player.settlements--;
                    console.log(`🏠 ${playerName} placed a settlement. Remaining settlements: ${player.settlements}`);
                }
            }
        }
        // Scenario 2: Roll dice (keyword: "rolled")
        else if (messageText.includes('rolled')) {
            const diceTotal = getDiceRollTotal(element);
            if (diceTotal && diceTotal >= 2 && diceTotal <= 12) {
                game.diceRolls[diceTotal]++;
                console.log(`🎲 Dice rolled: ${diceTotal}. Total rolls for ${diceTotal}: ${game.diceRolls[diceTotal]}`);
                // Show "you" player dialog on the first dice roll
                if (!hasAskedForYouPlayer && game.players.length > 0) {
                    markYouPlayerAsked();
                    showYouPlayerDialog();
                }
            }
        }
        // Scenario 3: Place road (keyword: "placed a" + road image)
        else if (messageText.includes('placed a') &&
            element.querySelector('img[alt="road"]')) {
            if (playerName) {
                ensurePlayerExists(playerName);
                const player = game.players.find(p => p.name === playerName);
                if (player && player.roads > 0) {
                    player.roads--;
                    console.log(`🛣️ ${playerName} placed a road. Remaining roads: ${player.roads}`);
                }
            }
        }
        // Scenario 4: Known trade (keyword: "gave" and "got" and "from")
        else if (messageText.includes('gave') &&
            messageText.includes('got') &&
            messageText.includes('from')) {
            if (playerName) {
                const tradePartner = getTradePartner(element);
                if (tradePartner) {
                    // Split the message to separate what was given from what was received
                    const messageParts = messageText.split(' and got ');
                    if (messageParts.length === 2) {
                        messageParts[0];
                        messageParts[1].split(' from ')[0];
                        // Get all resource images in the element
                        element.querySelectorAll(RESOURCE_STRING);
                        // Count resources in the "gave" section by looking at text position
                        const gaveResources = {};
                        const gotResources = {};
                        // Find the position where "and got" appears in the HTML
                        const elementHTML = element.innerHTML;
                        const gaveEndIndex = elementHTML.indexOf(' and got ');
                        if (gaveEndIndex !== -1) {
                            // Create temporary elements to count resources in each section
                            const tempGaveDiv = document.createElement('div');
                            tempGaveDiv.innerHTML = elementHTML.substring(0, gaveEndIndex);
                            const gaveImages = tempGaveDiv.querySelectorAll(RESOURCE_STRING);
                            const tempGotDiv = document.createElement('div');
                            const gotStartIndex = gaveEndIndex + ' and got '.length;
                            const gotEndIndex = elementHTML.indexOf(' from ');
                            tempGotDiv.innerHTML = elementHTML.substring(gotStartIndex, gotEndIndex);
                            const gotImages = tempGotDiv.querySelectorAll(RESOURCE_STRING);
                            // Count gave resources
                            gaveImages.forEach(img => {
                                const resourceType = getResourceTypeFromAlt(img.getAttribute('alt'));
                                if (resourceType) {
                                    gaveResources[resourceType] =
                                        (gaveResources[resourceType] || 0) + 1;
                                }
                            });
                            // Count got resources
                            gotImages.forEach(img => {
                                const resourceType = getResourceTypeFromAlt(img.getAttribute('alt'));
                                if (resourceType) {
                                    gotResources[resourceType] =
                                        (gotResources[resourceType] || 0) + 1;
                                }
                            });
                            // Apply trade to both players
                            if (Object.keys(gaveResources).length > 0 &&
                                Object.keys(gotResources).length > 0) {
                                // Update player who initiated trade (loses gave resources, gains got resources)
                                const playerChanges = {};
                                Object.keys(gaveResources).forEach(resource => {
                                    const key = resource;
                                    playerChanges[key] = -(gaveResources[key] || 0);
                                });
                                Object.keys(gotResources).forEach(resource => {
                                    const key = resource;
                                    playerChanges[key] =
                                        (playerChanges[key] || 0) + (gotResources[key] || 0);
                                });
                                updateResources(playerName, playerChanges);
                                // Update trade partner (gains gave resources, loses got resources)
                                const partnerChanges = {};
                                Object.keys(gaveResources).forEach(resource => {
                                    const key = resource;
                                    partnerChanges[key] = gaveResources[key] || 0;
                                });
                                Object.keys(gotResources).forEach(resource => {
                                    const key = resource;
                                    partnerChanges[key] =
                                        (partnerChanges[key] || 0) - (gotResources[key] || 0);
                                });
                                updateResources(tradePartner, partnerChanges);
                                console.log(`🤝 ${playerName} traded ${JSON.stringify(gaveResources)} for ${JSON.stringify(gotResources)} with ${tradePartner}`);
                            }
                        }
                    }
                }
            }
        }
        // Scenario 5: Get resources (keyword: "got")
        else if (messageText.includes('got')) {
            if (playerName) {
                ensurePlayerExists(playerName);
                const gotResources = getResourcesFromImages(element, RESOURCE_STRING);
                updateResources(playerName, gotResources);
                console.log(`🌾 ${playerName} got resources: ${JSON.stringify(gotResources)}`);
            }
        }
        // Scenario 6: Steal known (keyword: "stole" and "from")
        else if (messageText.includes('stole') && messageText.includes('from')) {
            const stolenResource = getResourceType(element);
            if (stolenResource) {
                const victimSpan = element.querySelector('span[style*="font-weight:600"]');
                const victim = (victimSpan === null || victimSpan === void 0 ? void 0 : victimSpan.textContent) || null;
                if (victim && playerName) {
                    updateResources(playerName, { [stolenResource]: 1 });
                    updateResources(victim, { [stolenResource]: -1 });
                    console.log(`🦹 ${playerName} stole ${stolenResource} from ${victim}`);
                }
            }
        }
        // Scenario 7: Buy dev card (keyword: "bought" + development card image)
        else if (messageText.includes('bought') &&
            element.querySelector('img[alt="development card"]')) {
            if (playerName) {
                ensurePlayerExists(playerName);
                game.devCards--;
                // Cost: 1 wheat, 1 sheep, 1 ore
                updateResources(playerName, { wheat: -1, sheep: -1, ore: -1 });
                console.log(`🃏 ${playerName} bought a development card. Remaining dev cards: ${game.devCards}`);
            }
        }
        // Scenario 8: Bank trade (keyword: "gave bank" and "took")
        else if (messageText.includes('gave bank') && messageText.includes('took')) {
            if (playerName) {
                const resourceImages = element.querySelectorAll(RESOURCE_STRING);
                const gaveResources = getResourcesFromImages(element, RESOURCE_STRING);
                // The last image is what they took, everything before is what they gave
                if (resourceImages.length > 1) {
                    const tookImage = resourceImages[resourceImages.length - 1];
                    const tookType = getResourceTypeFromAlt(tookImage.getAttribute('alt'));
                    if (tookType) {
                        // Remove what they took from the gave count
                        gaveResources[tookType]--;
                        // Update player resources (negative for gave, positive for took)
                        const playerChanges = Object.assign({}, gaveResources);
                        Object.keys(playerChanges).forEach(key => {
                            playerChanges[key] *= -1;
                        });
                        playerChanges[tookType] = 1;
                        updateResources(playerName, playerChanges);
                        console.log(`🏦 ${playerName} traded with bank: gave ${JSON.stringify(gaveResources)}, got ${tookType}`);
                    }
                }
            }
        }
        // Scenario 9: Used knight (keyword: "used" + "Knight")
        else if (messageText.includes('used') && messageText.includes('Knight')) {
            if (playerName) {
                ensurePlayerExists(playerName);
                const player = game.players.find(p => p.name === playerName);
                if (player) {
                    player.knights++;
                    player.discoveryCards.knights--;
                    console.log(`⚔️ ${playerName} used a knight. Total knights played: ${player.knights}`);
                }
            }
        }
        // Scenario 10: Buy settlement (keyword: "built a" + settlement image)
        else if (messageText.includes('built a') &&
            element.querySelector('img[alt="settlement"]')) {
            if (playerName) {
                ensurePlayerExists(playerName);
                const player = game.players.find(p => p.name === playerName);
                if (player) {
                    // Cost: 1 wood, 1 wheat, 1 brick, 1 sheep
                    updateResources(playerName, {
                        tree: -1,
                        wheat: -1,
                        brick: -1,
                        sheep: -1,
                    });
                    player.settlements--;
                    player.victoryPoints++;
                    console.log(`🏠 ${playerName} built a settlement. VP: ${player.victoryPoints}, Remaining settlements: ${player.settlements}`);
                }
            }
        }
        // Scenario 11: Buy city (keyword: "built a" + city image)
        else if (messageText.includes('built a') &&
            element.querySelector('img[alt="city"]')) {
            if (playerName) {
                ensurePlayerExists(playerName);
                const player = game.players.find(p => p.name === playerName);
                if (player) {
                    updateResources(playerName, { ore: -3, wheat: -2 });
                    player.cities--;
                    player.settlements++; // City replaces settlement
                    player.victoryPoints++;
                    console.log(`🏰 ${playerName} built a city. VP: ${player.victoryPoints}, Remaining cities: ${player.cities}`);
                }
            }
        }
        // Scenario 12: Buy road (keyword: "built a" + road image)
        else if (messageText.includes('built a') &&
            element.querySelector('img[alt="road"]')) {
            if (playerName) {
                ensurePlayerExists(playerName);
                const player = game.players.find(p => p.name === playerName);
                if (player) {
                    // Cost: 1 wood, 1 brick
                    updateResources(playerName, { tree: -1, brick: -1 });
                    player.roads--;
                    console.log(`🛣️ ${playerName} built a road. Remaining roads: ${player.roads}`);
                }
            }
        }
        // Scenario 13: Moved robber (keyword: "moved Robber")
        else if (messageText.includes('moved Robber')) {
            if (playerName) {
                ensurePlayerExists(playerName);
                const player = game.players.find(p => p.name === playerName);
                if (player) {
                    player.totalRobbers++;
                    console.log(`🔒 ${playerName} moved the robber. Total robber moves: ${player.totalRobbers}`);
                }
            }
        }
        // Scenario 14: Used Year of Plenty (keyword: "used" + "Year of Plenty")
        else if (messageText.includes('used') &&
            messageText.includes('Year of Plenty')) {
            if (playerName) {
                ensurePlayerExists(playerName);
                const player = game.players.find(p => p.name === playerName);
                if (player) {
                    game.yearOfPlenties--;
                    player.discoveryCards.yearOfPlenties--;
                    console.log(`🎯 ${playerName} used Year of Plenty. Remaining: ${game.yearOfPlenties}`);
                }
            }
        }
        // Scenario 15: Year of Plenty cards taken (keyword: "took from bank")
        else if (messageText.includes('took from bank')) {
            if (playerName) {
                ensurePlayerExists(playerName);
                const takenResources = getResourcesFromImages(element, RESOURCE_STRING);
                // Add resources to player (and remove from bank automatically)
                updateResources(playerName, takenResources);
                console.log(`🎯 ${playerName} took from bank via Year of Plenty: ${JSON.stringify(takenResources)}`);
            }
        }
        // Scenario 16: Used Road Building (keyword: "used" + "Road Building")
        else if (messageText.includes('used') &&
            messageText.includes('Road Building')) {
            if (playerName) {
                ensurePlayerExists(playerName);
                const player = game.players.find(p => p.name === playerName);
                if (player) {
                    game.roadBuilders--;
                    player.discoveryCards.roadBuilders--;
                    console.log(`🛣️ ${playerName} used Road Building. Remaining: ${game.roadBuilders}`);
                }
            }
        }
        // Scenario 17: Used Monopoly (keyword: "used" + "Monopoly")
        else if (messageText.includes('used') && messageText.includes('Monopoly')) {
            if (playerName) {
                ensurePlayerExists(playerName);
                const player = game.players.find(p => p.name === playerName);
                if (player) {
                    game.monopolies--;
                    player.discoveryCards.monopolies--;
                    console.log(`💰 ${playerName} used Monopoly. Remaining: ${game.monopolies}`);
                }
            }
        }
        // Scenario 18: Monopoly cards stolen (keyword: "stole" + number)
        else if (messageText.includes('stole') && /stole \d+/.test(messageText)) {
            if (playerName) {
                ensurePlayerExists(playerName);
                const player = game.players.find(p => p.name === playerName);
                const resourceType = getResourceType(element);
                if (player && resourceType) {
                    // Extract the number of cards stolen
                    const match = messageText.match(/stole (\d+)/);
                    const stolenCount = match ? parseInt(match[1]) : 0;
                    if (stolenCount > 0) {
                        // Add stolen resources to monopoly player
                        updateResources(playerName, { [resourceType]: stolenCount });
                        // Remove resources from all other players for this resource type
                        game.players.forEach(otherPlayer => {
                            if (otherPlayer.name !== playerName) {
                                otherPlayer.resources[resourceType] = 0;
                            }
                        });
                        console.log(`💰 ${playerName} monopolized ${stolenCount} ${resourceType} from all players`);
                    }
                }
            }
        }
        // Scenario 19: Starting resources (keyword: "received starting resources")
        else if (messageText.includes('received starting resources')) {
            if (playerName) {
                ensurePlayerExists(playerName);
                const startingResources = getResourcesFromImages(element, RESOURCE_STRING);
                // Add starting resources to player (and remove from bank automatically)
                updateResources(playerName, startingResources);
                console.log(`🏁 ${playerName} received starting resources: ${JSON.stringify(startingResources)}`);
            }
        }
        // Scenario 20: Disconnection messages (ignore)
        else if (messageText.includes('has disconnected') ||
            messageText.includes('will take over')) {
            console.log(`🔌 Player disconnection message (ignored)`);
        }
        // Scenario 21: Reconnection messages (ignore)
        else if (messageText.includes('has reconnected')) {
            console.log(`🔌 Player reconnection message (ignored)`);
        }
        // Scenario 22: Robber blocking messages (ignore)
        else if (messageText.includes('is blocked by the Robber') ||
            messageText.includes('No resources produced')) {
            console.log(`🚫 Robber blocking message (ignored)`);
        }
        // Scenario 23: Wants to give (ignore - no actual trade happens)
        else if (messageText.includes('wants to give')) {
            // Ignore these messages as they don't represent actual trades
            console.log(`💭 ${playerName} wants to trade (ignored - no actual trade)`);
        }
        // Scenario 24: Discards (keyword: "discarded")
        else if (messageText.includes('discarded')) {
            if (playerName) {
                ensurePlayerExists(playerName);
                const discardedResources = getResourcesFromImages(element, RESOURCE_STRING);
                // Remove resources from player (negative values, automatically adds to bank)
                const playerChanges = {};
                Object.keys(discardedResources).forEach(resource => {
                    const key = resource;
                    const count = discardedResources[key];
                    if (count > 0) {
                        playerChanges[key] = -count;
                    }
                });
                updateResources(playerName, playerChanges);
                console.log(`🗑️ ${playerName} discarded resources: ${JSON.stringify(discardedResources)}`);
            }
        }
        // Scenario 25: Ignore hr elements
        else if (element.querySelector('hr')) ;
        // Log any unknown messages
        else {
            console.log('💬💬💬  New unknown message:', element);
        }
        console.log('🎲 Game object:', game);
        updateGameStateDisplay();
    }

    // content.ts
    const chatMutationCallback = (mutationsList) => {
        for (const mutation of mutationsList) {
            mutation.addedNodes.forEach(addedNode => {
                if (addedNode.nodeType === Node.ELEMENT_NODE) {
                    const element = addedNode;
                    updateGameFromChat(element);
                }
            });
        }
    };
    function tryFindChat() {
        const chatContainer = findChatContainer();
        if (chatContainer) {
            console.log('✅ Chat container found!');
            // Show the game state overlay
            showGameStateOverlay();
            // Process existing messages in case user refreshed the page
            const existingMessages = chatContainer.children;
            console.log(`📜 Processing ${existingMessages.length} existing messages...`);
            for (let i = 0; i < existingMessages.length; i++) {
                const element = existingMessages[i];
                if (element.nodeType === Node.ELEMENT_NODE) {
                    updateGameFromChat(element);
                }
            }
            console.log('✅ Finished processing existing messages');
            // Set up observer for new messages
            const observer = new MutationObserver(chatMutationCallback);
            observer.observe(chatContainer, { childList: true });
            clearInterval(intervalId);
        }
        else {
            console.log('⏳ Chat container not found, retrying...');
        }
    }
    function reprocessAllMessages() {
        // Find all chat messages
        const chatElements = findAllChatMessages();
        if (chatElements.length > 0) {
            console.log(`🔄 Reprocessing ${chatElements.length} chat messages...`);
            // Reset game state but keep "you" player info
            resetGameState();
            // Process all messages in order
            chatElements.forEach((element, index) => {
                console.log(`Processing message ${index + 1}/${chatElements.length}`);
                updateGameFromChat(element);
            });
            console.log('✅ Finished reprocessing all messages');
        }
    }
    function findAllChatMessages() {
        // Try to find the chat container using the same logic as domUtils
        const divs = document.querySelectorAll('div');
        for (const outerDiv of Array.from(divs)) {
            const firstChild = outerDiv.firstElementChild;
            if ((firstChild === null || firstChild === void 0 ? void 0 : firstChild.tagName) === 'DIV') {
                for (const child of Array.from(firstChild.children)) {
                    if (child.tagName === 'SPAN') {
                        const anchor = child.querySelector('a[href="#open-rulebook"]');
                        if (anchor) {
                            // Found the chat container, return all its child elements
                            return Array.from(outerDiv.children);
                        }
                    }
                }
            }
        }
        return [];
    }
    // Set up the callback for when "you" player is selected
    setYouPlayerSelectedCallback(reprocessAllMessages);
    // Start polling every 2 seconds
    const intervalId = window.setInterval(tryFindChat, 2000);
    // Optionally run immediately
    tryFindChat();

})();
