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
export const TERRAIN_NAMES: Record<number, string> = {
  0: 'desert',
  1: 'lumber',
  2: 'brick',
  3: 'wool',
  4: 'grain',
  5: 'ore',
};

/** Port codes. Four generic and one of each resource on a standard board. */
export const PORT_NAMES: Record<number, string> = {
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
export const RESOURCE_NAMES: Record<number, string> = {
  1: 'lumber',
  2: 'brick',
  3: 'wool',
  4: 'grain',
  5: 'ore',
};

/** A face-down card, used where the log shows what the table could see. */
export const CARD_BACK = 0;

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
export const DEVELOPMENT_CARD_NAMES: Record<number, string> = {
  10: 'hidden',
  11: 'knight',
  12: 'victory-point',
  13: 'monopoly',
  14: 'road-building',
  15: 'year-of-plenty',
};

/** Piece codes, fixed by which mechanic state each one moves. */
export const PIECE_NAMES: Record<number, string> = {
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
export const ACHIEVEMENT_NAMES: Record<number, string> = {
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
export const VICTORY_POINT_SOURCES: Record<
  number,
  { name: string; points: number }
> = {
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
export const LOG_TYPE_NAMES: Record<number, string> = {
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
  115: 'trade-accepted',
  116: 'bank-trade',
  117: 'trade-offer-targeted',
  118: 'trade-offer',
};

/** Raw payload shapes. Only the parts the decoder reads are described. */

export interface RawHex {
  x: number;
  y: number;
  type: number;
  diceNumber: number;
}

export interface RawCoordinate {
  x: number;
  y: number;
  z: number;
}

export interface RawPort extends RawCoordinate {
  type: number;
}

export interface RawMapState {
  tileHexStates?: Record<string, RawHex>;
  tileCornerStates?: Record<string, RawCoordinate>;
  tileEdgeStates?: Record<string, RawCoordinate>;
  portEdgeStates?: Record<string, RawPort>;
}

export interface RawLogText {
  type?: number;
  [key: string]: unknown;
}

export interface RawLogEntry {
  text?: RawLogText;
  from?: number;
}

export interface RawChatEntry {
  text?: {
    type?: number;
    message?: string;
    from?: number;
  };
}

export interface RawStateChange {
  gameLogState?: Record<string, RawLogEntry>;
  gameChatState?: Record<string, RawChatEntry>;
  diceState?: { dice1?: number; dice2?: number; diceThrown?: boolean };
  playerStates?: Record<string, RawPlayerState>;
  mapState?: RawMapState;
  [key: string]: unknown;
}

export interface RawPlayerState {
  color?: number;
  resourceCards?: { cards?: number[] };
  victoryPointsState?: Record<string, number>;
  [key: string]: unknown;
}

export interface RawEvent {
  /** Seconds since the previous event. The only thing `input` carries. */
  input?: { deltaS?: number };
  stateChange?: RawStateChange;
}

export interface RawPlayerUserState {
  userId?: string;
  username?: string;
  isBot?: boolean;
  countryCode?: string;
  selectedColor?: number;
  [key: string]: unknown;
}

export interface RawReplay {
  data?: {
    eventHistory?: {
      version?: number;
      startTime?: string;
      initialState?: Record<string, unknown> & { mapState?: RawMapState };
      events?: RawEvent[];
      endGameState?: Record<string, unknown>;
      botUserNames?: Record<string, unknown>;
    };
    playerUserStates?: RawPlayerUserState[];
    playOrder?: number[];
    gameSettings?: Record<string, unknown>;
    gameDetails?: Record<string, unknown>;
    databaseGameId?: string;
    playerPerspective?: number;
  };
}
