import { describe, expect, it } from '@jest/globals';
import { describeReplayFailure, terminalReason } from '../pageReplayHook';

describe('telling a refusal from a slow load', () => {
  it('treats 403 as ordinary, because Colonist retries its own first request', () => {
    // Every successful page load produces one. Calling it terminal would
    // abandon the retry that actually delivers the replay.
    expect(terminalReason(403)).toBeNull();
  });

  it('knows the two refusals no retry is coming for', () => {
    expect(terminalReason(429)).toBe('rate-limited');
    expect(terminalReason(401)).toBe('signed-out');
  });
});

describe('explaining a load that produced no replay', () => {
  it('says nothing is wrong when the payload arrived', () => {
    expect(describeReplayFailure([403, 200])).toBeNull();
  });

  it('reports rate limiting, which is what a fast harvest runs into', () => {
    expect(describeReplayFailure([429])).toEqual({
      status: 429,
      reason: 'rate-limited',
    });
  });

  it('reports being signed out', () => {
    expect(describeReplayFailure([401])).toEqual({
      status: 401,
      reason: 'signed-out',
    });
  });

  it('prefers the refusal that explains the state over a plain 403', () => {
    // The usual 403 comes first and the retry is what got throttled.
    expect(describeReplayFailure([403, 429])).toEqual({
      status: 429,
      reason: 'rate-limited',
    });
  });

  it('still reports a 403 that never turned into anything', () => {
    expect(describeReplayFailure([403])).toEqual({
      status: 403,
      reason: 'refused',
    });
  });

  it('has nothing to say before any request has been seen', () => {
    expect(describeReplayFailure([])).toBeNull();
  });
});
