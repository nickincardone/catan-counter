'use strict';

var node_fs = require('node:fs');
var node_path = require('node:path');

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

function __rest(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

// replay/schema.ts
// The shape of Colonist's replay payload, and the numeric codes inside it.
//
// A replay arrives as one JSON document from
// /api/replay/data-from-game-id?gameId=<id>&playerColor=<seat>. It holds the
// whole game: the board, every event as a state diff, a structured game log,
// player chat, and the end-game stats.
//
// Two things about it are worth knowing before reading further.
//
// The seat in the URL does not restrict what comes back. The same game fetched
// as playerColor=1 and playerColor=5 returned the same bytes apart from
// `playerPerspective`, and both revealed all four players' hands. One fetch per
// game is enough.
//
// The payload carries ground truth AND the public view at once. Player states
// hold everyone's real cards, while log entries preserve what was visible at the
// table — a steal appears as `cardBacks` in the public entry (type 16) and as
// the real card in the two private entries (14, 15). Training that must respect
// an information set should read the log; training that needs the truth should
// read the state.
/** Terrain codes, shared with the live-game msgpack protocol. */
const TERRAIN_NAMES = {
    0: 'desert',
    1: 'lumber',
    2: 'brick',
    3: 'wool',
    4: 'grain',
    5: 'ore',
};
/** Port codes. Four generic and one of each resource on a standard board. */
const PORT_NAMES = {
    1: 'generic',
    2: 'lumber',
    3: 'brick',
    4: 'wool',
    5: 'grain',
    6: 'ore',
};
/**
 * Resource card codes. They line up with the terrain that produces them, and
 * with the keys of bankState.resourceCards.
 */
const RESOURCE_NAMES = {
    1: 'lumber',
    2: 'brick',
    3: 'wool',
    4: 'grain',
    5: 'ore',
};
/** A face-down card, used where the log shows what the table could see. */
const CARD_BACK = 0;
/**
 * Development card codes.
 *
 * Knight, monopoly and year of plenty are fixed by what each one is followed
 * by: every play of 11 precedes a robber move, the single play of 13 precedes
 * the monopoly entry, and both plays of 15 precede a year-of-plenty gain.
 *
 * Road building is confirmed the same way, once a wider harvest turned up
 * fifteen plays of 14: each is followed immediately by exactly two roads placed
 * for free, thirty in total, and never by anything else. That leaves 12 as the
 * victory point card, which fits the one thing that can be said about it — it
 * is never played, because a point card cannot be. If a play of 12 ever shows
 * up, that pairing is wrong and this is the place to fix.
 */
const DEVELOPMENT_CARD_NAMES = {
    10: 'hidden',
    11: 'knight',
    12: 'victory-point',
    13: 'monopoly',
    14: 'road-building',
    15: 'year-of-plenty',
};
/** Piece codes, fixed by which mechanic state each one moves. */
const PIECE_NAMES = {
    0: 'road',
    2: 'settlement',
    3: 'city',
    5: 'robber',
};
/**
 * Achievement codes, fixed by which mechanic state moves with the entry:
 * entries carrying 0 flip `hasLongestRoad`, entries carrying 1 flip
 * `hasLargestArmy`.
 */
const ACHIEVEMENT_NAMES = {
    0: 'longest-road',
    1: 'largest-army',
};
/**
 * Where a player's victory points come from. `victoryPointsState` is a count
 * per source, not a total, so the total needs these weights.
 *
 * The pairing is fixed by arithmetic rather than by name. Under it the winner
 * of the game this was built from scores exactly the 10 the settings ask for
 * (1 settlement, 2 cities, 3 point cards, largest army), and all four players'
 * totals fall in the same order as the ranks Colonist recorded. Any other
 * assignment breaks one or both. decodeReplay re-checks this on every file, so
 * a wrong pairing shows up as a failed check instead of a quietly wrong score.
 */
const VICTORY_POINT_SOURCES = {
    0: { name: 'settlement', points: 1 },
    1: { name: 'city', points: 2 },
    2: { name: 'development-card', points: 1 },
    3: { name: 'largest-army', points: 2 },
    4: { name: 'longest-road', points: 2 },
};
/**
 * Game log entry types.
 *
 * Every one of these was fixed by evidence rather than by reading names: the
 * parameters an entry carries, the state slices that change in the same event,
 * and the counts (the deck shrinking 24, 23, 22 across type 1 entries is three
 * development card purchases).
 *
 * Type 4 is worth spelling out, because its first reading was wrong. It looked
 * like the opening placement — sixteen of them a game is four players laying
 * two settlements and two roads — until a road building card turned up: every
 * play of one is followed by exactly two more type 4 roads. It is not the
 * opening, it is a piece placed without paying for it, and the two cases split
 * cleanly on whether the first roll has happened. Across twelve games that was
 * 192 before the first roll, exactly sixteen each, and 30 after, all roads and
 * exactly twice the fifteen road building plays.
 *
 * Types not listed here are preserved verbatim by the decoder rather than
 * dropped, so an unrecognised entry is visible instead of silently lost. What
 * is left over is connection and lifecycle noise — one entry each per game —
 * and none of it describes a move.
 */
const LOG_TYPE_NAMES = {
    1: 'buy-development-card',
    4: 'free-placement',
    5: 'build',
    10: 'roll',
    11: 'move-robber',
    14: 'steal-private-thief',
    15: 'steal-private-victim',
    16: 'steal-public',
    20: 'play-development-card',
    21: 'year-of-plenty-gain',
    44: 'turn-boundary',
    47: 'resource-distribution',
    49: 'robber-blocked-production',
    55: 'discard',
    66: 'achievement-gained',
    68: 'achievement-transferred',
    86: 'monopoly-steal',
    113: 'embargo-placed',
    114: 'embargo-lifted',
    115: 'trade-accepted',
    116: 'bank-trade',
    117: 'trade-offer-targeted',
    118: 'trade-offer',
};

// replay/decode.ts
const REPLAY_RECORD_VERSION = 1;
function name(table, code) {
    return typeof code === 'number' && table[code] !== undefined
        ? table[code]
        : `unknown(${String(code)})`;
}
/** A tile reference, as the robber and blocked-production entries carry it. */
function decodeTile(value) {
    if (!value || typeof value !== 'object')
        return null;
    const tile = value;
    return {
        terrain: name(TERRAIN_NAMES, tile.tileType),
        diceNumber: numberOrNull(tile.diceNumber),
        resource: name(RESOURCE_NAMES, tile.resourceType),
    };
}
function resourceList(value) {
    if (!Array.isArray(value))
        return [];
    return value.map(code => code === CARD_BACK ? 'hidden' : name(RESOURCE_NAMES, code));
}
function numberOrNull(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function indexedEntries(value) {
    if (!value || typeof value !== 'object')
        return [];
    return Object.entries(value)
        .map(([key, entry]) => [Number(key), entry])
        .filter(([key]) => Number.isSafeInteger(key))
        .sort((a, b) => a[0] - b[0]);
}
function decodeBoard(mapState) {
    const map = (mapState !== null && mapState !== void 0 ? mapState : {});
    return {
        hexes: indexedEntries(map.tileHexStates).map(([id, hex]) => ({
            id,
            x: hex.x,
            y: hex.y,
            terrain: name(TERRAIN_NAMES, hex.type),
            terrainCode: hex.type,
            // The desert carries no number; Colonist stores 0 there.
            diceNumber: hex.diceNumber,
        })),
        corners: indexedEntries(map.tileCornerStates).map(([id, corner]) => (Object.assign({ id }, corner))),
        edges: indexedEntries(map.tileEdgeStates).map(([id, edge]) => (Object.assign({ id }, edge))),
        ports: indexedEntries(map.portEdgeStates).map(([id, port]) => ({
            id,
            x: port.x,
            y: port.y,
            z: port.z,
            port: name(PORT_NAMES, port.type),
            portCode: port.type,
        })),
    };
}
/**
 * Resolve one log entry into an action's kind and detail.
 *
 * The parameter names come from Colonist and are kept, so that anyone checking
 * this against a raw file is reading the same words.
 */
function decodeDetail(logType, text, context) {
    var _a, _b;
    switch (logType) {
        case 4:
            // Placed without paying: the opening settlements and roads, and also the
            // two roads a road building card gives. The first roll separates them —
            // the opening is over by the time anyone rolls.
            return {
                piece: name(PIECE_NAMES, text.pieceEnum),
                duringOpening: !context.rolled,
            };
        case 5: // bought and paid for
            return Object.assign({ piece: name(PIECE_NAMES, text.pieceEnum) }, (text.isVp !== undefined ? { isVictoryPoint: text.isVp } : {}));
        case 10:
            return {
                dice: [text.firstDice, text.secondDice],
                total: ((_a = numberOrNull(text.firstDice)) !== null && _a !== void 0 ? _a : 0) +
                    ((_b = numberOrNull(text.secondDice)) !== null && _b !== void 0 ? _b : 0),
            };
        case 11:
            return {
                piece: name(PIECE_NAMES, text.pieceEnum),
                tile: decodeTile(text.tileInfo),
            };
        case 49:
            // A tile whose number came up while the robber sat on it, so it produced
            // nothing. Checked against the robber's recorded position across a full
            // game: all eight entries named the tile it was standing on.
            return { tile: decodeTile(text.tileInfo) };
        case 14: // the thief's own view: the real card
        case 15: // the victim's view: the same real card
            return { cards: resourceList(text.cardEnums) };
        case 16:
            // What the table saw. cardBacks is a list of face-down cards, so this
            // stays hidden even though the private entries beside it name the card.
            return {
                thief: numberOrNull(text.playerColorThief),
                victim: numberOrNull(text.playerColorVictim),
                cards: resourceList(text.cardBacks),
            };
        case 20:
            return { card: name(DEVELOPMENT_CARD_NAMES, text.cardEnum) };
        case 21:
            return { cards: resourceList(text.cardEnums) };
        case 47:
            return {
                cards: resourceList(text.cardsToBroadcast),
                distributionType: text.distributionType,
            };
        case 55:
            return {
                cards: resourceList(text.cardEnums),
                areResourceCards: text.areResourceCards,
            };
        case 66:
            return { achievement: name(ACHIEVEMENT_NAMES, text.achievementEnum) };
        case 68:
            return {
                achievement: name(ACHIEVEMENT_NAMES, text.achievementEnum),
                from: numberOrNull(text.playerColorOld),
                to: numberOrNull(text.playerColorNew),
            };
        case 86:
            return {
                card: name(RESOURCE_NAMES, text.cardEnum),
                amountStolen: numberOrNull(text.amountStolen),
            };
        case 113:
        case 114:
            // Refusing to trade with someone, and taking it back. Checked against the
            // embargo list that moves with each entry: after all seventeen of type
            // 113 the target is on the player's list, and after all eight of type 114
            // it is off it.
            return { against: numberOrNull(text.embargoedPlayerColor) };
        case 115:
            return {
                acceptedBy: numberOrNull(text.acceptingPlayerColor),
                given: resourceList(text.givenCardEnums),
                received: resourceList(text.receivedCardEnums),
            };
        case 116:
            return {
                given: resourceList(text.givenCardEnums),
                received: resourceList(text.receivedCardEnums),
            };
        case 117:
            return {
                offeredTo: numberOrNull(text.playerColorOffered),
                offered: resourceList(text.offeredCardEnums),
                wanted: resourceList(text.wantedCardEnums),
            };
        case 118:
            return {
                offered: resourceList(text.offeredCardEnums),
                wanted: resourceList(text.wantedCardEnums),
            };
        default: {
            // Keep everything but the discriminator, so an unrecognised entry can
            // still be read and classified later.
            const rest = __rest(text, ["type"]);
            return rest;
        }
    }
}
/** The acting player, which most entries name directly. */
function actorOf(text) {
    var _a, _b, _c, _d;
    return ((_d = (_c = (_b = (_a = numberOrNull(text.playerColor)) !== null && _a !== void 0 ? _a : numberOrNull(text.playerColorThief)) !== null && _b !== void 0 ? _b : numberOrNull(text.playerColorCreator)) !== null && _c !== void 0 ? _c : numberOrNull(text.playerColorOld)) !== null && _d !== void 0 ? _d : null);
}
/**
 * The road length recorded alongside a longest-road change, when the same
 * event's state says one. Colonist writes it under the gaining player.
 */
function longestRoadOf(change, event) {
    var _a, _b;
    if (change.achievement !== 'longest-road' || change.to === null)
        return null;
    const state = (_a = event.stateChange) === null || _a === void 0 ? void 0 : _a.mechanicLongestRoadState;
    return numberOrNull((_b = state === null || state === void 0 ? void 0 : state[String(change.to)]) === null || _b === void 0 ? void 0 : _b.longestRoad);
}
/** Final placings, with each player's points resolved to their sources. */
function decodeStandings(endGameState) {
    const players = endGameState.players;
    if (!players || typeof players !== 'object')
        return [];
    return Object.values(players)
        .map(player => {
        var _a, _b, _c, _d;
        const counts = ((_a = player.victoryPoints) !== null && _a !== void 0 ? _a : {});
        const pointsBySource = {};
        let totalPoints = 0;
        for (const [code, count] of Object.entries(counts)) {
            const source = VICTORY_POINT_SOURCES[Number(code)];
            const label = (_b = source === null || source === void 0 ? void 0 : source.name) !== null && _b !== void 0 ? _b : `unknown(${code})`;
            const points = ((_c = source === null || source === void 0 ? void 0 : source.points) !== null && _c !== void 0 ? _c : 0) * count;
            pointsBySource[label] = points;
            totalPoints += points;
        }
        return {
            color: (_d = numberOrNull(player.color)) !== null && _d !== void 0 ? _d : -1,
            rank: numberOrNull(player.rank),
            isWinner: player.winningPlayer === true,
            totalPoints,
            pointsBySource,
        };
    })
        .sort((a, b) => { var _a, _b; return ((_a = a.rank) !== null && _a !== void 0 ? _a : 99) - ((_b = b.rank) !== null && _b !== void 0 ? _b : 99); });
}
function decodeReplay(raw, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const data = (_a = raw.data) !== null && _a !== void 0 ? _a : {};
    const history = (_b = data.eventHistory) !== null && _b !== void 0 ? _b : {};
    const events = Array.isArray(history.events)
        ? history.events
        : [];
    const playOrder = Array.isArray(data.playOrder) ? data.playOrder : [];
    const players = ((_c = data.playerUserStates) !== null && _c !== void 0 ? _c : []).map(user => {
        const color = numberOrNull(user.selectedColor);
        const seatIndex = color === null ? -1 : playOrder.indexOf(color);
        return {
            color: color !== null && color !== void 0 ? color : -1,
            username: typeof user.username === 'string' ? user.username : null,
            userId: typeof user.userId === 'string' ? user.userId : null,
            isBot: user.isBot === true,
            countryCode: typeof user.countryCode === 'string' ? user.countryCode : null,
            seatIndex: seatIndex >= 0 ? seatIndex : null,
        };
    });
    const actions = [];
    const rolls = [];
    const chat = [];
    const achievements = [];
    const unknownLogTypes = {};
    let timeMs = 0;
    // The opening is the stretch before anyone rolls, which is what tells a
    // free placement in the opening from one a road building card paid for.
    const context = { rolled: false };
    events.forEach((event, eventIndex) => {
        var _a, _b, _c, _d, _e, _f;
        // deltaS is seconds since the previous event and is the only thing `input`
        // carries; summing it gives a clock without needing per-event timestamps.
        timeMs += Math.round(((_b = numberOrNull((_a = event.input) === null || _a === void 0 ? void 0 : _a.deltaS)) !== null && _b !== void 0 ? _b : 0) * 1000);
        const change = (_c = event.stateChange) !== null && _c !== void 0 ? _c : {};
        for (const [, entry] of indexedEntries(change.gameLogState)) {
            const text = entry === null || entry === void 0 ? void 0 : entry.text;
            const logType = numberOrNull(text === null || text === void 0 ? void 0 : text.type);
            if (!text || logType === null)
                continue;
            const kind = LOG_TYPE_NAMES[logType];
            if (kind === undefined) {
                unknownLogTypes[String(logType)] =
                    ((_d = unknownLogTypes[String(logType)]) !== null && _d !== void 0 ? _d : 0) + 1;
            }
            const player = actorOf(text);
            const action = {
                eventIndex,
                timeMs,
                kind: kind !== null && kind !== void 0 ? kind : 'unknown',
                logType,
                player,
                detail: decodeDetail(logType, text, context),
            };
            actions.push(action);
            // 66 is a first claim and 68 is a handover; both are two points moving.
            if (logType === 66 || logType === 68) {
                const change = {
                    eventIndex,
                    timeMs,
                    achievement: name(ACHIEVEMENT_NAMES, text.achievementEnum),
                    from: logType === 68 ? numberOrNull(text.playerColorOld) : null,
                    to: logType === 68
                        ? numberOrNull(text.playerColorNew)
                        : numberOrNull(text.playerColor),
                };
                const roads = change.to === null ? null : longestRoadOf(change, event);
                if (roads !== null)
                    change.roadLength = roads;
                achievements.push(change);
            }
            if (logType === 10) {
                context.rolled = true;
                const first = numberOrNull(text.firstDice);
                const second = numberOrNull(text.secondDice);
                if (first !== null && second !== null) {
                    rolls.push({
                        eventIndex,
                        timeMs,
                        player,
                        dice: [first, second],
                        total: first + second,
                    });
                }
            }
        }
        for (const [, entry] of indexedEntries(change.gameChatState)) {
            const message = (_e = entry === null || entry === void 0 ? void 0 : entry.text) === null || _e === void 0 ? void 0 : _e.message;
            if (typeof message !== 'string')
                continue;
            chat.push({
                eventIndex,
                timeMs,
                fromColor: numberOrNull((_f = entry === null || entry === void 0 ? void 0 : entry.text) === null || _f === void 0 ? void 0 : _f.from),
                message,
            });
        }
    });
    const endGame = ((_d = history.endGameState) !== null && _d !== void 0 ? _d : {});
    const standings = decodeStandings(endGame);
    const winner = standings.find(standing => standing.isWinner);
    const target = numberOrNull(((_e = data.gameSettings) !== null && _e !== void 0 ? _e : {})['victoryPointsToWin']);
    return {
        schemaVersion: REPLAY_RECORD_VERSION,
        gameId: (_g = (_f = options.gameId) !== null && _f !== void 0 ? _f : data.databaseGameId) !== null && _g !== void 0 ? _g : null,
        startTime: typeof history.startTime === 'string' ? history.startTime : null,
        perspective: numberOrNull(data.playerPerspective),
        settings: Object.assign(Object.assign({}, ((_h = data.gameSettings) !== null && _h !== void 0 ? _h : {})), ((_j = data.gameDetails) !== null && _j !== void 0 ? _j : {})),
        players,
        playOrder,
        board: decodeBoard((_k = history.initialState) === null || _k === void 0 ? void 0 : _k.mapState),
        actions,
        rolls,
        chat,
        achievements,
        standings,
        endGame,
        diagnostics: {
            events: events.length,
            actions: actions.length,
            unknownLogTypes,
            victoryPointsCheck: {
                winnerTotal: winner ? winner.totalPoints : null,
                target,
                consistent: winner === undefined || target === null
                    ? true
                    : winner.totalPoints >= target,
            },
        },
    };
}
/**
 * Strip the identifying fields, for a record that is going to leave this
 * machine. Seat colours are kept because the game is unreadable without them.
 *
 * Chat is dropped rather than scrubbed: it is free text people typed at each
 * other, and there is no reliable way to redact a name out of it.
 */
function anonymizeReplayRecord(record) {
    return Object.assign(Object.assign({}, record), { players: record.players.map((player, index) => (Object.assign(Object.assign({}, player), { username: `player${index + 1}`, userId: null, countryCode: null }))), chat: [] });
}

// replay/cli.ts
function parseArgs(argv) {
    var _a;
    const options = {
        targets: [],
        outDir: null,
        anonymize: false,
        quiet: false,
    };
    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index];
        if (arg === '--anonymize')
            options.anonymize = true;
        else if (arg === '--quiet')
            options.quiet = true;
        else if (arg === '--out')
            options.outDir = (_a = argv[++index]) !== null && _a !== void 0 ? _a : null;
        else
            options.targets.push(arg);
    }
    return options;
}
/** Every raw replay under a path, whether it names a file or a directory. */
function collect(target) {
    const full = node_path.resolve(target);
    if (node_fs.statSync(full).isDirectory()) {
        return node_fs.readdirSync(full)
            .filter(entry => entry.endsWith('.json') && !entry.endsWith('.record.json'))
            .map(entry => node_path.join(full, entry))
            .sort();
    }
    return [full];
}
/** A popup export, as opposed to one game's raw payload. */
function asBundle(value) {
    const bundle = value;
    if (!bundle || typeof bundle !== 'object')
        return null;
    if (typeof bundle.bundleVersion !== 'number')
        return null;
    if (!Array.isArray(bundle.replays))
        return null;
    return bundle.replays;
}
/**
 * Split a bundle into the per-game raw files the rest of the tool expects.
 * Returns the paths written.
 */
