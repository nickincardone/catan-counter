(function () {
    'use strict';

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };

    const RESOURCE_STRING = 'img[alt="grain"], img[alt="wool"], img[alt="lumber"], img[alt="brick"], img[alt="ore"], img[alt="Grain"], img[alt="Wool"], img[alt="Lumber"], img[alt="Brick"], img[alt="Ore"]';
    function findChatContainer() {
        // Colonist renders the chat log as a virtual scroller whose children are the
        // individual message rows, each tagged with a `data-index`. Find any rendered
        // row and return its parent (the scroller) so callers can iterate its children
        // and observe it for newly added messages.
        //
        // We intentionally do NOT key off the "Learn how to play in the rulebook"
        // (a[href="#open-rulebook"]) welcome message: it only lives at the top of the
        // log and scrolls out of the virtualized DOM as the game progresses, so relying
        // on it left the overlay unable to attach after a mid-game page refresh.
        const firstMessageRow = document.querySelector('[data-index]');
        return firstMessageRow ? firstMessageRow.parentElement : null;
    }
    /**
     * Read each player's current resource-card count from colonist's player panel
     * (`[data-player-information-container]` -> one `[data-player-color]` block per
     * player, each containing a `[data-resource-card]` count). Returns a map of
     * player name -> card count for the requested players only.
     *
     * These counts are the signal the chat alone can't provide: combined with the
     * variant engine they let `pruneByHandCounts` resolve steals (e.g. after a
     * monopoly). Block-to-name matching uses the known player names (longest match
     * first) to avoid partial-name collisions.
     */
    function getPlayerCardCounts(playerNames) {
        const counts = {};
        const container = document.querySelector('[data-player-information-container]');
        if (!container)
            return counts;
        const blocks = container.querySelectorAll('[data-player-color]');
        blocks.forEach(block => {
            var _a, _b;
            const text = block.textContent || '';
            const name = playerNames
                .filter(n => text.includes(n))
                .sort((a, b) => b.length - a.length)[0];
            if (!name)
                return;
            const cardEl = block.querySelector('[data-resource-card]');
            const count = parseInt((_b = (_a = cardEl === null || cardEl === void 0 ? void 0 : cardEl.textContent) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '', 10);
            if (!Number.isNaN(count)) {
                counts[name] = count;
            }
        });
        return counts;
    }
    function getPlayerName(element) {
        const playerSpan = element.querySelector('span[style*="font-weight:600"], span[style*="font-weight: 600"]');
        return playerSpan ? playerSpan.textContent || null : null;
    }
    function getPlayerColor(element) {
        const playerSpan = element.querySelector('span[style*="font-weight:600"], span[style*="font-weight: 600"]');
        return playerSpan ? playerSpan.style.color || '#000' : '#000';
    }
    /**
     * Automatically detects the current player from the web-header-username
     * This eliminates the need for user input popups
     */
    function getCurrentPlayerFromHeader() {
        var _a;
        const headerElement = document.getElementsByClassName('web-header-username')[0];
        if (!headerElement) {
            console.log('🔍 web-header-username element not found');
            return null;
        }
        const currentPlayer = ((_a = headerElement.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || null;
        if (currentPlayer) {
            console.log(`🎯 Auto-detected current player: ${currentPlayer}`);
        }
        else {
            console.log('🔍 web-header-username element found but empty');
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
        if (!alt)
            return null;
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
    function getTradePartner(element) {
        const spans = element.querySelectorAll('span[style*="font-weight:600"], span[style*="font-weight: 600"]');
        return spans.length > 1 ? spans[1].textContent || null : null;
    }
    function getResourcesFromImages(element, stopAt) {
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
            var _a;
            const alt = (_a = img.getAttribute('alt')) === null || _a === void 0 ? void 0 : _a.toLowerCase();
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
        // Handle both "font-weight:600" and "font-weight: 600" formats
        const victimSpans = element.querySelectorAll('span[style*="font-weight:600"], span[style*="font-weight: 600"]');
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
        const resources = {};
        const innerHTML = element.innerHTML;
        const forIndex = innerHTML.indexOf(' for ');
        let htmlBeforeFor;
        if (forIndex === -1) {
            htmlBeforeFor = innerHTML;
        }
        else {
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
    function getBlockedDiceNumber(element) {
        const diceImg = element.querySelector('img[alt^="prob_"]');
        if (diceImg) {
            const alt = diceImg.getAttribute('alt');
            const match = alt === null || alt === void 0 ? void 0 : alt.match(/prob_(\d+)/);
            return match ? parseInt(match[1]) : null;
        }
        return null;
    }
    /**
     * Extract resource type from blocked dice message
     * Example: <img alt="wool tile"> -> sheep
     */
    function getBlockedResourceType(element) {
        const tileImg = element.querySelector('img[alt$=" tile"]');
        if (tileImg) {
            const alt = tileImg.getAttribute('alt');
            const match = alt === null || alt === void 0 ? void 0 : alt.match(/(\w+) tile/);
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

    var GameTypeEnum;
    (function (GameTypeEnum) {
        GameTypeEnum["STANDARD"] = "STANDARD";
    })(GameTypeEnum || (GameTypeEnum = {}));
    // Game State Types
    var TransactionTypeEnum;
    (function (TransactionTypeEnum) {
        TransactionTypeEnum["ROBBER_STEAL"] = "ROBBER_STEAL";
        TransactionTypeEnum["MONOPOLY"] = "MONOPOLY";
        TransactionTypeEnum["TRADE"] = "TRADE";
        TransactionTypeEnum["TRADE_OFFER"] = "TRADE_OFFER";
        TransactionTypeEnum["DICE_ROLL"] = "DICE_ROLL";
        TransactionTypeEnum["RESOURCE_GAIN"] = "RESOURCE_GAIN";
        TransactionTypeEnum["RESOURCE_LOSS"] = "RESOURCE_LOSS";
        TransactionTypeEnum["BANK_TRADE"] = "BANK_TRADE";
    })(TransactionTypeEnum || (TransactionTypeEnum = {}));

    // Variant system for tracking uncertain game states
    const RESOURCE_TYPES = [
        'tree',
        'brick',
        'sheep',
        'wheat',
        'ore',
    ];
    /**
     * Represents a single possible game state with its probability
     */
    class Variant {
        constructor(probability, gameState) {
            this.probability = probability;
            this.gameState = gameState;
        }
    }
    /**
     * A node in the variant tree with parent/child relationships
     */
    class VariantNode {
        constructor(parent, probability, gameState, transactionId, stolenResource) {
            this.parent = parent;
            this.probability = probability;
            this.gameState = gameState;
            this.transactionId = transactionId;
            this.stolenResource = stolenResource;
            this.children = [];
        }
        /**
         * Get all transaction IDs that led to this node (including parent transactions)
         */
        getTransactionChain() {
            const chain = [];
            let current = this;
            while (current) {
                if (current.transactionId) {
                    chain.unshift(current.transactionId); // Add to beginning to maintain chronological order
                }
                current = current.parent;
            }
            return chain;
        }
        /**
         * Check if this node was created as part of a specific transaction
         */
        hasTransactionId(transactionId) {
            return this.getTransactionChain().includes(transactionId);
        }
        /**
         * Add multiple variant nodes as children
         */
        addVariantNodes(variants) {
            if (variants.length === 0)
                return;
            this.validateProbabilities(variants);
            for (const variant of variants) {
                this.children.push(variant);
            }
        }
        /**
         * Validate that probabilities sum to 1 (within tolerance)
         */
        validateProbabilities(variants) {
            const sum = variants.reduce((total, variant) => total + variant.probability, 0);
            const tolerance = 1e-8;
            if (Math.abs(sum - 1) > tolerance) {
                throw new Error(`Sum of variant probabilities must be 1, got ${sum}`);
            }
        }
        /**
         * Remove a child variant node and rebalance probabilities
         */
        removeVariantNode(nodeToRemove) {
            const index = this.children.indexOf(nodeToRemove);
            if (index === -1)
                return;
            this.children.splice(index, 1);
            this.rebalanceProbabilities(nodeToRemove.probability);
            // If this node has no children and has a parent, remove it from parent
            if (this.children.length === 0 && this.parent) {
                this.parent.removeVariantNode(this);
            }
        }
        /**
         * Rebalance probabilities after removing a node
         */
        rebalanceProbabilities(removedProbability) {
            const currentSum = this.children.reduce((sum, child) => sum + child.probability, 0);
            const scaleFactor = removedProbability / currentSum;
            for (const child of this.children) {
                child.probability += child.probability * scaleFactor;
            }
        }
    }
    /**
     * Manages the complete tree of possible game states
     */
    class VariantTree {
        constructor(initialGameState) {
            this.root = new VariantNode(null, 1.0, initialGameState);
        }
        /**
         * Remove a variant node from the tree
         */
        removeVariantNode(node) {
            if (node === this.root) {
                throw new Error('Cannot remove root node');
            }
            if (node.parent) {
                node.parent.removeVariantNode(node);
            }
            // If tree becomes unary (single path), simplify it
            if (this.isUnary()) {
                const leafNodes = this.getCurrentVariantNodes();
                this.root = leafNodes[0];
                this.root.parent = null;
            }
        }
        /**
         * Get all current possible game states with their probabilities
         */
        getCurrentVariants() {
            const leafNodes = this.getCurrentVariantNodes();
            const variants = [];
            for (const node of leafNodes) {
                // Calculate cumulative probability from root to leaf
                let probability = node.probability;
                let parent = node.parent;
                while (parent) {
                    probability *= parent.probability;
                    parent = parent.parent;
                }
                variants.push(new Variant(probability, node.gameState));
            }
            // Merge variants with identical game states
            const mergedVariants = [];
            for (const variant of variants) {
                const existing = mergedVariants.find(v => JSON.stringify(v.gameState) === JSON.stringify(variant.gameState));
                if (existing) {
                    existing.probability += variant.probability;
                }
                else {
                    mergedVariants.push(variant);
                }
            }
            // Sort by probability (highest first)
            return mergedVariants.sort((a, b) => b.probability - a.probability);
        }
        /**
         * Collapse the tree to a single node when every leaf agrees on the current
         * game state.
         *
         * Variants can differ only in HISTORY while agreeing on the present — e.g.
         * a stolen card that made a round trip leaves the same hands as one that
         * never moved. Once the leaves converge, the remaining branches carry no
         * information about anyone's current cards, and keeping them just clutters
         * the unknown-transactions display and multiplies future branching. After
         * collapsing, transactions whose chains were dropped resolve as unknowable.
         *
         * Returns true if the tree was collapsed.
         */
        collapseIfConverged() {
            const leafNodes = this.getCurrentVariantNodes();
            if (leafNodes.length <= 1)
                return false;
            const first = JSON.stringify(leafNodes[0].gameState);
            if (!leafNodes.every(node => JSON.stringify(node.gameState) === first)) {
                return false;
            }
            this.root = new VariantNode(null, 1.0, leafNodes[0].gameState);
            return true;
        }
        /**
         * Get all leaf nodes (nodes with no children)
         */
        getCurrentVariantNodes(node = this.root, result = []) {
            if (node.children.length === 0) {
                result.push(node);
            }
            else {
                for (const child of node.children) {
                    this.getCurrentVariantNodes(child, result);
                }
            }
            return result;
        }
        /**
         * Get all nodes with a specific transaction ID (not just leaf nodes)
         * This includes nodes that were created as part of the transaction chain
         */
        getNodesWithTransactionId(transactionId, node = this.root, result = []) {
            if (node.hasTransactionId(transactionId)) {
                result.push(node);
            }
            for (const child of node.children) {
                this.getNodesWithTransactionId(transactionId, child, result);
            }
            return result;
        }
        /**
         * Check if the tree is unary (single path from root to leaf)
         */
        isUnary() {
            let current = this.root;
            while (current.children.length === 1) {
                current = current.children[0];
            }
            return current.children.length === 0;
        }
        /**
         * Remove any nodes that have impossible game states (negative resources, etc.)
         */
        pruneInvalidNodes() {
            const leafNodes = this.getCurrentVariantNodes();
            for (const node of leafNodes) {
                if (this.isInvalidGameState(node.gameState)) {
                    this.removeVariantNode(node);
                }
            }
        }
        /**
         * Check if a game state is invalid
         */
        isInvalidGameState(gameState) {
            for (const playerName in gameState) {
                const player = gameState[playerName];
                for (const resourceType of RESOURCE_TYPES) {
                    if (player.resources[resourceType] < 0) {
                        return true;
                    }
                }
            }
            return false;
        }
    }

    class VariantTransactionProcessor {
        constructor(variantTree) {
            this.variantTree = variantTree;
            this.unknownTransactions = [];
            this.transactionCounter = 0;
        }
        processUnknownSteal(stealerName, victimName) {
            const currentNodes = this.variantTree.getCurrentVariantNodes();
            const transactionId = `${stealerName}_${victimName}_${Date.now()}_${++this.transactionCounter}`;
            let shouldCreateTransaction = false;
            // The chat is ground truth: a steal happened, so the victim had at least
            // one card. If every variant says they had none, our tracking is wrong
            // (e.g. messages were missed after a page refresh) — skip the steal rather
            // than eliminating every variant (which would throw on root removal).
            const victimHasResources = (node) => {
                const victimState = node.gameState[victimName];
                return (!!victimState &&
                    RESOURCE_TYPES.some(resourceType => victimState.resources[resourceType] > 0));
            };
            if (!currentNodes.some(victimHasResources)) {
                console.warn(`⚠️ ${stealerName} stole from ${victimName}, but ${victimName} has no resources in any variant — ignoring steal (messages may have been missed)`);
                return;
            }
            for (const node of currentNodes) {
                const newVariants = [];
                const gameState = node.gameState;
                const victimState = gameState[victimName];
                if (!victimState) {
                    console.warn(`Victim ${victimName} not found in game state`);
                    continue;
                }
                // Calculate total resources the victim has
                const totalResources = RESOURCE_TYPES.reduce((sum, resourceType) => sum + victimState.resources[resourceType], 0);
                if (totalResources === 0) {
                    // Victim has no resources, this branch is invalid
                    this.variantTree.removeVariantNode(node);
                    continue;
                }
                // Create a variant for each possible resource that could be stolen
                for (const resourceType of RESOURCE_TYPES) {
                    const resourceCount = victimState.resources[resourceType];
                    if (resourceCount > 0) {
                        // Probability = (victim's amount of this resource / victim's total resources)
                        const probability = resourceCount / totalResources;
                        // Create new game state where this resource was stolen
                        const newGameState = this.deepCloneGameState(gameState);
                        newGameState[victimName].resources[resourceType] -= 1;
                        if (!newGameState[stealerName]) {
                            console.warn(`Stealer ${stealerName} not found in game state`);
                            continue;
                        }
                        newGameState[stealerName].resources[resourceType] += 1;
                        // Create variant node with transaction ID
                        newVariants.push(new VariantNode(node, probability, newGameState, transactionId, resourceType));
                    }
                }
                if (newVariants.length > 1) {
                    shouldCreateTransaction = true;
                }
                // Add all possible steal variants as children
                node.addVariantNodes(newVariants);
            }
            if (shouldCreateTransaction) {
                const transaction = {
                    id: transactionId,
                    timestamp: Date.now(),
                    thief: stealerName,
                    victim: victimName,
                    isResolved: false,
                };
                this.unknownTransactions.push(transaction);
            }
            // Clean up invalid states
            this.variantTree.pruneInvalidNodes();
        }
        processMonopoly(playerName, resourceType, totalStolen) {
            const currentNodes = this.variantTree.getCurrentVariantNodes();
            const monopolyMatches = (node) => {
                // How many of this resource all OTHER players have in this variant
                let actualTotal = 0;
                for (const [name, playerState] of Object.entries(node.gameState)) {
                    if (name !== playerName) {
                        actualTotal += playerState.resources[resourceType];
                    }
                }
                return actualTotal === totalStolen;
            };
            // The chat is ground truth: if no variant matches the announced total, our
            // tracking is wrong (e.g. messages were missed after a page refresh). Keep
            // every variant rather than emptying the tree (which would throw on root
            // removal); the update below force-applies the announced result anyway.
            const anyMatch = currentNodes.some(monopolyMatches);
            if (!anyMatch) {
                console.warn(`⚠️ Monopoly by ${playerName} (${totalStolen} ${resourceType}) matches no variant — force-applying (messages may have been missed)`);
            }
            for (const node of currentNodes) {
                // If this branch doesn't match the known total, eliminate it
                if (anyMatch && !monopolyMatches(node)) {
                    this.variantTree.removeVariantNode(node);
                }
            }
            // Update remaining valid branches with the monopoly results
            const remainingNodes = this.variantTree.getCurrentVariantNodes();
            for (const node of remainingNodes) {
                const gameState = node.gameState;
                // Player receives all the resources
                if (gameState[playerName]) {
                    gameState[playerName].resources[resourceType] += totalStolen;
                }
                // All other players lose all of this resource
                for (const [name, playerState] of Object.entries(gameState)) {
                    if (name !== playerName) {
                        playerState.resources[resourceType] = 0;
                    }
                }
            }
        }
        processTrade(player1, player2, resourceChanges) {
            const currentNodes = this.variantTree.getCurrentVariantNodes();
            const player1Gives = Object.fromEntries(Object.entries(resourceChanges)
                .filter(([_, value]) => value < 0)
                .map(([key, value]) => [key, -value]));
            const player2Gives = Object.fromEntries(Object.entries(resourceChanges).filter(([_, value]) => value > 0));
            const tradeIsValid = (node) => this.canAffordTrade(node.gameState[player1], player1Gives) &&
                this.canAffordTrade(node.gameState[player2], player2Gives);
            // The chat is ground truth: if the trade is impossible in EVERY variant,
            // our tracking is wrong (e.g. messages were missed after a page refresh).
            // Eliminating all variants would cascade into removing the tree's root and
            // throw mid-prune, so instead keep every variant and force-apply the trade
            // with clamping.
            const anyValid = currentNodes.some(tradeIsValid);
            if (!anyValid) {
                console.warn(`⚠️ Trade between ${player1} and ${player2} is impossible in every variant — force-applying (messages may have been missed)`);
            }
            for (const node of currentNodes) {
                const gameState = node.gameState;
                if (anyValid && !tradeIsValid(node)) {
                    this.variantTree.removeVariantNode(node);
                    continue;
                }
                // Execute the trade (clamped so a force-applied trade can't go negative)
                const clamp = !anyValid;
                this.executeResourceTransfer(gameState[player1], player1Gives, -1, clamp);
                this.executeResourceTransfer(gameState[player1], player2Gives, 1, clamp);
                this.executeResourceTransfer(gameState[player2], player2Gives, -1, clamp);
                this.executeResourceTransfer(gameState[player2], player1Gives, 1, clamp);
            }
            this.variantTree.pruneInvalidNodes();
        }
        processTradeOffer(playerName, offeredResources) {
            const currentNodes = this.variantTree.getCurrentVariantNodes();
            const offerIsValid = (node) => {
                const playerState = node.gameState[playerName];
                return (!!playerState && this.canAffordTrade(playerState, offeredResources));
            };
            // The chat is ground truth: if the offer is impossible in EVERY variant,
            // our tracking is wrong (e.g. messages were missed after a page refresh).
            // Keep the tree intact rather than emptying it (which would throw on root
            // removal); an offer moves no resources, so there is nothing to apply.
            if (!currentNodes.some(offerIsValid)) {
                console.warn(`⚠️ Trade offer by ${playerName} is impossible in every variant — ignoring (messages may have been missed)`);
                return;
            }
            for (const node of currentNodes) {
                if (!offerIsValid(node)) {
                    this.variantTree.removeVariantNode(node);
                }
            }
        }
        getMostLikelyGameState() {
            const variants = this.variantTree.getCurrentVariants();
            if (variants.length === 0)
                return null;
            return {
                gameState: variants[0].gameState,
                probability: variants[0].probability,
            };
        }
        getAllPossibleGameStates() {
            return this.variantTree.getCurrentVariants().map(variant => ({
                gameState: variant.gameState,
                probability: variant.probability,
            }));
        }
        /**
         * Get uncertainty level for a specific player's resources
         */
        getPlayerResourceUncertainty(playerName) {
            const variants = this.variantTree.getCurrentVariants();
            const result = {};
            for (const resourceType of RESOURCE_TYPES) {
                const values = variants
                    .map(v => {
                    var _a;
                    return ({
                        value: ((_a = v.gameState[playerName]) === null || _a === void 0 ? void 0 : _a.resources[resourceType]) || 0,
                        probability: v.probability,
                    });
                })
                    .filter(v => v.value !== undefined);
                if (values.length === 0) {
                    result[resourceType] = { min: 0, max: 0, mostLikely: 0, confidence: 0 };
                    continue;
                }
                const min = Math.min(...values.map(v => v.value));
                const max = Math.max(...values.map(v => v.value));
                // Most likely value (highest probability)
                const mostLikely = values.reduce((best, current) => current.probability > best.probability ? current : best).value;
                // Confidence = probability of the most likely value
                const confidence = values
                    .filter(v => v.value === mostLikely)
                    .reduce((sum, v) => sum + v.probability, 0);
                result[resourceType] = { min, max, mostLikely, confidence };
            }
            return result;
        }
        /**
         * Helper: Deep clone game state
         */
        deepCloneGameState(gameState) {
            return JSON.parse(JSON.stringify(gameState));
        }
        /**
         * Helper: Check if player can afford a trade
         */
        canAffordTrade(playerState, resources) {
            for (const [resourceType, amount] of Object.entries(resources)) {
                if (amount && playerState.resources[resourceType] < amount) {
                    return false;
                }
            }
            return true;
        }
        /**
         * Helper: Execute resource transfer (multiplier: 1 for gain, -1 for loss)
         */
        executeResourceTransfer(playerState, resources, multiplier, clamp = false) {
            for (const [resourceType, amount] of Object.entries(resources)) {
                if (amount) {
                    const updated = playerState.resources[resourceType] + amount * multiplier;
                    playerState.resources[resourceType] = clamp
                        ? Math.max(0, updated)
                        : updated;
                }
            }
        }
        /**
         * Get all unresolved unknown transactions
         */
        getUnresolvedTransactions() {
            return this.unknownTransactions.filter(t => !t.isResolved);
        }
        /**
         * Get unknown transaction by ID
         */
        getUnknownTransaction(id) {
            return this.unknownTransactions.find(t => t.id === id);
        }
        /**
         * Resolve unknown transaction by specifying what resource was stolen
         */
        resolveUnknownTransaction(id, resolvedResource) {
            const transaction = this.unknownTransactions.find(t => t.id === id);
            if (!transaction || transaction.isResolved) {
                console.warn(`Transaction ${id} not found or already resolved`);
                return false;
            }
            // Mark transaction as resolved
            transaction.isResolved = true;
            transaction.resolvedResource = resolvedResource;
            // Remove variant nodes that don't match the resolved resource
            const currentNodes = this.variantTree.getCurrentVariantNodes();
            for (const node of currentNodes) {
                if (node.transactionId === id) {
                    // Check if this variant matches the resolved resource
                    const matches = this.variantMatchesResolvedResource(node, transaction, resolvedResource);
                    if (!matches) {
                        this.variantTree.removeVariantNode(node);
                    }
                }
            }
            this.variantTree.pruneInvalidNodes();
            return true;
        }
        /**
         * Check if a variant node matches the resolved resource for a transaction
         */
        variantMatchesResolvedResource(node, transaction, resolvedResource) {
            var _a, _b, _c, _d;
            // Use the stored stolen resource if available
            if (node.stolenResource) {
                return node.stolenResource === resolvedResource;
            }
            // Fallback to the old method for backward compatibility
            if (!node.parent)
                return true; // Root node always matches
            const parentState = node.parent.gameState;
            const currentState = node.gameState;
            // Check if the thief gained the resolved resource and victim lost it
            const thiefGained = ((_a = currentState[transaction.thief]) === null || _a === void 0 ? void 0 : _a.resources[resolvedResource]) -
                ((_b = parentState[transaction.thief]) === null || _b === void 0 ? void 0 : _b.resources[resolvedResource]);
            const victimLost = ((_c = parentState[transaction.victim]) === null || _c === void 0 ? void 0 : _c.resources[resolvedResource]) -
                ((_d = currentState[transaction.victim]) === null || _d === void 0 ? void 0 : _d.resources[resolvedResource]);
            return thiefGained === 1 && victimLost === 1;
        }
        /**
         * Find the stolen resource for a specific transaction in a node's chain
         */
        findStolenResourceInChain(node, transactionId) {
            let current = node;
            while (current) {
                if (current.transactionId === transactionId && current.stolenResource) {
                    return current.stolenResource;
                }
                current = current.parent;
            }
            return null;
        }
        /**
         * Get resource probabilities for a specific transaction
         */
        getTransactionResourceProbabilities(transactionId) {
            const transaction = this.getUnknownTransaction(transactionId);
            if (!transaction || transaction.isResolved) {
                return null;
            }
            // Get all variant nodes associated with this transaction
            const currentNodes = this.variantTree.getCurrentVariantNodes();
            const transactionNodes = currentNodes.filter(node => node.hasTransactionId(transactionId));
            if (transactionNodes.length === 0) {
                return null;
            }
            // Initialize result with all resources set to 0
            const result = {
                tree: 0,
                brick: 0,
                sheep: 0,
                wheat: 0,
                ore: 0,
            };
            // Calculate probabilities for each resource based on variants
            const resourceProbabilities = new Map();
            let totalProbability = 0;
            for (const node of transactionNodes) {
                // Calculate cumulative probability for this node
                let probability = node.probability;
                let parent = node.parent;
                while (parent) {
                    probability *= parent.probability;
                    parent = parent.parent;
                }
                totalProbability += probability;
                // Determine which resource this variant represents for this specific transaction
                const resource = this.findStolenResourceInChain(node, transactionId);
                if (resource) {
                    resourceProbabilities.set(resource, (resourceProbabilities.get(resource) || 0) + probability);
                }
            }
            // Normalize probabilities and populate result
            for (const [resource, probability] of resourceProbabilities.entries()) {
                result[resource] =
                    totalProbability > 0 ? probability / totalProbability : 0;
            }
            return result;
        }
        /**
         * Cull outcome branches whose probability has dropped below epsilon.
         *
         * Steal trees compound: a few unknown steals in a row leave outcome options
         * like "wheat: 0.02" alive forever (sub-3% is far below any actionable odds), cluttering the display and multiplying
         * the variant count (each surviving branch re-branches on every later
         * steal). Dropping a sub-epsilon outcome accepts a tiny chance of being
         * wrong in exchange for a much tighter tree — and if reality later
         * contradicts the cull, the processors force-apply the observation instead
         * of crashing, so the tracker self-heals.
         *
         * Never culls every outcome of a transaction: at least the most likely
         * option always survives.
         */
        cullImprobableOutcomes(epsilon = 0.03) {
            for (const transaction of this.getUnresolvedTransactions()) {
                const probabilities = this.getTransactionResourceProbabilities(transaction.id);
                if (!probabilities)
                    continue;
                const options = Object.entries(probabilities).filter(([, p]) => p > 0);
                if (options.length <= 1)
                    continue;
                const toCull = options.filter(([, p]) => p < epsilon);
                if (toCull.length === 0 || toCull.length === options.length)
                    continue;
                for (const [resource] of toCull) {
                    for (const node of this.variantTree.getCurrentVariantNodes()) {
                        if (this.findStolenResourceInChain(node, transaction.id) === resource) {
                            this.variantTree.removeVariantNode(node);
                        }
                    }
                }
                this.variantTree.pruneInvalidNodes();
            }
        }
        /**
         * Auto-resolve transactions where one outcome has become dominant
         * (>= threshold). A 96%-certain steal is more useful resolved than shown as
         * an open question; the rare miss is self-healing (see
         * cullImprobableOutcomes). Exact certainties (probability 1) are handled by
         * resolveAllUnknownTransactions already.
         */
        autoResolveDominantOutcomes(threshold = 0.95) {
            for (const transaction of this.getUnresolvedTransactions()) {
                const probabilities = this.getTransactionResourceProbabilities(transaction.id);
                if (!probabilities)
                    continue;
                const [bestResource, bestProbability] = Object.entries(probabilities).reduce((best, entry) => (entry[1] > best[1] ? entry : best));
                if (bestProbability >= threshold) {
                    console.log(`🎯 Auto-resolving ${transaction.thief} steal from ${transaction.victim} as ${bestResource} (${(bestProbability * 100).toFixed(0)}% likely)`);
                    this.resolveUnknownTransaction(transaction.id, bestResource);
                }
            }
        }
    }

    function updateResourceAmount(resources, resourceType, amount) {
        resources[resourceType] += amount;
    }
    function getResourceAmount(resources, resourceType) {
        return resources[resourceType];
    }
    function isValidResourceType(resourceType) {
        return RESOURCE_TYPES.includes(resourceType);
    }
    class PropbableGameState {
        constructor(initialPlayers) {
            // Initialize game state with players and their known starting resources
            const initialGameState = {};
            this.transactionHistory = [];
            for (const player of initialPlayers) {
                initialGameState[player.name] = {
                    resources: Object.assign({}, player.resources), // Copy the initial resources
                };
                // set initial transactions
                this.transactionHistory.push({
                    type: TransactionTypeEnum.RESOURCE_GAIN,
                    playerName: player.name,
                    resources: Object.assign({}, player.resources),
                });
            }
            this.variantTree = new VariantTree(initialGameState);
            this.transactionProcessor = new VariantTransactionProcessor(this.variantTree);
        }
        /**
         * Get all unknown transactions
         */
        getUnknownTransactions() {
            return this.transactionProcessor.getUnresolvedTransactions();
        }
        /**
         * Get unknown transaction by ID
         */
        getUnknownTransaction(id) {
            return this.transactionProcessor.getUnknownTransaction(id);
        }
        /**
         * Resolve unknown transaction by specifying what resource was stolen
         */
        resolveUnknownTransaction(id, resolvedResource) {
            return this.transactionProcessor.resolveUnknownTransaction(id, resolvedResource);
        }
        /**
         * Resolve all unknown transactions by looking at possible variants
         * if there doesn't exist a node with that transaction id then mark it as resolved
         * if there is only one node mark all transactions as resolved, never mark a transaction
         * as unresolved in this function
         */
        resolveAllUnknownTransactions() {
            const unresolvedTransactions = this.getUnknownTransactions();
            for (const transaction of unresolvedTransactions) {
                // Get all current leaf nodes that have this transaction in their chain
                const allLeafNodes = this.variantTree.getCurrentVariantNodes();
                const transactionNodes = allLeafNodes.filter(node => node.hasTransactionId(transaction.id));
                if (transactionNodes.length === 0) {
                    // No nodes exist with this transaction ID - variants have been pruned away
                    // Mark as resolved but we don't know what resource was stolen
                    transaction.isResolved = true;
                }
                else if (transactionNodes.length === 1) {
                    // Only one variant remains - we can determine what resource was stolen
                    const remainingNode = transactionNodes[0];
                    // Find the stolen resource by looking at the transaction chain
                    const stolenResource = this.findStolenResourceInChain(remainingNode, transaction.id);
                    if (stolenResource) {
                        // Resolve the transaction with the determined resource
                        this.transactionProcessor.resolveUnknownTransaction(transaction.id, stolenResource);
                    }
                    else {
                        // Mark as resolved even if we can't determine the resource
                        transaction.isResolved = true;
                    }
                }
                else {
                    // Multiple nodes exist - check if they all have the same stolen resource for this transaction
                    const stolenResources = new Set();
                    for (const node of transactionNodes) {
                        const stolenResource = this.findStolenResourceInChain(node, transaction.id);
                        if (stolenResource) {
                            stolenResources.add(stolenResource);
                        }
                    }
                    if (stolenResources.size === 1) {
                        // All variants agree on what resource was stolen
                        const stolenResource = Array.from(stolenResources)[0];
                        this.transactionProcessor.resolveUnknownTransaction(transaction.id, stolenResource);
                    }
                }
                // If multiple nodes exist with different stolen resources, leave the transaction unresolved
            }
        }
        /**
         * Full refinement cycle for unknown transactions: resolve what's certain,
         * cull vanishingly-unlikely outcome branches, auto-resolve dominant ones,
         * then resolve again (culling can leave a transaction with one option).
         */
        refineUnknownTransactions() {
            this.resolveAllUnknownTransactions();
            // When every variant agrees on the current hands, remaining branches are
            // purely historical (e.g. a card that made a round trip) — collapse them
            // so stale steals stop showing as open questions.
            if (this.variantTree.collapseIfConverged()) {
                console.log('🧹 All variants converged on one game state — retiring historical unknowns');
            }
            this.resolveAllUnknownTransactions();
        }
        /**
         * Prune variants using known per-player hand sizes (read from colonist's
         * `[data-player-information-container]` panel). Any variant in which a player's
         * total resource cards doesn't match their known count is impossible and is
         * removed. This resolves steals the chat alone can't — notably after a monopoly,
         * when variants disagree on how many cards a player kept.
         *
         * Safe no-op unless a strict, non-empty subset of variants matches all the given
         * counts, so contradictory or non-discriminating data never empties or collapses
         * the tree (and we never try to remove the root).
         */
        pruneByHandCounts(handCounts) {
            const nodes = this.variantTree.getCurrentVariantNodes();
            if (nodes.length <= 1)
                return; // nothing to disambiguate
            const matchesCounts = (node) => Object.entries(handCounts).every(([playerName, count]) => {
                const playerState = node.gameState[playerName];
                if (!playerState)
                    return true; // unknown player -> no constraint
                const total = RESOURCE_TYPES.reduce((sum, resourceType) => sum + playerState.resources[resourceType], 0);
                return total === count;
            });
            const validNodes = nodes.filter(matchesCounts);
            // Ignore contradictory (none match) or non-discriminating (all match) data.
            if (validNodes.length === 0 || validNodes.length === nodes.length)
                return;
            for (const node of nodes) {
                if (!matchesCounts(node)) {
                    this.variantTree.removeVariantNode(node);
                }
            }
            this.variantTree.pruneInvalidNodes();
            this.refineUnknownTransactions();
        }
        /**
         * Find the stolen resource for a specific transaction in a node's chain
         */
        findStolenResourceInChain(node, transactionId) {
            let current = node;
            while (current) {
                if (current.transactionId === transactionId && current.stolenResource) {
                    return current.stolenResource;
                }
                current = current.parent;
            }
            return null;
        }
        /**
         * Process a transaction
         */
        processTransaction(transaction) {
            // Add transaction to history for debugging
            this.transactionHistory.push(transaction);
            switch (transaction.type) {
                case TransactionTypeEnum.ROBBER_STEAL: {
                    if (transaction.stolenResource) {
                        // Known steal - we know exactly what was stolen
                        this.processKnownSteal(transaction.stealerName, transaction.victimName, transaction.stolenResource);
                    }
                    else {
                        // Unknown steal - create probability branches
                        this.transactionProcessor.processUnknownSteal(transaction.stealerName, transaction.victimName);
                    }
                    break;
                }
                case TransactionTypeEnum.MONOPOLY: {
                    this.transactionProcessor.processMonopoly(transaction.playerName, transaction.resourceType, transaction.totalStolen);
                    break;
                }
                case TransactionTypeEnum.TRADE: {
                    this.transactionProcessor.processTrade(transaction.player1, transaction.player2, transaction.resourceChanges);
                    break;
                }
                case TransactionTypeEnum.TRADE_OFFER: {
                    this.transactionProcessor.processTradeOffer(transaction.playerName, transaction.offeredResources);
                    break;
                }
                case TransactionTypeEnum.RESOURCE_GAIN: {
                    this.processResourceGain(transaction.playerName, transaction.resources);
                    break;
                }
                case TransactionTypeEnum.RESOURCE_LOSS: {
                    this.processResourceLoss(transaction.playerName, transaction.resources);
                    break;
                }
                case TransactionTypeEnum.BANK_TRADE: {
                    this.processBankTrade(transaction.playerName, transaction.resourceChanges);
                    break;
                }
                default:
                    // This should never happen with proper typing, but keeping for safety
                    const exhaustiveCheck = transaction;
                    console.warn(`Unknown transaction type: ${exhaustiveCheck.type}`);
            }
            // Auto-resolve any transactions that can now be determined
            this.refineUnknownTransactions();
        }
        /**
         * Process a known steal (we know exactly what resource was stolen)
         */
        processKnownSteal(stealerName, victimName, resourceType) {
            const currentNodes = this.variantTree.getCurrentVariantNodes();
            const stealIsPossible = (node) => {
                const victimState = node.gameState[victimName];
                return (!!victimState &&
                    !!node.gameState[stealerName] &&
                    getResourceAmount(victimState.resources, resourceType) > 0);
            };
            // The chat is ground truth: the steal happened. If it's impossible in
            // EVERY variant, our tracking is wrong (e.g. messages were missed after a
            // page refresh) — force-apply it (clamped at zero) rather than eliminating
            // every variant, which would throw on root removal.
            const anyPossible = currentNodes.some(stealIsPossible);
            if (!anyPossible) {
                console.warn(`⚠️ ${stealerName} stole ${resourceType} from ${victimName}, but no variant allows it — force-applying (messages may have been missed)`);
            }
            for (const node of currentNodes) {
                const gameState = node.gameState;
                const victimState = gameState[victimName];
                const stealerState = gameState[stealerName];
                if (stealIsPossible(node)) {
                    // Execute the steal
                    updateResourceAmount(victimState.resources, resourceType, -1);
                    updateResourceAmount(stealerState.resources, resourceType, 1);
                }
                else if (anyPossible) {
                    // This variant is invalid - victim doesn't have the resource
                    this.variantTree.removeVariantNode(node);
                }
                else if (victimState && stealerState) {
                    // Force-apply: victim can't go below zero
                    if (getResourceAmount(victimState.resources, resourceType) > 0) {
                        updateResourceAmount(victimState.resources, resourceType, -1);
                    }
                    updateResourceAmount(stealerState.resources, resourceType, 1);
                }
            }
            this.variantTree.pruneInvalidNodes();
        }
        /**
         * Process definite resource gain
         */
        processResourceGain(playerName, resources) {
            const currentNodes = this.variantTree.getCurrentVariantNodes();
            for (const node of currentNodes) {
                const gameState = node.gameState;
                const playerState = gameState[playerName];
                if (playerState) {
                    // Execute the gain
                    for (const [resourceType, amount] of Object.entries(resources)) {
                        if (typeof amount === 'number' && isValidResourceType(resourceType)) {
                            updateResourceAmount(playerState.resources, resourceType, amount);
                        }
                    }
                }
            }
        }
        /**
         * Process definite resource loss
         */
        processResourceLoss(playerName, resources) {
            const currentNodes = this.variantTree.getCurrentVariantNodes();
            for (const node of currentNodes) {
                const gameState = node.gameState;
                const playerState = gameState[playerName];
                if (playerState) {
                    let canAfford = true;
                    // Check if player can afford this loss in this variant
                    for (const [resourceType, amount] of Object.entries(resources)) {
                        if (typeof amount === 'number' &&
                            isValidResourceType(resourceType) &&
                            getResourceAmount(playerState.resources, resourceType) < amount) {
                            canAfford = false;
                            break;
                        }
                    }
                    if (canAfford) {
                        // Execute the loss
                        for (const [resourceType, amount] of Object.entries(resources)) {
                            if (typeof amount === 'number' &&
                                isValidResourceType(resourceType)) {
                                updateResourceAmount(playerState.resources, resourceType, -amount);
                            }
                        }
                    }
                    else {
                        // This variant is invalid - player can't afford the loss
                        this.variantTree.removeVariantNode(node);
                    }
                }
            }
            this.variantTree.pruneInvalidNodes();
        }
        /**
         * Process bank trade (player trades resources with the bank)
         */
        processBankTrade(playerName, resourceChanges) {
            const currentNodes = this.variantTree.getCurrentVariantNodes();
            for (const node of currentNodes) {
                const gameState = node.gameState;
                const playerState = gameState[playerName];
                if (playerState) {
                    let canAfford = true;
                    // Check if player can afford the resources they're giving up
                    for (const [resourceType, amount] of Object.entries(resourceChanges)) {
                        if (amount < 0 && // Negative amounts are resources being given up
                            isValidResourceType(resourceType) &&
                            getResourceAmount(playerState.resources, resourceType) <
                                Math.abs(amount)) {
                            canAfford = false;
                            break;
                        }
                    }
                    if (canAfford) {
                        // Execute the bank trade (both losses and gains)
                        for (const [resourceType, amount] of Object.entries(resourceChanges)) {
                            if (typeof amount === 'number' &&
                                isValidResourceType(resourceType)) {
                                updateResourceAmount(playerState.resources, resourceType, amount);
                            }
                        }
                    }
                    else {
                        // This variant is invalid - player can't afford the trade
                        this.variantTree.removeVariantNode(node);
                    }
                }
            }
            this.variantTree.pruneInvalidNodes();
        }
        /**
         * Get the current best estimate of a player's resources
         */
        getPlayerResources(playerName) {
            return this.transactionProcessor.getPlayerResourceUncertainty(playerName);
        }
        /**
         * Get resource probabilities for a player
         * Returns minimum guaranteed resources and probability of additional resources
         */
        getPlayerResourceProbabilities(playerName) {
            const variants = this.variantTree.getCurrentVariants();
            if (variants.length === 0) {
                // No variants - return all zeros
                const emptyResources = {
                    tree: 0,
                    brick: 0,
                    sheep: 0,
                    wheat: 0,
                    ore: 0,
                };
                return {
                    minimumResources: Object.assign({}, emptyResources),
                    additionalResourceProbabilities: Object.assign({}, emptyResources),
                };
            }
            // Calculate minimum resources across all variants
            const minimumResources = {
                tree: Number.MAX_SAFE_INTEGER,
                brick: Number.MAX_SAFE_INTEGER,
                sheep: Number.MAX_SAFE_INTEGER,
                wheat: Number.MAX_SAFE_INTEGER,
                ore: Number.MAX_SAFE_INTEGER,
            };
            // Collect all resource counts with their probabilities
            const resourceCounts = [];
            for (const variant of variants) {
                const playerState = variant.gameState[playerName];
                if (playerState) {
                    resourceCounts.push({
                        resources: playerState.resources,
                        probability: variant.probability,
                    });
                    // Update minimums
                    for (const resourceType of RESOURCE_TYPES) {
                        minimumResources[resourceType] = Math.min(minimumResources[resourceType], playerState.resources[resourceType]);
                    }
                }
            }
            // If no player state found, set minimums to 0
            if (resourceCounts.length === 0) {
                for (const resourceType of RESOURCE_TYPES) {
                    minimumResources[resourceType] = 0;
                }
            }
            // Calculate probability of having more than minimum for each resource
            const additionalResourceProbabilities = {
                tree: 0,
                brick: 0,
                sheep: 0,
                wheat: 0,
                ore: 0,
            };
            for (const resourceType of RESOURCE_TYPES) {
                const minCount = minimumResources[resourceType];
                let probabilityOfMore = 0;
                for (const { resources, probability } of resourceCounts) {
                    if (resources[resourceType] > minCount) {
                        probabilityOfMore += probability;
                    }
                }
                additionalResourceProbabilities[resourceType] = probabilityOfMore;
            }
            return {
                minimumResources,
                additionalResourceProbabilities,
            };
        }
        /**
         * Get the most likely complete game state
         */
        getMostLikelyGameState() {
            return this.transactionProcessor.getMostLikelyGameState();
        }
        /**
         * Get all possible game states with their probabilities
         */
        getAllPossibleGameStates() {
            return this.transactionProcessor.getAllPossibleGameStates();
        }
        /**
         * Get the number of possible game states being tracked
         */
        getVariantCount() {
            return this.variantTree.getCurrentVariantNodes().length;
        }
        /**
         * Get uncertainty score for the entire game state (0 = certain, 1 = completely uncertain)
         */
        getUncertaintyScore() {
            const variants = this.variantTree.getCurrentVariants();
            if (variants.length <= 1)
                return 0;
            // Calculate entropy as a measure of uncertainty
            const entropy = variants.reduce((sum, variant) => {
                if (variant.probability > 0) {
                    return sum - variant.probability * Math.log2(variant.probability);
                }
                return sum;
            }, 0);
            // Normalize entropy to 0-1 scale
            const maxEntropy = Math.log2(variants.length);
            return maxEntropy > 0 ? entropy / maxEntropy : 0;
        }
        /**
         * Debug: Print current variants and their probabilities
         */
        debugPrintVariants() {
            const variants = this.variantTree.getCurrentVariants();
            console.log(`\n=== Current Game State Variants (${variants.length} total) ===`);
            variants.forEach((variant, index) => {
                console.log(`\nVariant ${index + 1} (${(variant.probability * 100).toFixed(1)}% probability):`);
                for (const [playerName, playerState] of Object.entries(variant.gameState)) {
                    const resources = Object.entries(playerState.resources)
                        .map(([type, count]) => `${type}: ${count}`)
                        .join(', ');
                    console.log(`  ${playerName}: ${resources}`);
                }
            });
            console.log(`\nUncertainty Score: ${(this.getUncertaintyScore() * 100).toFixed(1)}%`);
        }
        /**
         * Get resource probabilities for a specific transaction
         */
        getTransactionResourceProbabilities(transactionId) {
            return this.transactionProcessor.getTransactionResourceProbabilities(transactionId);
        }
        /**
         * Get the complete transaction history for debugging
         */
        getTransactionHistory() {
            return [...this.transactionHistory]; // Return a copy to prevent external modification
        }
        /**
         * Get the number of transactions processed
         */
        getTransactionCount() {
            return this.transactionHistory.length;
        }
        /**
         * Debug: Print transaction history in a readable format
         */
        debugPrintTransactionHistory() {
            console.log(`\n=== Transaction History (${this.transactionHistory.length} total) ===`);
            this.transactionHistory.forEach((transaction, index) => {
                console.log(`\n${index + 1}. ${transaction.type}:`);
                switch (transaction.type) {
                    case TransactionTypeEnum.ROBBER_STEAL:
                        console.log(`  ${transaction.stealerName} stole from ${transaction.victimName}${transaction.stolenResource ? ` (${transaction.stolenResource})` : ' (unknown resource)'}`);
                        break;
                    case TransactionTypeEnum.MONOPOLY:
                        console.log(`  ${transaction.playerName} played monopoly on ${transaction.resourceType}, stole ${transaction.totalStolen} total`);
                        break;
                    case TransactionTypeEnum.TRADE:
                        console.log(`  Trade between ${transaction.player1} and ${transaction.player2}`);
                        console.log(`  Resource changes: ${JSON.stringify(transaction.resourceChanges)}`);
                        break;
                    case TransactionTypeEnum.TRADE_OFFER:
                        console.log(`  ${transaction.playerName} offered: ${JSON.stringify(transaction.offeredResources)}`);
                        break;
                    case TransactionTypeEnum.RESOURCE_GAIN:
                        console.log(`  ${transaction.playerName} gained: ${JSON.stringify(transaction.resources)}`);
                        break;
                    case TransactionTypeEnum.RESOURCE_LOSS:
                        console.log(`  ${transaction.playerName} lost: ${JSON.stringify(transaction.resources)}`);
                        break;
                    case TransactionTypeEnum.BANK_TRADE:
                        console.log(`  ${transaction.playerName} bank trade: ${JSON.stringify(transaction.resourceChanges)}`);
                        break;
                }
            });
        }
        /**
         * Clear transaction history (useful for testing or restarting)
         */
        clearTransactionHistory() {
            this.transactionHistory = [];
        }
    }

    function getDefaultGame() {
        return {
            players: [],
            gameType: GameTypeEnum.STANDARD,
            // Highest chat data-index processed so far; -1 means "none yet" so that the
            // first message (data-index 0) is still processed. See checkDuplicateElement.
            chatsProcessed: -1,
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
            hasRolledFirstDice: false,
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
            blockedDiceRolls: {},
            remainingDiscoveryCardsProbabilities: {
                knights: 0,
                victoryPoints: 0,
                yearOfPlenties: 0,
                roadBuilders: 0,
                monopolies: 0,
            },
            youPlayerName: null,
            probableGameState: new PropbableGameState([]),
        };
    }
    let game = getDefaultGame();
    let isWaitingForYouPlayerSelection = false;
    function setYouPlayer(playerName) {
        game.youPlayerName = playerName;
        isWaitingForYouPlayerSelection = false;
    }
    /**
     * Automatically sets the current player from web-header-username
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
    function markYouPlayerAsked() {
        isWaitingForYouPlayerSelection = true;
    }
    function ensurePlayerExists(playerName, color) {
        const existingPlayer = game.players.find(p => p.name === playerName);
        if (!existingPlayer) {
            const newPlayer = {
                name: playerName,
                color: color || '#000',
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
                totalCards: 0,
            };
            game.players.push(newPlayer);
        }
    }
    function updateResources(playerName, resourceChanges) {
        const player = game.players.find(p => p.name === playerName);
        if (!player)
            return;
        Object.keys(resourceChanges).forEach(resource => {
            const key = resource;
            const change = resourceChanges[key];
            if (change !== undefined) {
                player.resources[key] += change;
                game.gameResources[key] -= change;
            }
        });
    }

    function utf8Count(str) {
        const strLength = str.length;
        let byteLength = 0;
        let pos = 0;
        while (pos < strLength) {
            let value = str.charCodeAt(pos++);
            if ((value & 0xffffff80) === 0) {
                // 1-byte
                byteLength++;
                continue;
            }
            else if ((value & 0xfffff800) === 0) {
                // 2-bytes
                byteLength += 2;
            }
            else {
                // handle surrogate pair
                if (value >= 0xd800 && value <= 0xdbff) {
                    // high surrogate
                    if (pos < strLength) {
                        const extra = str.charCodeAt(pos);
                        if ((extra & 0xfc00) === 0xdc00) {
                            ++pos;
                            value = ((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000;
                        }
                    }
                }
                if ((value & 0xffff0000) === 0) {
                    // 3-byte
                    byteLength += 3;
                }
                else {
                    // 4-byte
                    byteLength += 4;
                }
            }
        }
        return byteLength;
    }
    function utf8EncodeJs(str, output, outputOffset) {
        const strLength = str.length;
        let offset = outputOffset;
        let pos = 0;
        while (pos < strLength) {
            let value = str.charCodeAt(pos++);
            if ((value & 0xffffff80) === 0) {
                // 1-byte
                output[offset++] = value;
                continue;
            }
            else if ((value & 0xfffff800) === 0) {
                // 2-bytes
                output[offset++] = ((value >> 6) & 0x1f) | 0xc0;
            }
            else {
                // handle surrogate pair
                if (value >= 0xd800 && value <= 0xdbff) {
                    // high surrogate
                    if (pos < strLength) {
                        const extra = str.charCodeAt(pos);
                        if ((extra & 0xfc00) === 0xdc00) {
                            ++pos;
                            value = ((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000;
                        }
                    }
                }
                if ((value & 0xffff0000) === 0) {
                    // 3-byte
                    output[offset++] = ((value >> 12) & 0x0f) | 0xe0;
                    output[offset++] = ((value >> 6) & 0x3f) | 0x80;
                }
                else {
                    // 4-byte
                    output[offset++] = ((value >> 18) & 0x07) | 0xf0;
                    output[offset++] = ((value >> 12) & 0x3f) | 0x80;
                    output[offset++] = ((value >> 6) & 0x3f) | 0x80;
                }
            }
            output[offset++] = (value & 0x3f) | 0x80;
        }
    }
    // TextEncoder and TextDecoder are standardized in whatwg encoding:
    // https://encoding.spec.whatwg.org/
    // and available in all the modern browsers:
    // https://caniuse.com/textencoder
    // They are available in Node.js since v12 LTS as well:
    // https://nodejs.org/api/globals.html#textencoder
    const sharedTextEncoder = new TextEncoder();
    // This threshold should be determined by benchmarking, which might vary in engines and input data.
    // Run `npx ts-node benchmark/encode-string.ts` for details.
    const TEXT_ENCODER_THRESHOLD = 50;
    function utf8EncodeTE(str, output, outputOffset) {
        sharedTextEncoder.encodeInto(str, output.subarray(outputOffset));
    }
    function utf8Encode(str, output, outputOffset) {
        if (str.length > TEXT_ENCODER_THRESHOLD) {
            utf8EncodeTE(str, output, outputOffset);
        }
        else {
            utf8EncodeJs(str, output, outputOffset);
        }
    }
    const CHUNK_SIZE = 4096;
    function utf8DecodeJs(bytes, inputOffset, byteLength) {
        let offset = inputOffset;
        const end = offset + byteLength;
        const units = [];
        let result = "";
        while (offset < end) {
            const byte1 = bytes[offset++];
            if ((byte1 & 0x80) === 0) {
                // 1 byte
                units.push(byte1);
            }
            else if ((byte1 & 0xe0) === 0xc0) {
                // 2 bytes
                const byte2 = bytes[offset++] & 0x3f;
                units.push(((byte1 & 0x1f) << 6) | byte2);
            }
            else if ((byte1 & 0xf0) === 0xe0) {
                // 3 bytes
                const byte2 = bytes[offset++] & 0x3f;
                const byte3 = bytes[offset++] & 0x3f;
                units.push(((byte1 & 0x1f) << 12) | (byte2 << 6) | byte3);
            }
            else if ((byte1 & 0xf8) === 0xf0) {
                // 4 bytes
                const byte2 = bytes[offset++] & 0x3f;
                const byte3 = bytes[offset++] & 0x3f;
                const byte4 = bytes[offset++] & 0x3f;
                let unit = ((byte1 & 0x07) << 0x12) | (byte2 << 0x0c) | (byte3 << 0x06) | byte4;
                if (unit > 0xffff) {
                    unit -= 0x10000;
                    units.push(((unit >>> 10) & 0x3ff) | 0xd800);
                    unit = 0xdc00 | (unit & 0x3ff);
                }
                units.push(unit);
            }
            else {
                units.push(byte1);
            }
            if (units.length >= CHUNK_SIZE) {
                result += String.fromCharCode(...units);
                units.length = 0;
            }
        }
        if (units.length > 0) {
            result += String.fromCharCode(...units);
        }
        return result;
    }
    const sharedTextDecoder = new TextDecoder();
    // This threshold should be determined by benchmarking, which might vary in engines and input data.
    // Run `npx ts-node benchmark/decode-string.ts` for details.
    const TEXT_DECODER_THRESHOLD = 200;
    function utf8DecodeTD(bytes, inputOffset, byteLength) {
        const stringBytes = bytes.subarray(inputOffset, inputOffset + byteLength);
        return sharedTextDecoder.decode(stringBytes);
    }
    function utf8Decode(bytes, inputOffset, byteLength) {
        if (byteLength > TEXT_DECODER_THRESHOLD) {
            return utf8DecodeTD(bytes, inputOffset, byteLength);
        }
        else {
            return utf8DecodeJs(bytes, inputOffset, byteLength);
        }
    }

    /**
     * ExtData is used to handle Extension Types that are not registered to ExtensionCodec.
     */
    class ExtData {
        type;
        data;
        constructor(type, data) {
            this.type = type;
            this.data = data;
        }
    }

    class DecodeError extends Error {
        constructor(message) {
            super(message);
            // fix the prototype chain in a cross-platform way
            const proto = Object.create(DecodeError.prototype);
            Object.setPrototypeOf(this, proto);
            Object.defineProperty(this, "name", {
                configurable: true,
                enumerable: false,
                value: DecodeError.name,
            });
        }
    }

    // Integer Utility
    const UINT32_MAX = 4294967295;
    // DataView extension to handle int64 / uint64,
    // where the actual range is 53-bits integer (a.k.a. safe integer)
    function setUint64(view, offset, value) {
        const high = value / 4294967296;
        const low = value; // high bits are truncated by DataView
        view.setUint32(offset, high);
        view.setUint32(offset + 4, low);
    }
    function setInt64(view, offset, value) {
        const high = Math.floor(value / 4294967296);
        const low = value; // high bits are truncated by DataView
        view.setUint32(offset, high);
        view.setUint32(offset + 4, low);
    }
    function getInt64(view, offset) {
        const high = view.getInt32(offset);
        const low = view.getUint32(offset + 4);
        return high * 4294967296 + low;
    }
    function getUint64(view, offset) {
        const high = view.getUint32(offset);
        const low = view.getUint32(offset + 4);
        return high * 4294967296 + low;
    }

    // https://github.com/msgpack/msgpack/blob/master/spec.md#timestamp-extension-type
    const EXT_TIMESTAMP = -1;
    const TIMESTAMP32_MAX_SEC = 0x100000000 - 1; // 32-bit unsigned int
    const TIMESTAMP64_MAX_SEC = 0x400000000 - 1; // 34-bit unsigned int
    function encodeTimeSpecToTimestamp({ sec, nsec }) {
        if (sec >= 0 && nsec >= 0 && sec <= TIMESTAMP64_MAX_SEC) {
            // Here sec >= 0 && nsec >= 0
            if (nsec === 0 && sec <= TIMESTAMP32_MAX_SEC) {
                // timestamp 32 = { sec32 (unsigned) }
                const rv = new Uint8Array(4);
                const view = new DataView(rv.buffer);
                view.setUint32(0, sec);
                return rv;
            }
            else {
                // timestamp 64 = { nsec30 (unsigned), sec34 (unsigned) }
                const secHigh = sec / 0x100000000;
                const secLow = sec & 0xffffffff;
                const rv = new Uint8Array(8);
                const view = new DataView(rv.buffer);
                // nsec30 | secHigh2
                view.setUint32(0, (nsec << 2) | (secHigh & 0x3));
                // secLow32
                view.setUint32(4, secLow);
                return rv;
            }
        }
        else {
            // timestamp 96 = { nsec32 (unsigned), sec64 (signed) }
            const rv = new Uint8Array(12);
            const view = new DataView(rv.buffer);
            view.setUint32(0, nsec);
            setInt64(view, 4, sec);
            return rv;
        }
    }
    function encodeDateToTimeSpec(date) {
        const msec = date.getTime();
        const sec = Math.floor(msec / 1e3);
        const nsec = (msec - sec * 1e3) * 1e6;
        // Normalizes { sec, nsec } to ensure nsec is unsigned.
        const nsecInSec = Math.floor(nsec / 1e9);
        return {
            sec: sec + nsecInSec,
            nsec: nsec - nsecInSec * 1e9,
        };
    }
    function encodeTimestampExtension(object) {
        if (object instanceof Date) {
            const timeSpec = encodeDateToTimeSpec(object);
            return encodeTimeSpecToTimestamp(timeSpec);
        }
        else {
            return null;
        }
    }
    function decodeTimestampToTimeSpec(data) {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        // data may be 32, 64, or 96 bits
        switch (data.byteLength) {
            case 4: {
                // timestamp 32 = { sec32 }
                const sec = view.getUint32(0);
                const nsec = 0;
                return { sec, nsec };
            }
            case 8: {
                // timestamp 64 = { nsec30, sec34 }
                const nsec30AndSecHigh2 = view.getUint32(0);
                const secLow32 = view.getUint32(4);
                const sec = (nsec30AndSecHigh2 & 0x3) * 0x100000000 + secLow32;
                const nsec = nsec30AndSecHigh2 >>> 2;
                return { sec, nsec };
            }
            case 12: {
                // timestamp 96 = { nsec32 (unsigned), sec64 (signed) }
                const sec = getInt64(view, 4);
                const nsec = view.getUint32(0);
                return { sec, nsec };
            }
            default:
                throw new DecodeError(`Unrecognized data size for timestamp (expected 4, 8, or 12): ${data.length}`);
        }
    }
    function decodeTimestampExtension(data) {
        const timeSpec = decodeTimestampToTimeSpec(data);
        return new Date(timeSpec.sec * 1e3 + timeSpec.nsec / 1e6);
    }
    const timestampExtension = {
        type: EXT_TIMESTAMP,
        encode: encodeTimestampExtension,
        decode: decodeTimestampExtension,
    };

    // ExtensionCodec to handle MessagePack extensions
    class ExtensionCodec {
        static defaultCodec = new ExtensionCodec();
        // ensures ExtensionCodecType<X> matches ExtensionCodec<X>
        // this will make type errors a lot more clear
        // eslint-disable-next-line @typescript-eslint/naming-convention
        __brand;
        // built-in extensions
        builtInEncoders = [];
        builtInDecoders = [];
        // custom extensions
        encoders = [];
        decoders = [];
        constructor() {
            this.register(timestampExtension);
        }
        register({ type, encode, decode, }) {
            if (type >= 0) {
                // custom extensions
                this.encoders[type] = encode;
                this.decoders[type] = decode;
            }
            else {
                // built-in extensions
                const index = -1 - type;
                this.builtInEncoders[index] = encode;
                this.builtInDecoders[index] = decode;
            }
        }
        tryToEncode(object, context) {
            // built-in extensions
            for (let i = 0; i < this.builtInEncoders.length; i++) {
                const encodeExt = this.builtInEncoders[i];
                if (encodeExt != null) {
                    const data = encodeExt(object, context);
                    if (data != null) {
                        const type = -1 - i;
                        return new ExtData(type, data);
                    }
                }
            }
            // custom extensions
            for (let i = 0; i < this.encoders.length; i++) {
                const encodeExt = this.encoders[i];
                if (encodeExt != null) {
                    const data = encodeExt(object, context);
                    if (data != null) {
                        const type = i;
                        return new ExtData(type, data);
                    }
                }
            }
            if (object instanceof ExtData) {
                // to keep ExtData as is
                return object;
            }
            return null;
        }
        decode(data, type, context) {
            const decodeExt = type < 0 ? this.builtInDecoders[-1 - type] : this.decoders[type];
            if (decodeExt) {
                return decodeExt(data, type, context);
            }
            else {
                // decode() does not fail, returns ExtData instead.
                return new ExtData(type, data);
            }
        }
    }

    function isArrayBufferLike(buffer) {
        return (buffer instanceof ArrayBuffer || (typeof SharedArrayBuffer !== "undefined" && buffer instanceof SharedArrayBuffer));
    }
    function ensureUint8Array(buffer) {
        if (buffer instanceof Uint8Array) {
            return buffer;
        }
        else if (ArrayBuffer.isView(buffer)) {
            return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        }
        else if (isArrayBufferLike(buffer)) {
            return new Uint8Array(buffer);
        }
        else {
            // ArrayLike<number>
            return Uint8Array.from(buffer);
        }
    }

    const DEFAULT_MAX_DEPTH = 100;
    const DEFAULT_INITIAL_BUFFER_SIZE = 2048;
    class Encoder {
        extensionCodec;
        context;
        useBigInt64;
        maxDepth;
        initialBufferSize;
        sortKeys;
        forceFloat32;
        ignoreUndefined;
        forceIntegerToFloat;
        pos;
        view;
        bytes;
        entered = false;
        constructor(options) {
            this.extensionCodec = options?.extensionCodec ?? ExtensionCodec.defaultCodec;
            this.context = options?.context; // needs a type assertion because EncoderOptions has no context property when ContextType is undefined
            this.useBigInt64 = options?.useBigInt64 ?? false;
            this.maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
            this.initialBufferSize = options?.initialBufferSize ?? DEFAULT_INITIAL_BUFFER_SIZE;
            this.sortKeys = options?.sortKeys ?? false;
            this.forceFloat32 = options?.forceFloat32 ?? false;
            this.ignoreUndefined = options?.ignoreUndefined ?? false;
            this.forceIntegerToFloat = options?.forceIntegerToFloat ?? false;
            this.pos = 0;
            this.view = new DataView(new ArrayBuffer(this.initialBufferSize));
            this.bytes = new Uint8Array(this.view.buffer);
        }
        clone() {
            // Because of slightly special argument `context`,
            // type assertion is needed.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return new Encoder({
                extensionCodec: this.extensionCodec,
                context: this.context,
                useBigInt64: this.useBigInt64,
                maxDepth: this.maxDepth,
                initialBufferSize: this.initialBufferSize,
                sortKeys: this.sortKeys,
                forceFloat32: this.forceFloat32,
                ignoreUndefined: this.ignoreUndefined,
                forceIntegerToFloat: this.forceIntegerToFloat,
            });
        }
        reinitializeState() {
            this.pos = 0;
        }
        /**
         * This is almost equivalent to {@link Encoder#encode}, but it returns an reference of the encoder's internal buffer and thus much faster than {@link Encoder#encode}.
         *
         * @returns Encodes the object and returns a shared reference the encoder's internal buffer.
         */
        encodeSharedRef(object) {
            if (this.entered) {
                const instance = this.clone();
                return instance.encodeSharedRef(object);
            }
            try {
                this.entered = true;
                this.reinitializeState();
                this.doEncode(object, 1);
                return this.bytes.subarray(0, this.pos);
            }
            finally {
                this.entered = false;
            }
        }
        /**
         * @returns Encodes the object and returns a copy of the encoder's internal buffer.
         */
        encode(object) {
            if (this.entered) {
                const instance = this.clone();
                return instance.encode(object);
            }
            try {
                this.entered = true;
                this.reinitializeState();
                this.doEncode(object, 1);
                return this.bytes.slice(0, this.pos);
            }
            finally {
                this.entered = false;
            }
        }
        doEncode(object, depth) {
            if (depth > this.maxDepth) {
                throw new Error(`Too deep objects in depth ${depth}`);
            }
            if (object == null) {
                this.encodeNil();
            }
            else if (typeof object === "boolean") {
                this.encodeBoolean(object);
            }
            else if (typeof object === "number") {
                if (!this.forceIntegerToFloat) {
                    this.encodeNumber(object);
                }
                else {
                    this.encodeNumberAsFloat(object);
                }
            }
            else if (typeof object === "string") {
                this.encodeString(object);
            }
            else if (this.useBigInt64 && typeof object === "bigint") {
                this.encodeBigInt64(object);
            }
            else {
                this.encodeObject(object, depth);
            }
        }
        ensureBufferSizeToWrite(sizeToWrite) {
            const requiredSize = this.pos + sizeToWrite;
            if (this.view.byteLength < requiredSize) {
                this.resizeBuffer(requiredSize * 2);
            }
        }
        resizeBuffer(newSize) {
            const newBuffer = new ArrayBuffer(newSize);
            const newBytes = new Uint8Array(newBuffer);
            const newView = new DataView(newBuffer);
            newBytes.set(this.bytes);
            this.view = newView;
            this.bytes = newBytes;
        }
        encodeNil() {
            this.writeU8(0xc0);
        }
        encodeBoolean(object) {
            if (object === false) {
                this.writeU8(0xc2);
            }
            else {
                this.writeU8(0xc3);
            }
        }
        encodeNumber(object) {
            if (!this.forceIntegerToFloat && Number.isSafeInteger(object)) {
                if (object >= 0) {
                    if (object < 0x80) {
                        // positive fixint
                        this.writeU8(object);
                    }
                    else if (object < 0x100) {
                        // uint 8
                        this.writeU8(0xcc);
                        this.writeU8(object);
                    }
                    else if (object < 0x10000) {
                        // uint 16
                        this.writeU8(0xcd);
                        this.writeU16(object);
                    }
                    else if (object < 0x100000000) {
                        // uint 32
                        this.writeU8(0xce);
                        this.writeU32(object);
                    }
                    else if (!this.useBigInt64) {
                        // uint 64
                        this.writeU8(0xcf);
                        this.writeU64(object);
                    }
                    else {
                        this.encodeNumberAsFloat(object);
                    }
                }
                else {
                    if (object >= -0x20) {
                        // negative fixint
                        this.writeU8(0xe0 | (object + 0x20));
                    }
                    else if (object >= -0x80) {
                        // int 8
                        this.writeU8(0xd0);
                        this.writeI8(object);
                    }
                    else if (object >= -0x8000) {
                        // int 16
                        this.writeU8(0xd1);
                        this.writeI16(object);
                    }
                    else if (object >= -0x80000000) {
                        // int 32
                        this.writeU8(0xd2);
                        this.writeI32(object);
                    }
                    else if (!this.useBigInt64) {
                        // int 64
                        this.writeU8(0xd3);
                        this.writeI64(object);
                    }
                    else {
                        this.encodeNumberAsFloat(object);
                    }
                }
            }
            else {
                this.encodeNumberAsFloat(object);
            }
        }
        encodeNumberAsFloat(object) {
            if (this.forceFloat32) {
                // float 32
                this.writeU8(0xca);
                this.writeF32(object);
            }
            else {
                // float 64
                this.writeU8(0xcb);
                this.writeF64(object);
            }
        }
        encodeBigInt64(object) {
            if (object >= BigInt(0)) {
                // uint 64
                this.writeU8(0xcf);
                this.writeBigUint64(object);
            }
            else {
                // int 64
                this.writeU8(0xd3);
                this.writeBigInt64(object);
            }
        }
        writeStringHeader(byteLength) {
            if (byteLength < 32) {
                // fixstr
                this.writeU8(0xa0 + byteLength);
            }
            else if (byteLength < 0x100) {
                // str 8
                this.writeU8(0xd9);
                this.writeU8(byteLength);
            }
            else if (byteLength < 0x10000) {
                // str 16
                this.writeU8(0xda);
                this.writeU16(byteLength);
            }
            else if (byteLength < 0x100000000) {
                // str 32
                this.writeU8(0xdb);
                this.writeU32(byteLength);
            }
            else {
                throw new Error(`Too long string: ${byteLength} bytes in UTF-8`);
            }
        }
        encodeString(object) {
            const maxHeaderSize = 1 + 4;
            const byteLength = utf8Count(object);
            this.ensureBufferSizeToWrite(maxHeaderSize + byteLength);
            this.writeStringHeader(byteLength);
            utf8Encode(object, this.bytes, this.pos);
            this.pos += byteLength;
        }
        encodeObject(object, depth) {
            // try to encode objects with custom codec first of non-primitives
            const ext = this.extensionCodec.tryToEncode(object, this.context);
            if (ext != null) {
                this.encodeExtension(ext);
            }
            else if (Array.isArray(object)) {
                this.encodeArray(object, depth);
            }
            else if (ArrayBuffer.isView(object)) {
                this.encodeBinary(object);
            }
            else if (typeof object === "object") {
                this.encodeMap(object, depth);
            }
            else {
                // symbol, function and other special object come here unless extensionCodec handles them.
                throw new Error(`Unrecognized object: ${Object.prototype.toString.apply(object)}`);
            }
        }
        encodeBinary(object) {
            const size = object.byteLength;
            if (size < 0x100) {
                // bin 8
                this.writeU8(0xc4);
                this.writeU8(size);
            }
            else if (size < 0x10000) {
                // bin 16
                this.writeU8(0xc5);
                this.writeU16(size);
            }
            else if (size < 0x100000000) {
                // bin 32
                this.writeU8(0xc6);
                this.writeU32(size);
            }
            else {
                throw new Error(`Too large binary: ${size}`);
            }
            const bytes = ensureUint8Array(object);
            this.writeU8a(bytes);
        }
        encodeArray(object, depth) {
            const size = object.length;
            if (size < 16) {
                // fixarray
                this.writeU8(0x90 + size);
            }
            else if (size < 0x10000) {
                // array 16
                this.writeU8(0xdc);
                this.writeU16(size);
            }
            else if (size < 0x100000000) {
                // array 32
                this.writeU8(0xdd);
                this.writeU32(size);
            }
            else {
                throw new Error(`Too large array: ${size}`);
            }
            for (const item of object) {
                this.doEncode(item, depth + 1);
            }
        }
        countWithoutUndefined(object, keys) {
            let count = 0;
            for (const key of keys) {
                if (object[key] !== undefined) {
                    count++;
                }
            }
            return count;
        }
        encodeMap(object, depth) {
            const keys = Object.keys(object);
            if (this.sortKeys) {
                keys.sort();
            }
            const size = this.ignoreUndefined ? this.countWithoutUndefined(object, keys) : keys.length;
            if (size < 16) {
                // fixmap
                this.writeU8(0x80 + size);
            }
            else if (size < 0x10000) {
                // map 16
                this.writeU8(0xde);
                this.writeU16(size);
            }
            else if (size < 0x100000000) {
                // map 32
                this.writeU8(0xdf);
                this.writeU32(size);
            }
            else {
                throw new Error(`Too large map object: ${size}`);
            }
            for (const key of keys) {
                const value = object[key];
                if (!(this.ignoreUndefined && value === undefined)) {
                    this.encodeString(key);
                    this.doEncode(value, depth + 1);
                }
            }
        }
        encodeExtension(ext) {
            if (typeof ext.data === "function") {
                const data = ext.data(this.pos + 6);
                const size = data.length;
                if (size >= 0x100000000) {
                    throw new Error(`Too large extension object: ${size}`);
                }
                this.writeU8(0xc9);
                this.writeU32(size);
                this.writeI8(ext.type);
                this.writeU8a(data);
                return;
            }
            const size = ext.data.length;
            if (size === 1) {
                // fixext 1
                this.writeU8(0xd4);
            }
            else if (size === 2) {
                // fixext 2
                this.writeU8(0xd5);
            }
            else if (size === 4) {
                // fixext 4
                this.writeU8(0xd6);
            }
            else if (size === 8) {
                // fixext 8
                this.writeU8(0xd7);
            }
            else if (size === 16) {
                // fixext 16
                this.writeU8(0xd8);
            }
            else if (size < 0x100) {
                // ext 8
                this.writeU8(0xc7);
                this.writeU8(size);
            }
            else if (size < 0x10000) {
                // ext 16
                this.writeU8(0xc8);
                this.writeU16(size);
            }
            else if (size < 0x100000000) {
                // ext 32
                this.writeU8(0xc9);
                this.writeU32(size);
            }
            else {
                throw new Error(`Too large extension object: ${size}`);
            }
            this.writeI8(ext.type);
            this.writeU8a(ext.data);
        }
        writeU8(value) {
            this.ensureBufferSizeToWrite(1);
            this.view.setUint8(this.pos, value);
            this.pos++;
        }
        writeU8a(values) {
            const size = values.length;
            this.ensureBufferSizeToWrite(size);
            this.bytes.set(values, this.pos);
            this.pos += size;
        }
        writeI8(value) {
            this.ensureBufferSizeToWrite(1);
            this.view.setInt8(this.pos, value);
            this.pos++;
        }
        writeU16(value) {
            this.ensureBufferSizeToWrite(2);
            this.view.setUint16(this.pos, value);
            this.pos += 2;
        }
        writeI16(value) {
            this.ensureBufferSizeToWrite(2);
            this.view.setInt16(this.pos, value);
            this.pos += 2;
        }
        writeU32(value) {
            this.ensureBufferSizeToWrite(4);
            this.view.setUint32(this.pos, value);
            this.pos += 4;
        }
        writeI32(value) {
            this.ensureBufferSizeToWrite(4);
            this.view.setInt32(this.pos, value);
            this.pos += 4;
        }
        writeF32(value) {
            this.ensureBufferSizeToWrite(4);
            this.view.setFloat32(this.pos, value);
            this.pos += 4;
        }
        writeF64(value) {
            this.ensureBufferSizeToWrite(8);
            this.view.setFloat64(this.pos, value);
            this.pos += 8;
        }
        writeU64(value) {
            this.ensureBufferSizeToWrite(8);
            setUint64(this.view, this.pos, value);
            this.pos += 8;
        }
        writeI64(value) {
            this.ensureBufferSizeToWrite(8);
            setInt64(this.view, this.pos, value);
            this.pos += 8;
        }
        writeBigUint64(value) {
            this.ensureBufferSizeToWrite(8);
            this.view.setBigUint64(this.pos, value);
            this.pos += 8;
        }
        writeBigInt64(value) {
            this.ensureBufferSizeToWrite(8);
            this.view.setBigInt64(this.pos, value);
            this.pos += 8;
        }
    }

    /**
     * It encodes `value` in the MessagePack format and
     * returns a byte buffer.
     *
     * The returned buffer is a slice of a larger `ArrayBuffer`, so you have to use its `#byteOffset` and `#byteLength` in order to convert it to another typed arrays including NodeJS `Buffer`.
     */
    function encode(value, options) {
        const encoder = new Encoder(options);
        return encoder.encodeSharedRef(value);
    }

    function prettyByte(byte) {
        return `${byte < 0 ? "-" : ""}0x${Math.abs(byte).toString(16).padStart(2, "0")}`;
    }

    const DEFAULT_MAX_KEY_LENGTH = 16;
    const DEFAULT_MAX_LENGTH_PER_KEY = 16;
    class CachedKeyDecoder {
        hit = 0;
        miss = 0;
        caches;
        maxKeyLength;
        maxLengthPerKey;
        constructor(maxKeyLength = DEFAULT_MAX_KEY_LENGTH, maxLengthPerKey = DEFAULT_MAX_LENGTH_PER_KEY) {
            this.maxKeyLength = maxKeyLength;
            this.maxLengthPerKey = maxLengthPerKey;
            // avoid `new Array(N)`, which makes a sparse array,
            // because a sparse array is typically slower than a non-sparse array.
            this.caches = [];
            for (let i = 0; i < this.maxKeyLength; i++) {
                this.caches.push([]);
            }
        }
        canBeCached(byteLength) {
            return byteLength > 0 && byteLength <= this.maxKeyLength;
        }
        find(bytes, inputOffset, byteLength) {
            const records = this.caches[byteLength - 1];
            FIND_CHUNK: for (const record of records) {
                const recordBytes = record.bytes;
                for (let j = 0; j < byteLength; j++) {
                    if (recordBytes[j] !== bytes[inputOffset + j]) {
                        continue FIND_CHUNK;
                    }
                }
                return record.str;
            }
            return null;
        }
        store(bytes, value) {
            const records = this.caches[bytes.length - 1];
            const record = { bytes, str: value };
            if (records.length >= this.maxLengthPerKey) {
                // `records` are full!
                // Set `record` to an arbitrary position.
                records[(Math.random() * records.length) | 0] = record;
            }
            else {
                records.push(record);
            }
        }
        decode(bytes, inputOffset, byteLength) {
            const cachedValue = this.find(bytes, inputOffset, byteLength);
            if (cachedValue != null) {
                this.hit++;
                return cachedValue;
            }
            this.miss++;
            const str = utf8DecodeJs(bytes, inputOffset, byteLength);
            // Ensure to copy a slice of bytes because the bytes may be a NodeJS Buffer and Buffer#slice() returns a reference to its internal ArrayBuffer.
            const slicedCopyOfBytes = Uint8Array.prototype.slice.call(bytes, inputOffset, inputOffset + byteLength);
            this.store(slicedCopyOfBytes, str);
            return str;
        }
    }

    const STATE_ARRAY = "array";
    const STATE_MAP_KEY = "map_key";
    const STATE_MAP_VALUE = "map_value";
    const mapKeyConverter = (key) => {
        if (typeof key === "string" || typeof key === "number") {
            return key;
        }
        throw new DecodeError("The type of key must be string or number but " + typeof key);
    };
    class StackPool {
        stack = [];
        stackHeadPosition = -1;
        get length() {
            return this.stackHeadPosition + 1;
        }
        top() {
            return this.stack[this.stackHeadPosition];
        }
        pushArrayState(size) {
            const state = this.getUninitializedStateFromPool();
            state.type = STATE_ARRAY;
            state.position = 0;
            state.size = size;
            state.array = new Array(size);
        }
        pushMapState(size) {
            const state = this.getUninitializedStateFromPool();
            state.type = STATE_MAP_KEY;
            state.readCount = 0;
            state.size = size;
            state.map = {};
        }
        getUninitializedStateFromPool() {
            this.stackHeadPosition++;
            if (this.stackHeadPosition === this.stack.length) {
                const partialState = {
                    type: undefined,
                    size: 0,
                    array: undefined,
                    position: 0,
                    readCount: 0,
                    map: undefined,
                    key: null,
                };
                this.stack.push(partialState);
            }
            return this.stack[this.stackHeadPosition];
        }
        release(state) {
            const topStackState = this.stack[this.stackHeadPosition];
            if (topStackState !== state) {
                throw new Error("Invalid stack state. Released state is not on top of the stack.");
            }
            if (state.type === STATE_ARRAY) {
                const partialState = state;
                partialState.size = 0;
                partialState.array = undefined;
                partialState.position = 0;
                partialState.type = undefined;
            }
            if (state.type === STATE_MAP_KEY || state.type === STATE_MAP_VALUE) {
                const partialState = state;
                partialState.size = 0;
                partialState.map = undefined;
                partialState.readCount = 0;
                partialState.type = undefined;
            }
            this.stackHeadPosition--;
        }
        reset() {
            this.stack.length = 0;
            this.stackHeadPosition = -1;
        }
    }
    const HEAD_BYTE_REQUIRED = -1;
    const EMPTY_VIEW = new DataView(new ArrayBuffer(0));
    const EMPTY_BYTES = new Uint8Array(EMPTY_VIEW.buffer);
    try {
        // IE11: The spec says it should throw RangeError,
        // IE11: but in IE11 it throws TypeError.
        EMPTY_VIEW.getInt8(0);
    }
    catch (e) {
        if (!(e instanceof RangeError)) {
            throw new Error("This module is not supported in the current JavaScript engine because DataView does not throw RangeError on out-of-bounds access");
        }
    }
    const MORE_DATA = new RangeError("Insufficient data");
    const sharedCachedKeyDecoder = new CachedKeyDecoder();
    class Decoder {
        extensionCodec;
        context;
        useBigInt64;
        rawStrings;
        maxStrLength;
        maxBinLength;
        maxArrayLength;
        maxMapLength;
        maxExtLength;
        keyDecoder;
        mapKeyConverter;
        totalPos = 0;
        pos = 0;
        view = EMPTY_VIEW;
        bytes = EMPTY_BYTES;
        headByte = HEAD_BYTE_REQUIRED;
        stack = new StackPool();
        entered = false;
        constructor(options) {
            this.extensionCodec = options?.extensionCodec ?? ExtensionCodec.defaultCodec;
            this.context = options?.context; // needs a type assertion because EncoderOptions has no context property when ContextType is undefined
            this.useBigInt64 = options?.useBigInt64 ?? false;
            this.rawStrings = options?.rawStrings ?? false;
            this.maxStrLength = options?.maxStrLength ?? UINT32_MAX;
            this.maxBinLength = options?.maxBinLength ?? UINT32_MAX;
            this.maxArrayLength = options?.maxArrayLength ?? UINT32_MAX;
            this.maxMapLength = options?.maxMapLength ?? UINT32_MAX;
            this.maxExtLength = options?.maxExtLength ?? UINT32_MAX;
            this.keyDecoder = options?.keyDecoder !== undefined ? options.keyDecoder : sharedCachedKeyDecoder;
            this.mapKeyConverter = options?.mapKeyConverter ?? mapKeyConverter;
        }
        clone() {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return new Decoder({
                extensionCodec: this.extensionCodec,
                context: this.context,
                useBigInt64: this.useBigInt64,
                rawStrings: this.rawStrings,
                maxStrLength: this.maxStrLength,
                maxBinLength: this.maxBinLength,
                maxArrayLength: this.maxArrayLength,
                maxMapLength: this.maxMapLength,
                maxExtLength: this.maxExtLength,
                keyDecoder: this.keyDecoder,
            });
        }
        reinitializeState() {
            this.totalPos = 0;
            this.headByte = HEAD_BYTE_REQUIRED;
            this.stack.reset();
            // view, bytes, and pos will be re-initialized in setBuffer()
        }
        setBuffer(buffer) {
            const bytes = ensureUint8Array(buffer);
            this.bytes = bytes;
            this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            this.pos = 0;
        }
        appendBuffer(buffer) {
            if (this.headByte === HEAD_BYTE_REQUIRED && !this.hasRemaining(1)) {
                this.setBuffer(buffer);
            }
            else {
                const remainingData = this.bytes.subarray(this.pos);
                const newData = ensureUint8Array(buffer);
                // concat remainingData + newData
                const newBuffer = new Uint8Array(remainingData.length + newData.length);
                newBuffer.set(remainingData);
                newBuffer.set(newData, remainingData.length);
                this.setBuffer(newBuffer);
            }
        }
        hasRemaining(size) {
            return this.view.byteLength - this.pos >= size;
        }
        createExtraByteError(posToShow) {
            const { view, pos } = this;
            return new RangeError(`Extra ${view.byteLength - pos} of ${view.byteLength} byte(s) found at buffer[${posToShow}]`);
        }
        /**
         * @throws {@link DecodeError}
         * @throws {@link RangeError}
         */
        decode(buffer) {
            if (this.entered) {
                const instance = this.clone();
                return instance.decode(buffer);
            }
            try {
                this.entered = true;
                this.reinitializeState();
                this.setBuffer(buffer);
                const object = this.doDecodeSync();
                if (this.hasRemaining(1)) {
                    throw this.createExtraByteError(this.pos);
                }
                return object;
            }
            finally {
                this.entered = false;
            }
        }
        *decodeMulti(buffer) {
            if (this.entered) {
                const instance = this.clone();
                yield* instance.decodeMulti(buffer);
                return;
            }
            try {
                this.entered = true;
                this.reinitializeState();
                this.setBuffer(buffer);
                while (this.hasRemaining(1)) {
                    yield this.doDecodeSync();
                }
            }
            finally {
                this.entered = false;
            }
        }
        async decodeAsync(stream) {
            if (this.entered) {
                const instance = this.clone();
                return instance.decodeAsync(stream);
            }
            try {
                this.entered = true;
                let decoded = false;
                let object;
                for await (const buffer of stream) {
                    if (decoded) {
                        this.entered = false;
                        throw this.createExtraByteError(this.totalPos);
                    }
                    this.appendBuffer(buffer);
                    try {
                        object = this.doDecodeSync();
                        decoded = true;
                    }
                    catch (e) {
                        if (!(e instanceof RangeError)) {
                            throw e; // rethrow
                        }
                        // fallthrough
                    }
                    this.totalPos += this.pos;
                }
                if (decoded) {
                    if (this.hasRemaining(1)) {
                        throw this.createExtraByteError(this.totalPos);
                    }
                    return object;
                }
                const { headByte, pos, totalPos } = this;
                throw new RangeError(`Insufficient data in parsing ${prettyByte(headByte)} at ${totalPos} (${pos} in the current buffer)`);
            }
            finally {
                this.entered = false;
            }
        }
        decodeArrayStream(stream) {
            return this.decodeMultiAsync(stream, true);
        }
        decodeStream(stream) {
            return this.decodeMultiAsync(stream, false);
        }
        async *decodeMultiAsync(stream, isArray) {
            if (this.entered) {
                const instance = this.clone();
                yield* instance.decodeMultiAsync(stream, isArray);
                return;
            }
            try {
                this.entered = true;
                let isArrayHeaderRequired = isArray;
                let arrayItemsLeft = -1;
                for await (const buffer of stream) {
                    if (isArray && arrayItemsLeft === 0) {
                        throw this.createExtraByteError(this.totalPos);
                    }
                    this.appendBuffer(buffer);
                    if (isArrayHeaderRequired) {
                        arrayItemsLeft = this.readArraySize();
                        isArrayHeaderRequired = false;
                        this.complete();
                    }
                    try {
                        while (true) {
                            yield this.doDecodeSync();
                            if (--arrayItemsLeft === 0) {
                                break;
                            }
                        }
                    }
                    catch (e) {
                        if (!(e instanceof RangeError)) {
                            throw e; // rethrow
                        }
                        // fallthrough
                    }
                    this.totalPos += this.pos;
                }
            }
            finally {
                this.entered = false;
            }
        }
        doDecodeSync() {
            DECODE: while (true) {
                const headByte = this.readHeadByte();
                let object;
                if (headByte >= 0xe0) {
                    // negative fixint (111x xxxx) 0xe0 - 0xff
                    object = headByte - 0x100;
                }
                else if (headByte < 0xc0) {
                    if (headByte < 0x80) {
                        // positive fixint (0xxx xxxx) 0x00 - 0x7f
                        object = headByte;
                    }
                    else if (headByte < 0x90) {
                        // fixmap (1000 xxxx) 0x80 - 0x8f
                        const size = headByte - 0x80;
                        if (size !== 0) {
                            this.pushMapState(size);
                            this.complete();
                            continue DECODE;
                        }
                        else {
                            object = {};
                        }
                    }
                    else if (headByte < 0xa0) {
                        // fixarray (1001 xxxx) 0x90 - 0x9f
                        const size = headByte - 0x90;
                        if (size !== 0) {
                            this.pushArrayState(size);
                            this.complete();
                            continue DECODE;
                        }
                        else {
                            object = [];
                        }
                    }
                    else {
                        // fixstr (101x xxxx) 0xa0 - 0xbf
                        const byteLength = headByte - 0xa0;
                        object = this.decodeString(byteLength, 0);
                    }
                }
                else if (headByte === 0xc0) {
                    // nil
                    object = null;
                }
                else if (headByte === 0xc2) {
                    // false
                    object = false;
                }
                else if (headByte === 0xc3) {
                    // true
                    object = true;
                }
                else if (headByte === 0xca) {
                    // float 32
                    object = this.readF32();
                }
                else if (headByte === 0xcb) {
                    // float 64
                    object = this.readF64();
                }
                else if (headByte === 0xcc) {
                    // uint 8
                    object = this.readU8();
                }
                else if (headByte === 0xcd) {
                    // uint 16
                    object = this.readU16();
                }
                else if (headByte === 0xce) {
                    // uint 32
                    object = this.readU32();
                }
                else if (headByte === 0xcf) {
                    // uint 64
                    if (this.useBigInt64) {
                        object = this.readU64AsBigInt();
                    }
                    else {
                        object = this.readU64();
                    }
                }
                else if (headByte === 0xd0) {
                    // int 8
                    object = this.readI8();
                }
                else if (headByte === 0xd1) {
                    // int 16
                    object = this.readI16();
                }
                else if (headByte === 0xd2) {
                    // int 32
                    object = this.readI32();
                }
                else if (headByte === 0xd3) {
                    // int 64
                    if (this.useBigInt64) {
                        object = this.readI64AsBigInt();
                    }
                    else {
                        object = this.readI64();
                    }
                }
                else if (headByte === 0xd9) {
                    // str 8
                    const byteLength = this.lookU8();
                    object = this.decodeString(byteLength, 1);
                }
                else if (headByte === 0xda) {
                    // str 16
                    const byteLength = this.lookU16();
                    object = this.decodeString(byteLength, 2);
                }
                else if (headByte === 0xdb) {
                    // str 32
                    const byteLength = this.lookU32();
                    object = this.decodeString(byteLength, 4);
                }
                else if (headByte === 0xdc) {
                    // array 16
                    const size = this.readU16();
                    if (size !== 0) {
                        this.pushArrayState(size);
                        this.complete();
                        continue DECODE;
                    }
                    else {
                        object = [];
                    }
                }
                else if (headByte === 0xdd) {
                    // array 32
                    const size = this.readU32();
                    if (size !== 0) {
                        this.pushArrayState(size);
                        this.complete();
                        continue DECODE;
                    }
                    else {
                        object = [];
                    }
                }
                else if (headByte === 0xde) {
                    // map 16
                    const size = this.readU16();
                    if (size !== 0) {
                        this.pushMapState(size);
                        this.complete();
                        continue DECODE;
                    }
                    else {
                        object = {};
                    }
                }
                else if (headByte === 0xdf) {
                    // map 32
                    const size = this.readU32();
                    if (size !== 0) {
                        this.pushMapState(size);
                        this.complete();
                        continue DECODE;
                    }
                    else {
                        object = {};
                    }
                }
                else if (headByte === 0xc4) {
                    // bin 8
                    const size = this.lookU8();
                    object = this.decodeBinary(size, 1);
                }
                else if (headByte === 0xc5) {
                    // bin 16
                    const size = this.lookU16();
                    object = this.decodeBinary(size, 2);
                }
                else if (headByte === 0xc6) {
                    // bin 32
                    const size = this.lookU32();
                    object = this.decodeBinary(size, 4);
                }
                else if (headByte === 0xd4) {
                    // fixext 1
                    object = this.decodeExtension(1, 0);
                }
                else if (headByte === 0xd5) {
                    // fixext 2
                    object = this.decodeExtension(2, 0);
                }
                else if (headByte === 0xd6) {
                    // fixext 4
                    object = this.decodeExtension(4, 0);
                }
                else if (headByte === 0xd7) {
                    // fixext 8
                    object = this.decodeExtension(8, 0);
                }
                else if (headByte === 0xd8) {
                    // fixext 16
                    object = this.decodeExtension(16, 0);
                }
                else if (headByte === 0xc7) {
                    // ext 8
                    const size = this.lookU8();
                    object = this.decodeExtension(size, 1);
                }
                else if (headByte === 0xc8) {
                    // ext 16
                    const size = this.lookU16();
                    object = this.decodeExtension(size, 2);
                }
                else if (headByte === 0xc9) {
                    // ext 32
                    const size = this.lookU32();
                    object = this.decodeExtension(size, 4);
                }
                else {
                    throw new DecodeError(`Unrecognized type byte: ${prettyByte(headByte)}`);
                }
                this.complete();
                const stack = this.stack;
                while (stack.length > 0) {
                    // arrays and maps
                    const state = stack.top();
                    if (state.type === STATE_ARRAY) {
                        state.array[state.position] = object;
                        state.position++;
                        if (state.position === state.size) {
                            object = state.array;
                            stack.release(state);
                        }
                        else {
                            continue DECODE;
                        }
                    }
                    else if (state.type === STATE_MAP_KEY) {
                        if (object === "__proto__") {
                            throw new DecodeError("The key __proto__ is not allowed");
                        }
                        state.key = this.mapKeyConverter(object);
                        state.type = STATE_MAP_VALUE;
                        continue DECODE;
                    }
                    else {
                        // it must be `state.type === State.MAP_VALUE` here
                        state.map[state.key] = object;
                        state.readCount++;
                        if (state.readCount === state.size) {
                            object = state.map;
                            stack.release(state);
                        }
                        else {
                            state.key = null;
                            state.type = STATE_MAP_KEY;
                            continue DECODE;
                        }
                    }
                }
                return object;
            }
        }
        readHeadByte() {
            if (this.headByte === HEAD_BYTE_REQUIRED) {
                this.headByte = this.readU8();
                // console.log("headByte", prettyByte(this.headByte));
            }
            return this.headByte;
        }
        complete() {
            this.headByte = HEAD_BYTE_REQUIRED;
        }
        readArraySize() {
            const headByte = this.readHeadByte();
            switch (headByte) {
                case 0xdc:
                    return this.readU16();
                case 0xdd:
                    return this.readU32();
                default: {
                    if (headByte < 0xa0) {
                        return headByte - 0x90;
                    }
                    else {
                        throw new DecodeError(`Unrecognized array type byte: ${prettyByte(headByte)}`);
                    }
                }
            }
        }
        pushMapState(size) {
            if (size > this.maxMapLength) {
                throw new DecodeError(`Max length exceeded: map length (${size}) > maxMapLengthLength (${this.maxMapLength})`);
            }
            this.stack.pushMapState(size);
        }
        pushArrayState(size) {
            if (size > this.maxArrayLength) {
                throw new DecodeError(`Max length exceeded: array length (${size}) > maxArrayLength (${this.maxArrayLength})`);
            }
            this.stack.pushArrayState(size);
        }
        decodeString(byteLength, headerOffset) {
            if (!this.rawStrings || this.stateIsMapKey()) {
                return this.decodeUtf8String(byteLength, headerOffset);
            }
            return this.decodeBinary(byteLength, headerOffset);
        }
        /**
         * @throws {@link RangeError}
         */
        decodeUtf8String(byteLength, headerOffset) {
            if (byteLength > this.maxStrLength) {
                throw new DecodeError(`Max length exceeded: UTF-8 byte length (${byteLength}) > maxStrLength (${this.maxStrLength})`);
            }
            if (this.bytes.byteLength < this.pos + headerOffset + byteLength) {
                throw MORE_DATA;
            }
            const offset = this.pos + headerOffset;
            let object;
            if (this.stateIsMapKey() && this.keyDecoder?.canBeCached(byteLength)) {
                object = this.keyDecoder.decode(this.bytes, offset, byteLength);
            }
            else {
                object = utf8Decode(this.bytes, offset, byteLength);
            }
            this.pos += headerOffset + byteLength;
            return object;
        }
        stateIsMapKey() {
            if (this.stack.length > 0) {
                const state = this.stack.top();
                return state.type === STATE_MAP_KEY;
            }
            return false;
        }
        /**
         * @throws {@link RangeError}
         */
        decodeBinary(byteLength, headOffset) {
            if (byteLength > this.maxBinLength) {
                throw new DecodeError(`Max length exceeded: bin length (${byteLength}) > maxBinLength (${this.maxBinLength})`);
            }
            if (!this.hasRemaining(byteLength + headOffset)) {
                throw MORE_DATA;
            }
            const offset = this.pos + headOffset;
            const object = this.bytes.subarray(offset, offset + byteLength);
            this.pos += headOffset + byteLength;
            return object;
        }
        decodeExtension(size, headOffset) {
            if (size > this.maxExtLength) {
                throw new DecodeError(`Max length exceeded: ext length (${size}) > maxExtLength (${this.maxExtLength})`);
            }
            const extType = this.view.getInt8(this.pos + headOffset);
            const data = this.decodeBinary(size, headOffset + 1 /* extType */);
            return this.extensionCodec.decode(data, extType, this.context);
        }
        lookU8() {
            return this.view.getUint8(this.pos);
        }
        lookU16() {
            return this.view.getUint16(this.pos);
        }
        lookU32() {
            return this.view.getUint32(this.pos);
        }
        readU8() {
            const value = this.view.getUint8(this.pos);
            this.pos++;
            return value;
        }
        readI8() {
            const value = this.view.getInt8(this.pos);
            this.pos++;
            return value;
        }
        readU16() {
            const value = this.view.getUint16(this.pos);
            this.pos += 2;
            return value;
        }
        readI16() {
            const value = this.view.getInt16(this.pos);
            this.pos += 2;
            return value;
        }
        readU32() {
            const value = this.view.getUint32(this.pos);
            this.pos += 4;
            return value;
        }
        readI32() {
            const value = this.view.getInt32(this.pos);
            this.pos += 4;
            return value;
        }
        readU64() {
            const value = getUint64(this.view, this.pos);
            this.pos += 8;
            return value;
        }
        readI64() {
            const value = getInt64(this.view, this.pos);
            this.pos += 8;
            return value;
        }
        readU64AsBigInt() {
            const value = this.view.getBigUint64(this.pos);
            this.pos += 8;
            return value;
        }
        readI64AsBigInt() {
            const value = this.view.getBigInt64(this.pos);
            this.pos += 8;
            return value;
        }
        readF32() {
            const value = this.view.getFloat32(this.pos);
            this.pos += 4;
            return value;
        }
        readF64() {
            const value = this.view.getFloat64(this.pos);
            this.pos += 8;
            return value;
        }
    }

    /**
     * It decodes a single MessagePack object in a buffer.
     *
     * This is a synchronous decoding function.
     * See other variants for asynchronous decoding: {@link decodeAsync}, {@link decodeMultiStream}, or {@link decodeArrayStream}.
     *
     * @throws {@link RangeError} if the buffer is incomplete, including the case where the buffer is empty.
     * @throws {@link DecodeError} if the buffer contains invalid data.
     */
    function decode(buffer, options) {
        const decoder = new Decoder(options);
        return decoder.decode(buffer);
    }

    function eventPlayerColor(event) {
        return 'playerColor' in event ? event.playerColor : null;
    }
    function buildPlayerAliases(log) {
        var _a, _b, _c;
        const board = log.spatialCapture.board;
        const orderedColors = [];
        const addColor = (color) => {
            if (!orderedColors.includes(color))
                orderedColors.push(color);
        };
        // A player's first settlement is the most direct observation of placement
        // order. The remaining sources make incomplete/mid-game captures deterministic.
        for (const event of log.spatialCapture.events) {
            if (event.kind === 'settlement-placed')
                addColor(event.playerColor);
        }
        for (const event of log.spatialCapture.events) {
            const color = eventPlayerColor(event);
            if (color !== null)
                addColor(color);
        }
        for (const color of (_a = board === null || board === void 0 ? void 0 : board.playOrder) !== null && _a !== void 0 ? _a : [])
            addColor(color);
        for (const player of (_b = board === null || board === void 0 ? void 0 : board.players) !== null && _b !== void 0 ? _b : [])
            addColor(player.color);
        const usernameByColor = new Map(((_c = board === null || board === void 0 ? void 0 : board.players) !== null && _c !== void 0 ? _c : []).map(player => [player.color, player.username]));
        const byName = new Map();
        const aliasesInOrder = [];
        const addName = (name) => {
            if (!name || byName.has(name))
                return;
            const alias = `Player ${aliasesInOrder.length + 1}`;
            byName.set(name, alias);
            aliasesInOrder.push(alias);
        };
        for (const color of orderedColors)
            addName(usernameByColor.get(color));
        for (const name of log.players)
            addName(name);
        addName(log.youPlayerName);
        return { byName, aliasesInOrder };
    }
    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    function escapeHtml(value) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    function replacePlayerNames(value, byName) {
        const replacements = new Map();
        for (const [name, alias] of byName) {
            replacements.set(name, alias);
            replacements.set(escapeHtml(name), alias);
        }
        const names = [...replacements.keys()].filter(Boolean);
        if (names.length === 0)
            return value;
        names.sort((a, b) => b.length - a.length);
        const pattern = new RegExp(names.map(escapeRegExp).join('|'), 'g');
        return value.replace(pattern, match => { var _a; return (_a = replacements.get(match)) !== null && _a !== void 0 ? _a : match; });
    }
    function redactUnknown(value, byName) {
        if (typeof value === 'string')
            return replacePlayerNames(value, byName);
        if (Array.isArray(value))
            return value.map(item => redactUnknown(item, byName));
        if (value instanceof Uint8Array || value instanceof Date)
            return value;
        if (value instanceof Map) {
            return new Map([...value].map(([key, item]) => [
                redactUnknown(key, byName),
                redactUnknown(item, byName),
            ]));
        }
        if (typeof value === 'object' && value !== null) {
            const redacted = {};
            for (const [key, item] of Object.entries(value)) {
                redacted[key] = redactUnknown(item, byName);
            }
            return redacted;
        }
        return value;
    }
    function base64ToBytes(value) {
        const binary = window.atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
    }
    function bytesToBase64(bytes) {
        let binary = '';
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
        }
        return window.btoa(binary);
    }
    function anonymizeTransportCapture(capture, byName) {
        if (!capture.data) {
            return { capture: Object.assign({}, capture), removedOpaquePayload: false };
        }
        if (capture.encoding === 'text' || capture.encoding === 'json') {
            return {
                capture: Object.assign(Object.assign({}, capture), { data: replacePlayerNames(capture.data, byName) }),
                removedOpaquePayload: false,
            };
        }
        if (capture.encoding === 'base64' && !capture.truncated) {
            try {
                const decoded = decode(base64ToBytes(capture.data));
                const redacted = redactUnknown(decoded, byName);
                const redactedBytes = encode(redacted);
                return {
                    capture: Object.assign(Object.assign({}, capture), { data: bytesToBase64(redactedBytes), byteLength: redactedBytes.byteLength }),
                    removedOpaquePayload: false,
                };
            }
            catch (_a) {
                // Colonist's outbound protocol includes framing that is not a standalone
                // MessagePack value. Do not leak an uninspected payload into an export.
            }
        }
        return {
            capture: Object.assign(Object.assign({}, capture), { encoding: 'none', data: null }),
            removedOpaquePayload: true,
        };
    }
    /** Create an anonymous export without mutating the live/resumable game log. */
    function anonymizeGameLog(log) {
        var _a;
        const aliases = buildPlayerAliases(log);
        let opaqueTransportPayloadsRemoved = 0;
        const transportCaptures = log.transportCaptures.map(original => {
            const result = anonymizeTransportCapture(original, aliases.byName);
            if (result.removedOpaquePayload)
                opaqueTransportPayloadsRemoved++;
            return result.capture;
        });
        return Object.assign(Object.assign({}, log), { schemaVersion: 6, youPlayerName: log.youPlayerName
                ? ((_a = aliases.byName.get(log.youPlayerName)) !== null && _a !== void 0 ? _a : null)
                : null, players: aliases.aliasesInOrder, messages: log.messages.map(message => (Object.assign(Object.assign({}, message), { text: replacePlayerNames(message.text, aliases.byName), html: replacePlayerNames(message.html, aliases.byName) }))), transportCaptures, spatialCapture: redactUnknown(log.spatialCapture, aliases.byName), anonymization: {
                playerNames: 'placement-order',
                opaqueTransportPayloadsRemoved,
            } });
    }

    const TRADE_PATTERN = /\b(wants to give|proposed counter offer|gave .+ got|traded with|accepted .+ offer)\b/i;
    const GAME_EVENT_PATTERN = /\b(placed|built|rolled|got|received|bought|used|played|stole|discarded|moved robber|has disconnected|has reconnected|is inactive|took from bank|won the game)\b/i;
    function decodeHtmlEntities(value) {
        const named = {
            amp: '&',
            lt: '<',
            gt: '>',
            quot: '"',
            apos: "'",
            '#039': "'",
        };
        return value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, code) => {
            var _a, _b;
            if (code[0] !== '#')
                return (_a = named[code.toLowerCase()]) !== null && _a !== void 0 ? _a : entity;
            const radix = ((_b = code[1]) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === 'x' ? 16 : 10;
            const digits = radix === 16 ? code.slice(2) : code.slice(1);
            const value = Number.parseInt(digits, radix);
            return Number.isFinite(value) ? String.fromCodePoint(value) : entity;
        });
    }
    function extractRichText(html, fallbackText) {
        const iconAlts = [];
        const withIcons = html.replace(/<img\b[^>]*\balt=(?:"([^"]*)"|'([^']*)')[^>]*>/gi, (_match, doubleQuoted, singleQuoted) => {
            var _a;
            const alt = decodeHtmlEntities((_a = doubleQuoted !== null && doubleQuoted !== void 0 ? doubleQuoted : singleQuoted) !== null && _a !== void 0 ? _a : '').trim();
            if (/^(player avatar|bot)$/i.test(alt))
                return ' ';
            if (alt)
                iconAlts.push(alt);
            return alt ? ` [${alt}] ` : ' ';
        });
        const richText = decodeHtmlEntities(withIcons
            .replace(/<hr\b[^>]*>/gi, ' ')
            .replace(/<br\s*\/?\s*>/gi, '\n')
            .replace(/<[^>]+>/g, ' '))
            .replace(/[ \t]+/g, ' ')
            .replace(/ *\n */g, '\n')
            .trim();
        return { richText: richText || fallbackText, iconAlts };
    }
    function findSpeaker(richText, players) {
        var _a;
        return ((_a = [...players]
            .filter(player => player.name)
            .sort((a, b) => b.name.length - a.name.length)
            .find(player => richText === player.name ||
            richText.startsWith(`${player.name} `) ||
            richText.startsWith(`${player.name}:`) ||
            richText.startsWith(`${player.name} -`))) !== null && _a !== void 0 ? _a : null);
    }
    function classifyMessage(message, speaker, richText) {
        if (!message.text && /<hr\b/i.test(message.html))
            return 'separator';
        if (speaker && TRADE_PATTERN.test(richText))
            return 'trade-offer';
        if (speaker && GAME_EVENT_PATTERN.test(richText))
            return 'game-event';
        if (speaker)
            return 'player-chat';
        return 'system';
    }
    function findColorMentions(richText, players) {
        const mentions = [];
        for (const player of players) {
            if (player.color === null || player.colorName === 'unknown')
                continue;
            const pattern = new RegExp(`\\b${player.colorName}\\b`, 'i');
            if (pattern.test(richText) &&
                !mentions.some(mention => mention.playerColor === player.color)) {
                mentions.push({
                    colorName: player.colorName,
                    playerName: player.name,
                    playerColor: player.color,
                });
            }
        }
        return mentions;
    }
    /** Normalize the complete Colonist feed without discarding its original rows. */
    function normalizeChatLog(messages, players) {
        return [...messages]
            .sort((a, b) => a.index - b.index)
            .map(message => {
            var _a, _b, _c;
            const { richText, iconAlts } = extractRichText(message.html, message.text);
            const speaker = findSpeaker(richText, players);
            const speakerless = speaker
                ? richText
                    .slice(speaker.name.length)
                    .replace(/^\s*(?::|-)\s*/, '')
                    .trim()
                : richText;
            return {
                index: message.index,
                kind: classifyMessage(message, speaker, richText),
                speakerName: (_a = speaker === null || speaker === void 0 ? void 0 : speaker.name) !== null && _a !== void 0 ? _a : null,
                speakerColor: (_b = speaker === null || speaker === void 0 ? void 0 : speaker.color) !== null && _b !== void 0 ? _b : null,
                speakerColorName: (_c = speaker === null || speaker === void 0 ? void 0 : speaker.colorName) !== null && _c !== void 0 ? _c : null,
                colorMentions: findColorMentions(richText, players),
                text: message.text,
                richText,
                message: speakerless,
                iconAlts,
                loggedAt: message.loggedAt,
            };
        });
    }

    // These codes were verified against the live protocol and rendered chat
    // colors. Unobserved/custom codes stay "unknown" rather than being guessed.
    const PLAYER_COLOR_NAMES = {
        1: 'red',
        2: 'blue',
        3: 'orange',
        9: 'black',
    };
    function getPlayerColorName(colorCode) {
        var _a;
        return (_a = PLAYER_COLOR_NAMES[colorCode]) !== null && _a !== void 0 ? _a : 'unknown';
    }

    const TERRAIN_TYPES = {
        0: 'desert',
        1: 'lumber',
        2: 'brick',
        3: 'wool',
        4: 'grain',
        5: 'ore',
    };
    const PORT_TYPES = {
        1: 'generic',
        2: 'lumber',
        3: 'brick',
        4: 'wool',
        5: 'grain',
        6: 'ore',
    };
    function isRecord$1(value) {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
    function numberValue(value) {
        return typeof value === 'number' && Number.isFinite(value) ? value : null;
    }
    function sortedNumericEntries(value) {
        if (!isRecord$1(value))
            return [];
        return Object.entries(value)
            .map(([id, state]) => [Number(id), state])
            .filter((entry) => Number.isSafeInteger(entry[0]) && isRecord$1(entry[1]))
            .sort((a, b) => a[0] - b[0]);
    }
    function buildingName(code) {
        if (code === 1)
            return 'settlement';
        if (code === 2)
            return 'city';
        return 'unknown';
    }
    function decodeIncomingCapture(capture) {
        if (capture.direction !== 'incoming' ||
            capture.event !== 'message' ||
            capture.encoding !== 'base64' ||
            !capture.data)
            return null;
        const binary = window.atob(capture.data);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) {
            bytes[index] = binary.charCodeAt(index);
        }
        const decoded = decode(bytes);
        return isRecord$1(decoded) ? decoded : null;
    }
    /**
     * Incrementally turns Colonist's inbound MessagePack snapshots/diffs into a
     * stable spatial board model. Numeric protocol codes are retained beside the
     * friendly names so future Colonist changes remain diagnosable.
     */
    class SpatialGameTracker {
        constructor() {
            this.board = null;
            this.events = [];
            this.decodedIncomingCaptures = 0;
            this.decodeFailures = 0;
        }
        reset() {
            this.board = null;
            this.events.length = 0;
            this.decodedIncomingCaptures = 0;
            this.decodeFailures = 0;
        }
        ingest(capture) {
            var _a;
            let envelope;
            try {
                envelope = decodeIncomingCapture(capture);
            }
            catch (_b) {
                if (capture.direction === 'incoming' &&
                    capture.event === 'message' &&
                    capture.encoding === 'base64') {
                    this.decodeFailures++;
                }
                return;
            }
            if (!envelope)
                return;
            this.decodedIncomingCaptures++;
            const data = isRecord$1(envelope.data) ? envelope.data : null;
            if (!data)
                return;
            const messageType = numberValue(data.type);
            const protocolSequence = (_a = numberValue(data.sequence)) !== null && _a !== void 0 ? _a : -1;
            if (messageType === 4 && isRecord$1(data.payload)) {
                this.applyFullSnapshot(data.payload, capture.capturedAt, protocolSequence);
                return;
            }
            if (messageType === 91 && isRecord$1(data.payload)) {
                const diff = isRecord$1(data.payload.diff) ? data.payload.diff : null;
                if (diff)
                    this.applyDiff(diff, capture.capturedAt, protocolSequence);
            }
        }
        snapshot() {
            return {
                board: this.board,
                events: [...this.events],
                chatLog: [],
                decodedIncomingCaptures: this.decodedIncomingCaptures,
                decodeFailures: this.decodeFailures,
            };
        }
        applyFullSnapshot(payload, capturedAt, protocolSequence) {
            var _a;
            const gameState = isRecord$1(payload.gameState) ? payload.gameState : null;
            const mapState = gameState && isRecord$1(gameState.mapState) ? gameState.mapState : null;
            if (!mapState)
                return;
            const hexes = sortedNumericEntries(mapState.tileHexStates).map(([id, state]) => {
                var _a, _b, _c, _d, _e;
                const terrainCode = (_a = numberValue(state.type)) !== null && _a !== void 0 ? _a : -1;
                return {
                    id,
                    x: (_b = numberValue(state.x)) !== null && _b !== void 0 ? _b : 0,
                    y: (_c = numberValue(state.y)) !== null && _c !== void 0 ? _c : 0,
                    terrain: (_d = TERRAIN_TYPES[terrainCode]) !== null && _d !== void 0 ? _d : 'unknown',
                    terrainCode,
                    diceNumber: (_e = numberValue(state.diceNumber)) !== null && _e !== void 0 ? _e : 0,
                };
            });
            const corners = sortedNumericEntries(mapState.tileCornerStates).map(([id, state]) => this.toCorner(id, state));
            const edges = sortedNumericEntries(mapState.tileEdgeStates).map(([id, state]) => this.toEdge(id, state));
            const ports = sortedNumericEntries(mapState.portEdgeStates).map(([id, state]) => {
                var _a, _b, _c, _d, _e;
                const portCode = (_a = numberValue(state.type)) !== null && _a !== void 0 ? _a : -1;
                return {
                    id,
                    x: (_b = numberValue(state.x)) !== null && _b !== void 0 ? _b : 0,
                    y: (_c = numberValue(state.y)) !== null && _c !== void 0 ? _c : 0,
                    z: (_d = numberValue(state.z)) !== null && _d !== void 0 ? _d : 0,
                    port: (_e = PORT_TYPES[portCode]) !== null && _e !== void 0 ? _e : 'unknown',
                    portCode,
                };
            });
            const robberState = isRecord$1(gameState === null || gameState === void 0 ? void 0 : gameState.mechanicRobberState)
                ? gameState.mechanicRobberState
                : null;
            const users = Array.isArray(payload.playerUserStates)
                ? payload.playerUserStates
                : [];
            const players = users.filter(isRecord$1).map((user) => {
                var _a, _b;
                return ({
                    color: (_a = numberValue(user.selectedColor)) !== null && _a !== void 0 ? _a : -1,
                    colorName: getPlayerColorName((_b = numberValue(user.selectedColor)) !== null && _b !== void 0 ? _b : -1),
                    username: typeof user.username === 'string' ? user.username : 'unknown',
                    isBot: user.isBot === true,
                });
            });
            const capturingPlayerColor = (_a = numberValue(payload.playerColor)) !== null && _a !== void 0 ? _a : -1;
            this.board = {
                source: 'colonist-msgpack',
                capturedAt,
                protocolSequence,
                capturingPlayerColor,
                capturingPlayerColorName: getPlayerColorName(capturingPlayerColor),
                playOrder: Array.isArray(payload.playOrder)
                    ? payload.playOrder.filter((color) => typeof color === 'number')
                    : [],
                players,
                hexes,
                corners,
                edges,
                ports,
                robberHexId: numberValue(robberState === null || robberState === void 0 ? void 0 : robberState.locationTileIndex),
            };
        }
        applyDiff(diff, capturedAt, protocolSequence) {
            if (!this.board)
                return;
            const mapState = isRecord$1(diff.mapState) ? diff.mapState : null;
            for (const [id, patch] of sortedNumericEntries(mapState === null || mapState === void 0 ? void 0 : mapState.tileCornerStates)) {
                const corner = this.board.corners.find(item => item.id === id);
                if (!corner)
                    continue;
                const previousBuildingCode = corner.buildingCode;
                const ownerColor = numberValue(patch.owner);
                const buildingCode = numberValue(patch.buildingType);
                if (ownerColor !== null)
                    corner.ownerColor = ownerColor;
                if (buildingCode !== null) {
                    corner.buildingCode = buildingCode;
                    corner.building = buildingName(buildingCode);
                }
                if (ownerColor !== null &&
                    (buildingCode === 1 || buildingCode === 2) &&
                    previousBuildingCode !== buildingCode) {
                    this.events.push({
                        kind: buildingCode === 2 ? 'city-built' : 'settlement-placed',
                        capturedAt,
                        protocolSequence,
                        playerColor: ownerColor,
                        cornerId: id,
                        buildingCode,
                    });
                }
            }
            for (const [id, patch] of sortedNumericEntries(mapState === null || mapState === void 0 ? void 0 : mapState.tileEdgeStates)) {
                const edge = this.board.edges.find(item => item.id === id);
                if (!edge)
                    continue;
                const previousOwner = edge.ownerColor;
                const ownerColor = numberValue(patch.owner);
                const roadCode = numberValue(patch.type);
                if (ownerColor !== null)
                    edge.ownerColor = ownerColor;
                if (roadCode !== null)
                    edge.roadCode = roadCode;
                if (ownerColor !== null && previousOwner !== ownerColor) {
                    this.events.push({
                        kind: 'road-placed',
                        capturedAt,
                        protocolSequence,
                        playerColor: ownerColor,
                        edgeId: id,
                        roadCode: roadCode !== null && roadCode !== void 0 ? roadCode : -1,
                    });
                }
            }
            const robberState = isRecord$1(diff.mechanicRobberState)
                ? diff.mechanicRobberState
                : null;
            const robberHexId = numberValue(robberState === null || robberState === void 0 ? void 0 : robberState.locationTileIndex);
            if (robberHexId !== null && robberHexId !== this.board.robberHexId) {
                this.board.robberHexId = robberHexId;
                this.events.push({
                    kind: 'robber-moved',
                    capturedAt,
                    protocolSequence,
                    hexId: robberHexId,
                });
            }
        }
        toCorner(id, state) {
            var _a, _b, _c;
            const buildingCode = numberValue(state.buildingType);
            const ownerColor = numberValue(state.owner);
            return Object.assign(Object.assign({ id, x: (_a = numberValue(state.x)) !== null && _a !== void 0 ? _a : 0, y: (_b = numberValue(state.y)) !== null && _b !== void 0 ? _b : 0, z: (_c = numberValue(state.z)) !== null && _c !== void 0 ? _c : 0 }, (ownerColor === null ? {} : { ownerColor })), (buildingCode === null
                ? {}
                : { buildingCode, building: buildingName(buildingCode) }));
        }
        toEdge(id, state) {
            var _a, _b, _c;
            const ownerColor = numberValue(state.owner);
            const roadCode = numberValue(state.type);
            return Object.assign(Object.assign({ id, x: (_a = numberValue(state.x)) !== null && _a !== void 0 ? _a : 0, y: (_b = numberValue(state.y)) !== null && _b !== void 0 ? _b : 0, z: (_c = numberValue(state.z)) !== null && _c !== void 0 ? _c : 0 }, (ownerColor === null ? {} : { ownerColor })), (roadCode === null ? {} : { roadCode }));
        }
    }

    // messageLogger.ts
    const STORAGE_KEY_PREFIX = 'catanGameLog:';
    const PERSIST_DEBOUNCE_MS = 1000;
    const MAX_TRANSPORT_CAPTURES_PER_GAME = 20000;
    const MAX_TRANSPORT_CAPTURE_DATA_PER_GAME = 50000000;
    const MAX_PENDING_TRANSPORT_CAPTURES = 2000;
    const MAX_PENDING_TRANSPORT_DATA = 10000000;
    let currentLog = null;
    const seenIndices = new Set();
    const seenTransportCaptureIds = new Set();
    const pendingTransportCaptures = [];
    let currentTransportCaptureDataLength = 0;
    let pendingTransportCaptureDataLength = 0;
    let persistTimer = null;
    const spatialGameTracker = new SpatialGameTracker();
    function withNormalizedChat(snapshot, messages, playerNames) {
        var _a, _b;
        const knownPlayers = new Map();
        for (const player of (_b = (_a = snapshot.board) === null || _a === void 0 ? void 0 : _a.players) !== null && _b !== void 0 ? _b : []) {
            knownPlayers.set(player.username, {
                name: player.username,
                color: player.color,
                colorName: player.colorName,
            });
        }
        for (const name of playerNames) {
            if (!knownPlayers.has(name)) {
                knownPlayers.set(name, {
                    name,
                    color: null,
                    colorName: getPlayerColorName(-1),
                });
            }
        }
        snapshot.chatLog = normalizeChatLog(messages, [...knownPlayers.values()]);
        return snapshot;
    }
    function storageAvailable() {
        var _a;
        return typeof chrome !== 'undefined' && !!((_a = chrome === null || chrome === void 0 ? void 0 : chrome.storage) === null || _a === void 0 ? void 0 : _a.local);
    }
    function getGameIdFromUrl() {
        const hash = window.location.hash.replace(/^#/, '');
        return hash || 'unknown';
    }
    /**
     * Start (or resume) logging for the game identified by the current URL. If a
     * log for this game already exists in chrome.storage.local (e.g. after a page
     * refresh), it is loaded and new messages are merged into it.
     */
    function initMessageLogger() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const gameId = getGameIdFromUrl();
            const now = new Date().toISOString();
            spatialGameTracker.reset();
            currentLog = {
                schemaVersion: 5,
                gameId,
                url: window.location.href,
                startedAt: now,
                updatedAt: now,
                youPlayerName: null,
                players: [],
                messages: [],
                transportCaptures: [],
                droppedTransportCaptures: 0,
                spatialCapture: spatialGameTracker.snapshot(),
            };
            seenIndices.clear();
            seenTransportCaptureIds.clear();
            currentTransportCaptureDataLength = 0;
            if (storageAvailable()) {
                try {
                    const key = STORAGE_KEY_PREFIX + gameId;
                    const stored = yield chrome.storage.local.get(key);
                    const existing = stored[key];
                    if (existing === null || existing === void 0 ? void 0 : existing.messages) {
                        // Older logs progressively added transport and spatial state. Upgrade
                        // them in memory without discarding any previously captured data.
                        currentLog = Object.assign(Object.assign({}, existing), { schemaVersion: 5, updatedAt: now, transportCaptures: Array.isArray(existing.transportCaptures)
                                ? existing.transportCaptures
                                : [], droppedTransportCaptures: typeof existing.droppedTransportCaptures === 'number'
                                ? existing.droppedTransportCaptures
                                : 0, spatialCapture: spatialGameTracker.snapshot() });
                        for (const message of currentLog.messages) {
                            seenIndices.add(message.index);
                        }
                        for (const capture of currentLog.transportCaptures) {
                            seenTransportCaptureIds.add(capture.id);
                            currentTransportCaptureDataLength += (_b = (_a = capture.data) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
                            spatialGameTracker.ingest(capture);
                        }
                        currentLog.spatialCapture = withNormalizedChat(spatialGameTracker.snapshot(), currentLog.messages, currentLog.players);
                        console.log(`📼 Resumed game log for "${gameId}" (${currentLog.messages.length} messages)`);
                    }
                }
                catch (error) {
                    console.warn('📼 Could not load stored game log:', error);
                }
            }
            // The transport hook starts at document_start, before the chat (and thus the
            // game logger) exists. Merge that startup window after any stored log is
            // loaded so the initial board snapshot is not lost.
            const startupCaptures = pendingTransportCaptures.splice(0);
            pendingTransportCaptureDataLength = 0;
            for (const capture of startupCaptures)
                appendTransportCapture(capture);
            if (startupCaptures.length > 0) {
                console.log(`📡 Attached ${startupCaptures.length} startup transport captures to game "${gameId}"`);
                schedulePersist();
            }
        });
    }
    /**
     * Record one chat row. Safe to call repeatedly with the same element (history
     * replay re-renders overlapping windows) — rows are deduped by data-index.
     */
    function logChatMessage(element) {
        var _a, _b;
        if (!currentLog)
            return;
        const dataIndexAttr = element.getAttribute('data-index');
        if (dataIndexAttr === null)
            return;
        const index = parseInt(dataIndexAttr, 10);
        if (isNaN(index) || seenIndices.has(index))
            return;
        seenIndices.add(index);
        currentLog.messages.push({
            index,
            text: (_b = (_a = element.textContent) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '',
            html: element.outerHTML,
            loggedAt: new Date().toISOString(),
        });
        schedulePersist();
    }
    function appendTransportCapture(capture) {
        var _a, _b;
        if (!currentLog || seenTransportCaptureIds.has(capture.id))
            return;
        seenTransportCaptureIds.add(capture.id);
        const captureDataLength = (_b = (_a = capture.data) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        if (currentLog.transportCaptures.length >= MAX_TRANSPORT_CAPTURES_PER_GAME ||
            currentTransportCaptureDataLength + captureDataLength >
                MAX_TRANSPORT_CAPTURE_DATA_PER_GAME) {
            currentLog.droppedTransportCaptures++;
            return;
        }
        currentLog.transportCaptures.push(capture);
        currentTransportCaptureDataLength += captureDataLength;
        spatialGameTracker.ingest(capture);
    }
    /**
     * Record one capture from the MAIN-world WebSocket hook. Captures that arrive
     * before the chat initializes the per-game logger are held in a bounded memory
     * queue, which is critical for preserving Colonist's initial game snapshot.
     */
    function logTransportCapture(capture) {
        var _a, _b, _c, _d, _e;
        if (!currentLog) {
            const captureDataLength = (_b = (_a = capture.data) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
            while (pendingTransportCaptures.length > 0 &&
                (pendingTransportCaptures.length >= MAX_PENDING_TRANSPORT_CAPTURES ||
                    pendingTransportCaptureDataLength + captureDataLength >
                        MAX_PENDING_TRANSPORT_DATA)) {
                pendingTransportCaptureDataLength -=
                    (_e = (_d = (_c = pendingTransportCaptures.shift()) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0;
            }
            pendingTransportCaptures.push(capture);
            pendingTransportCaptureDataLength += captureDataLength;
            return;
        }
        const previousLength = currentLog.transportCaptures.length;
        const previousDropped = currentLog.droppedTransportCaptures;
        appendTransportCapture(capture);
        if (currentLog.transportCaptures.length !== previousLength ||
            currentLog.droppedTransportCaptures !== previousDropped) {
            schedulePersist();
        }
    }
    /** Refresh the metadata snapshot from live game state and keep messages sorted. */
    function snapshotMetadata(log) {
        log.updatedAt = new Date().toISOString();
        log.youPlayerName = game.youPlayerName;
        log.players = game.players.map(p => p.name);
        log.messages.sort((a, b) => a.index - b.index);
        log.transportCaptures.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt) ||
            a.pageSessionId.localeCompare(b.pageSessionId) ||
            a.sequence - b.sequence);
        log.spatialCapture = withNormalizedChat(spatialGameTracker.snapshot(), log.messages, log.players);
    }
    function schedulePersist() {
        if (!storageAvailable())
            return;
        if (persistTimer !== null)
            clearTimeout(persistTimer);
        persistTimer = setTimeout(() => {
            persistTimer = null;
            void persistCurrentLog();
        }, PERSIST_DEBOUNCE_MS);
    }
    function persistCurrentLog() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!currentLog || !storageAvailable())
                return;
            snapshotMetadata(currentLog);
            try {
                yield chrome.storage.local.set({
                    [STORAGE_KEY_PREFIX + currentLog.gameId]: currentLog,
                });
            }
            catch (error) {
                console.warn('📼 Could not persist game log:', error);
            }
        });
    }
    function downloadJson(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json',
        });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
    }
    function timestampSlug() {
        return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    }
    /**
     * Download the current game's log as a JSON file (wired to the overlay's 💾
     * button). Returns the exported log, or null when nothing has been captured.
     */
    function downloadCurrentGameLog() {
        if (!currentLog ||
            (currentLog.messages.length === 0 &&
                currentLog.transportCaptures.length === 0)) {
            console.warn('📼 No game data captured yet — nothing to download');
            return null;
        }
        snapshotMetadata(currentLog);
        const exportLog = anonymizeGameLog(currentLog);
        downloadJson(exportLog, `catan-game-${currentLog.gameId}-${timestampSlug()}.json`);
        return exportLog;
    }
    /**
     * Download every game log stored by this extension as one JSON file. Run from
     * the extension's content-script console context:
     *   __catanCounter.exportAllGameLogs()
     */
    function exportAllGameLogs() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!storageAvailable()) {
                console.warn('📼 chrome.storage is not available');
                return [];
            }
            const all = yield chrome.storage.local.get(null);
            const logs = Object.entries(all)
                .filter(([key]) => key.startsWith(STORAGE_KEY_PREFIX))
                .map(([, value]) => {
                const existing = value;
                const messages = Array.isArray(existing.messages)
                    ? existing.messages
                    : [];
                const players = Array.isArray(existing.players) ? existing.players : [];
                const transportCaptures = Array.isArray(existing.transportCaptures)
                    ? existing.transportCaptures
                    : [];
                const tracker = new SpatialGameTracker();
                for (const capture of transportCaptures)
                    tracker.ingest(capture);
                const spatialCapture = withNormalizedChat(tracker.snapshot(), messages, players);
                return Object.assign(Object.assign({}, existing), { schemaVersion: 5, messages,
                    players,
                    transportCaptures, droppedTransportCaptures: typeof existing.droppedTransportCaptures === 'number'
                        ? existing.droppedTransportCaptures
                        : 0, spatialCapture });
            })
                .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
            if (logs.length === 0) {
                console.warn('📼 No stored game logs found');
                return [];
            }
            const exportLogs = logs.map(anonymizeGameLog);
            downloadJson(exportLogs, `catan-games-all-${timestampSlug()}.json`);
            return exportLogs;
        });
    }

    // =============================================================================
    // UTILITY FUNCTIONS
    // =============================================================================
    const RESOURCE_ICONS = {
        tree: 'tree.svg',
        brick: 'brick.svg',
        sheep: 'sheep.svg',
        wheat: 'wheat.svg',
        ore: 'ore.svg',
    };
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
    function formatResourceName(resource) {
        return String(resource).charAt(0).toUpperCase() + String(resource).slice(1);
    }
    /**
     * Get resource icon URL
     */
    function getResourceIconUrl(resource) {
        return chrome.runtime.getURL(`assets/${RESOURCE_ICONS[resource]}`);
    }
    /**
     * Create a modal backdrop element
     */
    function createModalBackdrop() {
        const backdrop = document.createElement('div');
        backdrop.style.cssText = STYLES.modalBackdrop;
        return backdrop;
    }
    /**
     * Create a modal dialog element
     */
    function createModalDialog() {
        const dialog = document.createElement('div');
        dialog.style.cssText = STYLES.modalDialog;
        return dialog;
    }
    /**
     * Create a resource button with icon and probability
     */
    function createResourceButton(resource, probability, onClick) {
        const button = document.createElement('button');
        button.setAttribute('data-resource', resource);
        button.style.cssText = `
    ${STYLES.primaryButton}
    display: flex;
    align-items: center;
    gap: 10px;
  `;
        const iconUrl = getResourceIconUrl(resource);
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
    function formatProbabilityText(resourceProbabilities) {
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
    let gameStateOverlay = null;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let isMinimized = false;
    let isResizing = false;
    let currentScale = 1;
    let resizeStartData = { x: 0, y: 0, scale: 1 };
    // True while content.ts is scrolling the chat to rebuild history after a page
    // load/refresh. The overlay shows a loader instead of (stale/partial) counts.
    let isLoadingHistory = false;
    function createGameStateOverlay() {
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
        if (!(header === null || header === void 0 ? void 0 : header.contains(target)) ||
            target.id === 'minimize-btn' ||
            target.id === 'save-log-btn')
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
    function getOrderedPlayers() {
        if (!game.youPlayerName) {
            return game.players;
        }
        const youPlayerIndex = game.players.findIndex(player => player.name === game.youPlayerName);
        if (youPlayerIndex === -1) {
            return game.players;
        }
        // Create ordered array: players after youPlayer, then players before youPlayer, then youPlayer
        const playersAfter = game.players.slice(youPlayerIndex + 1);
        const playersBefore = game.players.slice(0, youPlayerIndex);
        const youPlayer = game.players[youPlayerIndex];
        return [...playersAfter, ...playersBefore, youPlayer];
    }
    function generateResourceProbabilityTable() {
        if (!game.probableGameState || game.players.length === 0) {
            return '';
        }
        const resourceNames = ['tree', 'brick', 'sheep', 'wheat', 'ore'];
        const resourceColors = [
            '#38c61b22',
            '#cc7b6422',
            '#8fb50e22',
            '#f4bb2522',
            '#9fa4a122',
        ];
        let table = '<div style="margin-top: 15px;"><h4 style="margin: 0 0 10px 0; text-align: center;">Resource Probabilities</h4>';
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
            const probabilities = game.probableGameState.getPlayerResourceProbabilities(player.name);
            table += '<tr>';
            table += `<td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: ${player.color};">${player.name}</td>`;
            resourceNames.forEach((resource, index) => {
                const resourceKey = resource;
                const minCount = probabilities.minimumResources[resourceKey];
                const additionalProb = probabilities.additionalResourceProbabilities[resourceKey];
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
    function generateDevCardsDisplay() {
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
        const getDevCardIconUrl = (icon) => chrome.runtime.getURL(`assets/${icon}`);
        let display = '<div style="margin: 15px 0;">';
        display += `<h4 style="margin: 0 0 10px 0; text-align: center;">Development Cards Remaining: ${game.devCards}</h4>`;
        display +=
            '<div style="display: flex; justify-content: space-around; align-items: center; padding: 10px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e9ecef;">';
        devCardTypes.forEach(cardType => {
            const remaining = game[cardType.key];
            const total = cardType.key === 'knights'
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
    function generateBlockedDiceDisplay() {
        // Check if there are any blocked dice rolls
        const hasBlockedRolls = Object.keys(game.blockedDiceRolls).length > 0;
        if (!hasBlockedRolls) {
            return '';
        }
        let display = '<div style="margin: 15px 0;"><h4 style="margin: 0 0 10px 0; text-align: center;">🔒 Blocked by Robber</h4>';
        display +=
            '<div style="background: #f8f9fa; padding: 10px; border-radius: 6px; font-size: 12px; line-height: 1.4;">';
        // Collect all blocked entries
        const blockedEntries = [];
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
        const blockedTexts = blockedEntries.map(entry => `${entry.number} ${entry.resource}: ${entry.count}`);
        display += blockedTexts.join('<br>');
        display += '</div></div>';
        return display;
    }
    function generateUnknownTransactionsDisplay() {
        const unresolvedTransactions = game.probableGameState
            .getUnknownTransactions()
            .filter(t => !t.isResolved);
        if (unresolvedTransactions.length === 0) {
            return '';
        }
        let display = '<div style="margin: 15px 0; padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px;">';
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
            const transactionResourceProbabilities = game.probableGameState.getTransactionResourceProbabilities(transaction.id);
            if (transactionResourceProbabilities) {
                const probabilityText = formatProbabilityText(transactionResourceProbabilities);
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
    function showTransactionResolutionModal(transactionId) {
        const transaction = game.probableGameState.getUnknownTransaction(transactionId);
        if (!transaction) {
            console.error(`Transaction ${transactionId} not found`);
            return;
        }
        const transactionResourceProbabilities = game.probableGameState.getTransactionResourceProbabilities(transactionId);
        if (!transactionResourceProbabilities) {
            console.error(`No resource probabilities found for transaction ${transactionId}`);
            return;
        }
        // Get only the resources that are possible (probability > 0)
        const possibleResources = Object.entries(transactionResourceProbabilities)
            .filter(([_, probability]) => probability > 0)
            .sort(([_, a], [__, b]) => b - a); // Sort by probability descending
        if (possibleResources.length === 0) {
            console.error(`No possible resources found for transaction ${transactionId}`);
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
                resolveTransaction(transactionId, resource);
                document.body.removeChild(backdrop);
            });
            resourceButtonsContainer === null || resourceButtonsContainer === void 0 ? void 0 : resourceButtonsContainer.appendChild(button);
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
    function resolveTransaction(transactionId, resource) {
        const success = game.probableGameState.resolveUnknownTransaction(transactionId, resource);
        if (success) {
            console.log(`✅ Manually resolved transaction ${transactionId} with resource: ${resource}`);
            // Update the display to reflect the resolution
            updateGameStateDisplay();
        }
        else {
            console.error(`❌ Failed to resolve transaction ${transactionId} with resource: ${resource}`);
        }
    }
    function generateMainContent() {
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
    function generateLoadingContent() {
        return `
    <div style="
      text-align: center;
      padding: 40px 20px;
      color: #666;
      font-size: 14px;
      line-height: 1.5;
    ">
      <style>@keyframes catan-spin { to { transform: rotate(360deg); } }</style>
      <div class="catan-spinner" style="
        width: 40px;
        height: 40px;
        margin: 0 auto 18px;
        border: 4px solid #e0e0e0;
        border-top-color: #2c3e50;
        border-radius: 50%;
        animation: catan-spin 0.8s linear infinite;
      "></div>
      <div style="font-weight: bold; margin-bottom: 8px; color: #2c3e50;">
        Loading game history…
      </div>
      <div>
        Scrolling the chat and rebuilding resource counts.
      </div>
    </div>
  `;
    }
    function generateWaitingContent() {
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
    function updateOverlayContent(overlay) {
        const contentDisplay = isMinimized ? 'none' : 'block';
        const mainContent = isLoadingHistory
            ? generateLoadingContent()
            : game.hasRolledFirstDice
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
      <div style="display: flex; align-items: center; gap: 2px;">
        <button id="save-log-btn" style="
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 14px;
          padding: 2px 6px;
          border-radius: 3px;
        " title="Download this game's chat log as JSON">💾</button>
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
        const minimizeBtn = overlay.querySelector('#minimize-btn');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', e => {
                e.stopPropagation(); // Prevent dragging when clicking minimize
                toggleMinimize();
            });
        }
        // Add save-log button functionality
        const saveLogBtn = overlay.querySelector('#save-log-btn');
        if (saveLogBtn) {
            saveLogBtn.addEventListener('click', e => {
                e.stopPropagation(); // Prevent dragging when clicking save
                downloadCurrentGameLog();
            });
        }
        // Add event listeners for transaction items
        const transactionItems = overlay.querySelectorAll('.unknown-transaction-item');
        transactionItems.forEach(item => {
            item.addEventListener('click', e => {
                const transactionId = item.getAttribute('data-transaction-id');
                if (transactionId) {
                    showTransactionResolutionModal(transactionId);
                }
            });
        });
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
     * Toggle the "loading game history" state. While true the overlay shows a
     * spinner instead of the resource tables, since the counts are still being
     * rebuilt by scrolling the chat (see content.ts loadChatHistory).
     */
    function setHistoryLoading(loading) {
        isLoadingHistory = loading;
        if (gameStateOverlay) {
            updateOverlayContent(gameStateOverlay);
        }
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
      ${game.players
        .map(player => `
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
      `)
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

    /**
     * Handle a player discarding resources
     */
    function playerDiscard(playerName, discardedResources) {
        if (!playerName)
            return;
        // Remove resources from player (negative values, automatically adds to bank)
        const playerChanges = {};
        game.probableGameState.processTransaction({
            type: TransactionTypeEnum.RESOURCE_LOSS,
            playerName: playerName,
            resources: discardedResources,
        });
        Object.keys(discardedResources).forEach(resource => {
            const key = resource;
            const count = discardedResources[key];
            if (count && count > 0) {
                playerChanges[key] = -count;
            }
        });
        updateResources(playerName, playerChanges);
    }
    /**
     * Handle a player placing a settlement
     */
    function placeSettlement(playerName, color) {
        if (!playerName)
            return;
        ensurePlayerExists(playerName, color);
        const player = game.players.find(p => p.name === playerName);
        if (player && player.settlements > 0) {
            player.settlements--;
        }
    }
    /**
     * Handle a dice roll
     */
    function rollDice(diceTotal) {
        if (diceTotal >= 2 && diceTotal <= 12) {
            if (!game.hasRolledFirstDice) {
                game.hasRolledFirstDice = true;
                // setting up probable game state with all players
                game.probableGameState = new PropbableGameState(game.players);
                // Auto-detect current player on the first dice roll instead of showing popup
                if (!game.youPlayerName && game.players.length > 0) {
                    const success = autoDetectCurrentPlayer();
                    if (!success) {
                        console.log('⚠️ Could not auto-detect current player. Asking for manual selection.');
                        // Manually ask for player name
                        showYouPlayerDialog();
                    }
                }
            }
            game.diceRolls[diceTotal]++;
        }
    }
    /**
     * Handle a blocked dice roll where the robber prevents resource production
     */
    function blockedDiceRoll(diceNumber, resourceType) {
        if (diceNumber >= 2 && diceNumber <= 12) {
            // Initialize the dice number object if it doesn't exist
            if (!game.blockedDiceRolls[diceNumber]) {
                game.blockedDiceRolls[diceNumber] = {};
            }
            // Initialize the resource count if it doesn't exist
            if (!game.blockedDiceRolls[diceNumber][resourceType]) {
                game.blockedDiceRolls[diceNumber][resourceType] = 0;
            }
            // Increment the blocked count
            game.blockedDiceRolls[diceNumber][resourceType]++;
        }
    }
    /**
     * Handle a player placing inital road, no brick/tree spent
     */
    function placeInitialRoad(playerName) {
        if (!playerName)
            return;
        const player = game.players.find(p => p.name === playerName);
        if (player && player.roads > 0) {
            player.roads--;
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
        // add call to game probable processor to handle trade
        game.probableGameState.processTransaction({
            type: TransactionTypeEnum.TRADE,
            player1: playerName,
            player2: tradePartner,
            resourceChanges: resourceChanges,
        });
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
        // add call to game probable processor to handle resource gain
        game.probableGameState.processTransaction({
            type: TransactionTypeEnum.RESOURCE_GAIN,
            playerName: playerName,
            resources: resources,
        });
        updateResources(playerName, resources);
    }
    /**
     * Handle a known steal where we know what resource was stolen
     */
    function knownSteal(thief, victim, resource) {
        if (!thief || !victim)
            return;
        game.probableGameState.processTransaction({
            type: TransactionTypeEnum.ROBBER_STEAL,
            stealerName: thief,
            victimName: victim,
            stolenResource: resource,
        });
        updateResources(thief, { [resource]: 1 });
        updateResources(victim, { [resource]: -1 });
    }
    /**
     * Handle an unknown steal - tries to deduce the resource or records it as unknown
     */
    function unknownSteal(thief, victim) {
        if (!thief || !victim)
            return;
        // Check if victim has only one type of resource across ALL possible variants
        const victimProbabilities = game.probableGameState.getPlayerResourceProbabilities(victim);
        // Count how many resource types the victim could possibly have
        const possibleResourceTypes = Object.entries(victimProbabilities.minimumResources)
            .filter(([_, count]) => count > 0)
            .concat(Object.entries(victimProbabilities.additionalResourceProbabilities).filter(([_, probability]) => probability > 0));
        // Remove duplicates by converting to Set and back
        const uniqueResourceTypes = [
            ...new Set(possibleResourceTypes.map(([resourceType]) => resourceType)),
        ];
        if (uniqueResourceTypes.length === 1) {
            // Victim has only one type of resource - we can deduce what was stolen
            const resourceType = uniqueResourceTypes[0];
            knownSteal(thief, victim, resourceType);
        }
        else {
            // Unknown steal - we don't know what resource was stolen
            game.probableGameState.processTransaction({
                type: TransactionTypeEnum.ROBBER_STEAL,
                stealerName: thief,
                victimName: victim,
                stolenResource: null,
            });
        }
    }
    /**
     * Handle a player buying a development card
     */
    function buyDevCard(playerName) {
        if (!playerName)
            return;
        game.probableGameState.processTransaction({
            type: TransactionTypeEnum.RESOURCE_LOSS,
            playerName: playerName,
            resources: { wheat: 1, sheep: 1, ore: 1 },
        });
        game.devCards--;
        updateResources(playerName, { wheat: -1, sheep: -1, ore: -1 });
    }
    /**
     * Handle a player trading with the bank
     */
    function bankTrade(playerName, resourceChanges) {
        if (!playerName)
            return;
        // Validate that there are actual resource changes
        const hasChanges = Object.values(resourceChanges).some(count => count && count !== 0);
        if (!hasChanges)
            return;
        // Process the bank trade as a single transaction
        game.probableGameState.processTransaction({
            type: TransactionTypeEnum.BANK_TRADE,
            playerName: playerName,
            resourceChanges: resourceChanges,
        });
        updateResources(playerName, resourceChanges);
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
            player.discoveryCards.knights++;
            game.knights--;
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
            game.probableGameState.processTransaction({
                type: TransactionTypeEnum.RESOURCE_LOSS,
                playerName: playerName,
                resources: { tree: 1, wheat: 1, brick: 1, sheep: 1 },
            });
            updateResources(playerName, {
                tree: -1,
                wheat: -1,
                brick: -1,
                sheep: -1,
            });
            player.settlements--;
            player.victoryPoints++;
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
            game.probableGameState.processTransaction({
                type: TransactionTypeEnum.RESOURCE_LOSS,
                playerName: playerName,
                resources: { ore: 3, wheat: 2 },
            });
            updateResources(playerName, { ore: -3, wheat: -2 });
            player.cities--;
            player.settlements++; // City replaces settlement
            player.victoryPoints++;
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
            game.probableGameState.processTransaction({
                type: TransactionTypeEnum.RESOURCE_LOSS,
                playerName: playerName,
                resources: { tree: 1, brick: 1 },
            });
            updateResources(playerName, { tree: -1, brick: -1 });
            player.roads--;
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
            player.discoveryCards.yearOfPlenties++;
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
        game.probableGameState.processTransaction({
            type: TransactionTypeEnum.RESOURCE_GAIN,
            playerName: playerName,
            resources: resources,
        });
        updateResources(playerName, resources);
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
            player.discoveryCards.roadBuilders++;
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
            player.discoveryCards.monopolies++;
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
        game.probableGameState.processTransaction({
            type: TransactionTypeEnum.MONOPOLY,
            playerName: playerName,
            resourceType: resourceType,
            totalStolen: totalStolen,
        });
        // Add the actual stolen amount to monopoly player (directly, not via updateResources)
        monopolyPlayer.resources[resourceType] += actualStolen;
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
        game.probableGameState.processTransaction({
            type: TransactionTypeEnum.TRADE_OFFER,
            playerName: playerName,
            offeredResources: offeredResources,
        });
    }
    /**
     * Handle a player stealing a specific resource from the current player
     */
    function stealFromYou(thief, victim, stolenResource) {
        if (!thief || !victim)
            return;
        game.probableGameState.processTransaction({
            type: TransactionTypeEnum.ROBBER_STEAL,
            stealerName: thief,
            victimName: victim,
            stolenResource: stolenResource,
        });
        // Transfer resource from victim to thief
        updateResources(thief, { [stolenResource]: 1 });
        updateResources(victim, { [stolenResource]: -1 });
        console.log(`🦹 ${thief} stole ${stolenResource} from you (${victim})`);
    }

    /**
     * Check if an element should be ignored (not processed)
     */
    function ignoreElement(element, messageText) {
        return (
        // Disconnection messages
        messageText.includes('has disconnected') ||
            messageText.includes('will take over') ||
            messageText.includes('left the game') ||
            // Reconnection messages
            messageText.includes('has reconnected') ||
            // HR elements
            element.querySelector('hr') !== null ||
            // Learn how to play messages
            messageText.includes('Learn how to play'));
    }
    /**
     * Checks if an element represents a duplicate chat message
     * This can be solved in a greedy fashion by checking the chat number (data-index attribute) against the last processed chat number in game state
     */
    function checkDuplicateElement(element) {
        // Get ID from the element
        const dataIndexAttr = element.attributes.getNamedItem('data-index');
        // If no data-index attribute, treat as duplicate to be safe
        if (!dataIndexAttr)
            return true;
        const chatNumber = parseInt(dataIndexAttr.value);
        // Skip if this chat number has already been processed. Uses <= (not <) so the
        // boundary message isn't re-counted when the virtual scroller re-renders it in
        // an overlapping window during history loading. game.chatsProcessed starts at
        // -1 so the first message (data-index 0) is still processed.
        if (chatNumber <= game.chatsProcessed) {
            console.log(`⏭️ Skipping already processed chat #${chatNumber}`);
            return true;
        }
        // Update the last processed chat number
        game.chatsProcessed = chatNumber;
        return false;
    }
    /**
     * Refine the variant tree using the live per-player hand counts shown in
     * colonist's player-information panel (see domUtils.getPlayerCardCounts). This
     * resolves steals the chat alone can't — e.g. after a monopoly. Call it only for
     * live messages, NOT during history replay (the panel reflects the present, not
     * the replayed past). Safe to call anytime: pruneByHandCounts no-ops unless the
     * counts strictly discriminate between current variants.
     */
    function applyHandCountResolution() {
        const names = game.players.map(p => p.name);
        if (names.length === 0)
            return;
        const counts = getPlayerCardCounts(names);
        if (Object.keys(counts).length > 0) {
            game.probableGameState.pruneByHandCounts(counts);
        }
    }
    function updateGameFromChat(element) {
        var _a, _b;
        // If we're waiting for "you" player selection, don't process new messages
        if (isWaitingForYouPlayerSelection)
            return;
        const messageText = ((_a = element.textContent) === null || _a === void 0 ? void 0 : _a.replace(/\s+/g, ' ').trim()) || '';
        if (ignoreElement(element, messageText))
            return;
        if (checkDuplicateElement(element))
            return;
        let playerName = getPlayerName(element);
        // "You stole X from Y" names the victim but not the thief, and the thief is
        // always the current player. This previously read the name off the previous
        // chat row, assuming it was that player's "moved Robber" message — but any
        // message can land in between (another player building, buying a dev card),
        // in which case the steal was credited to the wrong player entirely.
        if (messageText.includes('You stole') && messageText.includes('from')) {
            playerName = (_b = game.youPlayerName) !== null && _b !== void 0 ? _b : playerName;
        }
        // Scenario 0: Handle "[Player] stole [resource] from you" scenario
        if (messageText.includes('stole') && messageText.includes('from you')) {
            const stolenResource = getResourceType(element);
            if (stolenResource) {
                stealFromYou(playerName, game.youPlayerName, stolenResource);
            }
        }
        // Scenario 1: Place settlement (keyword: "placed a")
        else if (messageText.includes('placed a') &&
            element.querySelector('img[alt="settlement"], img[alt="Settlement"]')) {
            placeSettlement(playerName, getPlayerColor(element));
        }
        // Scenario 2: Roll dice (keyword: "rolled")
        else if (messageText.includes('rolled')) {
            const diceTotal = getDiceRollTotal(element);
            if (diceTotal) {
                rollDice(diceTotal);
            }
        }
        // Scenario 2.5: Blocked dice (keyword: "is blocked by the Robber")
        else if (messageText.includes('blocked by the Robber')) {
            const diceNumber = getBlockedDiceNumber(element);
            const resourceType = getBlockedResourceType(element);
            if (diceNumber !== null && resourceType) {
                blockedDiceRoll(diceNumber, resourceType);
            }
        }
        // Scenario 3: Place road (keyword: "placed a" + road image)
        else if (messageText.includes('placed a') &&
            element.querySelector('img[alt="road"], img[alt="Road"]')) {
            placeInitialRoad(playerName);
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
            const gotResources = getResourcesFromImages(element);
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
            element.querySelector('img[alt="development card"], img[alt="Development card"], img[alt="Development Card"]')) {
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
            element.querySelector('img[alt="settlement"], img[alt="Settlement"]')) {
            buildSettlement(playerName);
        }
        // Scenario 11: Build city (keyword: "built a" + city image)
        else if (messageText.includes('built a') &&
            element.querySelector('img[alt="city"], img[alt="City"]')) {
            buildCity(playerName);
        }
        // Scenario 12: Build road (keyword: "built a" + road image)
        else if (messageText.includes('built a') &&
            element.querySelector('img[alt="road"], img[alt="Road"]')) {
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
            const takenResources = getResourcesFromImages(element);
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
            const startingResources = getResourcesFromImages(element);
            receiveStartingResources(playerName, startingResources);
        }
        // Scenario 20: Wants to give (can resolve unknown transactions)
        else if (messageText.includes('wants to give')) {
            const offeredResources = getResourcesFromImages(element, ' for ');
            playerOffer(playerName, offeredResources);
        }
        // Scenario 21: Discards (keyword: "discarded")
        else if (messageText.includes('discarded')) {
            const discardedResources = getResourcesFromImages(element);
            playerDiscard(playerName, discardedResources);
        }
        // Scenario 22: Proposed counter offer
        else if (messageText.includes('proposed counter offer to')) {
            const offeredResources = parseCounterOfferResources(element);
            playerOffer(playerName, offeredResources);
        }
        // Scenario 23: log game history when game is over
        else if (messageText.includes('won the game!')) {
            console.log(game.probableGameState.getTransactionHistory());
        }
        // Log any unknown messages
        else {
            console.log('💬💬💬  New unknown message:', element);
        }
        updateGameStateDisplay();
    }

    // messageOrderBuffer.ts
    // Guarantees chat rows are handed to the parser in strict data-index order.
    //
    // The parser's dedup (game.chatsProcessed) is a monotonic high-water mark, so
    // processing row 244 before rows 68–243 locks the earlier rows out FOREVER —
    // this is why dice/resource stats never caught up after a reconnect, where
    // colonist's virtual scroller can render the bottom of the chat before the
    // history sweep has covered the middle. This buffer captures rows in whatever
    // order they render and only feeds the parser the contiguous prefix; rows
    // after a gap wait until the gap fills (or until flush() gives up on it).
    //
    // Rows are captured as deep clones: virtual scrollers recycle DOM nodes, so a
    // held reference may be rewritten to show a different message by the time the
    // gap before it fills.
    class MessageOrderBuffer {
        constructor(processRow) {
            this.processRow = processRow;
            this.pending = new Map();
            this.lastProcessed = -1;
        }
        /**
         * Buffer one rendered chat row. Safe to call repeatedly with the same row
         * (dedups by data-index); rows at or below the high-water mark are ignored.
         */
        capture(element) {
            const dataIndexAttr = element.getAttribute('data-index');
            if (dataIndexAttr === null)
                return;
            const index = parseInt(dataIndexAttr, 10);
            if (isNaN(index) || index <= this.lastProcessed || this.pending.has(index))
                return;
            this.pending.set(index, element.cloneNode(true));
        }
        /**
         * Process the contiguous run of buffered rows starting right after the last
         * processed index. Stops at the first gap. Returns how many were processed.
         */
        drain() {
            let count = 0;
            while (this.pending.has(this.lastProcessed + 1)) {
                const element = this.pending.get(this.lastProcessed + 1);
                this.pending.delete(this.lastProcessed + 1);
                this.lastProcessed++;
                this.processRow(element);
                count++;
            }
            return count;
        }
        /**
         * Process everything still buffered in ascending order, accepting gaps.
         * Call once history loading has done its best — rows lost to a gap can't be
         * recovered, but everything captured after the gap still counts.
         */
        flush() {
            const indices = Array.from(this.pending.keys()).sort((a, b) => a - b);
            for (const index of indices) {
                const element = this.pending.get(index);
                this.pending.delete(index);
                this.lastProcessed = Math.max(this.lastProcessed, index);
                this.processRow(element);
            }
            return indices.length;
        }
        /** True when captured rows are stuck behind a gap (drain can't reach them). */
        hasPending() {
            return this.pending.size > 0;
        }
    }

    /**
     * Types and bridge code for the Colonist transport-capture POC.
     *
     * `pageTransportHook.ts` runs in the page's MAIN JavaScript world so it can
     * observe WebSocket traffic. This module runs in the extension's ISOLATED
     * world, validates messages crossing the window.postMessage boundary, and
     * forwards them to the game logger.
     */
    const PAGE_TRANSPORT_SOURCE = 'catan-counter-page-transport-v1';
    const EXTENSION_BRIDGE_SOURCE = 'catan-counter-extension-bridge-v1';
    const TRANSPORT_CAPTURE_VERSION = 1;
    const MAX_BRIDGED_DATA_LENGTH = 350000;
    function isRecord(value) {
        return typeof value === 'object' && value !== null;
    }
    /**
     * Validate the untrusted object received from the page's MAIN world. Colonist
     * can post messages to the same window, so the isolated content script must not
     * blindly persist arbitrary objects.
     */
    function parsePageTransportEnvelope(value) {
        if (!isRecord(value) || value.source !== PAGE_TRANSPORT_SOURCE)
            return null;
        if (!isRecord(value.capture))
            return null;
        const capture = value.capture;
        const directions = [
            'incoming',
            'outgoing',
            'lifecycle',
        ];
        const events = [
            'constructed',
            'open',
            'message',
            'close',
            'error',
        ];
        const encodings = ['text', 'base64', 'json', 'none'];
        if (capture.captureVersion !== TRANSPORT_CAPTURE_VERSION)
            return null;
        if (typeof capture.id !== 'string' || capture.id.length > 200)
            return null;
        if (typeof capture.pageSessionId !== 'string' ||
            capture.pageSessionId.length > 100)
            return null;
        if (typeof capture.sequence !== 'number' ||
            !Number.isSafeInteger(capture.sequence) ||
            capture.sequence < 0)
            return null;
        if (typeof capture.capturedAt !== 'string')
            return null;
        if (!directions.includes(capture.direction))
            return null;
        if (typeof capture.connectionId !== 'number' ||
            !Number.isSafeInteger(capture.connectionId) ||
            capture.connectionId < 0)
            return null;
        if (typeof capture.connectionUrl !== 'string' ||
            capture.connectionUrl.length > 2000)
            return null;
        if (!events.includes(capture.event))
            return null;
        if (!encodings.includes(capture.encoding))
            return null;
        if (capture.data !== null &&
            (typeof capture.data !== 'string' ||
                capture.data.length > MAX_BRIDGED_DATA_LENGTH))
            return null;
        if (capture.byteLength !== null &&
            (typeof capture.byteLength !== 'number' ||
                !Number.isSafeInteger(capture.byteLength) ||
                capture.byteLength < 0))
            return null;
        if (typeof capture.truncated !== 'boolean')
            return null;
        return capture;
    }
    /**
     * Start the isolated-world half of the bridge. The ready message asks the MAIN
     * world hook to replay anything captured during the tiny startup race.
     */
    function startTransportCaptureBridge(onCapture) {
        const listener = (event) => {
            if (event.source !== window || event.origin !== window.location.origin)
                return;
            const capture = parsePageTransportEnvelope(event.data);
            if (capture)
                onCapture(capture);
        };
        window.addEventListener('message', listener);
        window.postMessage({ source: EXTENSION_BRIDGE_SOURCE, type: 'ready' }, window.location.origin);
        return () => window.removeEventListener('message', listener);
    }

    // content.ts
    // Start listening immediately so the MAIN-world hook can replay WebSocket
    // traffic captured before Colonist rendered the chat or board.
    startTransportCaptureBridge(logTransportCapture);
    // All chat rows flow through this buffer so the parser always sees them in
    // strict data-index order — the parser's dedup is a monotonic high-water mark,
    // so an out-of-order row would permanently lock out everything before it.
    const messageBuffer = new MessageOrderBuffer(updateGameFromChat);
    let blockedFlushTimer = null;
    /**
     * Capture one rendered chat row: log it verbatim (the logger dedups by index
     * itself) and queue it for in-order parsing.
     */
    function captureRow(element) {
        logChatMessage(element);
        messageBuffer.capture(element);
    }
    /**
     * If rows are stuck behind a gap the scroller never rendered, give the gap a
     * few seconds to fill (a re-render or user scroll may still supply it), then
     * process what we have anyway so live tracking doesn't stall forever.
     */
    function scheduleBlockedFlush() {
        if (!messageBuffer.hasPending()) {
            if (blockedFlushTimer !== null) {
                clearTimeout(blockedFlushTimer);
                blockedFlushTimer = null;
            }
            return;
        }
        if (blockedFlushTimer !== null)
            return;
        blockedFlushTimer = window.setTimeout(() => {
            blockedFlushTimer = null;
            messageBuffer.drain();
            if (messageBuffer.hasPending()) {
                console.warn('⚠️ Chat gap never rendered — processing buffered rows out of contiguity');
                messageBuffer.flush();
            }
            updateGameStateDisplay();
        }, 3000);
    }
    const chatMutationCallback = (mutationsList) => {
        let sawRows = false;
        for (const mutation of mutationsList) {
            mutation.addedNodes.forEach(addedNode => {
                if (addedNode.nodeType === Node.ELEMENT_NODE) {
                    captureRow(addedNode);
                    sawRows = true;
                }
            });
        }
        if (sawRows) {
            messageBuffer.drain();
            scheduleBlockedFlush();
            // Wait for colonist's player-information panel to reflect this message, then
            // refine the variant tree by the live hand counts. Deferring a frame avoids
            // reading stale counts (and pruneByHandCounts no-ops if they don't help).
            requestAnimationFrame(() => {
                applyHandCountResolution();
                updateGameStateDisplay();
            });
        }
    };
    /** Capture all currently-rendered rows and parse the contiguous prefix. */
    function captureRenderedMessages(chatContainer) {
        chatContainer
            .querySelectorAll('[data-index]')
            .forEach(row => captureRow(row));
        messageBuffer.drain();
    }
    /**
     * Rebuild full game history after a page load/refresh.
     *
     * Colonist renders the chat as a virtual scroller that only keeps ~15 message
     * rows in the DOM at once, so on refresh the extension would otherwise see only
     * the most recent messages and miscount. We scroll from top to bottom capturing
     * each rendered window; the MessageOrderBuffer feeds the parser in data-index
     * order regardless of render order.
     *
     * The sweep reads scrollTop/scrollHeight live on every step — the scroller
     * corrects its estimated height as rows render, and re-pins to the bottom when
     * a live message arrives mid-sweep, so a precomputed position would jump over
     * whole stretches of the log (seen in practice as rows 68–243 never rendering).
     * If a sweep ends with rows still stuck behind a gap, it re-sweeps up to two
     * more times, then flushes whatever was captured.
     */
    function loadChatHistory(chatContainer) {
        return __awaiter(this, void 0, void 0, function* () {
            // The scrollable element is the chat container's parent (the virtual scroller
            // itself has full height; its parent has overflow-y:auto).
            const scrollEl = chatContainer.parentElement;
            const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            // Not virtualized (or everything already fits): just process what's rendered.
            if (!scrollEl || scrollEl.scrollHeight <= scrollEl.clientHeight + 5) {
                captureRenderedMessages(chatContainer);
                messageBuffer.flush();
                return;
            }
            const MAX_SWEEPS = 3;
            for (let sweep = 1; sweep <= MAX_SWEEPS; sweep++) {
                scrollEl.scrollTop = 0;
                yield sleep(120); // let the scroller render the top of the log
                let guard = 0;
                while (guard++ < 1000) {
                    captureRenderedMessages(chatContainer);
                    const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
                    if (scrollEl.scrollTop >= maxScroll - 2)
                        break;
                    // Step by ~half a viewport so consecutive windows overlap (no skipped
                    // rows), advancing from wherever the scroller ACTUALLY is right now.
                    const step = Math.max(50, Math.floor(scrollEl.clientHeight * 0.5));
                    scrollEl.scrollTop = Math.min(scrollEl.scrollTop + step, maxScroll);
                    yield sleep(90); // wait for the next window of rows to render
                }
                // Final pass at the bottom in case the last window rendered after the loop.
                captureRenderedMessages(chatContainer);
                if (!messageBuffer.hasPending())
                    return; // no gaps — history is complete
                console.warn(`⚠️ History sweep ${sweep}/${MAX_SWEEPS} left a gap in the chat log, ${sweep < MAX_SWEEPS ? 'retrying...' : 'giving up on the gap'}`);
            }
            // Gap rows never rendered; process everything captured after the gap anyway.
            messageBuffer.flush();
        });
    }
    function tryFindChat() {
        const chatContainer = findChatContainer();
        if (chatContainer) {
            console.log('✅ Chat container found!');
            // Stop polling now that we've located the chat.
            clearInterval(intervalId);
            autoDetectCurrentPlayer();
            // Start recording chat messages for this game (resumes any stored log for
            // the same game id, e.g. after a refresh). History replay below will feed
            // every message through the logger via captureRow.
            void initMessageLogger();
            // Show the game state overlay
            showGameStateOverlay();
            // Scroll through and process the full chat history (handles page refresh,
            // where only the most recent messages are initially rendered), then watch
            // for new messages.
            console.log('📜 Loading chat history...');
            setHistoryLoading(true);
            loadChatHistory(chatContainer)
                .then(() => {
                console.log('✅ Finished processing chat history');
                // The replay just caught up to the present, so the live hand counts in
                // colonist's player panel are valid evidence against the rebuilt tree
                // (this is what resolves post-monopoly ambiguity after a refresh).
                applyHandCountResolution();
            })
                .finally(() => {
                // Calculations done: drop the loader and show the rebuilt counts.
                setHistoryLoading(false);
                const observer = new MutationObserver(chatMutationCallback);
                observer.observe(chatContainer, { childList: true });
            });
        }
        else {
            console.log('⏳ Chat container not found, retrying...');
        }
    }
    // Console access to the stored game logs. From the page's DevTools console,
    // select the extension's content-script context, then run:
    //   __catanCounter.exportAllGameLogs()
    window.__catanCounter = {
        exportAllGameLogs,
    };
    // Start polling every 2 seconds
    const intervalId = window.setInterval(tryFindChat, 2000);
    // Optionally run immediately
    tryFindChat();

})();
