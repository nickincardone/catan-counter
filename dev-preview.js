(function () {
    'use strict';

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
    function setYouPlayer(playerName) {
        game.youPlayerName = playerName;
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
    function setYouPlayerForTesting(playerName) {
        game.youPlayerName = playerName;
    }
    function resetGameState() {
        // Reset game state but keep "you" player info
        const previousYouPlayer = game.youPlayerName;
        game = getDefaultGame();
        // Restore "you" player info
        game.youPlayerName = previousYouPlayer;
        console.log('🔄 Game state reset, reprocessing messages...');
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

    // TextEncoder and TextDecoder are standardized in whatwg encoding:
    // https://encoding.spec.whatwg.org/
    // and available in all the modern browsers:
    // https://caniuse.com/textencoder
    // They are available in Node.js since v12 LTS as well:
    // https://nodejs.org/api/globals.html#textencoder
    new TextEncoder();
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
    new TextDecoder();

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

    const EMPTY_VIEW = new DataView(new ArrayBuffer(0));
    new Uint8Array(EMPTY_VIEW.buffer);
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
    new CachedKeyDecoder();

    // messageLogger.ts
    /**
     * Download the current game's log as a JSON file (wired to the overlay's 💾
     * button). Returns the exported log, or null when nothing has been captured.
     */
    function downloadCurrentGameLog() {
        {
            console.warn('📼 No game data captured yet — nothing to download');
            return null;
        }
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
    const STYLES$6 = {
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
        backdrop.style.cssText = STYLES$6.modalBackdrop;
        return backdrop;
    }
    /**
     * Create a modal dialog element
     */
    function createModalDialog() {
        const dialog = document.createElement('div');
        dialog.style.cssText = STYLES$6.modalDialog;
        return dialog;
    }
    /**
     * Create a resource button with icon and probability
     */
    function createResourceButton(resource, probability, onClick) {
        const button = document.createElement('button');
        button.setAttribute('data-resource', resource);
        button.style.cssText = `
    ${STYLES$6.primaryButton}
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
        style="${STYLES$6.secondaryButton}"
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
    function hideGameStateOverlay() {
        if (gameStateOverlay) {
            gameStateOverlay.style.display = 'none';
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
    function showYouPlayerDialog$1() {
        if (game.players.length === 0)
            return;
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
        mount: showGameStateOverlay,
        unmount: hideGameStateOverlay,
        update: updateGameStateDisplay,
        setHistoryLoading,
        showYouPlayerDialog: showYouPlayerDialog$1,
    };

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
        return {
            players: orderPlayers(game.players, game.youPlayerName).map(player => buildPlayer(player, game, game.youPlayerName)),
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
    /** Width the rail collapses to — enough for the reopen chevron. */
    const COLLAPSED_SIZE = 28;
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
        right: { size: 0, collapsed: true, sections: [] },
        top: { size: 0, collapsed: true, sections: [] },
    };
    function cloneLayout(layout) {
        return {
            version: layout.version,
            left: Object.assign(Object.assign({}, layout.left), { sections: layout.left.sections.map(s => (Object.assign({}, s))) }),
            right: Object.assign(Object.assign({}, layout.right), { sections: layout.right.sections.map(s => (Object.assign({}, s))) }),
            top: Object.assign(Object.assign({}, layout.top), { sections: layout.top.sections.map(s => (Object.assign({}, s))) }),
            bottom: Object.assign(Object.assign({}, layout.bottom), { sections: layout.bottom.sections.map(s => (Object.assign({}, s))) }),
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
        return cloneLayout(layout);
    }
    function storageAvailable() {
        var _a;
        return typeof chrome !== 'undefined' && !!((_a = chrome === null || chrome === void 0 ? void 0 : chrome.storage) === null || _a === void 0 ? void 0 : _a.local);
    }
    function readLayout() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!storageAvailable())
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
            if (!storageAvailable())
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
            style.textContent = buildStyleSheet(registeredStyles());
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
                if (JSON.stringify(stored) === JSON.stringify(this.layout))
                    return;
                this.layout = stored;
                this.render();
            });
        }
        unmount() {
            if (!this.root)
                return;
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
            void this.syncPageFrame();
        }
        /** The header lives in the first gutter that exists, preferring the rail. */
        headerGutter() {
            var _a;
            return ((_a = GUTTER_NAMES.find(name => this.layout[name].sections.length > 0)) !== null && _a !== void 0 ? _a : null);
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
            header.append(collapsed ? toggle : brand);
            if (!collapsed)
                header.appendChild(toggle);
            return header;
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
        /** Test seam: the layout the shell is currently rendering. */
        getLayout() {
            return cloneLayout(this.layout);
        }
        /** Replace the layout wholesale — the seam a future arrangement UI uses. */
        setLayout(layout) {
            this.layout = cloneLayout(layout);
            void writeLayout(this.layout);
            if (this.root)
                this.render();
        }
        /** Test seam: the shadow root, so tests can assert on rendered structure. */
        getShadowRoot() {
            return this.shadow;
        }
    }

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

    // sections/blockedRobber.ts
    const STYLES$5 = `
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
        supports: ['vertical'],
        min: { width: 200, height: 0 },
        styles: STYLES$5,
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
        title: 'Dice',
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
    registerSection(blockedRobberSection);
    registerSection(diceSection);
    registerSection(devDeckSection);
    registerSection(playersSection);

    // v2.ts
    const shell$1 = new Shell({
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
        shell$1.update();
    }
    const v2Ui = {
        mount: () => shell$1.mount(),
        unmount: () => shell$1.unmount(),
        update: () => shell$1.update(),
        setHistoryLoading: loading => shell$1.setHistoryLoading(loading),
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

    // ui/index.ts
    const IMPLS = { v1: v1Ui, v2: v2Ui };
    let mode = DEFAULT_UI_MODE;
    function active() {
        return IMPLS[mode];
    }
    function showYouPlayerDialog() {
        active().showYouPlayerDialog();
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
    /** A steal moves exactly one card, whether or not anyone knows which. */
    function recordSteal(thiefName, victimName) {
        recordGain(thiefName, 'robGain', 1);
        recordLoss(victimName, 'robLoss', 1);
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

    // dev/preview.ts
    // The sections resolve bundled assets through chrome.runtime.getURL; outside
    // the extension they are just relative paths.
    globalThis.chrome = {
        runtime: { getURL: (path) => path },
    };
    const PLAYERS = [
        ['emipaco', '#59a8e8'],
        ['Shaum1928', '#e35b5b'],
        ['Powdahhh', '#f0a35e'],
        ['NickTheSwift', '#e6edf3'],
    ];
    function seedGame() {
        resetGameState();
        game.youPlayerName = null;
        for (const [name, color] of PLAYERS)
            placeSettlement(name, color);
        game.probableGameState = new PropbableGameState(game.players);
        // Set before the first roll: rollDice asks who you are otherwise, and here
        // there is no colonist page to auto-detect from.
        setYouPlayerForTesting('NickTheSwift');
        // Dice first, and not only for realism: the first roll deliberately rebuilds
        // the variant tree from scratch, because that is when tracking properly
        // begins. Anything dealt or stolen before it is discarded.
        const rolls = {
            2: 2,
            3: 2,
            4: 3,
            5: 6,
            6: 5,
            7: 12,
            8: 6,
            9: 9,
            10: 4,
            11: 3,
            12: 2,
        };
        for (const [total, count] of Object.entries(rolls)) {
            for (let i = 0; i < count; i++)
                rollDice(Number(total));
        }
        playerGetResources('Shaum1928', { sheep: 3, wheat: 2 });
        playerGetResources('Powdahhh', { wheat: 2, brick: 1 });
        playerGetResources('NickTheSwift', { sheep: 1, wheat: 3 });
        playerGetResources('emipaco', { ore: 1, wheat: 1 });
        // Two open steals, so the probability columns and the chips have something
        // to show.
        unknownSteal('emipaco', 'Powdahhh');
        unknownSteal('Powdahhh', 'emipaco');
        blockedDiceRoll(5, 'tree');
        blockedDiceRoll(5, 'tree');
        blockedDiceRoll(5, 'tree');
        blockedDiceRoll(6, 'wheat');
        blockedDiceRoll(8, 'wheat');
        useKnight('Shaum1928');
        useKnight('emipaco');
        useMonopoly('emipaco');
    }
    seedGame();
    const shell = new Shell({
        onAction: action => {
            if (action.type === 'resolve-steal') {
                game.probableGameState.resolveUnknownTransaction(action.id, action.resource);
            }
            else if (action.type === 'undo-steal') {
                game.probableGameState.unresolveUnknownTransaction(action.id);
            }
            shell.update();
        },
    });
    shell.mount();
    // Handy while iterating on a section from the console.
    globalThis.__catanPreview = {
        shell,
        game,
        reseed: () => {
            seedGame();
            shell.update();
        },
    };

})();