function unpackBundle(entries, outDir, quiet) {
    const written = [];
    for (const entry of entries) {
        if (!entry || entry.payload === undefined)
            continue;
        const gameId = typeof entry.gameId === 'string' ? entry.gameId : 'unknown';
        const path = node_path.join(outDir, `colonist-replay-${gameId}.json`);
        node_fs.writeFileSync(path, JSON.stringify(entry.payload));
        written.push(path);
    }
    if (!quiet) {
        console.log(`Unpacked ${written.length} replay(s) from the bundle.`);
    }
    return written;
}
/** The gameId is in the filename Colonist's own download name carries. */
function gameIdFrom(path) {
    const match = /colonist-replay-([^.]+)\.json$/.exec(node_path.basename(path));
    return match ? match[1] : null;
}
function run(argv) {
    const options = parseArgs(argv);
    if (options.targets.length === 0) {
        console.error('usage: node scripts/decode-replay.js <raw.json | directory> [--out <dir>] [--anonymize] [--quiet]');
        return 2;
    }
    let files = options.targets.flatMap(collect);
    if (files.length === 0) {
        console.error('No replay files found.');
        return 1;
    }
    // A bundle stands in for the games inside it, so everything downstream only
    // ever deals with one game per file.
    const expanded = [];
    for (const file of files) {
        let entries = null;
        try {
            entries = asBundle(JSON.parse(node_fs.readFileSync(file, 'utf8')));
        }
        catch (_a) {
            /* handled per-file below, where the error can be reported */
        }
        if (entries) {
            const outDir = options.outDir
                ? node_path.resolve(options.outDir)
                : node_path.resolve(file, '..');
            expanded.push(...unpackBundle(entries, outDir, options.quiet));
        }
        else {
            expanded.push(file);
        }
    }
    files = expanded;
    let failures = 0;
    for (const file of files) {
        try {
            const raw = JSON.parse(node_fs.readFileSync(file, 'utf8'));
            const decoded = decodeReplay(raw, { gameId: gameIdFrom(file) });
            const record = options.anonymize
                ? anonymizeReplayRecord(decoded)
                : decoded;
            const outName = node_path.basename(file).replace(/\.json$/, '.record.json');
            const outPath = options.outDir
                ? node_path.join(node_path.resolve(options.outDir), outName)
                : node_path.join(node_path.resolve(file, '..'), outName);
            node_fs.writeFileSync(outPath, JSON.stringify(record, null, 2));
            if (!options.quiet) {
                const unknown = Object.entries(record.diagnostics.unknownLogTypes);
                const winner = record.standings.find(standing => standing.isWinner);
                console.log(`${node_path.basename(file)} -> ${node_path.basename(outPath)}  ` +
                    `${record.players.length} players, ${record.diagnostics.events} events, ` +
                    `${record.diagnostics.actions} actions, ${record.rolls.length} rolls, ` +
                    `${record.chat.length} chat, ${record.achievements.length} achievement changes` +
                    (winner
                        ? `, winner ${winner.color} on ${winner.totalPoints}`
                        : '') +
                    (unknown.length
                        ? `  [unknown log types: ${unknown
                            .map(([type, count]) => `${type}x${count}`)
                            .join(', ')}]`
                        : ''));
            }
            // A winner short of the target means a victory-point source is weighted
            // wrongly, or the game is a variant scoring on rules this does not model.
            // Overshooting is fine — two-point achievements move a player past the
            // line — so only falling short is worth saying anything about.
            const check = record.diagnostics.victoryPointsCheck;
            if (!check.consistent) {
                console.warn(`  warning: ${node_path.basename(file)} winner scores ${check.winnerTotal}, ` +
                    `short of the ${check.target} the game was played to. ` +
                    'A victory-point source is mapped wrongly, or this is a variant.');
            }
        }
        catch (error) {
            failures++;
            console.error(`${node_path.basename(file)}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return failures > 0 ? 1 : 0;
}
process.exit(run(process.argv.slice(2)));
