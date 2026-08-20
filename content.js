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
            // Deliberately free of wall-clock time: rebuilding the tree by replaying
            // history must mint the same id for the same steal, or manual resolutions
            // could not be re-applied and the UI's ids would change under it. The
            // counter alone is unique within a processor. Observation time lives on the
            // transaction's `timestamp`.
            const transactionId = `${stealerName}_${victimName}_${++this.transactionCounter}`;
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
         * Every steal ever branched on, resolved or not. The UI needs the resolved
         * ones so a manual resolution can be shown as confirmed and undone.
         */
        getAllTransactions() {
            return [...this.unknownTransactions];
        }
        /**
         * Restore original observation times after a rebuild. Replay re-creates each
         * transaction with the current clock, which would otherwise stamp a whole
         * game's steals with the moment someone pressed undo.
         */
        restoreTransactionTimestamps(timestamps) {
            for (const transaction of this.unknownTransactions) {
                const original = timestamps.get(transaction.id);
                if (original !== undefined)
                    transaction.timestamp = original;
            }
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
            /**
             * Operator decisions, in the order they were made. Auto-resolutions are not
             * recorded here: they are re-derived by replay, and are not undoable.
             */
            this.manualResolutions = [];
            /** Observation times, so a rebuild doesn't restamp every steal. */
            this.stealTimestamps = new Map();
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
            this.initialPlayerNames = initialPlayers.map(player => player.name);
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
            const resolved = this.transactionProcessor.resolveUnknownTransaction(id, resolvedResource);
            if (resolved) {
                this.manualResolutions.push({ id, resource: resolvedResource });
            }
            return resolved;
        }
        /**
         * Every steal ever branched on, resolved or not — what the UI lists.
         */
        getAllUnknownTransactions() {
            return this.transactionProcessor.getAllTransactions();
        }
        /** Whether this resolution was a person's call, and so can be taken back. */
        isManuallyResolved(id) {
            return this.manualResolutions.some(resolution => resolution.id === id);
        }
        /**
         * Take back a manual resolution.
         *
         * Resolving prunes branches from the variant tree, and pruned branches cannot
         * be resurrected in place — so undo rebuilds: a fresh tree replays the whole
         * transaction history and then re-applies the manual resolutions that remain,
         * in their original order. That makes undo exact rather than approximate, and
         * it composes with everything else, because the rebuilt tree is derived from
         * the same evidence as the original.
         *
         * Hand-count pruning is not part of the rebuild — it comes from reading
         * colonist's panel, not from the chat — so immediately after an undo the tree
         * holds only what the chat proves. The next message re-applies it.
         *
         * Returns false for an id that was never manually resolved, which includes
         * anything the tracker resolved by itself: that was not a decision to undo.
         */
        unresolveUnknownTransaction(id) {
            const index = this.manualResolutions.findIndex(resolution => resolution.id === id);
            if (index === -1)
                return false;
            this.manualResolutions.splice(index, 1);
            this.rebuild();
            return true;
        }
        /** Rebuild the variant tree from history plus the surviving resolutions. */
        rebuild() {
            const history = this.transactionHistory;
            const resolutions = this.manualResolutions;
            const initialGameState = {};
            for (const name of this.initialPlayerNames) {
                const resources = {};
                for (const resourceType of RESOURCE_TYPES)
                    resources[resourceType] = 0;
                initialGameState[name] = { resources };
            }
            this.variantTree = new VariantTree(initialGameState);
            this.transactionProcessor = new VariantTransactionProcessor(this.variantTree);
            this.manualResolutions = [];
            for (const transaction of history)
                this.applyTransaction(transaction);
            this.transactionProcessor.restoreTransactionTimestamps(this.stealTimestamps);
            // Re-applying through the public method re-records them in order.
            for (const resolution of resolutions) {
                this.resolveUnknownTransaction(resolution.id, resolution.resource);
            }
        }
        /** Remember when each steal was first seen, so rebuilds can restore it. */
        rememberStealTimestamps() {
            for (const transaction of this.transactionProcessor.getAllTransactions()) {
                if (!this.stealTimestamps.has(transaction.id)) {
                    this.stealTimestamps.set(transaction.id, transaction.timestamp);
                }
            }
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
            this.transactionHistory.push(transaction);
            this.applyTransaction(transaction);
            this.rememberStealTimestamps();
        }
        /**
         * Apply a transaction to the tree without recording it. Replay uses this so
         * rebuilding does not append the history it is replaying back onto itself.
         */
        applyTransaction(transaction) {
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
        /**
         * Apply a change the player may not be able to afford, pruning the variants
         * where they cannot.
         *
         * The chat is ground truth: if it says someone built a road, they built it.
         * When NO variant can afford the cost our tracking is wrong — messages were
         * missed after a refresh, say — and pruning every variant cascades into
         * removing the tree's root, which throws mid-prune and takes the parser down
         * with it. So in that case keep every variant and force-apply with clamping,
         * exactly as trades and monopolies already do.
         */
        applyAffordableChange(playerName, description, requires, mutate) {
            const currentNodes = this.variantTree.getCurrentVariantNodes();
            const canAfford = (node) => {
                const state = node.gameState[playerName];
                if (!state)
                    return false;
                for (const [resourceType, amount] of Object.entries(requires)) {
                    if (typeof amount !== 'number' || !isValidResourceType(resourceType)) {
                        continue;
                    }
                    if (getResourceAmount(state.resources, resourceType) < amount) {
                        return false;
                    }
                }
                return true;
            };
            const anyValid = currentNodes.some(canAfford);
            if (!anyValid) {
                console.warn(`⚠️ ${description} is impossible in every variant — force-applying (messages may have been missed)`);
            }
            for (const node of currentNodes) {
                const state = node.gameState[playerName];
                if (!state)
                    continue;
                if (anyValid && !canAfford(node)) {
                    this.variantTree.removeVariantNode(node);
                    continue;
                }
                mutate(state, !anyValid);
            }
            this.variantTree.pruneInvalidNodes();
        }
        processResourceLoss(playerName, resources) {
            this.applyAffordableChange(playerName, `${playerName} losing cards`, resources, (state, clamp) => {
                for (const [resourceType, amount] of Object.entries(resources)) {
                    if (typeof amount !== 'number' ||
                        !isValidResourceType(resourceType)) {
                        continue;
                    }
                    // Clamped so a force-applied loss can never go negative.
                    const held = getResourceAmount(state.resources, resourceType);
                    const taken = clamp ? Math.min(held, amount) : amount;
                    updateResourceAmount(state.resources, resourceType, -taken);
                }
            });
        }
        /**
         * Process bank trade (player trades resources with the bank)
         */
        processBankTrade(playerName, resourceChanges) {
            // Only the negative side has to be affordable; the rest is what comes back.
            const requires = {};
            for (const [resourceType, amount] of Object.entries(resourceChanges)) {
                if (typeof amount === 'number' &&
                    amount < 0 &&
                    isValidResourceType(resourceType)) {
                    requires[resourceType] = Math.abs(amount);
                }
            }
            this.applyAffordableChange(playerName, `Bank trade by ${playerName}`, requires, (state, clamp) => {
                for (const [resourceType, amount] of Object.entries(resourceChanges)) {
                    if (typeof amount !== 'number' ||
                        !isValidResourceType(resourceType)) {
                        continue;
                    }
                    if (clamp && amount < 0) {
                        const held = getResourceAmount(state.resources, resourceType);
                        updateResourceAmount(state.resources, resourceType, -Math.min(held, Math.abs(amount)));
                    }
                    else {
                        updateResourceAmount(state.resources, resourceType, amount);
                    }
                }
            });
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
            cardLedger: {},
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
    function storageAvailable$2() {
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
            if (storageAvailable$2()) {
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
        if (!storageAvailable$2())
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
            if (!currentLog || !storageAvailable$2())
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
            if (!storageAvailable$2()) {
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
    const STYLES$8 = {
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
        backdrop.style.cssText = STYLES$8.modalBackdrop;
        return backdrop;
    }
    /**
     * Create a modal dialog element
     */
    function createModalDialog() {
        const dialog = document.createElement('div');
        dialog.style.cssText = STYLES$8.modalDialog;
        return dialog;
    }
    /**
     * Create a resource button with icon and probability
     */
    function createResourceButton(resource, probability, onClick) {
        const button = document.createElement('button');
        button.setAttribute('data-resource', resource);
        button.style.cssText = `
    ${STYLES$8.primaryButton}
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
        style="${STYLES$8.secondaryButton}"
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
            updateGameStateDisplay$1();
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
    function showGameStateOverlay$1() {
        if (!gameStateOverlay) {
            gameStateOverlay = createGameStateOverlay();
            document.body.appendChild(gameStateOverlay);
        }
        else {
            updateOverlayContent(gameStateOverlay);
            gameStateOverlay.style.display = 'block';
        }
    }
    function hideGameStateOverlay() {
        if (gameStateOverlay) {
            gameStateOverlay.style.display = 'none';
        }
    }
    function updateGameStateDisplay$1() {
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
    function setHistoryLoading$1(loading) {
        isLoadingHistory = loading;
        if (gameStateOverlay) {
            updateOverlayContent(gameStateOverlay);
        }
    }
    function showYouPlayerDialog$1() {
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

    // v1Adapter.ts
    const v1Ui = {
        mount: showGameStateOverlay$1,
        unmount: hideGameStateOverlay,
        update: updateGameStateDisplay$1,
        setHistoryLoading: setHistoryLoading$1,
        showYouPlayerDialog: showYouPlayerDialog$1,
    };

    // sections/dom.ts
    // Small helpers so a section reads as the structure it renders rather than as
    // a wall of createElement calls.
    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className)
            node.className = className;
        if (text !== undefined)
            node.textContent = text;
        return node;
    }
    /** A section header: label on the left, hint on the right. */
    function sectionHead(label, hint = '') {
        const head = el('div', 'section-head');
        const labelNode = el('span', 'section-label', label);
        const hintNode = el('span', 'section-hint', hint);
        head.append(labelNode, hintNode);
        return { head, labelNode, hintNode };
    }
    function img(src, alt, className) {
        const node = el('img', className);
        node.src = src;
        node.alt = alt;
        // Everything referenced here is a bundled asset, never a network fetch.
        node.decoding = 'async';
        return node;
    }

    // cardLedger.ts
    function emptyLedger() {
        return {
            dice: 0,
            robGain: 0,
            devGain: 0,
            tradeGain: 0,
            sevens: 0,
            robLoss: 0,
            monoLoss: 0,
            tradeLoss: 0,
            spent: 0,
        };
    }
    function ledgerFor(playerName) {
        let ledger = game.cardLedger[playerName];
        if (!ledger) {
            ledger = emptyLedger();
            game.cardLedger[playerName] = ledger;
        }
        return ledger;
    }
    /** Read a player's ledger. Players nobody has seen act as read yet read empty. */
    function getLedger(playerName) {
        var _a;
        return (_a = game.cardLedger[playerName]) !== null && _a !== void 0 ? _a : emptyLedger();
    }
    function recordGain(playerName, kind, cards) {
        if (!playerName || cards <= 0)
            return;
        ledgerFor(playerName)[kind] += cards;
    }
    function recordLoss(playerName, kind, cards) {
        if (!playerName || cards <= 0)
            return;
        ledgerFor(playerName)[kind] += cards;
    }
    /** Total cards in a set of resource changes, counting only the given sign. */
    function countCards(changes, sign) {
        let total = 0;
        for (const value of Object.values(changes)) {
            if (typeof value !== 'number')
                continue;
            if (sign === 'positive' && value > 0)
                total += value;
            if (sign === 'negative' && value < 0)
                total += -value;
        }
        return total;
    }
    /**
     * Record both halves of a trade. `changes` is net for `playerName`; the partner
     * gets the mirror image. Passing no partner records a bank trade.
     */
    function recordTrade(playerName, partnerName, changes) {
        const received = countCards(changes, 'positive');
        const given = countCards(changes, 'negative');
        recordGain(playerName, 'tradeGain', received);
        recordLoss(playerName, 'tradeLoss', given);
        // The partner's side is the mirror: what one gave, the other received.
        recordGain(partnerName, 'tradeGain', given);
        recordLoss(partnerName, 'tradeLoss', received);
    }
    /**
     * Record a monopoly.
     *
     * The caster's haul is ground truth — the chat states it — so it is recorded
     * exactly. The per-victim split is not in the chat at all, so each victim is
     * charged what the tracker believes they were holding. That is the one entry in
     * the ledger that can be wrong, and it can only be wrong about WHICH victims
     * lost cards, never about how many the caster gained.
     */
    function recordMonopoly(casterName, totalStolen, perVictim) {
        recordGain(casterName, 'devGain', totalStolen);
        for (const victim of perVictim) {
            recordLoss(victim.name, 'monoLoss', victim.cards);
        }
    }
    /** A steal moves exactly one card, whether or not anyone knows which. */
    function recordSteal(thiefName, victimName) {
        recordGain(thiefName, 'robGain', 1);
        recordLoss(victimName, 'robLoss', 1);
    }
    /**
     * Fold a ledger into the numbers both card-flow tables show.
     *
     * Every gain lands in exactly one of `got`/`devGain` and every loss in exactly
     * one of `robbed`/`sevens`/`spentAndTraded`, so the compact table balances:
     * got + devGain - robbed - sevens - spentAndTraded === hand.
     */
    function totalsFor(playerName) {
        const ledger = getLedger(playerName);
        const gained = ledger.dice + ledger.robGain + ledger.devGain + ledger.tradeGain;
        const lost = ledger.sevens +
            ledger.robLoss +
            ledger.monoLoss +
            ledger.tradeLoss +
            ledger.spent;
        return Object.assign(Object.assign({}, ledger), { gained,
            lost, hand: gained - lost, got: ledger.dice + ledger.robGain + ledger.tradeGain, robbed: ledger.robLoss + ledger.monoLoss, spentAndTraded: ledger.spent + ledger.tradeLoss });
    }

    // view/types.ts
    // The shape every section renders from. This is deliberately plain data: no
    // DOM, no chrome APIs, no references back into the tracker. A section that only
    // ever sees a GameView can be mounted in any gutter, rendered in a test, and
    // later moved without touching its code.
    /** Display order used everywhere in v2 (matches the mockup). */
    const RESOURCE_ORDER = [
        'tree',
        'brick',
        'sheep',
        'wheat',
        'ore',
    ];

    // view/gameView.ts
    /** Cards of each resource in a standard game. */
    const BANK_TOTAL = 19;
    /** Ways to roll each total with two dice, out of 36. */
    const DICE_ODDS = {
        2: 1,
        3: 2,
        4: 3,
        5: 4,
        6: 5,
        7: 6,
        8: 5,
        9: 4,
        10: 3,
        11: 2,
        12: 1,
    };
    /** A roll this far above its expected rate is called out as running hot. */
    const HOT_MULTIPLIER = 1.3;
    const DEV_CARDS = [
        { key: 'knights', name: 'Knight', icon: 'knight.svg', total: 14 },
        { key: 'monopolies', name: 'Monopoly', icon: 'mono.svg', total: 2 },
        { key: 'roadBuilders', name: 'Roads', icon: 'rb.svg', total: 2 },
        { key: 'yearOfPlenties', name: 'Plenty', icon: 'yop.svg', total: 2 },
        { key: 'victoryPoints', name: 'Vic. Pt', icon: 'vp.svg', total: 5 },
    ];
    const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
    const pct = (p) => `${Math.round(p * 100)}%`;
    /**
     * Players in reading order with you last, matching v1's ordering — your own
     * hand is the one you already know, so it belongs at the bottom of the rail.
     */
    function orderPlayers(players, youPlayerName) {
        if (!youPlayerName)
            return players;
        const index = players.findIndex(player => player.name === youPlayerName);
        if (index === -1)
            return players;
        return [
            ...players.slice(index + 1),
            ...players.slice(0, index),
            players[index],
        ];
    }
    /** '6:35:45 PM' — wall-clock, because it is matched against the game's chat. */
    function formatStealTime(timestamp) {
        const date = new Date(timestamp);
        const hours24 = date.getHours();
        const hours = hours24 % 12 === 0 ? 12 : hours24 % 12;
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds} ${hours24 < 12 ? 'AM' : 'PM'}`;
    }
    function buildPlayer(player, game, youPlayerName) {
        const probabilities = game.probableGameState.getPlayerResourceProbabilities(player.name);
        const cells = RESOURCE_ORDER.map(resource => {
            var _a, _b;
            const known = (_a = probabilities.minimumResources[resource]) !== null && _a !== void 0 ? _a : 0;
            const probability = (_b = probabilities.additionalResourceProbabilities[resource]) !== null && _b !== void 0 ? _b : 0;
            return {
                resource,
                known,
                probability,
                probabilityLabel: probability > 0 ? `+${pct(probability)}` : '',
                hasAny: known > 0 || probability > 0,
            };
        });
        return {
            name: player.name,
            color: player.color,
            knownCards: cells.reduce((total, cell) => total + cell.known, 0),
            cells,
            victoryPoints: player.victoryPoints,
            knights: player.knights,
            settlements: player.settlements,
            cities: player.cities,
            roads: player.roads,
            isYou: player.name === youPlayerName,
        };
    }
    function buildCardFlow(players) {
        return players.map(player => {
            const totals = totalsFor(player.name);
            return {
                name: player.name,
                color: player.color,
                got: totals.got,
                robbed: totals.robbed,
                spentAndTraded: totals.spentAndTraded,
                gained: totals.gained,
                dice: totals.dice,
                robGain: totals.robGain,
                devGain: totals.devGain,
                tradeGain: totals.tradeGain,
                lost: totals.lost,
                sevens: totals.sevens,
                robLoss: totals.robLoss,
                monoLoss: totals.monoLoss,
                tradeLoss: totals.tradeLoss,
                spent: totals.spent,
                hand: totals.hand,
            };
        });
    }
    function buildBank(gameResources) {
        return RESOURCE_ORDER.map(resource => ({
            resource,
            left: gameResources[resource],
            total: BANK_TOTAL,
        }));
    }
    function buildSteals(game) {
        const colorOf = (name) => { var _a, _b; return (_b = (_a = game.players.find(player => player.name === name)) === null || _a === void 0 ? void 0 : _a.color) !== null && _b !== void 0 ? _b : '#ffffff'; };
        // Steals the tracker resolved by itself have retired — showing them would
        // grow the list forever. A person's own resolution stays visible so it can be
        // undone.
        const listed = game.probableGameState
            .getAllUnknownTransactions()
            .filter(transaction => !transaction.isResolved ||
            game.probableGameState.isManuallyResolved(transaction.id));
        return listed.map(transaction => {
            var _a;
            const resolvedResource = (_a = transaction.resolvedResource) !== null && _a !== void 0 ? _a : null;
            let candidates;
            if (transaction.isResolved && resolvedResource) {
                candidates = [
                    {
                        resource: resolvedResource,
                        probability: 1,
                        label: `${resolvedResource} · confirmed`,
                    },
                ];
            }
            else {
                const probabilities = game.probableGameState.getTransactionResourceProbabilities(transaction.id);
                candidates = RESOURCE_ORDER.map(resource => {
                    var _a;
                    return ({
                        resource,
                        probability: (_a = probabilities === null || probabilities === void 0 ? void 0 : probabilities[resource]) !== null && _a !== void 0 ? _a : 0,
                        label: '',
                    });
                })
                    .filter(candidate => candidate.probability > 0)
                    .sort((a, b) => b.probability - a.probability)
                    .map(candidate => (Object.assign(Object.assign({}, candidate), { label: `${candidate.resource} ${pct(candidate.probability)}` })));
            }
            return {
                id: transaction.id,
                thief: transaction.thief,
                thiefColor: colorOf(transaction.thief),
                victim: transaction.victim,
                victimColor: colorOf(transaction.victim),
                time: formatStealTime(transaction.timestamp),
                resolved: transaction.isResolved,
                resolvedResource,
                canUndo: game.probableGameState.isManuallyResolved(transaction.id),
                candidates,
            };
        });
    }
    function buildBlocked(game) {
        const blocked = [];
        for (const [diceNumber, byResource] of Object.entries(game.blockedDiceRolls)) {
            for (const [resource, count] of Object.entries(byResource)) {
                if (count > 0) {
                    blocked.push({
                        diceNumber: Number(diceNumber),
                        resource: resource,
                        count,
                    });
                }
            }
        }
        blocked.sort((a, b) => a.diceNumber - b.diceNumber ||
            RESOURCE_ORDER.indexOf(a.resource) - RESOURCE_ORDER.indexOf(b.resource));
        return {
            blocked,
            blockedTotal: blocked.reduce((total, entry) => total + entry.count, 0),
        };
    }
    function buildDice(game) {
        const counts = Object.entries(game.diceRolls).map(([n, count]) => ({
            n: Number(n),
            count,
        }));
        const totalRolls = counts.reduce((total, entry) => total + entry.count, 0);
        // Guard the divisor: before the first roll every count is 0.
        const tallest = Math.max(1, ...counts.map(entry => entry.count));
        const bars = counts
            .sort((a, b) => a.n - b.n)
            .map(({ n, count }) => {
            const expected = (totalRolls * DICE_ODDS[n]) / 36;
            // A short floor so an unrolled number is still a visible baseline.
            const heightPct = count === 0 ? 0 : Math.max(4, (count / tallest) * 100);
            const expectedPct = clamp((expected / tallest) * 100, 0, 100);
            const tone = n === 7
                ? 'seven'
                : count > expected * HOT_MULTIPLIER
                    ? 'hot'
                    : 'normal';
            return {
                n,
                count,
                heightPct,
                // Positioned from the top of its own bar, so it reads as "this bar is
                // above/below the rate you'd expect by now".
                expectedTopPct: heightPct > 0
                    ? clamp((1 - expectedPct / heightPct) * 100, 0, 100)
                    : 100,
                expected,
                tone,
            };
        });
        return { totalRolls, bars };
    }
    /**
     * Attribution for a dev card type. The tracker already counts plays per player
     * (gameActions increments discoveryCards on use), so this is a fold, not new
     * parsing. Victory points are never played, so they always read as unseen.
     */
    function buildDevCaption(players, key, left) {
        const playedBy = players
            .map(player => ({ name: player.name, count: player.discoveryCards[key] }))
            .filter(entry => entry.count > 0);
        if (playedBy.length === 0)
            return `${left} unseen`;
        if (playedBy.length === 1) {
            const [only] = playedBy;
            return only.count > 1 ? `${only.name} ×${only.count}` : only.name;
        }
        const total = playedBy.reduce((sum, entry) => sum + entry.count, 0);
        return `${total} played`;
    }
    function buildDevDeck(game) {
        const cards = DEV_CARDS.map(card => {
            // These counters decrement on play, not on draw, so `left` is "not yet
            // played" — which is why an untouched deck reads 5/5 for victory points.
            const left = game[card.key];
            return {
                key: card.key,
                name: card.name,
                icon: card.icon,
                left,
                total: card.total,
                leftPct: clamp((left / card.total) * 100, 0, 100),
                caption: buildDevCaption(game.players, card.key, left),
                untouched: left >= card.total,
            };
        });
        return {
            remaining: cards.reduce((total, card) => total + card.left, 0),
            cards,
        };
    }
    function buildGameView(game, options = {}) {
        var _a;
        const { blocked, blockedTotal } = buildBlocked(game);
        const steals = buildSteals(game);
        const ordered = orderPlayers(game.players, game.youPlayerName);
        return {
            players: ordered.map(player => buildPlayer(player, game, game.youPlayerName)),
            cardFlow: buildCardFlow(ordered),
            bank: buildBank(game.gameResources),
            steals,
            openStealCount: steals.filter(steal => !steal.resolved).length,
            blocked,
            blockedTotal,
            dice: buildDice(game),
            devDeck: buildDevDeck(game),
            youPlayerName: game.youPlayerName,
            hasStarted: game.hasRolledFirstDice,
            isLoadingHistory: (_a = options.isLoadingHistory) !== null && _a !== void 0 ? _a : false,
        };
    }

    // sections/registry.ts
    // Maps a section id to its implementation. The shell resolves placements
    // through this, so adding a section is a one-line registration and the layout
    // is the only thing that decides where it goes.
    const REGISTRY = {};
    function registerSection(definition) {
        REGISTRY[definition.id] = definition;
    }
    function getSection(id, registry = REGISTRY) {
        return registry[id];
    }
    function registeredSections(registry = REGISTRY) {
        return Object.values(registry).filter(Boolean);
    }
    /** Every registered section's CSS, for the shadow root's stylesheet. */
    function registeredStyles(registry = REGISTRY) {
        return registeredSections(registry)
            .map(section => { var _a; return (_a = section.styles) !== null && _a !== void 0 ? _a : ''; })
            .filter(Boolean);
    }

    // shell/layoutStore.ts
    const GUTTER_NAMES = ['left', 'right', 'top', 'bottom'];
    /** Zone order, which is also the order the settings menu lists sections in. */
    const ZONES = ['left', 'top', 'bottom', 'right', 'off'];
    /** Width the rail collapses to — enough for the reopen chevron. */
    const COLLAPSED_SIZE = 28;
    /** Fallback thickness for a gutter stored without a usable one. */
    const DEFAULT_SIZE = {
        left: 365,
        right: 365,
        top: 210,
        bottom: 210,
    };
    const MIN_RAIL_WIDTH = 280;
    const MAX_RAIL_WIDTH = 420;
    const LAYOUT_STORAGE_KEY = 'catanUiLayout';
    const DEFAULT_LAYOUT = {
        version: 1,
        left: {
            size: 365,
            collapsed: false,
            sections: [
                { id: 'hands' },
                { id: 'unknown-steals' },
                { id: 'card-flow' },
                { id: 'blocked-robber' },
            ],
        },
        bottom: {
            size: 210,
            collapsed: false,
            sections: [
                { id: 'dice', weight: 1 },
                { id: 'dev-deck', weight: 1 },
            ],
        },
        // Empty, but with a real size ready for the day something is put here.
        // Emptiness is what makes a gutter take no room (see gutterThickness) —
        // marking one collapsed instead would make it a 28px sliver the moment a
        // section landed in it, with no chevron to open it.
        right: { size: 365, collapsed: false, sections: [] },
        top: { size: 210, collapsed: false, sections: [] },
        off: [{ id: 'card-flow-ledger' }, { id: 'players' }],
    };
    /**
     * Presets set placement only. Gutter sizes are deliberately left alone, so
     * picking one does not undo a rail you had sized to taste.
     */
    const PRESETS = [
        {
            name: 'Full read',
            note: 'Everything, left rail and bottom bar',
            build: () => cloneLayout(DEFAULT_LAYOUT),
        },
        {
            name: 'Competitive',
            note: 'Dice and card flow, bottom bar only',
            build: () => ({
                version: 1,
                left: Object.assign(Object.assign({}, DEFAULT_LAYOUT.left), { sections: [] }),
                right: Object.assign(Object.assign({}, DEFAULT_LAYOUT.right), { sections: [] }),
                top: Object.assign(Object.assign({}, DEFAULT_LAYOUT.top), { sections: [] }),
                bottom: Object.assign(Object.assign({}, DEFAULT_LAYOUT.bottom), { sections: [{ id: 'dice' }, { id: 'card-flow' }] }),
                off: [
                    { id: 'hands' },
                    { id: 'unknown-steals' },
                    { id: 'blocked-robber' },
                    { id: 'dev-deck' },
                    { id: 'card-flow-ledger' },
                    { id: 'players' },
                ],
            }),
        },
    ];
    function cloneLayout(layout) {
        var _a;
        return {
            version: layout.version,
            left: Object.assign(Object.assign({}, layout.left), { sections: layout.left.sections.map(s => (Object.assign({}, s))) }),
            right: Object.assign(Object.assign({}, layout.right), { sections: layout.right.sections.map(s => (Object.assign({}, s))) }),
            top: Object.assign(Object.assign({}, layout.top), { sections: layout.top.sections.map(s => (Object.assign({}, s))) }),
            bottom: Object.assign(Object.assign({}, layout.bottom), { sections: layout.bottom.sections.map(s => (Object.assign({}, s))) }),
            off: ((_a = layout.off) !== null && _a !== void 0 ? _a : []).map(s => (Object.assign({}, s))),
        };
    }
    function isGutterConfig(value) {
        const gutter = value;
        return (!!gutter &&
            typeof gutter.size === 'number' &&
            Number.isFinite(gutter.size) &&
            typeof gutter.collapsed === 'boolean' &&
            Array.isArray(gutter.sections) &&
            gutter.sections.every(placement => !!placement &&
                typeof placement.id === 'string' &&
                (placement.weight === undefined ||
                    (typeof placement.weight === 'number' && placement.weight > 0))));
    }
    /**
     * A stored layout is only honored if it is entirely well-formed. A partially
     * valid layout is worse than none: it would leave sections silently unplaced.
     */
    function parseLayout(value) {
        const layout = value;
        if (!layout || layout.version !== DEFAULT_LAYOUT.version)
            return null;
        if (!GUTTER_NAMES.every(name => isGutterConfig(layout[name])))
            return null;
        if (layout.off !== undefined &&
            (!Array.isArray(layout.off) ||
                layout.off.some(placement => !placement || typeof placement.id !== 'string'))) {
            return null;
        }
        return repairLayout(layout);
    }
    function storageAvailable$1() {
        var _a;
        return typeof chrome !== 'undefined' && !!((_a = chrome === null || chrome === void 0 ? void 0 : chrome.storage) === null || _a === void 0 ? void 0 : _a.local);
    }
    function readLayout() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!storageAvailable$1())
                return cloneLayout(DEFAULT_LAYOUT);
            try {
                const stored = yield chrome.storage.local.get(LAYOUT_STORAGE_KEY);
                return ((_a = parseLayout(stored[LAYOUT_STORAGE_KEY])) !== null && _a !== void 0 ? _a : cloneLayout(DEFAULT_LAYOUT));
            }
            catch (error) {
                console.warn('🎛️ Could not read the stored v2 layout:', error);
                return cloneLayout(DEFAULT_LAYOUT);
            }
        });
    }
    function writeLayout(layout) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!storageAvailable$1())
                return;
            try {
                yield chrome.storage.local.set({ [LAYOUT_STORAGE_KEY]: layout });
            }
            catch (error) {
                console.warn('🎛️ Could not store the v2 layout:', error);
            }
        });
    }
    /** Effective thickness of a gutter, accounting for collapse and emptiness. */
    function gutterThickness(gutter) {
        if (gutter.sections.length === 0)
            return 0;
        return gutter.collapsed ? COLLAPSED_SIZE : gutter.size;
    }
    /** Which zone a section currently sits in, or null if the layout omits it. */
    function zoneOf(layout, id) {
        var _a;
        for (const name of GUTTER_NAMES) {
            if (layout[name].sections.some(placement => placement.id === id)) {
                return name;
            }
        }
        if (((_a = layout.off) !== null && _a !== void 0 ? _a : []).some(placement => placement.id === id))
            return 'off';
        return null;
    }
    function listFor(layout, zone) {
        if (zone === 'off') {
            if (!layout.off)
                layout.off = [];
            return layout.off;
        }
        return layout[zone].sections;
    }
    /**
     * Move a section to a zone, appending it at the end. Returns a new layout;
     * moving a section to the zone it already occupies changes nothing.
     */
    function placeSection(layout, id, zone) {
        const next = cloneLayout(layout);
        const current = zoneOf(next, id);
        if (current === zone)
            return next;
        if (current) {
            const list = listFor(next, current);
            const index = list.findIndex(placement => placement.id === id);
            if (index >= 0)
                list.splice(index, 1);
        }
        listFor(next, zone).push({ id });
        // A gutter being switched on must be usable, or the section vanishes into it.
        return repairLayout(next);
    }
    /** Move a section one step up or down within its own zone. */
    function reorderSection(layout, id, direction) {
        const next = cloneLayout(layout);
        const zone = zoneOf(next, id);
        if (!zone)
            return next;
        const list = listFor(next, zone);
        const index = list.findIndex(placement => placement.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= list.length)
            return next;
        const moved = list[index];
        list[index] = list[target];
        list[target] = moved;
        return next;
    }
    /**
     * Fold in any section the stored layout predates, at its default position.
     *
     * A section absent from a stored layout has never been decided about — it was
     * added in a later version — so it takes the place it was designed for rather
     * than staying invisible forever. One that was switched off is in `off`, and
     * stays there.
     */
    function withKnownSections(layout, knownIds) {
        var _a;
        let next = cloneLayout(layout);
        for (const id of knownIds) {
            if (zoneOf(next, id))
                continue;
            next = placeSection(next, id, (_a = zoneOf(DEFAULT_LAYOUT, id)) !== null && _a !== void 0 ? _a : 'off');
        }
        return next;
    }
    /** Every known section with its zone, in the order the settings menu lists. */
    function listSections(layout, knownIds) {
        const full = withKnownSections(layout, knownIds);
        const rows = [];
        for (const zone of ZONES) {
            for (const placement of listFor(full, zone)) {
                if (knownIds.includes(placement.id)) {
                    rows.push({ id: placement.id, zone });
                }
            }
        }
        return rows;
    }
    /** Which gutter carries the header — the only one with a collapse chevron. */
    function headerGutterOf(layout) {
        if (layout.left.sections.length > 0)
            return 'left';
        if (layout.right.sections.length > 0)
            return 'right';
        return null;
    }
    /**
     * Make a layout renderable, whatever state it arrived in.
     *
     * Two ways a gutter can be unreachable, both of which stranded sections:
     *
     *  - a size of zero, so it renders as nothing however much is in it;
     *  - collapsed, on a gutter with no header and therefore no chevron to undo
     *    it. Only the header rail can be collapsed, because only it can be opened
     *    again.
     *
     * Applied when a layout is read and after anything is placed, so a layout
     * already stored in the broken shape repairs itself rather than needing a reset.
     */
    function repairLayout(layout) {
        const next = cloneLayout(layout);
        const header = headerGutterOf(next);
        for (const name of GUTTER_NAMES) {
            const gutter = next[name];
            if (!Number.isFinite(gutter.size) || gutter.size <= 0) {
                gutter.size = DEFAULT_SIZE[name];
            }
            if (gutter.collapsed && name !== header)
                gutter.collapsed = false;
        }
        return next;
    }

    // shell/theme.ts
    // Design tokens for v2, read out of the mockup rather than eyeballed. Sections
    // reference these names, never raw hex, so the palette can move in one place.
    const THEME = {
        /** Rail and bottom-bar background. */
        panel: '#16181c',
        hairline: 'rgba(255,255,255,.09)',
        /** Cards, player rows, dev tiles. */
        surface: 'rgba(255,255,255,.05)',
        /** A resource cell nobody can hold. */
        surfaceEmpty: 'rgba(255,255,255,.02)',
        /** Every section label, the logo, and the robber's tally. */
        accent: '#e8a33d',
        accentTint: 'rgba(232,163,61,.09)',
        accentBorder: 'rgba(232,163,61,.32)',
        /** Dice running hot, an untouched dev pile, a confirmed resolution. */
        good: '#5ec8a0',
        goodText: '#8fe0c4',
        goodTint: 'rgba(94,200,160,.09)',
        goodBorder: 'rgba(94,200,160,.45)',
        /** Probable holdings, which sit against a resource tint rather than a panel. */
        probable: '#6fdcae',
        danger: '#e35b5b',
        /** Numbers in a losing column: softer than the dice seven's red. */
        lossText: '#f19a9a',
        /** Numbers in a spending column. */
        spendText: '#e8b877',
        bar: '#5b6775',
        text: '#ffffff',
        textBody: '#eef1f4',
        textMuted: '#c3ccd4',
        /** Right-hand hints, e.g. "bank left". */
        labelDim: '#8a939d',
        monoDim: '#949da6',
        /** A zero that isn't really a holding. */
        zero: '#4b5158',
        /** The circle behind a blocked dice number. */
        well: '#24272d',
        /** The collapse chevron. */
        chevron: '#b9c2cc',
    };
    const RESOURCE_STYLE = {
        tree: { color: '#3f8f2f', tint: 'rgba(63,143,47,.22)', icon: 'tree.svg' },
        brick: { color: '#cf5b32', tint: 'rgba(207,91,50,.22)', icon: 'brick.svg' },
        sheep: { color: '#8dc63f', tint: 'rgba(141,198,63,.22)', icon: 'sheep.svg' },
        wheat: { color: '#e8b23a', tint: 'rgba(232,178,58,.22)', icon: 'wheat.svg' },
        ore: { color: '#9aa8ae', tint: 'rgba(154,168,174,.22)', icon: 'ore.svg' },
    };
    /**
     * Manrope for names and headings, JetBrains Mono for every number. Both are
     * bundled as web-accessible resources rather than fetched from Google, so they
     * do not depend on colonist's content security policy. The fallbacks matter:
     * if the files are ever missing the UI degrades to the system stack instead of
     * to a serif face.
     */
    const FONT_SANS = "'Manrope', system-ui, -apple-system, 'Segoe UI', Helvetica, sans-serif";
    const FONT_MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

    // shell/styles.ts
    function tokens() {
        const resourceVars = Object.entries(RESOURCE_STYLE)
            .map(([key, style]) => `--cc-${key}: ${style.color}; --cc-${key}-tint: ${style.tint};`)
            .join('\n      ');
        return `
    :host {
      --cc-panel: ${THEME.panel};
      --cc-hairline: ${THEME.hairline};
      --cc-surface: ${THEME.surface};
      --cc-surface-empty: ${THEME.surfaceEmpty};
      --cc-accent: ${THEME.accent};
      --cc-accent-tint: ${THEME.accentTint};
      --cc-accent-border: ${THEME.accentBorder};
      --cc-good: ${THEME.good};
      --cc-good-text: ${THEME.goodText};
      --cc-good-tint: ${THEME.goodTint};
      --cc-good-border: ${THEME.goodBorder};
      --cc-probable: ${THEME.probable};
      --cc-danger: ${THEME.danger};
      --cc-loss-text: ${THEME.lossText};
      --cc-spend-text: ${THEME.spendText};
      --cc-bar: ${THEME.bar};
      --cc-text: ${THEME.text};
      --cc-text-body: ${THEME.textBody};
      --cc-text-muted: ${THEME.textMuted};
      --cc-label-dim: ${THEME.labelDim};
      --cc-mono-dim: ${THEME.monoDim};
      --cc-zero: ${THEME.zero};
      --cc-well: ${THEME.well};
      --cc-chevron: ${THEME.chevron};
      --cc-font: ${FONT_SANS};
      --cc-mono: ${FONT_MONO};
      ${resourceVars}
    }
  `;
    }
    const FRAME = `
  :host {
    all: initial;
    position: fixed;
    inset: 0;
    /* The frame itself must never eat clicks meant for the game. */
    pointer-events: none;
    z-index: 2147483646;
    font-family: var(--cc-font);
    color: var(--cc-text-body);
  }

  *, *::before, *::after { box-sizing: border-box; }

  .gutter {
    position: fixed;
    background: var(--cc-panel);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: auto;
  }
  .gutter--left   { left: 0; top: 0; bottom: 0; border-right: 1px solid var(--cc-hairline); }
  .gutter--right  { right: 0; top: 0; bottom: 0; border-left: 1px solid var(--cc-hairline); }
  .gutter--top    { top: 0; border-bottom: 1px solid var(--cc-hairline); }
  .gutter--bottom { bottom: 0; border-top: 1px solid var(--cc-hairline); }

  /* Body scrolls in a column gutter; a strip gutter lays sections side by side. */
  .gutter-body {
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
  }
  .gutter--vertical .gutter-body {
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: 18px;
  }
  .gutter--horizontal .gutter-body {
    flex-direction: row;
    overflow: hidden;
  }
  .gutter--horizontal .section + .section {
    border-left: 1px solid var(--cc-hairline);
  }
  .gutter--horizontal .section {
    min-width: 0;
    overflow: hidden;
    padding: 12px 18px 14px;
    display: flex;
    flex-direction: column;
  }

  .gutter--collapsed .gutter-body,
  .gutter--collapsed .rail-brand { display: none; }

  /* ---- rail header ---- */
  .rail-header {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--cc-hairline);
  }
  .gutter--collapsed .rail-header {
    padding: 12px 0;
    justify-content: center;
    border-bottom: none;
  }
  .rail-brand { display: flex; align-items: center; gap: 9px; min-width: 0; }
  .rail-logo {
    width: 24px; height: 24px; flex: none;
    border-radius: 6px;
    background: var(--cc-accent);
    color: var(--cc-panel);
    font-weight: 800;
    font-size: 14px;
    display: flex; align-items: center; justify-content: center;
  }
  .rail-title {
    font-weight: 800; font-size: 18px; color: var(--cc-text); line-height: 1.1;
  }
  .rail-controls { display: flex; align-items: center; gap: 2px; }
  .rail-gear {
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--cc-chevron);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
  }
  .rail-gear:hover { background: rgba(255,255,255,.08); color: var(--cc-text); }

  /* Shown only when neither rail is on screen to hold the header. */
  .floating-gear {
    position: fixed;
    top: 14px;
    right: 14px;
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 8px;
    background: rgba(14,16,19,.85);
    color: var(--cc-text-body);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: auto;
    padding: 0;
  }
  .floating-gear:hover { background: var(--cc-panel); }

  .rail-collapse {
    font-family: var(--cc-mono);
    font-size: 16px;
    line-height: 1;
    color: var(--cc-chevron);
    background: none;
    border: 0;
    padding: 4px;
    cursor: pointer;
  }
  .rail-collapse:hover { color: var(--cc-text); }

  /* ---- resize handle ---- */
  .gutter-resize { position: absolute; z-index: 2; }
  .gutter-resize:hover { background: var(--cc-accent-border); }
  .gutter--left .gutter-resize   { top: 0; bottom: 0; right: -2px; width: 5px; cursor: ew-resize; }
  .gutter--right .gutter-resize  { top: 0; bottom: 0; left: -2px; width: 5px; cursor: ew-resize; }
  .gutter--bottom .gutter-resize { left: 0; right: 0; top: -2px; height: 5px; cursor: ns-resize; }
  .gutter--top .gutter-resize    { left: 0; right: 0; bottom: -2px; height: 5px; cursor: ns-resize; }

  /* ---- shared section primitives ---- */
  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .gutter--vertical .section-head { padding: 14px 14px 8px; }
  .gutter--horizontal .section-head { margin-bottom: 10px; }
  .section-label {
    font-family: var(--cc-mono);
    font-size: 11px;
    letter-spacing: .14em;
    color: var(--cc-accent);
    text-transform: uppercase;
    white-space: nowrap;
  }
  .section-hint {
    font-family: var(--cc-mono);
    font-size: 11px;
    color: var(--cc-label-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .section-note {
    padding: 14px 14px 0;
    font-size: 12px;
    color: var(--cc-label-dim);
    line-height: 1.45;
  }
  .section-empty {
    padding: 4px 14px 0;
    font-size: 12px;
    color: var(--cc-mono-dim);
  }
  .section-rows { padding: 0 10px; display: flex; flex-direction: column; gap: 6px; }

  /* ---- loading + placeholder states ---- */
  .rail-status {
    padding: 22px 14px;
    text-align: center;
    color: var(--cc-text-muted);
    font-size: 13px;
    line-height: 1.5;
  }
  .rail-status-detail {
    margin-top: 6px;
    font-size: 12px;
    color: var(--cc-label-dim);
  }
  .rail-spinner {
    width: 22px; height: 22px;
    margin: 0 auto 10px;
    border: 2px solid var(--cc-hairline);
    border-top-color: var(--cc-accent);
    border-radius: 50%;
    animation: cc-spin 0.9s linear infinite;
  }
  @keyframes cc-spin { to { transform: rotate(360deg); } }

  @media (prefers-reduced-motion: reduce) {
    .rail-spinner { animation-duration: 4s; }
  }
`;
    function buildStyleSheet(sectionStyles) {
        // No @font-face here: Chrome ignores those inside a shadow root. The bundled
        // faces are registered on the document by shell/fonts.ts instead.
        return [tokens(), FRAME, ...sectionStyles].join('\n');
    }

    // shell/fonts.ts
    const BUNDLED = [
        {
            family: 'Manrope',
            file: 'assets/fonts/manrope-latin-var.woff2',
            weight: '200 800',
        },
        {
            family: 'JetBrains Mono',
            file: 'assets/fonts/jetbrains-mono-latin-var.woff2',
            weight: '100 800',
        },
    ];
    let loaded = [];
    let pending = null;
    /**
     * Load the typefaces onto the document. Safe to call repeatedly; the work
     * happens once. Failures are swallowed — the font stacks in `theme.ts` name a
     * real fallback, so the worst case is the system face rather than no interface.
     */
    function loadFonts(assetUrl) {
        if (pending)
            return pending;
        if (typeof FontFace === 'undefined' || !document.fonts) {
            return Promise.resolve();
        }
        pending = Promise.all(BUNDLED.map((font) => __awaiter(this, void 0, void 0, function* () {
            try {
                const face = new FontFace(font.family, `url('${assetUrl(font.file)}')`, { weight: font.weight, display: 'swap' });
                yield face.load();
                document.fonts.add(face);
                loaded.push(face);
            }
            catch (error) {
                console.warn(`🎛️ Could not load ${font.family}:`, error);
            }
        }))).then(() => undefined);
        return pending;
    }
    /** Take them off the document again, so unmounting leaves nothing behind. */
    function unloadFonts() {
        for (const face of loaded) {
            try {
                document.fonts.delete(face);
            }
            catch (_a) {
                // Already gone, or the document is being torn down.
            }
        }
        loaded = [];
        pending = null;
    }

    // shell/settings.ts
    const ZONE_LABEL = {
        left: 'LEFT',
        top: 'TOP',
        bottom: 'BTM',
        right: 'RIGHT',
        off: 'OFF',
    };
    /** Which zones a section can actually be read in. */
    function allowedZones(definition) {
        return ZONES.filter(zone => {
            if (zone === 'off')
                return true;
            const axis = zone === 'left' || zone === 'right' ? 'vertical' : 'horizontal';
            return definition.supports.includes(axis);
        });
    }
    const SETTINGS_STYLES = `
  .settings-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  }
  .settings-scrim { position: absolute; inset: 0; background: rgba(6,7,9,.72); }
  .settings-panel {
    position: relative;
    width: 560px;
    max-width: calc(100vw - 40px);
    max-height: calc(100vh - 60px);
    overflow-y: auto;
    background: var(--cc-panel);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 12px;
    box-shadow: 0 30px 70px rgba(0,0,0,.6);
  }
  .settings-header {
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--cc-hairline);
    position: sticky;
    top: 0;
    background: var(--cc-panel);
    z-index: 1;
  }
  /* Focused programmatically so Escape works; the ring would be noise. */
  .settings-panel:focus { outline: none; }
  .settings-title { font-size: 18px; font-weight: 800; color: var(--cc-text); }
  .settings-close {
    font-family: var(--cc-mono);
    font-size: 18px;
    color: var(--cc-mono-dim);
    background: none;
    border: 0;
    cursor: pointer;
    padding: 0 4px;
  }
  .settings-close:hover { color: var(--cc-text); }

  .settings-group { padding: 18px 20px 8px; }
  .settings-group-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .settings-legend {
    font-family: var(--cc-mono);
    font-size: 11px;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--cc-accent);
  }
  .settings-hint {
    font-family: var(--cc-mono);
    font-size: 11px;
    color: var(--cc-label-dim);
  }

  .preset-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .preset {
    background: var(--cc-surface);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 7px;
    padding: 9px 13px;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    min-width: 0;
  }
  .preset:hover { border-color: var(--cc-accent); }
  .preset--active {
    background: var(--cc-accent-tint);
    border-color: var(--cc-accent);
  }
  .preset-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--cc-text-body);
    line-height: 1.2;
  }
  .preset--active .preset-name { color: var(--cc-accent); }
  .preset-note {
    font-size: 11px;
    color: var(--cc-label-dim);
    line-height: 1.3;
    margin-top: 2px;
  }

  .section-list { display: flex; flex-direction: column; gap: 6px; }
  .section-row {
    background: var(--cc-surface);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .section-row--off { border-color: transparent; }
  .section-row-text { flex: 1; min-width: 0; }
  .section-row-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--cc-text-body);
    line-height: 1.2;
  }
  .section-row--off .section-row-name { color: var(--cc-label-dim); }
  .section-row-note {
    font-size: 11px;
    color: var(--cc-label-dim);
    line-height: 1.3;
    margin-top: 2px;
  }

  .zone-picker {
    display: flex;
    gap: 2px;
    background: rgba(0,0,0,.35);
    border-radius: 7px;
    padding: 2px;
  }
  .zone-button {
    font-family: var(--cc-mono);
    font-size: 11px;
    padding: 5px 8px;
    border-radius: 5px;
    border: 0;
    background: none;
    color: var(--cc-mono-dim);
    cursor: pointer;
  }
  .zone-button:hover:not(:disabled) { color: var(--cc-text); }
  .zone-button--active {
    background: var(--cc-accent);
    color: var(--cc-panel);
    font-weight: 700;
  }
  .zone-button:disabled { color: var(--cc-zero); cursor: not-allowed; }

  .reorder { display: flex; flex-direction: column; gap: 2px; }
  .reorder button {
    width: 22px;
    height: 15px;
    border: 0;
    border-radius: 4px;
    background: rgba(255,255,255,.07);
    color: var(--cc-chevron);
    font-size: 9px;
    line-height: 1;
    cursor: pointer;
  }
  .reorder button:hover:not(:disabled) { background: rgba(255,255,255,.16); color: var(--cc-text); }
  .reorder button:disabled { color: var(--cc-zero); cursor: default; }

  .size-row { display: flex; align-items: center; gap: 14px; margin-top: 10px; }
  .size-row:first-of-type { margin-top: 0; }
  .size-label { font-size: 13px; color: var(--cc-text-muted); width: 92px; }
  .size-row input { flex: 1; accent-color: var(--cc-accent); }
  .size-value {
    font-family: var(--cc-mono);
    font-size: 12px;
    color: var(--cc-text-muted);
    width: 52px;
    text-align: right;
  }

  .settings-footer {
    padding: 18px 20px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .settings-reset {
    font-family: var(--cc-mono);
    font-size: 11px;
    color: var(--cc-mono-dim);
    background: none;
    border: 0;
    cursor: pointer;
    padding: 0;
  }
  .settings-reset:hover { color: var(--cc-text); }
  .settings-done {
    background: var(--cc-accent);
    color: var(--cc-panel);
    font-family: inherit;
    font-size: 14px;
    font-weight: 800;
    border: 0;
    border-radius: 8px;
    padding: 9px 18px;
    cursor: pointer;
  }
  .settings-done:hover { filter: brightness(1.08); }
`;
    class SettingsDialog {
        constructor(options) {
            this.options = options;
            this.root = null;
            this.body = null;
        }
        isOpen() {
            return this.root !== null;
        }
        open(parent) {
            if (this.root)
                return;
            const backdrop = el('div', 'settings-backdrop');
            const scrim = el('div', 'settings-scrim');
            scrim.addEventListener('click', () => this.options.onClose());
            const panel = el('div', 'settings-panel');
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-label', 'Counter settings');
            const header = el('div', 'settings-header');
            header.append(el('div', 'settings-title', 'Counter settings'));
            const close = el('button', 'settings-close', '×');
            close.type = 'button';
            close.setAttribute('aria-label', 'Close settings');
            close.addEventListener('click', () => this.options.onClose());
            header.appendChild(close);
            const body = el('div');
            panel.append(header, body);
            backdrop.append(scrim, panel);
            parent.appendChild(backdrop);
            this.root = backdrop;
            this.body = body;
            this.render();
            // Escape closes, as a dialog should.
            const onKey = (event) => {
                if (event.key === 'Escape')
                    this.options.onClose();
            };
            backdrop.addEventListener('keydown', onKey);
            panel.tabIndex = -1;
            panel.focus();
        }
        close() {
            var _a;
            (_a = this.root) === null || _a === void 0 ? void 0 : _a.remove();
            this.root = null;
            this.body = null;
        }
        /** Rebuild the dialog's contents from the current layout. */
        render() {
            if (!this.body)
                return;
            const layout = this.options.layout();
            const definitions = this.options.sections();
            const byId = new Map(definitions.map(d => [d.id, d]));
            this.body.textContent = '';
            this.body.append(this.buildPresets(layout), this.buildSections(layout, byId), this.buildSizes(layout), this.buildFooter());
        }
        group(legend, hint) {
            const group = el('div', 'settings-group');
            const head = el('div', 'settings-group-head');
            head.appendChild(el('span', 'settings-legend', legend));
            if (hint)
                head.appendChild(el('span', 'settings-hint', hint));
            group.appendChild(head);
            return group;
        }
        buildPresets(layout) {
            const group = this.group('Presets');
            const row = el('div', 'preset-row');
            for (const preset of PRESETS) {
                const built = preset.build();
                const active = samePlacement(built, layout);
                const button = el('button', active ? 'preset preset--active' : 'preset');
                button.type = 'button';
                button.append(el('div', 'preset-name', preset.name), el('div', 'preset-note', preset.note));
                button.addEventListener('click', () => {
                    // Presets set placement only; the current gutter sizes are kept.
                    const next = preset.build();
                    next.left.size = layout.left.size;
                    next.right.size = layout.right.size;
                    next.top.size = layout.top.size;
                    next.bottom.size = layout.bottom.size;
                    this.options.onLayout(next);
                });
                row.appendChild(button);
            }
            group.appendChild(row);
            return group;
        }
        buildSections(layout, byId) {
            const group = this.group('Sections', 'place · reorder · hide');
            const list = el('div', 'section-list');
            const rows = listSections(layout, [...byId.keys()].filter((id) => byId.has(id)));
            rows.forEach(({ id, zone }, index) => {
                const definition = byId.get(id);
                if (!definition)
                    return;
                const row = el('div', zone === 'off' ? 'section-row section-row--off' : 'section-row');
                // Deliberately not data-section: that identifies a MOUNTED section in a
                // gutter, and sharing it makes every selector ambiguous.
                row.dataset.settingsRow = id;
                const text = el('div', 'section-row-text');
                text.append(el('div', 'section-row-name', definition.title));
                if (definition.note) {
                    text.append(el('div', 'section-row-note', definition.note));
                }
                row.appendChild(text);
                row.appendChild(this.buildZonePicker(layout, definition, zone));
                row.appendChild(this.buildReorder(layout, rows, id, zone, index));
                list.appendChild(row);
            });
            group.appendChild(list);
            return group;
        }
        buildZonePicker(layout, definition, zone) {
            const picker = el('div', 'zone-picker');
            const allowed = allowedZones(definition);
            for (const candidate of ZONES) {
                const button = el('button', candidate === zone ? 'zone-button zone-button--active' : 'zone-button', ZONE_LABEL[candidate]);
                button.type = 'button';
                button.dataset.zone = candidate;
                if (!allowed.includes(candidate)) {
                    // Saying why beats a control that silently does nothing.
                    button.disabled = true;
                    button.title = `${definition.title} is too wide to read in a side rail`;
                }
                else {
                    button.addEventListener('click', () => this.options.onLayout(placeSection(layout, definition.id, candidate)));
                }
                picker.appendChild(button);
            }
            return picker;
        }
        buildReorder(layout, rows, id, zone, index) {
            const inZone = rows.filter(row => row.zone === zone);
            const position = inZone.findIndex(row => row.id === id);
            const wrap = el('div', 'reorder');
            const step = (direction, label, disabled) => {
                const button = el('button', undefined, label);
                button.type = 'button';
                button.disabled = disabled;
                button.setAttribute('aria-label', direction === -1 ? 'Move up' : 'Move down');
                if (!disabled) {
                    button.addEventListener('click', () => this.options.onLayout(reorderSection(layout, id, direction)));
                }
                return button;
            };
            wrap.append(step(-1, '▲', position <= 0), step(1, '▼', position < 0 || position >= inZone.length - 1));
            return wrap;
        }
        buildSizes(layout) {
            const group = this.group('Gutter size');
            const slider = (label, value, min, max, onInput) => {
                const row = el('div', 'size-row');
                const input = el('input');
                input.type = 'range';
                input.min = String(min);
                input.max = String(max);
                input.step = '5';
                input.value = String(value);
                input.setAttribute('aria-label', label);
                const readout = el('span', 'size-value', `${value}px`);
                input.addEventListener('input', () => {
                    const next = Number(input.value);
                    readout.textContent = `${next}px`;
                    onInput(next);
                });
                row.append(el('span', 'size-label', label), input, readout);
                return row;
            };
            group.append(slider('Side rail', layout.left.size, MIN_RAIL_WIDTH, MAX_RAIL_WIDTH, n => this.options.onSize('rail', n)), slider('Bottom bar', layout.bottom.size, 150, 320, n => this.options.onSize('bar', n)));
            return group;
        }
        buildFooter() {
            const footer = el('div', 'settings-footer');
            const reset = el('button', 'settings-reset', 'RESET TO DEFAULT');
            reset.type = 'button';
            reset.addEventListener('click', () => this.options.onReset());
            const done = el('button', 'settings-done', 'Done');
            done.type = 'button';
            done.addEventListener('click', () => this.options.onClose());
            footer.append(reset, done);
            return footer;
        }
    }
    /** Whether two layouts place every section the same way, sizes aside. */
    function samePlacement(a, b) {
        var _a;
        const ids = new Set();
        for (const layout of [a, b]) {
            for (const zone of ZONES) {
                const list = zone === 'off' ? ((_a = layout.off) !== null && _a !== void 0 ? _a : []) : layout[zone].sections;
                for (const placement of list)
                    ids.add(placement.id);
            }
        }
        for (const id of ids) {
            if (zoneOf(a, id) !== zoneOf(b, id))
                return false;
        }
        return true;
    }

    /**
     * MAIN-world viewport control for the v2 gutter UI.
     *
     * Colonist has no single page root to pad: it absolutely-positions its canvas
     * layers and `#ui-game` on <body> and writes inline pixel sizes onto them,
     * recomputed from `window.innerWidth`/`innerHeight` whenever a resize fires.
     * The only way to make it lay out inside a smaller area — crisply, at native
     * resolution, without touching its own transforms — is to make it read smaller
     * numbers and tell it to re-measure.
     *
     * That has to happen in the page's own JavaScript world, so this module runs
     * alongside the transport hook and takes its commands from the isolated content
     * script over the same window.postMessage bridge.
     */
    const PAGE_VIEWPORT_SOURCE = 'catan-counter-page-viewport-v1';
    const ZERO_INSET = {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    };

    // shell/pageFrame.ts
    const STYLE_ID = 'catan-v2-page-frame';
    /** If the MAIN-world half never answers, stop waiting and carry on. */
    const REPORT_TIMEOUT_MS = 750;
    /** Below this the game is too cramped to be worth squeezing further. */
    const MIN_PAGE_WIDTH = 900;
    const MIN_PAGE_HEIGHT = 500;
    let nonce = 0;
    let installed = false;
    /**
     * Whether the MAIN-world half is answering. It is injected at document_start,
     * well before any UI mounts, so if the first request goes unanswered it is not
     * coming — and every later call should skip the wait instead of stalling the
     * shell for a timeout each time.
     */
    let bridgeResponsive = null;
    let reportTimeoutMs = REPORT_TIMEOUT_MS;
    Object.assign({}, ZERO_INSET);
    function post(type, inset) {
        const id = ++nonce;
        window.postMessage({ source: PAGE_VIEWPORT_SOURCE, type, inset, nonce: id }, window.location.origin);
        return id;
    }
    /** Wait for the report matching this command, or give up. */
    function awaitReport(id) {
        return new Promise(resolve => {
            const timer = window.setTimeout(() => {
                window.removeEventListener('message', listener);
                resolve(null);
            }, reportTimeoutMs);
            function listener(event) {
                if (event.source !== window || event.origin !== window.location.origin)
                    return;
                const data = event.data;
                if (!data ||
                    data.source !== PAGE_VIEWPORT_SOURCE ||
                    data.type !== 'report' ||
                    data.nonce !== id)
                    return;
                window.clearTimeout(timer);
                window.removeEventListener('message', listener);
                resolve(data);
            }
            window.addEventListener('message', listener);
        });
    }
    /**
     * Shift colonist's own elements out from under the gutters.
     *
     * Uses the independent CSS `translate` property, never `transform`: colonist
     * pairs `top: 50%` with `transform: translateY(-50%)` on its canvas, so writing
     * transform here would drop the board half a screen. `translate` composes with
     * it and colonist never sets it.
     */
    function applyShift(left, top) {
        let style = document.getElementById(STYLE_ID);
        if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            document.head.appendChild(style);
        }
        style.textContent =
            left === 0 && top === 0
                ? ''
                : `body > *:not(#catan-v2-root):not(#${STYLE_ID}) { translate: ${left}px ${top}px; }`;
    }
    function removeShift() {
        var _a;
        (_a = document.getElementById(STYLE_ID)) === null || _a === void 0 ? void 0 : _a.remove();
    }
    /** Clamp so the game never gets squeezed into uselessness. */
    function clampInset(inset) {
        const maxHorizontal = Math.max(0, window.innerWidth - MIN_PAGE_WIDTH);
        const maxVertical = Math.max(0, window.innerHeight - MIN_PAGE_HEIGHT);
        const horizontal = inset.left + inset.right;
        const vertical = inset.top + inset.bottom;
        const scale = (value, total, max) => total <= max || total === 0 ? value : Math.floor((value * max) / total);
        return {
            left: scale(inset.left, horizontal, maxHorizontal),
            right: scale(inset.right, horizontal, maxHorizontal),
            top: scale(inset.top, vertical, maxVertical),
            bottom: scale(inset.bottom, vertical, maxVertical),
        };
    }
    /**
     * Squeeze the page so the given edges are free, then shift it clear of the
     * left and top gutters.
     *
     * The inset frees exactly the space it asks for — colonist sizes its layers to
     * the viewport height it is told. But it also centers them, so half that space
     * lands above the game and half below, and asking for a 176px bottom gutter
     * leaves 88px at each end. Pinning the content to the top instead of trying to
     * ask for more is what makes this exact: the gap that was above moves to the
     * bottom, where the gutter is.
     *
     * The shift is cleared before measuring rather than compensated for, so each
     * call re-derives the offset from scratch and repeated calls land identically.
     */
    function applyPageFrame(requested) {
        return __awaiter(this, void 0, void 0, function* () {
            const target = clampInset(requested);
            installed = true;
            // Without the MAIN-world half the page cannot be squeezed at all; the gutters
            // still render, they just sit over the page instead of beside it.
            if (bridgeResponsive === false) {
                applyShift(0, 0);
                return { applied: false };
            }
            applyShift(0, 0);
            const report = yield awaitReport(post('set-inset', target));
            // The MAIN-world half is missing (hook blocked, or an older build): the
            // gutters still render, they just overlay the page instead of framing it.
            if (!report) {
                bridgeResponsive = false;
                console.warn('🎛️ The page-viewport hook did not answer — v2 will overlay the page instead of shrinking it');
                return { applied: false };
            }
            bridgeResponsive = true;
            if (!report.content) {
                // Colonist has not drawn the board yet; the horizontal shift is safe on its
                // own, and the next call (or the next resize) will settle the vertical one.
                applyShift(target.left, 0);
                return { applied: true };
            }
            const shiftY = Math.round(target.top - report.content.top);
            applyShift(target.left, shiftY);
            return {
                applied: true,
                free: {
                    left: report.content.left + target.left,
                    bottom: report.real.height - (report.content.bottom + shiftY),
                },
            };
        });
    }
    /** Put the page back exactly as it was. */
    function releasePageFrame() {
        return __awaiter(this, void 0, void 0, function* () {
            removeShift();
            if (!installed)
                return;
            installed = false;
            Object.assign({}, ZERO_INSET);
            if (bridgeResponsive === false)
                return;
            yield awaitReport(post('release'));
        });
    }

    // shell/shell.ts
    const ROOT_ID = 'catan-v2-root';
    const AXIS = {
        left: 'vertical',
        right: 'vertical',
        top: 'horizontal',
        bottom: 'horizontal',
    };
    /** Extension assets need an absolute URL; tests run without the API. */
    function assetUrl(path) {
        var _a, _b, _c;
        try {
            return (_c = (_b = (_a = chrome === null || chrome === void 0 ? void 0 : chrome.runtime) === null || _a === void 0 ? void 0 : _a.getURL) === null || _b === void 0 ? void 0 : _b.call(_a, path)) !== null && _c !== void 0 ? _c : path;
        }
        catch (_d) {
            return path;
        }
    }
    /** Drawn rather than an emoji, so it scales and recolors with the UI. */
    function gearIcon(size) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', String(size));
        svg.setAttribute('height', String(size));
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '12');
        circle.setAttribute('cy', '12');
        circle.setAttribute('r', '3.2');
        const teeth = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        teeth.setAttribute('d', 'M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.7 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.7a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.7a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.3 9c.24.58.8.97 1.43 1h.27a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z');
        svg.append(circle, teeth);
        return svg;
    }
    /**
     * Whether the gutters should show a status instead of the sections. Both cases
     * are moments when the tables would be actively misleading: during a history
     * replay the counts are still being rebuilt, and before the first roll the
     * tracker deliberately discards and rebuilds its variant tree.
     */
    function statusFor(view) {
        if (view.isLoadingHistory) {
            return {
                text: 'Rebuilding game history',
                detail: 'Reading the chat back from the start of the game.',
                spinner: true,
            };
        }
        if (!view.hasStarted) {
            return {
                text: 'Waiting for the first dice roll',
                detail: 'Tracking begins with the first roll of the game.',
                spinner: false,
            };
        }
        return null;
    }
    function buildStatus(status, withDetail) {
        const host = document.createElement('div');
        host.className = 'rail-status';
        if (status.spinner) {
            const spinner = document.createElement('div');
            spinner.className = 'rail-spinner';
            host.appendChild(spinner);
        }
        const text = document.createElement('div');
        text.textContent = status.text;
        host.appendChild(text);
        // Only the gutter carrying the header has room for the longer explanation.
        if (withDetail) {
            const detail = document.createElement('div');
            detail.className = 'rail-status-detail';
            detail.textContent = status.detail;
            host.appendChild(detail);
        }
        return host;
    }
    class Shell {
        constructor(options) {
            this.options = options;
            this.root = null;
            this.shadow = null;
            this.layout = cloneLayout(DEFAULT_LAYOUT);
            this.gutters = new Map();
            this.mounted = new Map();
            this.historyLoading = false;
            /** Status text currently rendered, so update() can notice a transition. */
            this.status = '';
            this.disposers = [];
            this.framePending = false;
            this.settings = new SettingsDialog({
                layout: () => this.layout,
                sections: () => registeredSections(this.options.registry),
                onLayout: next => this.applyLayout(next),
                onSize: (gutter, size) => this.applySize(gutter, size),
                onReset: () => this.applyLayout(cloneLayout(DEFAULT_LAYOUT)),
                onClose: () => this.closeSettings(),
            });
        }
        isMounted() {
            return this.root !== null;
        }
        mount() {
            if (this.root)
                return;
            this.root = document.createElement('div');
            this.root.id = ROOT_ID;
            // documentElement, not body: colonist's own children get shifted, and this
            // must not be one of them.
            document.documentElement.appendChild(this.root);
            this.shadow = this.root.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            style.textContent = buildStyleSheet([
                ...registeredStyles(this.options.registry),
                SETTINGS_STYLES,
            ]);
            this.shadow.appendChild(style);
            // Registered on the document rather than in the shadow root, which Chrome
            // would ignore. Nothing waits on it: the stacks fall back to system faces
            // until the files arrive.
            void loadFonts(assetUrl);
            this.render();
            // Colonist re-lays out on window resize; so must the frame.
            const onResize = () => void this.syncPageFrame();
            window.addEventListener('resize', onResize);
            this.disposers.push(() => window.removeEventListener('resize', onResize));
            // Storage answers after the first paint; re-render if it differs.
            void readLayout().then(stored => {
                if (!this.root)
                    return;
                const merged = withKnownSections(stored, registeredSections(this.options.registry).map(section => section.id));
                if (JSON.stringify(merged) === JSON.stringify(this.layout))
                    return;
                this.layout = merged;
                this.render();
            });
        }
        unmount() {
            if (!this.root)
                return;
            this.settings.close();
            this.destroySections();
            this.disposers.forEach(dispose => dispose());
            this.disposers = [];
            this.gutters.clear();
            this.root.remove();
            this.root = null;
            this.shadow = null;
            unloadFonts();
            void releasePageFrame();
        }
        setHistoryLoading(loading) {
            if (this.historyLoading === loading)
                return;
            this.historyLoading = loading;
            this.render();
        }
        update() {
            var _a, _b;
            if (!this.root)
                return;
            const view = this.currentView();
            // Crossing into or out of a status state swaps what the gutters hold, so it
            // needs a full render rather than an update of sections that aren't mounted.
            const status = (_b = (_a = statusFor(view)) === null || _a === void 0 ? void 0 : _a.text) !== null && _b !== void 0 ? _b : '';
            if (status !== this.status) {
                this.render();
                return;
            }
            // A section that throws must not take the rest of the UI down with it.
            for (const [id, section] of this.mounted) {
                try {
                    section.instance.update(view);
                }
                catch (error) {
                    console.warn(`🎛️ Section "${id}" failed to update:`, error);
                }
            }
        }
        currentView() {
            return buildGameView(game, { isLoadingHistory: this.historyLoading });
        }
        /** Rebuild the whole frame. Used on mount and whenever the layout changes. */
        render() {
            var _a, _b;
            if (!this.shadow)
                return;
            this.destroySections();
            this.gutters.forEach(gutter => gutter.remove());
            this.gutters.clear();
            this.shadow
                .querySelectorAll('.floating-gear')
                .forEach(node => node.remove());
            const view = this.currentView();
            const headerGutter = this.headerGutter();
            this.status = (_b = (_a = statusFor(view)) === null || _a === void 0 ? void 0 : _a.text) !== null && _b !== void 0 ? _b : '';
            for (const name of GUTTER_NAMES) {
                const config = this.layout[name];
                if (config.sections.length === 0)
                    continue;
                const gutter = document.createElement('div');
                const collapsed = config.collapsed;
                gutter.className = [
                    'gutter',
                    `gutter--${name}`,
                    `gutter--${AXIS[name]}`,
                    collapsed ? 'gutter--collapsed' : '',
                ]
                    .filter(Boolean)
                    .join(' ');
                this.sizeGutter(gutter, name);
                if (name === headerGutter)
                    gutter.appendChild(this.buildHeader(collapsed));
                if (!collapsed) {
                    const body = document.createElement('div');
                    body.className = 'gutter-body';
                    gutter.appendChild(body);
                    const status = statusFor(view);
                    // While the counts are being rebuilt, or before tracking has begun,
                    // showing the tables would show numbers that are about to change.
                    if (status) {
                        body.appendChild(buildStatus(status, name === headerGutter));
                    }
                    else {
                        this.fillGutter(body, name, view);
                    }
                    gutter.appendChild(this.buildResizeHandle(name));
                }
                this.shadow.appendChild(gutter);
                this.gutters.set(name, gutter);
            }
            // The header only ever lives on a vertical rail; without one, float it.
            const railHasHeader = headerGutter === 'left' || headerGutter === 'right';
            if (!railHasHeader)
                this.shadow.appendChild(this.buildFloatingGear());
            void this.syncPageFrame();
        }
        /**
         * The header lives on a side rail, preferring the left. Bars are too short to
         * carry it, so when neither rail is in use there is no header at all and the
         * gear floats over the page instead.
         *
         * Shared with the layout repair, which relies on the same answer to decide
         * which gutter may be left collapsed.
         */
        headerGutter() {
            return headerGutterOf(this.layout);
        }
        sizeGutter(gutter, name) {
            const thickness = gutterThickness(this.layout[name]);
            const inset = this.insets();
            if (AXIS[name] === 'vertical') {
                gutter.style.width = `${thickness}px`;
            }
            else {
                gutter.style.height = `${thickness}px`;
                // Horizontal gutters stop at the vertical ones, so the corners belong to
                // the rail — matching the mockup, where the rail runs the full height.
                gutter.style.left = `${inset.left}px`;
                gutter.style.right = `${inset.right}px`;
            }
        }
        insets() {
            return {
                left: gutterThickness(this.layout.left),
                right: gutterThickness(this.layout.right),
                top: gutterThickness(this.layout.top),
                bottom: gutterThickness(this.layout.bottom),
            };
        }
        buildHeader(collapsed) {
            const header = document.createElement('div');
            header.className = 'rail-header';
            const brand = document.createElement('div');
            brand.className = 'rail-brand';
            const logo = document.createElement('div');
            logo.className = 'rail-logo';
            logo.textContent = 'CC';
            const titles = document.createElement('div');
            const title = document.createElement('div');
            title.className = 'rail-title';
            title.textContent = 'Counter';
            titles.appendChild(title);
            brand.append(logo, titles);
            const toggle = document.createElement('button');
            toggle.className = 'rail-collapse';
            toggle.type = 'button';
            toggle.textContent = collapsed ? '›' : '‹';
            toggle.title = collapsed ? 'Expand the counter' : 'Collapse the counter';
            toggle.setAttribute('aria-label', collapsed ? 'Expand the counter' : 'Collapse the counter');
            toggle.addEventListener('click', () => this.toggleCollapse());
            if (collapsed) {
                header.append(toggle);
                return header;
            }
            const controls = el('div', 'rail-controls');
            controls.append(this.buildGearButton(17, 'rail-gear'), toggle);
            header.append(brand, controls);
            return header;
        }
        /**
         * With no rail on screen there is no header to hold the gear, so it floats
         * over the page instead. Without this the Competitive preset — bottom bar
         * only — would have no way back into settings.
         */
        buildFloatingGear() {
            return this.buildGearButton(18, 'floating-gear');
        }
        toggleCollapse() {
            const name = this.headerGutter();
            if (!name)
                return;
            this.layout[name].collapsed = !this.layout[name].collapsed;
            void writeLayout(this.layout);
            this.render();
        }
        /** Mount each section the layout puts in this gutter. */
        fillGutter(body, name, view) {
            var _a;
            const axis = AXIS[name];
            const thickness = gutterThickness(this.layout[name]);
            for (const placement of this.layout[name].sections) {
                const definition = getSection(placement.id, this.options.registry);
                if (!definition) {
                    console.warn(`🎛️ No section registered as "${placement.id}"`);
                    continue;
                }
                if (!definition.supports.includes(axis)) {
                    console.warn(`🎛️ Section "${placement.id}" cannot render in a ${axis} gutter — skipping`);
                    continue;
                }
                // Only the gutter's thickness is knowable here; its long axis is shared.
                const available = axis === 'vertical' ? definition.min.width : definition.min.height;
                const measured = axis === 'vertical' ? thickness : thickness;
                if (measured < available) {
                    console.warn(`🎛️ Section "${placement.id}" needs ${available}px but the ${name} gutter is ${measured}px — skipping`);
                    continue;
                }
                const host = document.createElement('div');
                host.className = 'section';
                host.dataset.section = placement.id;
                if (axis === 'horizontal') {
                    host.style.flex = `${(_a = placement.weight) !== null && _a !== void 0 ? _a : 1} 1 0`;
                }
                body.appendChild(host);
                try {
                    const instance = definition.mount(host, view, {
                        axis,
                        assetUrl,
                        emit: action => this.options.onAction(action),
                    });
                    this.mounted.set(placement.id, { instance, host });
                }
                catch (error) {
                    console.warn(`🎛️ Section "${placement.id}" failed to mount:`, error);
                    host.remove();
                }
            }
        }
        destroySections() {
            for (const [id, section] of this.mounted) {
                try {
                    section.instance.destroy();
                }
                catch (error) {
                    console.warn(`🎛️ Section "${id}" failed to unmount:`, error);
                }
            }
            this.mounted.clear();
        }
        buildResizeHandle(name) {
            const handle = document.createElement('div');
            handle.className = 'gutter-resize';
            handle.addEventListener('pointerdown', event => {
                event.preventDefault();
                const vertical = AXIS[name] === 'vertical';
                const start = vertical ? event.clientX : event.clientY;
                const startSize = this.layout[name].size;
                handle.setPointerCapture(event.pointerId);
                const onMove = (move) => {
                    const delta = (vertical ? move.clientX : move.clientY) - start;
                    // Left and top gutters grow with the pointer; right and bottom shrink.
                    const signed = name === 'left' || name === 'top' ? delta : -delta;
                    const next = Math.round(Math.min(MAX_RAIL_WIDTH, Math.max(MIN_RAIL_WIDTH, startSize + signed)));
                    if (next === this.layout[name].size)
                        return;
                    this.layout[name].size = next;
                    this.applySizes();
                };
                const onUp = () => {
                    handle.removeEventListener('pointermove', onMove);
                    handle.removeEventListener('pointerup', onUp);
                    void writeLayout(this.layout);
                    // One squeeze at the end rather than on every pointer move.
                    void this.syncPageFrame();
                };
                handle.addEventListener('pointermove', onMove);
                handle.addEventListener('pointerup', onUp);
            });
            return handle;
        }
        /** Cheap path used while dragging: resize boxes without remounting anything. */
        applySizes() {
            for (const [name, gutter] of this.gutters)
                this.sizeGutter(gutter, name);
        }
        syncPageFrame() {
            return __awaiter(this, void 0, void 0, function* () {
                if (!this.root || this.framePending)
                    return;
                this.framePending = true;
                try {
                    yield applyPageFrame(this.insets());
                }
                finally {
                    this.framePending = false;
                }
            });
        }
        /** Apply a layout change from the settings menu, live. */
        applyLayout(next) {
            this.layout = repairLayout(next);
            void writeLayout(this.layout);
            this.render();
            // The dialog is rebuilt separately: render() only owns the gutters.
            this.settings.render();
        }
        /**
         * Both side rails share one width and both bars one height, so the slider
         * that sets a rail sets whichever rail is showing.
         */
        applySize(gutter, size) {
            if (gutter === 'rail') {
                this.layout.left.size = size;
                this.layout.right.size = size;
            }
            else {
                this.layout.top.size = size;
                this.layout.bottom.size = size;
            }
            this.applySizes();
            void writeLayout(this.layout);
            void this.syncPageFrame();
        }
        openSettings() {
            if (!this.shadow || this.settings.isOpen())
                return;
            this.settings.open(this.shadow);
        }
        closeSettings() {
            this.settings.close();
            this.render();
        }
        /** A gear that opens the settings menu. */
        buildGearButton(size, className) {
            const button = document.createElement('button');
            button.className = className;
            button.type = 'button';
            button.title = 'Counter settings';
            button.setAttribute('aria-label', 'Counter settings');
            button.appendChild(gearIcon(size));
            button.addEventListener('click', () => this.openSettings());
            return button;
        }
        /** Test seam: the layout the shell is currently rendering. */
        getLayout() {
            return cloneLayout(this.layout);
        }
        /** Replace the layout wholesale — the seam a future arrangement UI uses. */
        setLayout(layout) {
            this.layout = repairLayout(layout);
            void writeLayout(this.layout);
            if (this.root)
                this.render();
        }
        /** Test seam: the shadow root, so tests can assert on rendered structure. */
        getShadowRoot() {
            return this.shadow;
        }
    }

    // sections/blockedRobber.ts
    const STYLES$7 = `
  .blocked-row {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--cc-surface);
    border-radius: 6px;
    padding: 6px 9px;
  }
  .blocked-number {
    width: 20px;
    height: 20px;
    flex: none;
    border-radius: 50%;
    background: var(--cc-well);
    border: 1px solid rgba(255,255,255,.16);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--cc-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--cc-text-body);
  }
  .blocked-row img { width: 12px; height: 17px; border-radius: 1px; display: block; flex: none; }
  .blocked-spacer { flex: 1; }
  .blocked-count { font-family: var(--cc-mono); font-size: 13px; color: var(--cc-accent); }
`;
    const blockedRobberSection = {
        id: 'blocked-robber',
        title: 'Blocked by robber',
        note: 'Production denied per number',
        supports: ['vertical'],
        min: { width: 200, height: 0 },
        styles: STYLES$7,
        mount(host, view, ctx) {
            const { head, hintNode } = sectionHead('Blocked by robber');
            const rows = el('div', 'section-rows');
            const empty = el('div', 'section-empty', 'The robber has cost nobody yet.');
            host.append(head, rows, empty);
            let rendered = '';
            function render(next) {
                hintNode.textContent = `${next.blockedTotal} denied`;
                hintNode.style.display = next.blockedTotal > 0 ? '' : 'none';
                empty.style.display = next.blocked.length === 0 ? '' : 'none';
                const signature = next.blocked
                    .map(entry => `${entry.diceNumber}${entry.resource}${entry.count}`)
                    .join('|');
                if (signature === rendered)
                    return;
                rendered = signature;
                rows.textContent = '';
                for (const entry of next.blocked) {
                    const row = el('div', 'blocked-row');
                    row.append(el('div', 'blocked-number', String(entry.diceNumber)), img(ctx.assetUrl(`assets/${RESOURCE_STYLE[entry.resource].icon}`), entry.resource), el('div', 'blocked-spacer'), el('span', 'blocked-count', `\u00d7${entry.count}`));
                    rows.appendChild(row);
                }
            }
            render(view);
            return {
                update: render,
                destroy: () => {
                    host.textContent = '';
                },
            };
        },
    };

    // sections/cardFlow.ts
    const STYLES$6 = `
  .flow-grid {
    display: grid;
    grid-template-columns: minmax(78px, 1.2fr) repeat(6, minmax(26px, 1fr));
    gap: 3px;
    align-items: center;
    min-width: 0;
  }
  .flow-head {
    font-family: var(--cc-mono);
    font-size: 10px;
    color: var(--cc-label-dim);
    text-align: center;
  }
  .flow-name {
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 4px;
  }
  .flow-cell {
    border-radius: 4px;
    padding: 5px 0;
    text-align: center;
    font-family: var(--cc-mono);
    font-size: 13px;
    font-weight: 600;
  }
  .flow-cell--gain { background: rgba(94,200,160,.12); color: var(--cc-good-text); }
  .flow-cell--loss { background: rgba(227,91,91,.12); color: var(--cc-loss-text); }
  .flow-cell--spend { background: rgba(232,163,61,.12); color: var(--cc-spend-text); }
  .flow-cell--hand { color: var(--cc-text-body); min-width: 0; }
  /* A column that never happened should not read as a number worth weighing. */
  .flow-cell--none { color: var(--cc-zero); }
`;
    const NOTE$1 = 'GOT is everything picked up: production, trades and steals. ROBD is what ' +
        'the robber or a monopoly took. SPENT covers building, buying and trading away.';
    /** Column definitions, in display order. */
    const COLUMNS = [
        { label: 'GOT', tone: 'gain', dimZero: false, value: r => r.got },
        { label: 'DEV', tone: 'gain', dimZero: true, value: r => r.devGain },
        { label: 'ROBD', tone: 'loss', dimZero: true, value: r => r.robbed },
        { label: '7s', tone: 'loss', dimZero: true, value: r => r.sevens },
        {
            label: 'SPENT',
            tone: 'spend',
            dimZero: false,
            value: r => r.spentAndTraded,
        },
        { label: 'HAND', tone: 'hand', dimZero: false, value: r => r.hand },
    ];
    const cardFlowSection = {
        id: 'card-flow',
        title: 'Card flow',
        note: 'Gained, robbed, discarded and spent per player',
        supports: ['vertical', 'horizontal'],
        min: { width: 260, height: 120 },
        styles: STYLES$6,
        mount(host, view) {
            const { head } = sectionHead('Card flow', 'whole game');
            const grid = el('div', 'flow-grid');
            const empty = el('div', 'section-empty', 'Nothing has moved yet.');
            const note = el('div', 'section-note', NOTE$1);
            grid.appendChild(el('div')); // spacer above the player-name column
            for (const column of COLUMNS) {
                grid.appendChild(el('div', 'flow-head', column.label));
            }
            host.append(head, grid, empty, note);
            let rows = new Map();
            let seating = '';
            function render(next) {
                var _a;
                const names = next.cardFlow.map(row => row.name).join(' ');
                if (names !== seating) {
                    seating = names;
                    // Rebuild the body but keep the header cells that lead the grid.
                    while (grid.children.length > COLUMNS.length + 1) {
                        (_a = grid.lastElementChild) === null || _a === void 0 ? void 0 : _a.remove();
                    }
                    rows = new Map();
                    for (const row of next.cardFlow) {
                        const name = el('div', 'flow-name');
                        grid.appendChild(name);
                        const cells = COLUMNS.map(column => {
                            const cell = el('div', column.tone === 'hand'
                                ? 'flow-cell flow-cell--hand'
                                : `flow-cell flow-cell--${column.tone}`);
                            grid.appendChild(cell);
                            return cell;
                        });
                        rows.set(row.name, { name, cells });
                    }
                }
                for (const row of next.cardFlow) {
                    const nodes = rows.get(row.name);
                    if (!nodes)
                        continue;
                    nodes.name.textContent = row.name;
                    nodes.name.style.color = row.color;
                    COLUMNS.forEach((column, index) => {
                        const value = column.value(row);
                        const cell = nodes.cells[index];
                        cell.textContent = String(value);
                        cell.classList.toggle('flow-cell--none', column.dimZero && value === 0);
                    });
                }
                const hasPlayers = next.cardFlow.length > 0;
                empty.style.display = hasPlayers ? 'none' : '';
                note.style.display = hasPlayers ? '' : 'none';
                grid.style.display = hasPlayers ? 'grid' : 'none';
            }
            render(view);
            return {
                update: render,
                destroy: () => {
                    host.textContent = '';
                },
            };
        },
    };

    // sections/cardFlowLedger.ts
    const STYLES$5 = `
  .ledger-grid {
    display: grid;
    grid-template-columns:
      minmax(80px, 1.1fr)
      repeat(5, minmax(28px, .8fr))
      10px
      repeat(6, minmax(28px, .8fr))
      10px
      minmax(32px, .9fr);
    gap: 3px;
    align-items: center;
    min-width: 0;
  }
  .ledger-band {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--cc-mono);
    font-size: 10px;
    letter-spacing: .1em;
  }
  .ledger-band-rule { flex: 1; height: 1px; }
  .ledger-band--gain { color: var(--cc-good-text); }
  .ledger-band--gain .ledger-band-rule { background: rgba(143,224,196,.3); }
  .ledger-band--loss { color: var(--cc-loss-text); }
  .ledger-band--loss .ledger-band-rule { background: rgba(241,154,154,.3); }

  .ledger-head {
    font-family: var(--cc-mono);
    font-size: 10px;
    color: var(--cc-label-dim);
    text-align: center;
  }
  /* The two subtotal columns lead their band, so they read first. */
  .ledger-head--total { color: var(--cc-text-muted); }
  .ledger-name {
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 4px;
  }
  .ledger-total {
    border-radius: 4px;
    padding: 5px 0;
    text-align: center;
    font-family: var(--cc-mono);
    font-size: 13px;
    font-weight: 600;
  }
  .ledger-total--gain { background: rgba(94,200,160,.16); color: var(--cc-good-text); }
  .ledger-total--loss { background: rgba(227,91,91,.16); color: var(--cc-loss-text); }
  .ledger-part {
    text-align: center;
    font-family: var(--cc-mono);
    font-size: 12px;
    color: var(--cc-text-body);
  }
  .ledger-part--none { color: var(--cc-zero); }
  .ledger-hand {
    text-align: center;
    font-family: var(--cc-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--cc-text-body);
  }
`;
    /** Sub-columns of each band, in display order. */
    const GAINS = [
        { label: 'DICE', value: r => r.dice },
        { label: 'ROB', value: r => r.robGain },
        { label: 'DEV', value: r => r.devGain },
        { label: 'TRDE', value: r => r.tradeGain },
    ];
    const LOSSES = [
        { label: '7s', value: r => r.sevens },
        { label: 'ROB', value: r => r.robLoss },
        { label: 'MONO', value: r => r.monoLoss },
        { label: 'TRDE', value: r => r.tradeLoss },
        { label: 'SPENT', value: r => r.spent },
    ];
    function band(kind, label, span) {
        const node = el('div', `ledger-band ledger-band--${kind}`);
        node.style.gridColumn = `span ${span}`;
        node.append(el('span', undefined, label), el('div', 'ledger-band-rule'));
        return node;
    }
    const cardFlowLedgerSection = {
        id: 'card-flow-ledger',
        title: 'Card flow — full ledger',
        note: 'Every gain and loss by source, top or bottom only',
        // Fourteen columns of numbers: only a wide bar can hold it.
        supports: ['horizontal'],
        min: { width: 0, height: 150 },
        styles: STYLES$5,
        mount(host, view) {
            const { head, hintNode } = sectionHead('Card flow · full ledger', 'every gain and loss by source');
            const grid = el('div', 'ledger-grid');
            const empty = el('div', 'section-empty', 'Nothing has moved yet.');
            // Band row: name spacer, GAINED over its five, gap, LOST over its six, HAND.
            grid.appendChild(el('div'));
            grid.appendChild(band('gain', 'GAINED', 5));
            grid.appendChild(el('div'));
            grid.appendChild(band('loss', 'LOST', 6));
            grid.appendChild(el('div'));
            grid.appendChild(el('div'));
            // Column labels.
            grid.appendChild(el('div'));
            grid.appendChild(el('div', 'ledger-head ledger-head--total', 'ALL'));
            for (const column of GAINS) {
                grid.appendChild(el('div', 'ledger-head', column.label));
            }
            grid.appendChild(el('div'));
            grid.appendChild(el('div', 'ledger-head ledger-head--total', 'ALL'));
            for (const column of LOSSES) {
                grid.appendChild(el('div', 'ledger-head', column.label));
            }
            grid.appendChild(el('div'));
            grid.appendChild(el('div', 'ledger-head ledger-head--total', 'HAND'));
            const headerCells = grid.children.length;
            host.append(head, grid, empty);
            let rows = new Map();
            let seating = '';
            function render(next) {
                var _a;
                hintNode.style.display = next.cardFlow.length > 0 ? '' : 'none';
                const names = next.cardFlow.map(row => row.name).join(' ');
                if (names !== seating) {
                    seating = names;
                    while (grid.children.length > headerCells) {
                        (_a = grid.lastElementChild) === null || _a === void 0 ? void 0 : _a.remove();
                    }
                    rows = new Map();
                    for (const row of next.cardFlow) {
                        const name = el('div', 'ledger-name');
                        const gained = el('div', 'ledger-total ledger-total--gain');
                        grid.append(name, gained);
                        const gains = GAINS.map(() => {
                            const cell = el('div', 'ledger-part');
                            grid.appendChild(cell);
                            return cell;
                        });
                        grid.appendChild(el('div'));
                        const lost = el('div', 'ledger-total ledger-total--loss');
                        grid.appendChild(lost);
                        const losses = LOSSES.map(() => {
                            const cell = el('div', 'ledger-part');
                            grid.appendChild(cell);
                            return cell;
                        });
                        grid.appendChild(el('div'));
                        const hand = el('div', 'ledger-hand');
                        grid.appendChild(hand);
                        rows.set(row.name, { name, gained, gains, lost, losses, hand });
                    }
                }
                for (const row of next.cardFlow) {
                    const nodes = rows.get(row.name);
                    if (!nodes)
                        continue;
                    nodes.name.textContent = row.name;
                    nodes.name.style.color = row.color;
                    nodes.gained.textContent = String(row.gained);
                    nodes.lost.textContent = String(row.lost);
                    nodes.hand.textContent = String(row.hand);
                    const paint = (cells, columns) => {
                        columns.forEach((column, index) => {
                            const value = column.value(row);
                            cells[index].textContent = String(value);
                            cells[index].classList.toggle('ledger-part--none', value === 0);
                        });
                    };
                    paint(nodes.gains, GAINS);
                    paint(nodes.losses, LOSSES);
                }
                const hasPlayers = next.cardFlow.length > 0;
                empty.style.display = hasPlayers ? 'none' : '';
                grid.style.display = hasPlayers ? 'grid' : 'none';
            }
            render(view);
            return {
                update: render,
                destroy: () => {
                    host.textContent = '';
                },
            };
        },
    };

    // sections/devDeck.ts
    const STYLES$4 = `
  .dev-tiles {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 4px;
  }
  .dev-tile {
    min-width: 0;
    background: var(--cc-surface);
    border-radius: 7px;
    padding: 6px 2px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    text-align: center;
    overflow: hidden;
  }
  .dev-tile img { width: 26px; height: 35px; flex: none; border-radius: 2px; display: block; }
  .dev-ratio {
    font-family: var(--cc-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--cc-text);
    line-height: 1;
    white-space: nowrap;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dev-name {
    max-width: 100%;
    font-size: 10px;
    font-weight: 700;
    color: var(--cc-text-muted);
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dev-bar {
    width: 100%;
    height: 4px;
    background: rgba(255,255,255,.1);
    border-radius: 2px;
    overflow: hidden;
  }
  .dev-fill { height: 100%; background: var(--cc-accent); }
  .dev-tile--untouched .dev-fill { background: var(--cc-good); }
  .dev-caption {
    max-width: 100%;
    font-family: var(--cc-mono);
    font-size: 10px;
    color: var(--cc-mono-dim);
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
    const devDeckSection = {
        id: 'dev-deck',
        title: 'Dev deck',
        note: 'Cards left and who played what',
        supports: ['horizontal', 'vertical'],
        min: { width: 240, height: 110 },
        styles: STYLES$4,
        mount(host, view, ctx) {
            const { head, labelNode } = sectionHead('Dev deck', 'left / total');
            const tilesHost = el('div', 'dev-tiles');
            // The five card types are fixed for a standard game; only their numbers move.
            const tiles = view.devDeck.cards.map(card => {
                const tile = el('div', 'dev-tile');
                const ratio = el('div', 'dev-ratio');
                const bar = el('div', 'dev-bar');
                const fill = el('div', 'dev-fill');
                bar.appendChild(fill);
                const caption = el('div', 'dev-caption');
                tile.append(img(ctx.assetUrl(`assets/${card.icon}`), card.name), ratio, el('div', 'dev-name', card.name), bar, caption);
                tilesHost.appendChild(tile);
                return { tile, ratio, fill, caption };
            });
            host.append(head, tilesHost);
            function render(next) {
                labelNode.textContent = `Dev deck · ${next.devDeck.remaining} left`;
                next.devDeck.cards.forEach((card, index) => {
                    const nodes = tiles[index];
                    if (!nodes)
                        return;
                    nodes.ratio.textContent = `${card.left}/${card.total}`;
                    nodes.fill.style.width = `${card.leftPct}%`;
                    nodes.caption.textContent = card.caption;
                    nodes.caption.title = card.caption;
                    nodes.tile.classList.toggle('dev-tile--untouched', card.untouched);
                });
            }
            render(view);
            return {
                update: render,
                destroy: () => {
                    host.textContent = '';
                },
            };
        },
    };

    // sections/dice.ts
    const STYLES$3 = `
  .dice-bars { flex: 1; display: flex; align-items: flex-end; gap: 6px; min-height: 0; }
  .dice-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    height: 100%;
  }
  .dice-count {
    font-family: var(--cc-mono);
    font-size: 12px;
    margin-bottom: 3px;
    color: var(--cc-mono-dim);
  }
  .dice-column--hot .dice-count { color: var(--cc-good); }
  .dice-bar {
    width: 100%;
    background: var(--cc-bar);
    border-radius: 3px 3px 0 0;
    position: relative;
  }
  .dice-column--hot .dice-bar { background: var(--cc-good); }
  .dice-column--seven .dice-bar { background: var(--cc-danger); }
  .dice-tick {
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background: rgba(255,255,255,.5);
  }
  .dice-axis { display: flex; gap: 6px; margin-top: 5px; }
  .dice-axis span {
    flex: 1;
    text-align: center;
    font-family: var(--cc-mono);
    font-size: 12px;
    color: var(--cc-mono-dim);
  }
