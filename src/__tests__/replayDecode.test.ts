import { describe, expect, it } from '@jest/globals';
import {
  anonymizeReplayRecord,
  decodeReplay,
  type ReplayRecord,
} from '../replay/decode';
import type { RawReplay } from '../replay/schema';

/** One event carrying the given log entries, in the shape Colonist sends. */
function event(
  deltaS: number,
  entries: Array<Record<string, unknown>>,
  extra: Record<string, unknown> = {}
) {
  const gameLogState: Record<string, unknown> = {};
  entries.forEach((text, index) => {
    gameLogState[String(index)] = { text, from: text.playerColor };
  });
  return { input: { deltaS }, stateChange: { gameLogState, ...extra } };
}

function replay(events: unknown[]): RawReplay {
  return {
    data: {
      databaseGameId: '251323211',
      playerPerspective: 5,
      playOrder: [1, 4, 2, 5],
      gameSettings: { victoryPointsToWin: 10, cardDiscardLimit: 7 },
      gameDetails: { isRanked: true },
      playerUserStates: [
        {
          userId: 'u1',
          username: 'Ada',
          isBot: false,
          countryCode: 'US',
          selectedColor: 1,
        },
        {
          userId: 'u2',
          username: 'Grace',
          isBot: true,
          countryCode: 'GB',
          selectedColor: 4,
        },
      ],
      eventHistory: {
        startTime: '2026-08-19T00:00:00.000Z',
        initialState: {
          mapState: {
            tileHexStates: {
              '0': { x: 0, y: -2, type: 4, diceNumber: 6 },
              '1': { x: 1, y: -2, type: 0, diceNumber: 0 },
            },
            tileCornerStates: { '0': { x: 0, y: -2, z: 0 } },
            tileEdgeStates: { '0': { x: 1, y: -3, z: 2 } },
            portEdgeStates: {
              '0': { x: 0, y: -2, z: 0, type: 1 },
              '1': { x: 3, y: 0, z: 1, type: 5 },
            },
          },
        },
        events: events as never[],
        endGameState: {
          totalTurnCount: 83,
          players: {
            '1': {
              color: 1,
              rank: 2,
              // 1 settlement, 2 cities, 1 point card = 6
              victoryPoints: { '0': 1, '1': 2, '2': 1 },
              winningPlayer: false,
            },
            '4': {
              color: 4,
              rank: 1,
              // 1 settlement, 2 cities, 3 point cards, largest army = 10
              victoryPoints: { '0': 1, '1': 2, '2': 3, '3': 1 },
              winningPlayer: true,
            },
          },
        },
      },
    },
  };
}

describe('decoding the board', () => {
  it('names terrain and ports, and keeps the numeric codes beside them', () => {
    const board = decodeReplay(replay([])).board;

    expect(board.hexes[0]).toEqual({
      id: 0,
      x: 0,
      y: -2,
      terrain: 'grain',
      terrainCode: 4,
      diceNumber: 6,
    });
    // The desert is the one hex Colonist gives no number.
    expect(board.hexes[1].terrain).toBe('desert');
    expect(board.hexes[1].diceNumber).toBe(0);
    expect(board.ports.map(p => p.port)).toEqual(['generic', 'grain']);
    expect(board.corners).toEqual([{ id: 0, x: 0, y: -2, z: 0 }]);
    expect(board.edges).toEqual([{ id: 0, x: 1, y: -3, z: 2 }]);
  });
});

describe('decoding players', () => {
  it('places each seat in the turn order', () => {
    const players = decodeReplay(replay([])).players;
    expect(players.map(p => [p.color, p.seatIndex])).toEqual([
      [1, 0],
      [4, 1],
    ]);
    expect(players[1].isBot).toBe(true);
  });
});

