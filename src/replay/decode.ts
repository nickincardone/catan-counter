// replay/decode.ts
// Turns one raw Colonist replay into a flat, self-describing game record.
//
// The raw payload is a stream of state diffs, which is faithful but awkward to
// train on: what a player *did* is spread across a structured log entry and
// whichever state slices moved with it. This module reads the log — the part
// that says what happened, in order, with typed parameters — and resolves the
// numeric codes into names.
//
// Two rules shape it.
//
// Nothing is dropped. A log type the decoder does not recognise becomes an
// `unknown` action carrying its parameters verbatim, and is counted in
// diagnostics, so a Colonist change shows up as a number to look at instead of
// as a silently shorter game.
//
// Nothing is invented. Where the payload records only card backs — a steal, as
// the table saw it — the decoded action says `hidden` rather than filling in the
// card from the private entry sitting next to it. Both entries are kept, so a
// model can be trained on either the information set or the truth, and the
// choice stays the caller's.

import {
  ACHIEVEMENT_NAMES,
  CARD_BACK,
  DEVELOPMENT_CARD_NAMES,
  LOG_TYPE_NAMES,
  PIECE_NAMES,
  PORT_NAMES,
  RESOURCE_NAMES,
  TERRAIN_NAMES,
  VICTORY_POINT_SOURCES,
  type RawCoordinate,
  type RawEvent,
  type RawHex,
  type RawLogText,
  type RawPort,
  type RawReplay,
} from './schema.js';

export const REPLAY_RECORD_VERSION = 1 as const;

export interface DecodedHex {
  id: number;
  x: number;
  y: number;
  terrain: string;
  terrainCode: number;
  diceNumber: number;
}

export interface DecodedPort {
  id: number;
  x: number;
  y: number;
  z: number;
  port: string;
  portCode: number;
}

export interface DecodedBoard {
  hexes: DecodedHex[];
  corners: Array<{ id: number } & RawCoordinate>;
  edges: Array<{ id: number } & RawCoordinate>;
  ports: DecodedPort[];
}

export interface DecodedPlayer {
  color: number;
  username: string | null;
  userId: string | null;
  isBot: boolean;
  countryCode: string | null;
  /** Position in the turn order, or null if the play order omits this seat. */
  seatIndex: number | null;
}

export interface ChatLine {
  eventIndex: number;
  timeMs: number;
  fromColor: number | null;
  message: string;
}

/** One thing that happened, in order, with codes resolved. */
export interface ReplayAction {
  /** Index into the raw event list, so any action can be traced back. */
  eventIndex: number;
  /** Milliseconds from the first event, summed from each event's deltaS. */
  timeMs: number;
  /** Resolved name, or `unknown` for a log type this decoder does not know. */
  kind: string;
  logType: number;
  player: number | null;
  /** Fields specific to the kind; see the switch in decodeLogEntry. */
  detail: Record<string, unknown>;
}

/**
 * A change of hands for longest road or largest army. Both are worth two
 * points, and both move during a game, so who holds one at a given moment is
 * part of the state rather than an end-of-game fact.
 */
export interface AchievementChange {
  eventIndex: number;
  timeMs: number;
  achievement: string;
  /** The player who lost it, or null the first time it is claimed. */
  from: number | null;
  to: number | null;
  /** Road length at the moment it moved, when the payload records one. */
  roadLength?: number;
}

/** Final placing, with victory points broken out by where they came from. */
export interface Standing {
  color: number;
  rank: number | null;
  isWinner: boolean;
  totalPoints: number;
  pointsBySource: Record<string, number>;
}

export interface ReplayRecord {
  schemaVersion: typeof REPLAY_RECORD_VERSION;
  gameId: string | null;
  startTime: string | null;
  /** The seat whose link produced the file. Does not limit what is revealed. */
  perspective: number | null;
  settings: Record<string, unknown>;
  players: DecodedPlayer[];
  playOrder: number[];
  board: DecodedBoard;
  actions: ReplayAction[];
  rolls: Array<{
    eventIndex: number;
    timeMs: number;
    player: number | null;
    dice: [number, number];
    total: number;
  }>;
  chat: ChatLine[];
  /** Every time longest road or largest army was claimed or taken. */
  achievements: AchievementChange[];
  standings: Standing[];
  endGame: Record<string, unknown>;
  diagnostics: {
    events: number;
    actions: number;
    /** Log types with no name yet, and how often each appeared. */
    unknownLogTypes: Record<string, number>;
    /**
     * Whether the winner's points add up to what the game was played to. A
     * false here means a victory-point source is weighted wrongly, which would
     * otherwise show up only as quietly wrong scores.
     */
    victoryPointsCheck: {
      winnerTotal: number | null;
      target: number | null;
      consistent: boolean;
    };
  };
}

