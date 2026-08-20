import { describe, expect, it } from '@jest/globals';
import {
  PAGE_TRANSPORT_SOURCE,
  parsePageTransportEnvelope,
} from '../transportCapture';
import type { TransportCapture } from '../transportCapture';

function makeCapture(): TransportCapture {
  return {
    captureVersion: 1,
    id: 'page:4',
    pageSessionId: 'page',
    sequence: 4,
    capturedAt: '2026-08-17T20:00:00.000Z',
    direction: 'incoming',
    connectionId: 1,
    connectionUrl: 'wss://example.colonist.io/socket',
    event: 'message',
    encoding: 'text',
    data: '42["game-state",{}]',
    byteLength: 19,
    truncated: false,
  };
}

describe('transportCapture bridge validation', () => {
  it('accepts a valid capture envelope', () => {
    const capture = makeCapture();
    expect(
      parsePageTransportEnvelope({ source: PAGE_TRANSPORT_SOURCE, capture })
    ).toEqual(capture);
  });

  it('ignores unrelated page messages', () => {
    expect(
      parsePageTransportEnvelope({ source: 'colonist', capture: {} })
    ).toBe(null);
  });

  it('rejects malformed or oversized captures', () => {
    expect(
      parsePageTransportEnvelope({
        source: PAGE_TRANSPORT_SOURCE,
        capture: { ...makeCapture(), sequence: -1 },
      })
    ).toBe(null);
    expect(
      parsePageTransportEnvelope({
        source: PAGE_TRANSPORT_SOURCE,
        capture: { ...makeCapture(), data: 'x'.repeat(350_001) },
      })
    ).toBe(null);
  });
});
