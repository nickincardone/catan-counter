import { describe, expect, it } from '@jest/globals';
import { encode } from '@msgpack/msgpack';
import { SpatialGameTracker } from '../spatialGameState';
import type { TransportCapture } from '../transportCapture';

function capture(sequence: number, value: unknown): TransportCapture {
  const data = Buffer.from(encode(value)).toString('base64');
  return {
    captureVersion: 1,
    id: `page:${sequence}`,
    pageSessionId: 'page',
    sequence,
    capturedAt: `2026-08-17T20:00:${String(sequence).padStart(2, '0')}.000Z`,
    direction: 'incoming',
    connectionId: 1,
    connectionUrl: 'wss://socket.svr.colonist.io/',
    event: 'message',
    encoding: 'base64',
    data,
    byteLength: data.length,
    truncated: false,
  };
}

function fullSnapshot(): unknown {
  return {
    id: '130',
    data: {
      type: 4,
      sequence: 3,
      payload: {
        playerColor: 9,
        playOrder: [9, 3, 2, 1],
        playerUserStates: [
          { selectedColor: 9, username: 'NickTheSwift', isBot: false },
          { selectedColor: 3, username: 'Gard', isBot: true },
        ],
        gameState: {
          mapState: {
            tileHexStates: {
              0: { x: 0, y: -2, type: 5, diceNumber: 5 },
              7: { x: 1, y: 1, type: 0, diceNumber: 0 },
            },
            tileCornerStates: {
              10: { x: -2, y: 1, z: 0 },
            },
            tileEdgeStates: {
              11: { x: -1, y: 0, z: 1 },
            },
            portEdgeStates: {
              0: { x: 0, y: -2, z: 0, type: 2 },
            },
          },
          mechanicRobberState: { locationTileIndex: 7 },
        },
      },
    },
  };
}

function diff(sequence: number, stateDiff: unknown): unknown {
  return {
    id: '130',
    data: {
      type: 91,
      sequence,
      payload: { diff: stateDiff },
    },
  };
}

describe('SpatialGameTracker', () => {
  it('decodes the canonical board from Colonist MessagePack', () => {
    const tracker = new SpatialGameTracker();
    tracker.ingest(capture(1, fullSnapshot()));

    const snapshot = tracker.snapshot();
    expect(snapshot.decodeFailures).toBe(0);
    expect(snapshot.board).toMatchObject({
      capturingPlayerColor: 9,
      capturingPlayerColorName: 'black',
      playOrder: [9, 3, 2, 1],
      robberHexId: 7,
    });
    expect(snapshot.board!.players).toEqual([
      {
        color: 9,
        colorName: 'black',
        username: 'NickTheSwift',
        isBot: false,
      },
      { color: 3, colorName: 'orange', username: 'Gard', isBot: true },
    ]);
    expect(snapshot.board!.hexes).toEqual([
      { id: 0, x: 0, y: -2, terrain: 'ore', terrainCode: 5, diceNumber: 5 },
      { id: 7, x: 1, y: 1, terrain: 'desert', terrainCode: 0, diceNumber: 0 },
    ]);
    expect(snapshot.board!.corners).toEqual([{ id: 10, x: -2, y: 1, z: 0 }]);
    expect(snapshot.board!.edges).toEqual([{ id: 11, x: -1, y: 0, z: 1 }]);
    expect(snapshot.board!.ports).toEqual([
      { id: 0, x: 0, y: -2, z: 0, port: 'lumber', portCode: 2 },
    ]);
  });

  it('normalizes settlement, road, city, and robber diffs', () => {
    const tracker = new SpatialGameTracker();
    tracker.ingest(capture(1, fullSnapshot()));
    tracker.ingest(
      capture(
        2,
        diff(12, {
          mapState: {
            tileCornerStates: { 10: { owner: 9, buildingType: 1 } },
          },
        })
      )
    );
    tracker.ingest(
      capture(
        3,
        diff(20, {
          mapState: { tileEdgeStates: { 11: { owner: 9, type: 1 } } },
        })
      )
    );
    tracker.ingest(
      capture(
        4,
        diff(30, {
          mapState: {
            tileCornerStates: { 10: { owner: 9, buildingType: 2 } },
          },
          mechanicRobberState: { locationTileIndex: 0 },
        })
      )
    );

    const snapshot = tracker.snapshot();
    expect(snapshot.board!.corners[0]).toMatchObject({
      ownerColor: 9,
      building: 'city',
      buildingCode: 2,
    });
    expect(snapshot.board!.edges[0]).toMatchObject({
      ownerColor: 9,
      roadCode: 1,
    });
    expect(snapshot.board!.robberHexId).toBe(0);
    expect(snapshot.events).toEqual([
      expect.objectContaining({
        kind: 'settlement-placed',
        protocolSequence: 12,
        playerColor: 9,
        cornerId: 10,
      }),
      expect.objectContaining({
        kind: 'road-placed',
        protocolSequence: 20,
        playerColor: 9,
        edgeId: 11,
      }),
      expect.objectContaining({
        kind: 'city-built',
        protocolSequence: 30,
        playerColor: 9,
        cornerId: 10,
      }),
      expect.objectContaining({
        kind: 'robber-moved',
        protocolSequence: 30,
        hexId: 0,
      }),
    ]);
  });

  it('ignores outgoing framing and counts malformed incoming packets', () => {
    const tracker = new SpatialGameTracker();
    const outgoing = capture(1, fullSnapshot());
    outgoing.direction = 'outgoing';
    tracker.ingest(outgoing);
    tracker.ingest({ ...capture(2, fullSnapshot()), data: 'not-base64!' });

    expect(tracker.snapshot()).toMatchObject({
      board: null,
      decodedIncomingCaptures: 0,
      decodeFailures: 1,
    });
  });
});
