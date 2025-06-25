(function () {
    'use strict';

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
    /**
     * Automatically detects the current player from the header profile username
     * This eliminates the need for user input popups
     */
    function getCurrentPlayerFromHeader() {
        var _a;
        const headerElement = document.getElementById('header_profile_username');
        if (!headerElement) {
            console.log('🔍 header_profile_username element not found');
            return null;
        }
        const currentPlayer = ((_a = headerElement.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || null;
        if (currentPlayer) {
            console.log(`🎯 Auto-detected current player: ${currentPlayer}`);
        }
        else {
            console.log('🔍 header_profile_username element found but empty');
        }
        return currentPlayer;
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
    function getResourcesFromImages(element, selector, stopAt) {
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
            unknownTransactions: [],
        };
    }
    let game = getDefaultGame();
    // Track the "you" player
    let youPlayerName = null;
    let isWaitingForYouPlayerSelection = false;
    function setYouPlayer(playerName) {
        youPlayerName = playerName;
        isWaitingForYouPlayerSelection = false;
    }
    /**
     * Automatically sets the current player from header_profile_username
     * Returns true if successful, false otherwise
     */
    function autoDetectCurrentPlayer() {
        const detectedPlayer = getCurrentPlayerFromHeader();
        if (detectedPlayer) {
            setYouPlayer(detectedPlayer);
            console.log(`✅ Auto-detected and set current player: ${detectedPlayer}`);
            return true;
        }
        console.log('❌ Failed to auto-detect current player');
        return false;
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
        if (!player)
            return;
        // For negative resource changes (spending), check if we need to resolve unknown transactions
        Object.keys(resourceChanges).forEach(resource => {
            const key = resource;
            const change = resourceChanges[key];
            if (change !== undefined && change < 0) {
                // Player is trying to spend resources
                const requiredAmount = Math.abs(change);
                const currentAmount = player.resources[key];
                if (currentAmount < requiredAmount) {
                    // Player doesn't have enough, try to resolve unknown transactions
                    const shortfall = requiredAmount - currentAmount;
                    console.log(`⚠️  ${playerName} needs ${shortfall} more ${key}, attempting to resolve unknown transactions...`);
                    if (!attemptToResolveUnknownTransactions(playerName, key, requiredAmount)) {
                        console.log(`❌ Could not resolve unknown transactions for ${playerName} to get ${shortfall} ${key}`);
                        // Still apply the change - this could result in negative resources which might be useful for debugging
                    }
                }
            }
        });
        // Apply all resource changes
        Object.keys(resourceChanges).forEach(resource => {
            const key = resource;
            const change = resourceChanges[key];
            if (change !== undefined) {
                // Update player resources
                player.resources[key] += change;
                // Update game resources (opposite of player change)
                game.gameResources[key] -= change;
                // Check if bank reached maximum for this resource type (19 = all cards back in bank)
                if (game.gameResources[key] === 19) {
                    resolveUnknownProbabilitiesForResource(key);
                }
            }
        });
    }
    function addUnknownSteal(thief, victim) {
        const victimPlayer = game.players.find(p => p.name === victim);
        if (!victimPlayer) {
            console.error(`❌ Victim player ${victim} not found`);
            return '';
        }
        // Calculate what resources the victim had that could be stolen
        const possibleResources = Object.assign({}, victimPlayer.resources);
        // Generate unique ID for this transaction
        const transactionId = `steal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const unknownTransaction = {
            id: transactionId,
            type: 'steal',
            timestamp: Date.now(),
            thief,
            victim,
            possibleResources,
            isResolved: false,
        };
        game.unknownTransactions.push(unknownTransaction);
        // Update probabilities for both players
        updateProbabilitiesAfterUnknownSteal(thief, victim, possibleResources);
        console.log(`🔍 Added unknown steal: ${thief} stole from ${victim} (Transaction ID: ${transactionId})`);
        console.log(`📊 Victim had: ${JSON.stringify(possibleResources)}`);
        return transactionId;
    }
    function updateProbabilitiesAfterUnknownSteal(thief, victim, possibleResources) {
        const thiefPlayer = game.players.find(p => p.name === thief);
        const victimPlayer = game.players.find(p => p.name === victim);
        if (!thiefPlayer || !victimPlayer)
            return;
        // Calculate total possible cards that could be stolen
        const totalPossibleCards = Object.values(possibleResources).reduce((sum, count) => sum + count, 0);
        if (totalPossibleCards === 0) {
            console.log(`⚠️  ${victim} had no cards to steal`);
            return;
        }
        // Update thief's resource probabilities (they gained one of these resources)
        Object.keys(possibleResources).forEach(resource => {
            const key = resource;
            const resourceCount = possibleResources[key];
            if (resourceCount > 0) {
                const probability = resourceCount / totalPossibleCards;
                thiefPlayer.resourceProbabilities[key] += probability;
            }
        });
        // Update victim's resource probabilities (they lost one card, but we don't know which)
        Object.keys(possibleResources).forEach(resource => {
            const key = resource;
            const resourceCount = possibleResources[key];
            if (resourceCount > 0) {
                const probability = resourceCount / totalPossibleCards;
                victimPlayer.resourceProbabilities[key] -= probability;
            }
        });
        console.log(`📈 Updated probabilities for ${thief} and ${victim}`);
    }
    function attemptToResolveUnknownTransactions(playerName, requiredResource, requiredAmount = 1) {
        const player = game.players.find(p => p.name === playerName);
        if (!player)
            return false;
        // Check if player has enough of the required resource
        if (player.resources[requiredResource] >= requiredAmount) {
            return true; // No need to resolve, player has the resource
        }
        const shortfall = requiredAmount - player.resources[requiredResource];
        // Check if player has enough including probabilities
        // Count how many unresolved transactions could potentially provide this resource
        const unresolvedStealsForResource = game.unknownTransactions.filter(transaction => !transaction.isResolved &&
            transaction.type === 'steal' &&
            transaction.thief === playerName &&
            transaction.possibleResources[requiredResource] > 0);
        const maxPossibleFromUnresolvedSteals = unresolvedStealsForResource.length;
        const totalMaxAvailable = player.resources[requiredResource] + maxPossibleFromUnresolvedSteals;
        if (totalMaxAvailable < requiredAmount) {
            console.log(`❌ ${playerName} doesn't have enough ${requiredResource} even with probabilities`);
            return false;
        }
        // Find unresolved transactions where this player was the thief and could have stolen this resource
        const unresolvedSteals = game.unknownTransactions.filter(transaction => !transaction.isResolved &&
            transaction.type === 'steal' &&
            transaction.thief === playerName &&
            transaction.possibleResources[requiredResource] > 0);
        if (unresolvedSteals.length === 0) {
            console.log(`❌ No unresolved steals found for ${playerName} involving ${requiredResource}`);
            return false;
        }
        // For now, resolve the most recent steal that could provide this resource
        // In a more sophisticated system, you might want to resolve based on highest probability
        const stealToResolve = unresolvedSteals[unresolvedSteals.length - 1];
        console.log(`🔍 Resolving unknown steal: ${stealToResolve.id}`);
        console.log(`   ${playerName} stole ${requiredResource} from ${stealToResolve.victim}`);
        // Resolve the transaction
        stealToResolve.isResolved = true;
        stealToResolve.resolvedResource = requiredResource;
        // Update actual resources
        player.resources[requiredResource] += shortfall;
        const victimPlayer = game.players.find(p => p.name === stealToResolve.victim);
        if (victimPlayer) {
            victimPlayer.resources[requiredResource] -= shortfall;
        }
        // Clear probabilities for this resolved transaction
        clearProbabilitiesForResolvedTransaction(stealToResolve);
        console.log(`✅ Resolved steal: ${playerName} stole ${requiredResource} from ${stealToResolve.victim}`);
        return true;
    }
    function clearProbabilitiesForResolvedTransaction(transaction) {
        const thiefPlayer = game.players.find(p => p.name === transaction.thief);
        const victimPlayer = game.players.find(p => p.name === transaction.victim);
        if (!thiefPlayer || !victimPlayer || !transaction.resolvedResource)
            return;
        // Calculate original probabilities to subtract
        const totalPossibleCards = Object.values(transaction.possibleResources).reduce((sum, count) => sum + count, 0);
        if (totalPossibleCards === 0)
            return;
        // Clear the resolved resource probabilities
        const resolvedResource = transaction.resolvedResource;
        const originalProbability = transaction.possibleResources[resolvedResource] / totalPossibleCards;
        // Remove the resolved probability from thief and add back to victim
        thiefPlayer.resourceProbabilities[resolvedResource] -= originalProbability;
        victimPlayer.resourceProbabilities[resolvedResource] += originalProbability;
        // Clear other probabilities that are no longer valid
        Object.keys(transaction.possibleResources).forEach(resource => {
            const key = resource;
            if (key !== resolvedResource && transaction.possibleResources[key] > 0) {
                const probability = transaction.possibleResources[key] / totalPossibleCards;
                thiefPlayer.resourceProbabilities[key] -= probability;
                victimPlayer.resourceProbabilities[key] += probability;
            }
        });
        console.log(`🧹 Cleared probabilities for resolved transaction ${transaction.id}`);
    }
    function resolveUnknownProbabilitiesForResource(resourceType) {
        console.log(`📈 Bank reached 19 ${resourceType} cards - resolving unknown probabilities`);
        // Find all unresolved transactions that could have involved this resource type
        const affectedTransactions = game.unknownTransactions.filter(transaction => !transaction.isResolved && transaction.possibleResources[resourceType] > 0);
        if (affectedTransactions.length === 0) {
            console.log(`📊 No unresolved transactions involving ${resourceType} found`);
            return;
        }
        // For each affected transaction, remove the probability for this resource type
        affectedTransactions.forEach(transaction => {
            const thiefPlayer = game.players.find(p => p.name === transaction.thief);
            const victimPlayer = game.players.find(p => p.name === transaction.victim);
            if (!thiefPlayer || !victimPlayer)
                return;
            // Calculate original probabilities
            const totalPossibleCards = Object.values(transaction.possibleResources).reduce((sum, count) => sum + count, 0);
            if (totalPossibleCards === 0)
                return;
            // Calculate the probability that was assigned to this resource type
            const eliminatedProbability = transaction.possibleResources[resourceType] / totalPossibleCards;
            // Remove this probability from both players
            thiefPlayer.resourceProbabilities[resourceType] -= eliminatedProbability;
            victimPlayer.resourceProbabilities[resourceType] += eliminatedProbability;
            // Update the transaction to reflect that this resource is no longer possible
            transaction.possibleResources[resourceType] = 0;
            // Recalculate probabilities for remaining possible resources
            const remainingTotal = Object.values(transaction.possibleResources).reduce((sum, count) => sum + count, 0);
            if (remainingTotal > 0) {
                // Redistribute the eliminated probability among remaining possible resources
                Object.keys(transaction.possibleResources).forEach(resource => {
                    const key = resource;
                    const resourceCount = transaction.possibleResources[key];
                    if (resourceCount > 0) {
                        const newProbability = resourceCount / remainingTotal;
                        const oldProbability = resourceCount / totalPossibleCards;
                        const probabilityIncrease = newProbability - oldProbability;
                        // Update player probabilities
                        thiefPlayer.resourceProbabilities[key] += probabilityIncrease;
                        victimPlayer.resourceProbabilities[key] -= probabilityIncrease;
                    }
                });
                console.log(`📊 Updated probabilities for transaction ${transaction.id} - eliminated ${resourceType}`);
            }
            else {
                // No possible resources left - this shouldn't happen but handle gracefully
                console.log(`⚠️  Transaction ${transaction.id} has no remaining possible resources after eliminating ${resourceType}`);
            }
        });
        console.log(`✅ Resolved ${affectedTransactions.length} unknown transactions involving ${resourceType}`);
    }

    // Create draggable overlay for game state display
    let gameStateOverlay = null;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let isMinimized = false;
    let isResizing = false;
    let currentScale = 1;
    let resizeStartData = { x: 0, y: 0, scale: 1 };
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
                scale: currentScale,
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
        const resourceColors = [
            '#f0f8ff',
            '#fff8dc',
            '#ffeaa7',
            '#a8e6cf',
            '#ddd6fe',
        ];
        let table = '<table style="width: 100%; border-collapse: collapse; margin: 10px 0;">';
        // Header row with resource totals
        table += '<thead><tr style="background: #f5f5f5;">';
        table +=
            '<th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Player</th>';
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
                const probability = player.resourceProbabilities[resource];
                // Show both actual count and probability if there's a probability
                let displayText = count.toString();
                if (probability !== 0) {
                    const sign = probability > 0 ? '+' : '';
                    const color = probability > 0 ? '#e74c3c' : '#3498db';
                    displayText = `${count} <span style="color: ${color}; font-size: 10px;">${sign}${probability.toFixed(2)}</span>`;
                }
                table += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center; background: ${resourceColors[index]}; font-weight: bold;">
        ${displayText}
      </td>`;
            });
            table += '</tr>';
        });
        table += '</tbody></table>';
        return table;
    }
    function generateUnknownTransactionsDisplay() {
        const unresolvedTransactions = game.unknownTransactions.filter(t => !t.isResolved);
        if (unresolvedTransactions.length === 0) {
            return '';
        }
        let display = '<div style="margin: 15px 0; padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px;">';
        display +=
            '<h4 style="margin: 0 0 10px 0; color: #856404;">🔍 Unknown Transactions</h4>';
        unresolvedTransactions.forEach(transaction => {
            const timestamp = new Date(transaction.timestamp).toLocaleTimeString();
            display += `<div style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; font-size: 11px;">`;
            display += `<strong>${transaction.thief}</strong> stole from <strong>${transaction.victim}</strong> `;
            display += `<span style="color: #666;">(${timestamp})</span><br>`;
            // Show what could have been stolen
            const possibleResources = Object.entries(transaction.possibleResources)
                .filter(([_, count]) => count > 0)
                .map(([resource, count]) => `${resource}: ${count}`)
                .join(', ');
            display += `<small style="color: #666;">Could be: ${possibleResources}</small>`;
            display += '</div>';
        });
        display += '</div>';
        return display;
    }
    function generateDiceChart() {
        const maxRolls = Math.max(...Object.values(game.diceRolls), 1);
        const chartHeight = 120;
        let chart = '<div style="margin: 15px 0;"><h4 style="margin: 0 0 10px 0; text-align: center;">Dice Roll Frequency</h4>';
        chart +=
            '<div style="display: flex; align-items: end; justify-content: space-between; height: ' +
                chartHeight +
                'px; border-bottom: 2px solid #333; padding: 0 5px;">';
        for (let i = 2; i <= 12; i++) {
            const rolls = game.diceRolls[i];
            const barHeight = maxRolls > 0 ? (rolls / maxRolls) * (chartHeight - 20) : 0;
            const barColor = i === 7 ? '#ff6b6b' : i === 6 || i === 8 ? '#4ecdc4' : '#45b7d1';
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
       ${generateUnknownTransactionsDisplay()}
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

    function updateGameFromChat(element) {
        var _a, _b;
        // If we're waiting for "you" player selection, don't process new messages
        if (isWaitingForYouPlayerSelection) {
            return;
        }
        const messageText = ((_a = element.textContent) === null || _a === void 0 ? void 0 : _a.replace(/\s+/g, ' ').trim()) || '';
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
                // Auto-detect current player on the first dice roll instead of showing popup
                if (!youPlayerName && game.players.length > 0) {
                    const success = autoDetectCurrentPlayer();
                    if (!success) {
                        console.log('⚠️ Could not auto-detect current player. Manual selection may be needed.');
                    }
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
            // Get the victim (second span with font-weight:600, after "from")
            const victimSpans = element.querySelectorAll('span[style*="font-weight:600"]');
            // if there are not two spans then the first user is "you"
            const victim = victimSpans.length >= 2
                ? victimSpans[1].textContent
                : victimSpans[0].textContent;
            if (victim && playerName) {
                const stolenResource = getResourceType(element);
                if (stolenResource) {
                    // Known steal - we know what resource was stolen
                    updateResources(playerName, { [stolenResource]: 1 });
                    updateResources(victim, { [stolenResource]: -1 });
                    console.log(`🦹 ${playerName} stole ${stolenResource} from ${victim}`);
                }
                else {
                    // Check if victim has only one type of resource (with non-zero count)
                    const victimPlayer = game.players.find(p => p.name === victim);
                    const nonZeroResources = victimPlayer
                        ? Object.entries(victimPlayer.resources).filter(([_, count]) => count > 0)
                        : [];
                    if (nonZeroResources.length === 1) {
                        // Victim has only one type of resource - we can deduce what was stolen
                        const [deductedStolenResource] = nonZeroResources[0];
                        updateResources(playerName, { [deductedStolenResource]: 1 });
                        updateResources(victim, { [deductedStolenResource]: -1 });
                        console.log(`🦹 ${playerName} stole ${deductedStolenResource} from ${victim} (deduced - victim had only one resource type)`);
                    }
                    else {
                        // Unknown steal - we don't know what resource was stolen
                        const transactionId = addUnknownSteal(playerName, victim);
                        console.log(`🔍 ${playerName} stole unknown resource from ${victim} (Transaction: ${transactionId})`);
                    }
                }
            }
        }
        // Scenario 7: Buy dev card (keyword: "bought" + development card image)
        else if (messageText.includes('bought') &&
            element.querySelector('img[alt="development card"]')) {
            if (playerName) {
                ensurePlayerExists(playerName);
                game.devCards--;
                // Cost: 1 wheat, 1 sheep, 1 ore (updateResources will handle unknown transaction resolution)
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
                    // Cost: 1 wood, 1 wheat, 1 brick, 1 sheep (updateResources will handle unknown transaction resolution)
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
                    // Cost: 3 ore, 2 wheat (updateResources will handle unknown transaction resolution)
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
                    // Cost: 1 wood, 1 brick (updateResources will handle unknown transaction resolution)
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
        // Scenario 23: Wants to give (can resolve unknown transactions)
        else if (messageText.includes('wants to give')) {
            if (playerName) {
                ensurePlayerExists(playerName);
                // Parse what resources the player is offering to give (only before " for ")
                const offeredResources = getResourcesFromImages(element, RESOURCE_STRING, ' for ');
                // For each resource they're offering, they must have it
                // This can resolve unknown transactions
                Object.keys(offeredResources).forEach(resource => {
                    const key = resource;
                    const offeredCount = offeredResources[key];
                    if (offeredCount > 0) {
                        // Try to resolve unknown transactions for this resource
                        attemptToResolveUnknownTransactions(playerName, key, offeredCount);
                    }
                });
                console.log(`💭 ${playerName} wants to trade (offering: ${JSON.stringify(offeredResources)}) - checking for unknown transaction resolution`);
            }
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
        // Scenario 26: Ignore learn how to play messages
        else if (messageText.includes('Learn how to play')) ;
        // Scenario 27: Proposed counter offer
        else if (messageText.includes('proposed counter offer to')) {
            if (playerName) {
                ensurePlayerExists(playerName);
                // Parse the counter offer to extract what resources the player is offering
                // Format: "Arop proposed counter offer to sadpanda10, offering [resources] for [resources]"
                // Find the "offering" and "for" parts to extract what they're giving
                const offeringMatch = messageText.match(/offering (.+?) for/);
                if (offeringMatch) {
                    // Get all images between "offering" and "for" to see what resources they have
                    const messageHTML = element.innerHTML;
                    const offeringSection = (_b = messageHTML
                        .split('offering ')[1]) === null || _b === void 0 ? void 0 : _b.split(' for ')[0];
                    if (offeringSection) {
                        // Create a temporary element to parse the offering section
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = offeringSection;
                        // Extract resources from the offering section
                        const offeredResources = getResourcesFromImages(tempDiv, RESOURCE_STRING);
                        if (Object.keys(offeredResources).length > 0) {
                            console.log(`💰 ${playerName} proposed counter offer, confirming they have: ${JSON.stringify(offeredResources)}`);
                            // This confirms the player has these resources, which can help resolve unknown transactions
                            // Try to resolve unknown steals for each resource type they're offering
                            Object.keys(offeredResources).forEach(resource => {
                                const resourceKey = resource;
                                const amount = offeredResources[resourceKey];
                                if (amount > 0) {
                                    // Try to resolve unknown transactions involving this resource
                                    attemptToResolveUnknownTransactions(playerName, resourceKey, amount);
                                }
                            });
                        }
                    }
                }
            }
        }
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
            autoDetectCurrentPlayer();
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
    // Start polling every 2 seconds
    const intervalId = window.setInterval(tryFindChat, 2000);
    // Optionally run immediately
    tryFindChat();

})();
