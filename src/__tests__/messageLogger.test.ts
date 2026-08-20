import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  initMessageLogger,
  logChatMessage,
  logTransportCapture,
  downloadCurrentGameLog,
  _resetMessageLoggerForTesting,
  _getCurrentLogForTesting,
} from '../messageLogger';
import { game, resetGameState, ensurePlayerExists } from '../gameState';
import type { TransportCapture } from '../transportCapture';

function makeMessageElement(index: number, text: string): HTMLElement {
  const element = document.createElement('div');
  element.setAttribute('data-index', String(index));
  element.innerHTML = `<span style="color:#CF6B2E">${text}</span>`;
  return element;
}

function makeTransportCapture(
  sequence: number,
  data = `packet-${sequence}`
): TransportCapture {
  return {
    captureVersion: 1,
    id: `page-session:${sequence}`,
    pageSessionId: 'page-session',
    sequence,
    capturedAt: `2026-08-17T20:00:${String(sequence).padStart(2, '0')}.000Z`,
    direction: 'incoming',
    connectionId: 1,
    connectionUrl: 'wss://example.colonist.io/socket',
    event: 'message',
    encoding: 'text',
    data,
    byteLength: data.length,
    truncated: false,
  };
}

describe('messageLogger', () => {
  beforeEach(async () => {
    resetGameState();
    game.youPlayerName = null;
    window.location.hash = '#testgame1';
    await initMessageLogger();
  });

  afterEach(() => {
    _resetMessageLoggerForTesting();
    window.location.hash = '';
  });

  describe('initMessageLogger', () => {
    it('creates a fresh log with the game id from the URL hash', () => {
      const log = _getCurrentLogForTesting();
      expect(log).not.toBeNull();
      expect(log!.gameId).toBe('testgame1');
      expect(log!.schemaVersion).toBe(5);
      expect(log!.messages).toEqual([]);
      expect(log!.transportCaptures).toEqual([]);
      expect(log!.spatialCapture).toEqual({
        board: null,
        events: [],
        chatLog: [],
        decodedIncomingCaptures: 0,
        decodeFailures: 0,
      });
    });

    it('falls back to "unknown" when there is no URL hash', async () => {
      window.location.hash = '';
      await initMessageLogger();
      expect(_getCurrentLogForTesting()!.gameId).toBe('unknown');
    });
  });

  describe('logChatMessage', () => {
    it('records text and raw html for a message row', () => {
      logChatMessage(makeMessageElement(3, 'Aaren placed a Settlement'));

      const messages = _getCurrentLogForTesting()!.messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].index).toBe(3);
      expect(messages[0].text).toBe('Aaren placed a Settlement');
      expect(messages[0].html).toContain('data-index="3"');
      expect(messages[0].html).toContain('color:#CF6B2E');
      expect(messages[0].loggedAt).toEqual(expect.any(String));
    });

    it('dedupes rows by data-index (history replay re-renders rows)', () => {
      const element = makeMessageElement(5, 'Botzow placed a Road');
      logChatMessage(element);
      logChatMessage(element);
      logChatMessage(makeMessageElement(5, 'different text, same index'));

      expect(_getCurrentLogForTesting()!.messages).toHaveLength(1);
    });

    it('ignores elements without a data-index attribute', () => {
      logChatMessage(document.createElement('div'));
      expect(_getCurrentLogForTesting()!.messages).toHaveLength(0);
    });

    it('does nothing before the logger is initialized', () => {
      _resetMessageLoggerForTesting();
      expect(() =>
        logChatMessage(makeMessageElement(1, 'hello'))
      ).not.toThrow();
    });
  });

  describe('logTransportCapture', () => {
    it('records and dedupes transport captures by id', () => {
      const capture = makeTransportCapture(1);
      logTransportCapture(capture);
      logTransportCapture(capture);

      expect(_getCurrentLogForTesting()!.transportCaptures).toEqual([capture]);
    });

    it('keeps captures that arrive before the game logger initializes', async () => {
      _resetMessageLoggerForTesting();
      const capture = makeTransportCapture(0, 'initial game snapshot');
      logTransportCapture(capture);

      await initMessageLogger();

      expect(_getCurrentLogForTesting()!.transportCaptures).toEqual([capture]);
    });
  });

  describe('downloadCurrentGameLog', () => {
    let clickSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
      // jsdom implements neither createObjectURL nor real downloads
      URL.createObjectURL = jest.fn(() => 'blob:fake') as never;
      URL.revokeObjectURL = jest.fn() as never;
      clickSpy = jest
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {});
    });

    it('returns null when no messages have been captured', () => {
      expect(downloadCurrentGameLog()).toBeNull();
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('exports messages sorted by index with current game metadata', () => {
      ensurePlayerExists('Aaren');
      ensurePlayerExists('Camilo#6469');
      game.youPlayerName = 'Camilo#6469';

      logChatMessage(makeMessageElement(7, 'second'));
      logChatMessage(makeMessageElement(2, 'first'));

      const exported = downloadCurrentGameLog();
      expect(exported).not.toBeNull();
      expect(exported!.schemaVersion).toBe(6);
      expect(exported!.messages.map(m => m.index)).toEqual([2, 7]);
      expect(exported!.spatialCapture.chatLog.map(m => m.index)).toEqual([
        2, 7,
      ]);
      expect(exported!.youPlayerName).toBe('Player 2');
      expect(exported!.players).toEqual(['Player 1', 'Player 2']);
      expect(exported!.anonymization.playerNames).toBe('placement-order');
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('exports transport captures even before chat messages exist', () => {
      logTransportCapture(makeTransportCapture(2));

      const exported = downloadCurrentGameLog();

      expect(exported!.transportCaptures).toHaveLength(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
  });
});