`;
    const diceSection = {
        id: 'dice',
        title: 'Dice rolls',
        note: 'Distribution against the expected rate',
        supports: ['horizontal', 'vertical'],
        min: { width: 260, height: 110 },
        styles: STYLES$3,
        mount(host, view) {
            const { head, labelNode } = sectionHead('Dice', 'white tick = expected rate');
            const bars = el('div', 'dice-bars');
            const axis = el('div', 'dice-axis');
            // The eleven columns never change, so they are built once and only their
            // heights and colors are touched afterwards.
            const columns = view.dice.bars.map(barView => {
                const column = el('div', 'dice-column');
                const count = el('span', 'dice-count');
                const bar = el('div', 'dice-bar');
                const tick = el('div', 'dice-tick');
                bar.appendChild(tick);
                column.append(count, bar);
                bars.appendChild(column);
                axis.appendChild(el('span', undefined, String(barView.n)));
                return { column, count, bar, tick };
            });
            host.append(head, bars, axis);
            function render(next) {
                labelNode.textContent = `Dice · ${next.dice.totalRolls} rolls`;
                next.dice.bars.forEach((barView, index) => {
                    const nodes = columns[index];
                    if (!nodes)
                        return;
                    nodes.count.textContent = String(barView.count);
                    nodes.bar.style.height = `${barView.heightPct}%`;
                    nodes.tick.style.top = `${barView.expectedTopPct}%`;
                    // A bar with nothing in it has no rate to compare against.
                    nodes.tick.style.display = barView.count === 0 ? 'none' : '';
                    nodes.column.classList.toggle('dice-column--hot', barView.tone === 'hot');
                    nodes.column.classList.toggle('dice-column--seven', barView.tone === 'seven');
                    nodes.column.title = `${barView.n}: rolled ${barView.count}, expected ${barView.expected.toFixed(1)}`;
                });
            }
            render(view);
            return {
                update: render,
                destroy: () => {
                    host.textContent = '';
                },
            };
        },
    };

    // sections/hands.ts
    const STYLES$2 = `
  .hands-body { padding: 0 10px; }

  .hands-bank {
    display: grid;
    grid-template-columns: 76px repeat(5, 1fr);
    gap: 6px 3px;
    align-items: center;
  }
  .bank-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }
  .bank-cell img { width: 22px; height: 31px; border-radius: 2px; display: block; }
  .bank-count { font-family: var(--cc-mono); font-size: 10px; color: var(--cc-label-dim); }

  .player-row {
    margin-top: 6px;
    background: var(--cc-surface);
    border-left: 3px solid var(--cc-mono-dim);
    border-radius: 6px;
    padding: 7px 8px;
  }
  .player-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .player-name {
    font-size: 14px;
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .player-summary {
    font-family: var(--cc-mono);
    font-size: 12px;
    color: var(--cc-text-muted);
    white-space: nowrap;
  }
  .player-cells { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px; }
  .cell {
    border-top: 3px solid transparent;
    border-radius: 4px;
    padding: 4px 0 5px;
    text-align: center;
  }
  .cell-count {
    font-family: var(--cc-mono);
    font-size: 16px;
    font-weight: 600;
    line-height: 1.1;
    color: var(--cc-text);
  }
  /* A zero reads as dim even when the cell is tinted by a probable holding. */
  .cell--zero .cell-count { color: var(--cc-zero); }
  .cell-probability {
    font-family: var(--cc-mono);
    font-size: 11px;
    line-height: 1.2;
    min-height: 13px;
    color: var(--cc-probable);
  }
`;
    const NOTE = 'Solid numbers are guaranteed. Green fractions are probable holdings from unresolved steals.';
    function buildRow(player) {
        const row = el('div', 'player-row');
        const head = el('div', 'player-head');
        const name = el('span', 'player-name');
        const summary = el('span', 'player-summary');
        head.append(name, summary);
        const cellsHost = el('div', 'player-cells');
        const cells = player.cells.map(cellView => {
            const cell = el('div', 'cell');
            cell.style.borderTopColor = RESOURCE_STYLE[cellView.resource].color;
            const count = el('div', 'cell-count');
            const probability = el('div', 'cell-probability');
            cell.append(count, probability);
            cellsHost.appendChild(cell);
            return { cell, count, probability };
        });
        row.append(head, cellsHost);
        return { row, name, summary, cells };
    }
    function paintRow$1(nodes, player) {
        nodes.row.style.borderLeftColor = player.color;
        nodes.name.textContent = player.name;
        nodes.name.style.color = player.color;
        nodes.summary.textContent = `${player.knownCards} known`;
        player.cells.forEach((cellView, index) => {
            const target = nodes.cells[index];
            if (!target)
                return;
            // Tint follows "could hold any of this"; the number's weight follows what
            // is actually guaranteed, so a 0 stays quiet under a green fraction.
            target.cell.classList.toggle('cell--zero', cellView.known === 0);
            target.cell.style.background = cellView.hasAny
                ? RESOURCE_STYLE[cellView.resource].tint
                : 'var(--cc-surface-empty)';
            target.count.textContent = String(cellView.known);
            target.probability.textContent = cellView.probabilityLabel;
        });
    }
    const handsSection = {
        id: 'hands',
        title: 'Hands',
        note: 'Per-player card counts and probabilities',
        supports: ['vertical'],
        min: { width: 220, height: 0 },
        styles: STYLES$2,
        mount(host, view, ctx) {
            const { head, hintNode } = sectionHead('Hands', 'bank left');
            const body = el('div', 'hands-body');
            const bank = el('div', 'hands-bank');
            bank.appendChild(el('div')); // spacer above the player-name column
            const empty = el('div', 'section-empty', 'Waiting for players.');
            const note = el('div', 'section-note', NOTE);
            const bankCounts = view.bank.map(entry => {
                const cell = el('div', 'bank-cell');
                const icon = img(ctx.assetUrl(`assets/${RESOURCE_STYLE[entry.resource].icon}`), entry.resource);
                const count = el('span', 'bank-count');
                cell.append(icon, count);
                bank.appendChild(cell);
                return count;
            });
            body.appendChild(bank);
            host.append(head, body, empty, note);
            // Rows are rebuilt only when the seating changes; otherwise values are
            // patched in place, so images never reload and the rail never flickers.
            let rows = new Map();
            let seating = '';
            function render(next) {
                next.bank.forEach((entry, index) => {
                    bankCounts[index].textContent = `${entry.left}/${entry.total}`;
                });
                const names = next.players.map(player => player.name).join(' ');
                if (names !== seating) {
                    seating = names;
                    rows.forEach(node => node.row.remove());
                    rows = new Map();
                    for (const player of next.players) {
                        const nodes = buildRow(player);
                        rows.set(player.name, nodes);
                        body.appendChild(nodes.row);
                    }
                }
                for (const player of next.players) {
                    const nodes = rows.get(player.name);
                    if (nodes)
                        paintRow$1(nodes, player);
                }
                const hasPlayers = next.players.length > 0;
                empty.style.display = hasPlayers ? 'none' : '';
                note.style.display = hasPlayers ? '' : 'none';
                hintNode.style.display = hasPlayers ? '' : 'none';
            }
            render(view);
            return {
                update: render,
                destroy: () => {
                    host.textContent = '';
                },
            };
        },
    };

    // sections/players.ts
    const STYLES$1 = `
  .players-row {
    background: var(--cc-surface);
    border-left: 3px solid var(--cc-mono-dim);
    border-radius: 6px;
    padding: 7px 9px;
  }
  .players-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  .players-name {
    font-size: 14px;
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .players-vp { font-family: var(--cc-mono); font-size: 12px; color: var(--cc-text-muted); }
  .players-stats {
    display: flex;
    gap: 10px;
    margin-top: 5px;
    font-family: var(--cc-mono);
    font-size: 12px;
    color: var(--cc-mono-dim);
  }
  .players-stat strong { color: var(--cc-text-body); font-weight: 600; }
`;
    function paintRow(nodes, player) {
        nodes.row.style.borderLeftColor = player.color;
        nodes.name.textContent = player.name;
        nodes.name.style.color = player.color;
        nodes.vp.textContent = `${player.victoryPoints} vp`;
        const stats = [
            ['knights', player.knights],
            ['set', player.settlements],
            ['cit', player.cities],
            ['rd', player.roads],
        ];
        nodes.stats.textContent = '';
        for (const [label, value] of stats) {
            const stat = el('span', 'players-stat');
            const strong = el('strong', undefined, String(value));
            stat.append(strong, document.createTextNode(` ${label}`));
            nodes.stats.appendChild(stat);
        }
    }
    const playersSection = {
        id: 'players',
        title: 'Players',
        note: 'Victory points, knights and pieces left',
        supports: ['vertical'],
        min: { width: 220, height: 0 },
        styles: STYLES$1,
        mount(host, view) {
            const { head } = sectionHead('Players', 'vp / pieces left');
            const rows = el('div', 'section-rows');
            const empty = el('div', 'section-empty', 'Waiting for players.');
            host.append(head, rows, empty);
            let nodes = new Map();
            let seating = '';
            function render(next) {
                empty.style.display = next.players.length === 0 ? '' : 'none';
                const names = next.players.map(player => player.name).join(' ');
                if (names !== seating) {
                    seating = names;
                    rows.textContent = '';
                    nodes = new Map();
                    for (const player of next.players) {
                        const row = el('div', 'players-row');
                        const rowHead = el('div', 'players-head');
                        const name = el('span', 'players-name');
                        const vp = el('span', 'players-vp');
                        rowHead.append(name, vp);
                        const stats = el('div', 'players-stats');
                        row.append(rowHead, stats);
                        rows.appendChild(row);
                        nodes.set(player.name, { row, name, vp, stats });
                    }
                }
                for (const player of next.players) {
                    const target = nodes.get(player.name);
                    if (target)
                        paintRow(target, player);
                }
            }
            render(view);
            return {
                update: render,
                destroy: () => {
                    host.textContent = '';
                },
            };
        },
    };

    // sections/unknownSteals.ts
    const STYLES = `
  .steal {
    background: var(--cc-accent-tint);
    border: 1px solid var(--cc-accent-border);
    border-radius: 6px;
    padding: 8px 9px;
  }
  .steal--resolved {
    background: var(--cc-good-tint);
    border-color: var(--cc-good-border);
  }
  .steal-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px;
  }
  .steal-who { font-size: 13px; color: var(--cc-text-body); line-height: 1.35; }
  .steal-who strong { font-weight: 800; }
  .steal-time {
    font-family: var(--cc-mono);
    font-size: 11px;
    color: var(--cc-mono-dim);
    white-space: nowrap;
  }
  .steal-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 7px;
    align-items: center;
  }
  .chip {
    display: flex;
    align-items: center;
    gap: 5px;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 20px;
    padding: 3px 8px 3px 4px;
    cursor: pointer;
    font-family: inherit;
  }
  .chip:hover { border-color: var(--cc-good); }
  .chip:focus-visible { outline: 2px solid var(--cc-good); outline-offset: 1px; }
  .chip img { width: 12px; height: 17px; border-radius: 1px; display: block; flex: none; }
  .chip-label {
    font-family: var(--cc-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--cc-text-body);
  }
  .chip--confirmed {
    background: rgba(94,200,160,.16);
    border-color: rgba(94,200,160,.5);
    cursor: default;
  }
  .chip--confirmed .chip-label { color: var(--cc-good-text); }
  .chip-undo {
    font-family: var(--cc-mono);
    font-size: 11px;
    color: var(--cc-mono-dim);
    background: none;
    border: 0;
    padding: 2px 4px;
    margin-left: 2px;
    cursor: pointer;
  }
  .chip-undo:hover { color: var(--cc-text); }