describe('decoding actions', () => {
  it('reads a dice roll and lists it separately', () => {
    const record = decodeReplay(
      replay([
        event(2.5, [{ type: 10, playerColor: 4, firstDice: 3, secondDice: 5 }]),
      ])
    );

    expect(record.actions[0]).toMatchObject({
      kind: 'roll',
      logType: 10,
      player: 4,
      detail: { dice: [3, 5], total: 8 },
    });
    expect(record.rolls).toEqual([
      { eventIndex: 0, timeMs: 2500, player: 4, dice: [3, 5], total: 8 },
    ]);
  });

  it('tells a free placement from a purchase, and names the piece', () => {
    const record = decodeReplay(
      replay([
        event(0, [{ type: 4, playerColor: 1, pieceEnum: 2 }]),
        event(1, [{ type: 5, playerColor: 1, pieceEnum: 3, isVp: true }]),
      ])
    );

    expect(record.actions[0]).toMatchObject({
      kind: 'free-placement',
      detail: { piece: 'settlement', duringOpening: true },
    });
    expect(record.actions[1]).toMatchObject({
      kind: 'build',
      detail: { piece: 'city', isVictoryPoint: true },
    });
  });

  it('separates opening placements from the roads a road building card gives', () => {
    // Type 4 is not the opening, it is a piece placed without paying. Road
    // building produces two more of them, mid-game, and reading those as
    // opening placements would put four settlements' worth of free pieces in
    // the wrong phase of the game.
    const record = decodeReplay(
      replay([
        event(0, [{ type: 4, playerColor: 1, pieceEnum: 2 }]),
        event(1, [{ type: 10, playerColor: 1, firstDice: 3, secondDice: 4 }]),
        event(1, [{ type: 20, playerColor: 1, cardEnum: 14 }]),
        event(0, [{ type: 4, playerColor: 1, pieceEnum: 0 }]),
        event(0, [{ type: 4, playerColor: 1, pieceEnum: 0 }]),
      ])
    );

    const placements = record.actions.filter(a => a.kind === 'free-placement');
    expect(placements.map(p => p.detail.duringOpening)).toEqual([
      true,
      false,
      false,
    ]);
    expect(record.actions[2].detail).toEqual({ card: 'road-building' });
  });

  it('names a bought development card and the card that was played', () => {
    const record = decodeReplay(
      replay([
        event(0, [{ type: 1, playerColor: 2 }]),
        event(0, [{ type: 20, playerColor: 2, cardEnum: 11 }]),
      ])
    );

    expect(record.actions[0].kind).toBe('buy-development-card');
    expect(record.actions[1]).toMatchObject({
      kind: 'play-development-card',
      detail: { card: 'knight' },
    });
  });

  it('keeps both sides of a trade', () => {
    const record = decodeReplay(
      replay([
        event(0, [
          {
            type: 115,
            playerColorCreator: 1,
            acceptingPlayerColor: 4,
            givenCardEnums: [1, 1],
            receivedCardEnums: [5],
          },
        ]),
      ])
    );

    expect(record.actions[0]).toMatchObject({
      kind: 'trade-accepted',
      player: 1,
      detail: { acceptedBy: 4, given: ['lumber', 'lumber'], received: ['ore'] },
    });
  });

  it('leaves a public steal face down even though the private entry names it', () => {
    // All three entries land in the same event, exactly as Colonist sends them.
    const record = decodeReplay(
      replay([
        event(0, [
          {
            type: 16,
            playerColorThief: 2,
            playerColorVictim: 5,
            cardBacks: [0],
          },
          { type: 14, playerColor: 2, cardEnums: [3] },
          { type: 15, playerColor: 5, cardEnums: [3] },
        ]),
      ])
    );

    const [publicSteal, thiefView, victimView] = record.actions;
    expect(publicSteal.detail).toEqual({
      thief: 2,
      victim: 5,
      cards: ['hidden'],
    });
    // The truth is available, but only from the entries that actually hold it.
    expect(thiefView.detail).toEqual({ cards: ['wool'] });
    expect(victimView.detail).toEqual({ cards: ['wool'] });
  });

  it('names the tile the robber moved to, and the one it blocked', () => {
    const tile = { tileType: 5, diceNumber: 9, resourceType: 5 };
    const record = decodeReplay(
      replay([
        event(0, [{ type: 11, playerColor: 2, pieceEnum: 5, tileInfo: tile }]),
        event(0, [{ type: 49, tileInfo: tile }]),
      ])
    );

    expect(record.actions[0]).toMatchObject({
      kind: 'move-robber',
      player: 2,
      detail: { piece: 'robber', tile: { terrain: 'ore', diceNumber: 9 } },
    });
    // Production lost to the robber is a fact worth training on, so it is a
    // named action rather than an unrecognised entry.
    expect(record.actions[1]).toMatchObject({
      kind: 'robber-blocked-production',
      detail: { tile: { terrain: 'ore', diceNumber: 9, resource: 'ore' } },
    });
  });

  it('reports a log type it does not know instead of dropping the entry', () => {
    const record = decodeReplay(
      replay([event(0, [{ type: 999, playerColor: 1, mysteryField: 7 }])])
    );

    expect(record.actions).toHaveLength(1);
    expect(record.actions[0]).toMatchObject({
      kind: 'unknown',
      logType: 999,
      player: 1,
      detail: { mysteryField: 7 },
    });
    expect(record.diagnostics.unknownLogTypes).toEqual({ '999': 1 });
  });

  it('builds a clock by adding up each event delta', () => {
    const record = decodeReplay(
      replay([
        event(1.5, [{ type: 10, playerColor: 1, firstDice: 1, secondDice: 1 }]),
        event(2, [{ type: 10, playerColor: 4, firstDice: 2, secondDice: 2 }]),
      ])
    );
    expect(record.rolls.map(r => r.timeMs)).toEqual([1500, 3500]);
  });
});

describe('decoding chat', () => {
  it('keeps the message and who sent it', () => {
    const record = decodeReplay(
      replay([
        {
          input: { deltaS: 3 },
          stateChange: {
            gameChatState: {
              '0': { text: { type: 0, message: 'Ore nb', from: 4 } },
            },
          },
        },
      ])
    );

    expect(record.chat).toEqual([
      { eventIndex: 0, timeMs: 3000, fromColor: 4, message: 'Ore nb' },
    ]);
  });
});