function name(table: Record<number, string>, code: unknown): string {
  return typeof code === 'number' && table[code] !== undefined
    ? table[code]
    : `unknown(${String(code)})`;
}

/** A tile reference, as the robber and blocked-production entries carry it. */
function decodeTile(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const tile = value as {
    tileType?: number;
    diceNumber?: number;
    resourceType?: number;
  };
  return {
    terrain: name(TERRAIN_NAMES, tile.tileType),
    diceNumber: numberOrNull(tile.diceNumber),
    resource: name(RESOURCE_NAMES, tile.resourceType),
  };
}

function resourceList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(code =>
    code === CARD_BACK ? 'hidden' : name(RESOURCE_NAMES, code)
  );
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function indexedEntries<T>(value: unknown): Array<[number, T]> {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, T>)
    .map(([key, entry]) => [Number(key), entry] as [number, T])
    .filter(([key]) => Number.isSafeInteger(key))
    .sort((a, b) => a[0] - b[0]);
}

function decodeBoard(mapState: unknown): DecodedBoard {
  const map = (mapState ?? {}) as {
    tileHexStates?: Record<string, RawHex>;
    tileCornerStates?: Record<string, RawCoordinate>;
    tileEdgeStates?: Record<string, RawCoordinate>;
    portEdgeStates?: Record<string, RawPort>;
  };

  return {
    hexes: indexedEntries<RawHex>(map.tileHexStates).map(([id, hex]) => ({
      id,
      x: hex.x,
      y: hex.y,
      terrain: name(TERRAIN_NAMES, hex.type),
      terrainCode: hex.type,
      // The desert carries no number; Colonist stores 0 there.
      diceNumber: hex.diceNumber,
    })),
    corners: indexedEntries<RawCoordinate>(map.tileCornerStates).map(
      ([id, corner]) => ({ id, ...corner })
    ),
    edges: indexedEntries<RawCoordinate>(map.tileEdgeStates).map(
      ([id, edge]) => ({ id, ...edge })
    ),
    ports: indexedEntries<RawPort>(map.portEdgeStates).map(([id, port]) => ({
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
function decodeDetail(
  logType: number,
  text: RawLogText
): Record<string, unknown> {
  switch (logType) {
    case 4: // setup placement
    case 5: // built during play
      return {
        piece: name(PIECE_NAMES, text.pieceEnum),
        ...(text.isVp !== undefined ? { isVictoryPoint: text.isVp } : {}),
      };

    case 10:
      return {
        dice: [text.firstDice, text.secondDice],
        total:
          (numberOrNull(text.firstDice) ?? 0) +
          (numberOrNull(text.secondDice) ?? 0),
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
      const { type: _type, ...rest } = text;
      return rest;
    }
  }
}

/** The acting player, which most entries name directly. */
function actorOf(text: RawLogText): number | null {
  return (
    numberOrNull(text.playerColor) ??
    numberOrNull(text.playerColorThief) ??
    numberOrNull(text.playerColorCreator) ??
    numberOrNull(text.playerColorOld) ??
    null
  );
}

/**
 * The road length recorded alongside a longest-road change, when the same
 * event's state says one. Colonist writes it under the gaining player.
 */
function longestRoadOf(
  change: AchievementChange,
  event: RawEvent
): number | null {
  if (change.achievement !== 'longest-road' || change.to === null) return null;
  const state = event.stateChange?.mechanicLongestRoadState as
    | Record<string, { longestRoad?: number }>
    | undefined;
  return numberOrNull(state?.[String(change.to)]?.longestRoad);
}

/** Final placings, with each player's points resolved to their sources. */
function decodeStandings(endGameState: Record<string, unknown>): Standing[] {
  const players = endGameState.players;
  if (!players || typeof players !== 'object') return [];

  return Object.values(players as Record<string, Record<string, unknown>>)
    .map(player => {
      const counts = (player.victoryPoints ?? {}) as Record<string, number>;
      const pointsBySource: Record<string, number> = {};
      let totalPoints = 0;

      for (const [code, count] of Object.entries(counts)) {
        const source = VICTORY_POINT_SOURCES[Number(code)];
        const label = source?.name ?? `unknown(${code})`;
        const points = (source?.points ?? 0) * count;
        pointsBySource[label] = points;
        totalPoints += points;
      }

      return {
        color: numberOrNull(player.color) ?? -1,
        rank: numberOrNull(player.rank),
        isWinner: player.winningPlayer === true,
        totalPoints,
        pointsBySource,
      };
    })
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
}

export function decodeReplay(
  raw: RawReplay,
  options: { gameId?: string | null } = {}
): ReplayRecord {
  const data = raw.data ?? {};
  const history = data.eventHistory ?? {};
  const events: RawEvent[] = Array.isArray(history.events)
    ? history.events
    : [];
  const playOrder = Array.isArray(data.playOrder) ? data.playOrder : [];

  const players: DecodedPlayer[] = (data.playerUserStates ?? []).map(user => {
    const color = numberOrNull(user.selectedColor);
    const seatIndex = color === null ? -1 : playOrder.indexOf(color);
    return {
      color: color ?? -1,
      username: typeof user.username === 'string' ? user.username : null,
      userId: typeof user.userId === 'string' ? user.userId : null,
      isBot: user.isBot === true,
      countryCode:
        typeof user.countryCode === 'string' ? user.countryCode : null,
      seatIndex: seatIndex >= 0 ? seatIndex : null,
    };
  });

  const actions: ReplayAction[] = [];
  const rolls: ReplayRecord['rolls'] = [];
  const chat: ChatLine[] = [];
  const achievements: AchievementChange[] = [];
  const unknownLogTypes: Record<string, number> = {};

  let timeMs = 0;
  events.forEach((event, eventIndex) => {
    // deltaS is seconds since the previous event and is the only thing `input`
    // carries; summing it gives a clock without needing per-event timestamps.
    timeMs += Math.round((numberOrNull(event.input?.deltaS) ?? 0) * 1000);
    const change = event.stateChange ?? {};

    for (const [, entry] of indexedEntries<{ text?: RawLogText }>(
      change.gameLogState
    )) {
      const text = entry?.text;
      const logType = numberOrNull(text?.type);
      if (!text || logType === null) continue;

      const kind = LOG_TYPE_NAMES[logType];
      if (kind === undefined) {
        unknownLogTypes[String(logType)] =
          (unknownLogTypes[String(logType)] ?? 0) + 1;
      }

      const player = actorOf(text);
      const action: ReplayAction = {
        eventIndex,
        timeMs,
        kind: kind ?? 'unknown',
        logType,
        player,
        detail: decodeDetail(logType, text),
      };
      actions.push(action);

      // 66 is a first claim and 68 is a handover; both are two points moving.
      if (logType === 66 || logType === 68) {
        const change: AchievementChange = {
          eventIndex,
          timeMs,
          achievement: name(ACHIEVEMENT_NAMES, text.achievementEnum),
          from: logType === 68 ? numberOrNull(text.playerColorOld) : null,
          to:
            logType === 68
              ? numberOrNull(text.playerColorNew)
              : numberOrNull(text.playerColor),
        };
        const roads = change.to === null ? null : longestRoadOf(change, event);
        if (roads !== null) change.roadLength = roads;
        achievements.push(change);
      }

      if (logType === 10) {
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

    for (const [, entry] of indexedEntries<{
      text?: { message?: string; from?: number };
    }>(change.gameChatState)) {
      const message = entry?.text?.message;
      if (typeof message !== 'string') continue;
      chat.push({
        eventIndex,
        timeMs,
        fromColor: numberOrNull(entry?.text?.from),
        message,
      });
    }
  });

  const endGame = (history.endGameState ?? {}) as Record<string, unknown>;
  const standings = decodeStandings(endGame);
  const winner = standings.find(standing => standing.isWinner);
  const target = numberOrNull(
    (data.gameSettings ?? {})['victoryPointsToWin' as string]
  );

  return {
    schemaVersion: REPLAY_RECORD_VERSION,
    gameId: options.gameId ?? data.databaseGameId ?? null,
    startTime: typeof history.startTime === 'string' ? history.startTime : null,
    perspective: numberOrNull(data.playerPerspective),
    settings: { ...(data.gameSettings ?? {}), ...(data.gameDetails ?? {}) },
    players,
    playOrder,
    board: decodeBoard(history.initialState?.mapState),
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
        consistent:
          winner === undefined || target === null
            ? true
            : winner.totalPoints === target,
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
export function anonymizeReplayRecord(record: ReplayRecord): ReplayRecord {
  return {
    ...record,
    players: record.players.map((player, index) => ({
      ...player,
      username: `player${index + 1}`,
      userId: null,
      countryCode: null,
    })),
    chat: [],
  };
}