`;
    function buildSteal(steal, ctx) {
        const row = el('div', steal.resolved ? 'steal steal--resolved' : 'steal steal--open');
        const head = el('div', 'steal-head');
        const who = el('div', 'steal-who');
        const thief = el('strong', undefined, steal.thief);
        thief.style.color = steal.thiefColor;
        const victim = el('strong', undefined, steal.victim);
        victim.style.color = steal.victimColor;
        who.append(thief, document.createTextNode(' stole from '), victim);
        head.append(who, el('span', 'steal-time', steal.time));
        const chips = el('div', 'steal-chips');
        for (const candidate of steal.candidates) {
            const chip = el('button', steal.resolved ? 'chip chip--confirmed' : 'chip');
            chip.type = 'button';
            if (!steal.resolved) {
                chip.dataset.stealId = steal.id;
                chip.dataset.resource = candidate.resource;
                chip.title = `Record that ${candidate.resource} was stolen`;
            }
            else {
                chip.disabled = true;
            }
            chip.append(img(ctx.assetUrl(`assets/${RESOURCE_STYLE[candidate.resource].icon}`), candidate.resource), el('span', 'chip-label', candidate.label));
            chips.appendChild(chip);
        }
        if (steal.canUndo) {
            const undo = el('button', 'chip-undo', 'UNDO');
            undo.type = 'button';
            undo.dataset.undoId = steal.id;
            undo.title = 'Take back this resolution';
            chips.appendChild(undo);
        }
        row.append(head, chips);
        return row;
    }
    /** Changes only when something visible changed, so we can skip re-rendering. */
    function signature(view) {
        return view.steals
            .map(steal => `${steal.id}:${steal.resolved}:${steal.canUndo}:` +
            steal.candidates.map(c => `${c.resource}${c.label}`).join(','))
            .join('|');
    }
    const unknownStealsSection = {
        id: 'unknown-steals',
        title: 'Unknown steals',
        note: 'Click a candidate to resolve a steal',
        supports: ['vertical'],
        min: { width: 220, height: 0 },
        styles: STYLES,
        mount(host, view, ctx) {
            const { head, labelNode, hintNode } = sectionHead('Unknown steals', 'click to resolve');
            const rows = el('div', 'section-rows');
            const empty = el('div', 'section-empty', 'Nothing unaccounted for right now.');
            host.append(head, rows, empty);
            // Delegated from the host, so a full re-render can never orphan a handler.
            const onClick = (event) => {
                const target = event.target;
                const chip = target === null || target === void 0 ? void 0 : target.closest('[data-resource]');
                if ((chip === null || chip === void 0 ? void 0 : chip.dataset.stealId) && chip.dataset.resource) {
                    ctx.emit({
                        type: 'resolve-steal',
                        id: chip.dataset.stealId,
                        resource: chip.dataset.resource,
                    });
                    return;
                }
                const undo = target === null || target === void 0 ? void 0 : target.closest('[data-undo-id]');
                if (undo === null || undo === void 0 ? void 0 : undo.dataset.undoId) {
                    ctx.emit({ type: 'undo-steal', id: undo.dataset.undoId });
                }
            };
            host.addEventListener('click', onClick);
            let rendered = '';
            function render(next) {
                labelNode.textContent = `Unknown steals · ${next.openStealCount}`;
                hintNode.style.display = next.openStealCount > 0 ? '' : 'none';
                empty.style.display = next.steals.length === 0 ? '' : 'none';
                const current = signature(next);
                if (current === rendered)
                    return;
                rendered = current;
                rows.textContent = '';
                for (const steal of next.steals)
                    rows.appendChild(buildSteal(steal, ctx));
            }
            render(view);
            return {
                update: render,
                destroy: () => {
                    host.removeEventListener('click', onClick);
                    host.textContent = '';
                },
            };
        },
    };

    // sections/index.ts
    registerSection(handsSection);
    registerSection(unknownStealsSection);
    registerSection(cardFlowSection);
    registerSection(cardFlowLedgerSection);
    registerSection(blockedRobberSection);
    registerSection(diceSection);
    registerSection(devDeckSection);
    registerSection(playersSection);

    // v2.ts
    const shell = new Shell({
        onAction: handleAction,
    });
    function handleAction(action) {
        switch (action.type) {
            case 'resolve-steal':
                game.probableGameState.resolveUnknownTransaction(action.id, action.resource);
                break;
            case 'undo-steal':
                game.probableGameState.unresolveUnknownTransaction(action.id);
                break;
            default: {
                const exhaustive = action;
                console.warn('🎛️ Unhandled section action:', exhaustive);
                return;
            }
        }
        // The tracker's beliefs just changed; every section reads from the same view.
        shell.update();
    }
    const v2Ui = {
        mount: () => shell.mount(),
        unmount: () => shell.unmount(),
        update: () => shell.update(),
        setHistoryLoading: loading => shell.setHistoryLoading(loading),
        // The seat-picker is a modal rather than a gutter, and v1's works in either
        // mode. Giving it a v2 treatment is deliberately left for later.
        showYouPlayerDialog: showYouPlayerDialog$1,
    };

    // uiMode.ts
    /**
     * The gutter interface is what the extension shows unless someone has chosen
     * otherwise. The overlay stays available from the popup.
     */
    const DEFAULT_UI_MODE = 'v2';
    const UI_MODE_STORAGE_KEY = 'catanUiMode';
    function isUiMode(value) {
        return value === 'v1' || value === 'v2';
    }
    function storageAvailable() {
        var _a;
        return typeof chrome !== 'undefined' && !!((_a = chrome === null || chrome === void 0 ? void 0 : chrome.storage) === null || _a === void 0 ? void 0 : _a.local);
    }
    /** Read the stored mode, falling back to the default on anything unexpected. */
    function readUiMode() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!storageAvailable())
                return DEFAULT_UI_MODE;
            try {
                const stored = yield chrome.storage.local.get(UI_MODE_STORAGE_KEY);
                const value = stored[UI_MODE_STORAGE_KEY];
                return isUiMode(value) ? value : DEFAULT_UI_MODE;
            }
            catch (error) {
                console.warn('🎛️ Could not read the stored UI mode:', error);
                return DEFAULT_UI_MODE;
            }
        });
    }
    /**
     * Watch for mode changes made elsewhere (the popup). Returns an unsubscribe
     * function. Colonist hands your seat to a bot if the page reloads mid-game, so
     * the switch has to apply live rather than asking for a refresh.
     */
    function subscribeUiMode(onChange) {
        var _a;
        const listener = (changes) => {
            const change = changes[UI_MODE_STORAGE_KEY];
            if (change && isUiMode(change.newValue))
                onChange(change.newValue);
        };
        if (typeof chrome === 'undefined' || !((_a = chrome === null || chrome === void 0 ? void 0 : chrome.storage) === null || _a === void 0 ? void 0 : _a.onChanged)) {
            return () => undefined;
        }
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }

    // ui/index.ts
    const IMPLS = { v1: v1Ui, v2: v2Ui };
    let mode = DEFAULT_UI_MODE;
    let mounted = false;
    /** Remembered so a mode switch mid-replay doesn't drop the loading state. */
    let historyLoading = false;
    function active() {
        return IMPLS[mode];
    }
    /**
     * Swap interfaces in place. The outgoing one unmounts first so it can undo its
     * page changes (v2 squeezes colonist's layout) before the next one starts.
     */
    function setUiMode(next) {
        if (next === mode)
            return;
        if (mounted)
            active().unmount();
        mode = next;
        if (mounted) {
            active().mount();
            active().setHistoryLoading(historyLoading);
            active().update();
        }
    }
    /**
     * Show the interface. Mounts the stored mode as soon as storage answers — the
     * default mounts immediately so there is never a window with no UI at all.
     */
    function showGameStateOverlay() {
        if (mounted)
            return;
        mounted = true;
        active().mount();
        void readUiMode().then(stored => {
            if (stored !== mode)
                setUiMode(stored);
        });
        subscribeUiMode(setUiMode);
    }
    function updateGameStateDisplay() {
        if (mounted)
            active().update();
    }
    function setHistoryLoading(loading) {
        historyLoading = loading;
        if (mounted)
            active().setHistoryLoading(loading);
    }
    function showYouPlayerDialog() {
        active().showYouPlayerDialog();
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
        // Anyone over the limit discards when a seven is rolled, not just the roller.
        recordLoss(playerName, 'sevens', countCards(discardedResources, 'positive'));
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
        recordTrade(playerName, tradePartner, resourceChanges);
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
        recordGain(playerName, 'dice', countCards(resources, 'positive'));
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
        recordSteal(thief, victim);
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
            // Unknown steal - we don't know what resource was stolen. The ledger counts
            // cards, so it is exact anyway; knownSteal records its own.
            recordSteal(thief, victim);
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
        recordLoss(playerName, 'spent', 3);
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
        recordTrade(playerName, null, resourceChanges);
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
            recordLoss(playerName, 'spent', 4);
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
            recordLoss(playerName, 'spent', 5);
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
            recordLoss(playerName, 'spent', 2);
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
        recordGain(playerName, 'devGain', countCards(resources, 'positive'));
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
        const perVictim = [];
        game.players.forEach(otherPlayer => {
            if (otherPlayer.name !== playerName) {
                const playerHas = otherPlayer.resources[resourceType];
                if (playerHas > 0) {
                    actualStolen += playerHas;
                    perVictim.push({ name: otherPlayer.name, cards: playerHas });
                    otherPlayer.resources[resourceType] = 0;
                }
            }
        });
        // The haul is ground truth from the chat; the split across victims is not.
        recordMonopoly(playerName, totalStolen, perVictim);
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
        // The ledger covers the whole game, opening hand included.
        recordGain(playerName, 'dice', countCards(resources, 'positive'));
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
        recordSteal(thief, victim);
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