describe('anonymizing a record', () => {
  let record: ReplayRecord;
  beforeEach(() => {
    record = decodeReplay(
      replay([
        {
          input: { deltaS: 0 },
          stateChange: {
            gameChatState: { '0': { text: { message: 'gg Ada', from: 1 } } },
          },
        },
      ])
    );
  });

  it('removes the identifying fields but keeps the game readable', () => {
    const safe = anonymizeReplayRecord(record);

    expect(safe.players.map(p => p.username)).toEqual(['player1', 'player2']);
    expect(safe.players.every(p => p.userId === null)).toBe(true);
    expect(safe.players.every(p => p.countryCode === null)).toBe(true);
    // Seats still identify who did what.
    expect(safe.players.map(p => p.color)).toEqual([1, 4]);
    expect(safe.board).toEqual(record.board);
  });

  it('drops chat rather than trying to scrub names out of free text', () => {
    expect(record.chat).toHaveLength(1);
    expect(anonymizeReplayRecord(record).chat).toEqual([]);
  });
});

describe('longest road and largest army', () => {
  it('records a first claim, with no previous holder', () => {
    const record = decodeReplay(
      replay([
        {
          input: { deltaS: 4 },
          stateChange: {
            gameLogState: {
              '0': { text: { type: 66, playerColor: 5, achievementEnum: 1 } },
            },
            mechanicLargestArmyState: { '5': { hasLargestArmy: true } },
          },
        },
      ])
    );

    expect(record.achievements).toEqual([
      {
        eventIndex: 0,
        timeMs: 4000,
        achievement: 'largest-army',
        from: null,
        to: 5,
      },
    ]);
  });

  it('records a handover, and the road length that won it', () => {
    const record = decodeReplay(
      replay([
        {
          input: { deltaS: 1 },
          stateChange: {
            gameLogState: {
              '0': {
                text: {
                  type: 68,
                  achievementEnum: 0,
                  playerColorOld: 2,
                  playerColorNew: 5,
                },
              },
            },
            mechanicLongestRoadState: {
              '2': { hasLongestRoad: null },
              '5': { longestRoad: 6, hasLongestRoad: true },
            },
          },
        },
      ])
    );

    expect(record.achievements[0]).toEqual({
      eventIndex: 0,
      timeMs: 1000,
      achievement: 'longest-road',
      from: 2,
      to: 5,
      roadLength: 6,
    });
  });

  it('leaves the road length out when the payload does not carry one', () => {
    const record = decodeReplay(
      replay([
        {
          input: { deltaS: 0 },
          stateChange: {
            gameLogState: {
              '0': { text: { type: 66, playerColor: 1, achievementEnum: 0 } },
            },
          },
        },
      ])
    );
    expect(record.achievements[0].roadLength).toBeUndefined();
  });
});

describe('final standings', () => {
  it('weights each victory point source and orders by rank', () => {
    const record = decodeReplay(replay([]));

    expect(record.standings.map(s => [s.color, s.rank, s.totalPoints])).toEqual(
      [
        [4, 1, 10],
        [1, 2, 6],
      ]
    );
    expect(record.standings[0].pointsBySource).toEqual({
      settlement: 1,
      city: 4,
      'development-card': 3,
      // Two points, not one: the count is 1 and the source is worth 2.
      'largest-army': 2,
    });
    expect(record.standings[0].isWinner).toBe(true);
  });

  it('confirms the winner reached the target the game was played to', () => {
    const check = decodeReplay(replay([])).diagnostics.victoryPointsCheck;
    expect(check).toEqual({ winnerTotal: 10, target: 10, consistent: true });
  });

  it('accepts a winner who overshot, since two-point gains jump the line', () => {
    // Real game: taking largest army and then longest road from nine points
    // finishes on eleven. Demanding an exact landing would cry wolf on it.
    const raw = replay([]);
    (
      raw.data!.eventHistory!.endGameState as never as Record<string, never>
    ).players = {
      '3': {
        color: 3,
        rank: 1,
        victoryPoints: { '0': 3, '1': 1, '2': 2, '3': 1, '4': 1 },
        winningPlayer: true,
      },
    } as never;

    const check = decodeReplay(raw).diagnostics.victoryPointsCheck;
    expect(check.winnerTotal).toBe(11);
    expect(check.consistent).toBe(true);
  });

  it('flags a winner whose points do not add up to the target', () => {
    const raw = replay([]);
    // A point source weighted wrongly would look exactly like this.
    (
      raw.data!.eventHistory!.endGameState as never as Record<string, never>
    ).players = {
      '4': {
        color: 4,
        rank: 1,
        victoryPoints: { '0': 1 },
        winningPlayer: true,
      },
    } as never;

    const check = decodeReplay(raw).diagnostics.victoryPointsCheck;
    expect(check.consistent).toBe(false);
    expect(check.winnerTotal).toBe(1);
  });
});
