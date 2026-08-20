import { describe, expect, it } from '@jest/globals';
import { decode, encode } from '@msgpack/msgpack';
import { anonymizeGameLog } from '../gameLogAnonymizer';
import type { GameLog } from '../messageLogger';
import type { TransportCapture } from '../transportCapture';

function transportCapture(
  sequence: number,
  data: string,
  direction: TransportCapture['direction'] = 'incoming'
): TransportCapture {
  return {
    captureVersion: 1,
    id: `session:${sequence}`,
    pageSessionId: 'session',
    sequence,
    capturedAt: `2026-08-17T20:00:0${sequence}.000Z`,
    direction,
    connectionId: 1,
    connectionUrl: 'wss://socket.svr.colonist.io/',
    event: 'message',
    encoding: 'base64',
    data,
    byteLength: data.length,
    truncated: false,
  };
}

function exampleLog(): GameLog {
  const encodedSnapshot = Buffer.from(
    encode({
      data: {
        payload: {
          playerUserStates: [
            { selectedColor: 2, username: 'Beta' },
            { selectedColor: 9, username: 'Alpha & Co' },
          ],
        },
      },
    })
  ).toString('base64');

  return {
    schemaVersion: 5,
    gameId: 'test-game',
    url: 'https://colonist.io/#test-game',
    startedAt: '2026-08-17T20:00:00.000Z',
    updatedAt: '2026-08-17T20:01:00.000Z',
    youPlayerName: 'Beta',
    players: ['Beta', 'Alpha & Co'],
    messages: [
      {
        index: 1,
        text: 'Alpha & Co placed a Settlement',
        html: '<div>Alpha &amp; Co placed a Settlement</div>',
        loggedAt: '2026-08-17T20:00:01.000Z',
      },
    ],
    transportCaptures: [
      transportCapture(1, encodedSnapshot),
      transportCapture(2, 'not-base64!', 'outgoing'),
    ],
    droppedTransportCaptures: 0,
    spatialCapture: {
      board: {
        source: 'colonist-msgpack',
        capturedAt: '2026-08-17T20:00:00.000Z',
        protocolSequence: 3,
        capturingPlayerColor: 2,
        capturingPlayerColorName: 'blue',
        playOrder: [2, 9],
        players: [
          { color: 2, colorName: 'blue', username: 'Beta', isBot: false },
          {
            color: 9,
            colorName: 'black',
            username: 'Alpha & Co',
            isBot: false,
          },
        ],
        hexes: [],
        corners: [],
        edges: [],
        ports: [],
        robberHexId: null,
      },
      events: [
        {
          kind: 'settlement-placed',
          capturedAt: '2026-08-17T20:00:01.000Z',
          protocolSequence: 12,
          playerColor: 9,
          cornerId: 10,
          buildingCode: 1,
        },
        {
          kind: 'settlement-placed',
          capturedAt: '2026-08-17T20:00:02.000Z',
          protocolSequence: 14,
          playerColor: 2,
          cornerId: 20,
          buildingCode: 1,
        },
      ],
      chatLog: [
        {
          index: 1,
          kind: 'player-chat',
          speakerName: 'Alpha & Co',
          speakerColor: 9,
          speakerColorName: 'black',
          colorMentions: [],
          text: 'Alpha & Co: ore for no block?',
          richText: 'Alpha & Co: ore for no block?',
          message: 'ore for no block?',
          iconAlts: [],
          loggedAt: '2026-08-17T20:00:01.000Z',
        },
      ],
      decodedIncomingCaptures: 1,
      decodeFailures: 0,
    },
  };
}

describe('anonymizeGameLog', () => {
  it('assigns aliases by first settlement placement across exported fields', () => {
    const source = exampleLog();
    const exported = anonymizeGameLog(source);

    expect(exported.schemaVersion).toBe(6);
    expect(exported.players).toEqual(['Player 1', 'Player 2']);
    expect(exported.youPlayerName).toBe('Player 2');
    expect(exported.messages[0]).toMatchObject({
      text: 'Player 1 placed a Settlement',
      html: '<div>Player 1 placed a Settlement</div>',
    });
    expect(exported.spatialCapture.board!.players).toEqual([
      {
        color: 2,
        colorName: 'blue',
        username: 'Player 2',
        isBot: false,
      },
      {
        color: 9,
        colorName: 'black',
        username: 'Player 1',
        isBot: false,
      },
    ]);
    expect(exported.spatialCapture.chatLog[0]).toMatchObject({
      speakerName: 'Player 1',
      richText: 'Player 1: ore for no block?',
      message: 'ore for no block?',
    });
  });

  it('redacts MessagePack and removes protocol payloads it cannot inspect', () => {
    const exported = anonymizeGameLog(exampleLog());
    const decoded = decode(
      Buffer.from(exported.transportCaptures[0].data!, 'base64')
    ) as { data: { payload: { playerUserStates: unknown[] } } };

    expect(decoded.data.payload.playerUserStates).toEqual([
      { selectedColor: 2, username: 'Player 2' },
      { selectedColor: 9, username: 'Player 1' },
    ]);
    expect(exported.transportCaptures[1]).toMatchObject({
      encoding: 'none',
      data: null,
    });
    expect(exported.anonymization).toEqual({
      playerNames: 'placement-order',
      opaqueTransportPayloadsRemoved: 1,
    });
  });

  it('does not mutate the resumable source log', () => {
    const source = exampleLog();
    anonymizeGameLog(source);

    expect(source.schemaVersion).toBe(5);
    expect(source.players).toEqual(['Beta', 'Alpha & Co']);
    expect(source.transportCaptures[1].data).toBe('not-base64!');
  });
});
