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
    /**
     * Parse trade resources from HTML element by splitting on text markers
     */
    function parseTradeResources(element) {
        const elementHTML = element.innerHTML;
        const gaveEndIndex = elementHTML.indexOf(' and got ');
        const fromIndex = elementHTML.indexOf(' from ');
        if (gaveEndIndex === -1 || fromIndex === -1)
            return null;
        // Extract the "gave" section (before " and got ")
        const gaveDiv = document.createElement('div');
        gaveDiv.innerHTML = elementHTML.substring(0, gaveEndIndex);
        // Extract the "got" section (between " and got " and " from ")
        const gotDiv = document.createElement('div');
        const gotStartIndex = gaveEndIndex + ' and got '.length;
        gotDiv.innerHTML = elementHTML.substring(gotStartIndex, fromIndex);
        // Count resources in each section
        const gave = {};
        const got = {};
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
    function getStealVictim(element) {
        // Get the victim (second span with font-weight:600, after "from")
        const victimSpans = element.querySelectorAll('span[style*="font-weight:600"]');
        // if there are not two spans then the first user is "you"
        return victimSpans.length >= 2
            ? victimSpans[1].textContent || null
            : victimSpans[0].textContent || null;
    }
    /**
     * Parse bank trade resources from HTML element
     */
    function parseBankTrade(element) {
        const elementHTML = element.innerHTML;
        const tookIndex = elementHTML.indexOf(' and took ');
        if (tookIndex === -1)
            return null;
        // Extract the "gave" section (before " and took ")
        const gaveDiv = document.createElement('div');
        gaveDiv.innerHTML = elementHTML.substring(0, tookIndex);
        // Extract the "took" section (after " and took ")
        const tookDiv = document.createElement('div');
        const tookStartIndex = tookIndex + ' and took '.length;
        tookDiv.innerHTML = elementHTML.substring(tookStartIndex);
        // Count resources in each section using the same approach as parseTradeResources
        const resourceChanges = {};
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
    function parseCounterOfferResources(element) {
        var _a;
        // Get all images between "offering" and "for" to see what resources they have
        const messageHTML = element.innerHTML;
        const offeringSection = (_a = messageHTML.split('offering ')[1]) === null || _a === void 0 ? void 0 : _a.split(' for ')[0];
        if (offeringSection) {
            // Create a temporary element to parse the offering section
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = offeringSection;
            // Extract resources from the offering section
            return getResourcesFromImages(tempDiv, RESOURCE_STRING);
        }
        return {};
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
                // If player used resources and now has 0 of that type, eliminate from victim transactions
                // (if they had this resource stolen, they wouldn't be able to use it and reach 0)
                if (change < 0 && player.resources[key] === 0) {
                    eliminateResourceFromVictimTransactions(playerName, key);
                }
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
        // Resolve the transaction using helper function
        resolveUnknownTransaction(stealToResolve, requiredResource);
        // If we needed more than 1 resource, add the additional amount
        if (shortfall > 1) {
            player.resources[requiredResource] += shortfall - 1;
            const victimPlayer = game.players.find(p => p.name === stealToResolve.victim);
            if (victimPlayer) {
                victimPlayer.resources[requiredResource] -= shortfall - 1;
            }
        }
        console.log(`✅ Resolved steal: ${playerName} stole ${requiredResource} from ${stealToResolve.victim}`);
        return true;
    }
    /**
     * Resolve a specific unknown transaction with a known resource type
     */
    function resolveUnknownTransaction(transaction, resourceType) {
        console.log(`✅ Auto-resolving transaction ${transaction.id} - ${resourceType} determined`);
        const thiefPlayer = game.players.find(p => p.name === transaction.thief);
        const victimPlayer = game.players.find(p => p.name === transaction.victim);
        if (!thiefPlayer || !victimPlayer)
            return;
        // Mark transaction as resolved
        transaction.isResolved = true;
        transaction.resolvedResource = resourceType;
        // Transfer the actual resource
        thiefPlayer.resources[resourceType] += 1;
        victimPlayer.resources[resourceType] -= 1;
        // Clear all probabilities for this resolved transaction
        clearProbabilitiesForResolvedTransaction(transaction);
    }
    function clearProbabilitiesForResolvedTransaction(transaction) {
        console.log(`🧹 Recalculating probabilities after resolving transaction ${transaction.id}`);
        // Instead of trying to clear just this transaction's probabilities,
        // recalculate all probabilities from scratch based on remaining unresolved transactions
        recalculateAllProbabilities();
    }
    /**
     * Recalculate all player probabilities from scratch based on unresolved transactions
     */
    function recalculateAllProbabilities() {
        // First, reset all probabilities to 0
        game.players.forEach(player => {
            Object.keys(player.resourceProbabilities).forEach(resource => {
                const key = resource;
                player.resourceProbabilities[key] = 0;
            });
        });
        // Then, recalculate probabilities for all unresolved transactions
        const unresolvedTransactions = game.unknownTransactions.filter(t => !t.isResolved);
        unresolvedTransactions.forEach(transaction => {
            const thiefPlayer = game.players.find(p => p.name === transaction.thief);
            const victimPlayer = game.players.find(p => p.name === transaction.victim);
            if (!thiefPlayer || !victimPlayer)
                return;
            // Calculate total possible resources for this transaction
            const totalPossible = Object.values(transaction.possibleResources).reduce((sum, count) => sum + count, 0);
            if (totalPossible > 0) {
                // Add probabilities for each possible resource
                Object.keys(transaction.possibleResources).forEach(resource => {
                    const key = resource;
                    const resourceCount = transaction.possibleResources[key];
                    if (resourceCount > 0) {
                        const probability = resourceCount / totalPossible;
                        // Thief gains probability, victim loses probability
                        thiefPlayer.resourceProbabilities[key] += probability;
                        victimPlayer.resourceProbabilities[key] -= probability;
                    }
                });
            }
        });
        console.log(`📊 Recalculated probabilities for ${unresolvedTransactions.length} unresolved transactions`);
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
    /**
     * Eliminate a resource from unknown transactions where the player was the victim
     * (because if they used it and reached 0, or if they're offering it, they must still have it)
     */
    function eliminateResourceFromVictimTransactions(playerName, resource) {
        const affectedTransactions = game.unknownTransactions.filter(transaction => !transaction.isResolved &&
            transaction.victim === playerName &&
            transaction.possibleResources[resource] > 0);
        affectedTransactions.forEach(transaction => {
            console.log(`🔍 Eliminating ${resource} from transaction ${transaction.id} - ${playerName} proven to still have it`);
            const thiefPlayer = game.players.find(p => p.name === transaction.thief);
            const victimPlayer = game.players.find(p => p.name === transaction.victim);
            if (!thiefPlayer || !victimPlayer)
                return;
            // Calculate original probabilities
            const totalPossibleCards = Object.values(transaction.possibleResources).reduce((sum, count) => sum + count, 0);
            if (totalPossibleCards === 0)
                return;
            // Calculate the probability that was assigned to this resource type
            const eliminatedProbability = transaction.possibleResources[resource] / totalPossibleCards;
            // Remove this probability from both players
            thiefPlayer.resourceProbabilities[resource] -= eliminatedProbability;
            victimPlayer.resourceProbabilities[resource] += eliminatedProbability;
            // Update the transaction to reflect that this resource is no longer possible
            transaction.possibleResources[resource] = 0;
            // Recalculate probabilities for remaining possible resources
            const remainingTotal = Object.values(transaction.possibleResources).reduce((sum, count) => sum + count, 0);
            if (remainingTotal > 0) {
                // Check if only one resource type remains - if so, resolve the transaction
                const remainingResourceTypes = Object.keys(transaction.possibleResources).filter(res => transaction.possibleResources[res] > 0);
                if (remainingResourceTypes.length === 1) {
                    // Only one resource type left - we can resolve this transaction
                    const resolvedResourceType = remainingResourceTypes[0];
                    resolveUnknownTransaction(transaction, resolvedResourceType);
                }
                else {
                    // Multiple resource types remain - redistribute probabilities
                    Object.keys(transaction.possibleResources).forEach(res => {
                        const key = res;
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
                    console.log(`📊 Updated probabilities for transaction ${transaction.id} - eliminated ${resource}`);
                }
            }
        });
    }

    /**
     * Handle a player discarding resources
     */
    function playerDiscard(playerName, discardedResources) {
        if (!playerName)
            return;
        // Remove resources from player (negative values, automatically adds to bank)
        const playerChanges = {};
        Object.keys(discardedResources).forEach(resource => {
            const key = resource;
            const count = discardedResources[key];
            if (count && count > 0) {
                playerChanges[key] = -count;
            }
        });
        updateResources(playerName, playerChanges);
        console.log(`🗑️ ${playerName} discarded resources: ${JSON.stringify(discardedResources)}`);
    }
    /**
     * Handle a player placing a settlement
     */
    function placeSettlement(playerName) {
        if (!playerName)
            return;
        ensurePlayerExists(playerName);
        const player = game.players.find(p => p.name === playerName);
        if (player && player.settlements > 0) {
            player.settlements--;
            console.log(`🏠 ${playerName} placed a settlement. Remaining settlements: ${player.settlements}`);
        }
    }
    /**
     * Handle a dice roll
     */
    function rollDice(diceTotal) {
        if (diceTotal >= 2 && diceTotal <= 12) {
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
    /**
     * Handle a player placing a road
     */
    function placeRoad(playerName) {
        if (!playerName)
            return;
        const player = game.players.find(p => p.name === playerName);
        if (player && player.roads > 0) {
            player.roads--;
            console.log(`🛣️ ${playerName} placed a road. Remaining roads: ${player.roads}`);
        }
    }
    /**
     * Handle a trade between two players
     */
    function playerTrade(playerName, tradePartner, resourceChanges) {
        if (!playerName || !tradePartner)
            return;
        // Validate that there are actual resource changes
        const hasChanges = Object.values(resourceChanges).some(count => count && count !== 0);
        if (!hasChanges)
            return;
        // Update the player who initiated the trade
        updateResources(playerName, resourceChanges);
        // Update the trade partner (opposite changes)
        const partnerChanges = {};
        Object.entries(resourceChanges).forEach(([resource, count]) => {
            if (count && count !== 0) {
                partnerChanges[resource] = -count;
            }
        });
        updateResources(tradePartner, partnerChanges);
        console.log(`🤝 ${playerName} traded with ${tradePartner}. Changes: ${JSON.stringify(resourceChanges)}`);
    }
    /**
     * Handle a player getting resources
     */
    function playerGetResources(playerName, resources) {
        if (!playerName)
            return;
        // Validate that there are actual resources to get
        const hasResources = Object.values(resources).some(count => count && count > 0);
        if (!hasResources)
            return;
        updateResources(playerName, resources);
        console.log(`🌾 ${playerName} got resources: ${JSON.stringify(resources)}`);
    }
    /**
     * Handle a known steal where we know what resource was stolen
     */
    function knownSteal(thief, victim, resource) {
        if (!thief || !victim)
            return;
        updateResources(thief, { [resource]: 1 });
        updateResources(victim, { [resource]: -1 });
        console.log(`🦹 ${thief} stole ${resource} from ${victim}`);
    }
    /**
     * Handle an unknown steal - tries to deduce the resource or records it as unknown
     */
    function unknownSteal(thief, victim) {
        if (!thief || !victim)
            return;
        // Check if victim has only one type of resource (with non-zero count)
        const victimPlayer = game.players.find(p => p.name === victim);
        const nonZeroResources = victimPlayer
            ? Object.entries(victimPlayer.resources).filter(([_, count]) => count > 0)
            : [];
        if (nonZeroResources.length === 1) {
            // Victim has only one type of resource - we can deduce what was stolen
            const [deductedResource] = nonZeroResources[0];
            const resourceType = deductedResource;
            knownSteal(thief, victim, resourceType);
        }
        else {
            // Unknown steal - we don't know what resource was stolen
            const transactionId = addUnknownSteal(thief, victim);
            console.log(`🔍 ${thief} stole unknown resource from ${victim} (Transaction: ${transactionId})`);
        }
    }
    /**
     * Handle a player buying a development card
     */
    function buyDevCard(playerName) {
        if (!playerName)
            return;
        game.devCards--;
        updateResources(playerName, { wheat: -1, sheep: -1, ore: -1 });
        console.log(`🃏 ${playerName} bought a development card. Remaining dev cards: ${game.devCards}`);
    }
    /**
     * Handle a player trading with the bank
     */
    function bankTrade(playerName, resourceChanges) {
        if (!playerName)
            return;
        updateResources(playerName, resourceChanges);
        console.log(`🏦 ${playerName} traded with bank. Changes: ${JSON.stringify(resourceChanges)}`);
    }
    /**
     * Handle a player using a knight card
     */
    function useKnight(playerName) {
        if (!playerName)
            return;
        const player = game.players.find(p => p.name === playerName);
        if (player) {
            player.knights++;
            player.discoveryCards.knights--;
            console.log(`⚔️ ${playerName} used a knight. Total knights played: ${player.knights}`);
        }
    }
    /**
     * Handle a player building a settlement
     */
    function buildSettlement(playerName) {
        if (!playerName)
            return;
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
    /**
     * Handle a player building a city
     */
    function buildCity(playerName) {
        if (!playerName)
            return;
        const player = game.players.find(p => p.name === playerName);
        if (player) {
            updateResources(playerName, { ore: -3, wheat: -2 });
            player.cities--;
            player.settlements++; // City replaces settlement
            player.victoryPoints++;
            console.log(`🏰 ${playerName} built a city. VP: ${player.victoryPoints}, Remaining cities: ${player.cities}`);
        }
    }
    /**
     * Handle a player building a road
     */
    function buildRoad(playerName) {
        if (!playerName)
            return;
        const player = game.players.find(p => p.name === playerName);
        if (player) {
            updateResources(playerName, { tree: -1, brick: -1 });
            player.roads--;
            console.log(`🛣️ ${playerName} built a road. Remaining roads: ${player.roads}`);
        }
    }
    /**
     * Handle a player moving the robber
     */
    function moveRobber(playerName) {
        if (!playerName)
            return;
        const player = game.players.find(p => p.name === playerName);
        if (player) {
            player.totalRobbers++;
            console.log(`🔒 ${playerName} moved the robber. Total robber moves: ${player.totalRobbers}`);
        }
    }
    /**
     * Handle a player using Year of Plenty card
     */
    function useYearOfPlenty(playerName) {
        if (!playerName)
            return;
        const player = game.players.find(p => p.name === playerName);
        if (player) {
            game.yearOfPlenties--;
            player.discoveryCards.yearOfPlenties--;
            console.log(`🎯 ${playerName} used Year of Plenty. Remaining: ${game.yearOfPlenties}`);
        }
    }
    /**
     * Handle a player taking resources from bank via Year of Plenty
     */
    function yearOfPlentyTake(playerName, resources) {
        if (!playerName)
            return;
        const hasResources = Object.values(resources).some(count => count && count > 0);
        if (!hasResources)
            return;
        updateResources(playerName, resources);
        console.log(`🎯 ${playerName} took from bank via Year of Plenty: ${JSON.stringify(resources)}`);
    }
    /**
     * Handle a player using Road Building card
     */
    function useRoadBuilding(playerName) {
        if (!playerName)
            return;
        const player = game.players.find(p => p.name === playerName);
        if (player) {
            game.roadBuilders--;
            player.discoveryCards.roadBuilders--;
            console.log(`🛣️ ${playerName} used Road Building. Remaining: ${game.roadBuilders}`);
        }
    }
    /**
     * Handle a player using Monopoly card
     */
    function useMonopoly(playerName) {
        if (!playerName)
            return;
        const player = game.players.find(p => p.name === playerName);
        if (player) {
            game.monopolies--;
            player.discoveryCards.monopolies--;
            console.log(`💰 ${playerName} used Monopoly. Remaining: ${game.monopolies}`);
        }
    }
    /**
     * Handle monopoly resource steal - takes resources from all other players
     */
    function monopolySteal(playerName, resourceType, totalStolen) {
        if (!playerName || totalStolen <= 0)
            return;
        const monopolyPlayer = game.players.find(p => p.name === playerName);
        if (!monopolyPlayer)
            return;
        // Calculate total resources to steal and remove from other players
        let actualStolen = 0;
        game.players.forEach(otherPlayer => {
            if (otherPlayer.name !== playerName) {
                const playerHas = otherPlayer.resources[resourceType];
                if (playerHas > 0) {
                    actualStolen += playerHas;
                    otherPlayer.resources[resourceType] = 0;
                }
            }
        });
        // Add the actual stolen amount to monopoly player (directly, not via updateResources)
        monopolyPlayer.resources[resourceType] += actualStolen;
        console.log(`💰 ${playerName} monopolized ${actualStolen} ${resourceType} from all players (expected: ${totalStolen})`);
    }
    /**
     * Handle a player receiving starting resources
     */
    function receiveStartingResources(playerName, resources) {
        if (!playerName)
            return;
        const hasResources = Object.values(resources).some(count => count && count > 0);
        if (!hasResources)
            return;
        updateResources(playerName, resources);
        console.log(`🏁 ${playerName} received starting resources: ${JSON.stringify(resources)}`);
    }
    /**
     * Handle a player offering resources in trade (helps resolve unknown transactions)
     */
    function playerOffer(playerName, offeredResources) {
        if (!playerName)
            return;
        const hasResources = Object.values(offeredResources).some(count => count && count > 0);
        if (!hasResources)
            return;
        const player = game.players.find(p => p.name === playerName);
        if (!player)
            return;
        // For each resource they're offering, they must have it
        // This can resolve unknown transactions
        Object.keys(offeredResources).forEach(resource => {
            const key = resource;
            const offeredCount = offeredResources[key];
            if (offeredCount && offeredCount > 0) {
                // Try to resolve unknown transactions for this resource
                attemptToResolveUnknownTransactions(playerName, key, offeredCount);
                // If player is offering exactly the amount they have of a resource,
                // eliminate it from any unknown transactions where they were the victim
                // (because they must still have it to be able to offer it)
                if (player.resources[key] === offeredCount) {
                    eliminateResourceFromVictimTransactions(playerName, key);
                }
            }
        });
        console.log(`💭 ${playerName} (offering: ${JSON.stringify(offeredResources)}) - checking for unknown transaction resolution`);
    }
    /**
     * Handle a player stealing a specific resource from the current player
     */
    function stealFromYou(thief, victim, stolenResource) {
        if (!thief || !victim)
            return;
        // Transfer resource from victim to thief
        updateResources(thief, { [stolenResource]: 1 });
        updateResources(victim, { [stolenResource]: -1 });
        console.log(`🦹 ${thief} stole ${stolenResource} from you (${victim})`);
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

    /**
     * Check if an element should be ignored (not processed)
     */
    function ignoreElement(element, messageText) {
        return (
        // Disconnection messages
        messageText.includes('has disconnected') ||
            messageText.includes('will take over') ||
            // Reconnection messages
            messageText.includes('has reconnected') ||
            // Robber blocking messages
            messageText.includes('is blocked by the Robber') ||
            messageText.includes('No resources produced') ||
            // HR elements
            element.querySelector('hr') !== null ||
            // Learn how to play messages
            messageText.includes('Learn how to play'));
    }
    function updateGameFromChat(element) {
        var _a;
        // If we're waiting for "you" player selection, don't process new messages
        if (isWaitingForYouPlayerSelection)
            return;
        const messageText = ((_a = element.textContent) === null || _a === void 0 ? void 0 : _a.replace(/\s+/g, ' ').trim()) || '';
        if (ignoreElement(element, messageText))
            return;
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
        // Scenario 0: Handle "[Player] stole [resource] from you" scenario
        if (messageText.includes('stole') && messageText.includes('from you')) {
            const stolenResource = getResourceType(element);
            if (stolenResource) {
                stealFromYou(playerName, youPlayerName, stolenResource);
            }
        }
        // Scenario 1: Place settlement (keyword: "placed a")
        else if (messageText.includes('placed a') &&
            element.querySelector('img[alt="settlement"]')) {
            placeSettlement(playerName);
        }
        // Scenario 2: Roll dice (keyword: "rolled")
        else if (messageText.includes('rolled')) {
            const diceTotal = getDiceRollTotal(element);
            if (diceTotal) {
                rollDice(diceTotal);
            }
        }
        // Scenario 3: Place road (keyword: "placed a" + road image)
        else if (messageText.includes('placed a') &&
            element.querySelector('img[alt="road"]')) {
            placeRoad(playerName);
        }
        // Scenario 4: Known trade (keyword: "gave" and "got" and "from")
        else if (messageText.includes('gave') &&
            messageText.includes('got') &&
            messageText.includes('from')) {
            const tradePartner = getTradePartner(element);
            const tradeData = parseTradeResources(element);
            if (tradeData) {
                // Calculate net resource changes for the 1stplayer (negative for gave, positive for got)
                const resourceChanges = {};
                // Add what they gave (negative values)
                Object.entries(tradeData.gave).forEach(([resource, count]) => {
                    if (count && count > 0) {
                        resourceChanges[resource] = -count;
                    }
                });
                // Add what they got (positive values)
                Object.entries(tradeData.got).forEach(([resource, count]) => {
                    if (count && count > 0) {
                        resourceChanges[resource] =
                            (resourceChanges[resource] || 0) +
                                count;
                    }
                });
                playerTrade(playerName, tradePartner, resourceChanges);
            }
        }
        // Scenario 5: Get resources (keyword: "got")
        else if (messageText.includes('got')) {
            const gotResources = getResourcesFromImages(element, RESOURCE_STRING);
            playerGetResources(playerName, gotResources);
        }
        // Scenario 6: Steal (keyword: "stole" and "from")
        else if (messageText.includes('stole') && messageText.includes('from')) {
            const victim = getStealVictim(element);
            const stolenResource = getResourceType(element);
            stolenResource
                ? knownSteal(playerName, victim, stolenResource)
                : unknownSteal(playerName, victim);
        }
        // Scenario 7: Buy dev card (keyword: "bought" + development card image)
        else if (messageText.includes('bought') &&
            element.querySelector('img[alt="development card"]')) {
            buyDevCard(playerName);
        }
        // Scenario 8: Bank trade (keyword: "gave bank" and "took")
        else if (messageText.includes('gave bank') && messageText.includes('took')) {
            const resourceChanges = parseBankTrade(element);
            if (resourceChanges) {
                bankTrade(playerName, resourceChanges);
            }
        }
        // Scenario 9: Used knight (keyword: "used" + "Knight")
        else if (messageText.includes('used') && messageText.includes('Knight')) {
            useKnight(playerName);
        }
        // Scenario 10: Build settlement (keyword: "built a" + settlement image)
        else if (messageText.includes('built a') &&
            element.querySelector('img[alt="settlement"]')) {
            buildSettlement(playerName);
        }
        // Scenario 11: Build city (keyword: "built a" + city image)
        else if (messageText.includes('built a') &&
            element.querySelector('img[alt="city"]')) {
            buildCity(playerName);
        }
        // Scenario 12: Build road (keyword: "built a" + road image)
        else if (messageText.includes('built a') &&
            element.querySelector('img[alt="road"]')) {
            buildRoad(playerName);
        }
        // Scenario 13: Move robber (keyword: "moved Robber")
        else if (messageText.includes('moved Robber')) {
            moveRobber(playerName);
        }
        // Scenario 14: Use Year of Plenty (keyword: "used" + "Year of Plenty")
        else if (messageText.includes('used') &&
            messageText.includes('Year of Plenty')) {
            useYearOfPlenty(playerName);
        }
        // Scenario 15: Year of Plenty take (keyword: "took from bank")
        else if (messageText.includes('took from bank')) {
            const takenResources = getResourcesFromImages(element, RESOURCE_STRING);
            yearOfPlentyTake(playerName, takenResources);
        }
        // Scenario 16: Use Road Building (keyword: "used" + "Road Building")
        else if (messageText.includes('used') &&
            messageText.includes('Road Building')) {
            useRoadBuilding(playerName);
        }
        // Scenario 17: Use Monopoly (keyword: "used" + "Monopoly")
        else if (messageText.includes('used') && messageText.includes('Monopoly')) {
            useMonopoly(playerName);
        }
        // Scenario 18: Monopoly steal (keyword: "stole" + number)
        else if (messageText.includes('stole') && /stole \d+/.test(messageText)) {
            const resourceType = getResourceType(element);
            const match = messageText.match(/stole (\d+)/);
            const stolenCount = match ? parseInt(match[1]) : 0;
            if (resourceType && stolenCount > 0) {
                monopolySteal(playerName, resourceType, stolenCount);
            }
        }
        // Scenario 19: Starting resources (keyword: "received starting resources")
        else if (messageText.includes('received starting resources')) {
            const startingResources = getResourcesFromImages(element, RESOURCE_STRING);
            receiveStartingResources(playerName, startingResources);
        }
        // Scenario 20: Wants to give (can resolve unknown transactions)
        else if (messageText.includes('wants to give')) {
            const offeredResources = getResourcesFromImages(element, RESOURCE_STRING, ' for ');
            playerOffer(playerName, offeredResources);
        }
        // Scenario 21: Discards (keyword: "discarded")
        else if (messageText.includes('discarded')) {
            const discardedResources = getResourcesFromImages(element, RESOURCE_STRING);
            playerDiscard(playerName, discardedResources);
        }
        // Scenario 22: Proposed counter offer
        else if (messageText.includes('proposed counter offer to')) {
            const offeredResources = parseCounterOfferResources(element);
            playerOffer(playerName, offeredResources);
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
