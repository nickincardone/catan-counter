import { describe, expect, it } from '@jest/globals';
import {
  PAGE_REPLAY_SOURCE,
  REPLAY_CAPTURE_VERSION,
  ReplayAssembler,
  parseReplayChunk,
} from '../replayCapture';

function meta(overrides: Record<string, unknown> = {}) {
  return {
    captureVersion: REPLAY_CAPTURE_VERSION,
    capturedAt: '2026-08-19T00:00:00.000Z',
    url: 'https://colonist.io/api/replay/data-from-game-id',
    gameId: '251323211',
    playerColor: 5,
    status: 200,
    contentType: 'application/json',
    byteLength: 6,
    ...overrides,
  };
}

function chunk(overrides: Record<string, unknown> = {}) {
  return {
    source: PAGE_REPLAY_SOURCE,
    captureId: 'a-0',
    index: 0,
    total: 1,
    chunk: 'AAAA',
    meta: meta(),
    ...overrides,
  };
}

describe('validating what crosses from the page', () => {
  it('accepts a well-formed chunk', () => {
    expect(parseReplayChunk(chunk())).not.toBeNull();
  });

  it('ignores anything not from the hook', () => {
    expect(
      parseReplayChunk({ ...chunk(), source: 'somewhere-else' })
    ).toBeNull();
    expect(parseReplayChunk(null)).toBeNull();
    expect(parseReplayChunk('a string')).toBeNull();
  });

  it('rejects an index outside its own total', () => {
    expect(parseReplayChunk(chunk({ index: 3, total: 3 }))).toBeNull();
    expect(parseReplayChunk(chunk({ index: -1 }))).toBeNull();
    expect(parseReplayChunk(chunk({ total: 0 }))).toBeNull();
  });

  it('rejects metadata from a version it does not understand', () => {
    expect(
      parseReplayChunk(chunk({ meta: meta({ captureVersion: 99 }) }))
    ).toBeNull();
  });

  it('rejects an implausibly large payload', () => {
    expect(
      parseReplayChunk(chunk({ meta: meta({ byteLength: 64 * 1024 * 1024 }) }))
    ).toBeNull();
  });

  it('accepts a chunk with no metadata, since only the last one carries it', () => {
    const withoutMeta = chunk({ index: 0, total: 2 }) as Record<
      string,
      unknown
    >;
    delete withoutMeta.meta;
    expect(parseReplayChunk(withoutMeta)).not.toBeNull();
  });
});

describe('reassembling a payload', () => {
  it('returns nothing until every chunk and the metadata have arrived', () => {
    const assembler = new ReplayAssembler();
    const first = chunk({ index: 0, total: 2, chunk: 'AA' }) as Record<
      string,
      unknown
    >;
    delete first.meta;

    expect(assembler.accept(parseReplayChunk(first)!)).toBeNull();

    const last = parseReplayChunk(chunk({ index: 1, total: 2, chunk: 'BB' }))!;
    const done = assembler.accept(last);
    expect(done).not.toBeNull();
    expect(done!.base64).toBe('AABB');
    expect(done!.gameId).toBe('251323211');
  });

  it('joins chunks in index order however they arrive', () => {
    const assembler = new ReplayAssembler();
    const tail = parseReplayChunk(chunk({ index: 2, total: 3, chunk: 'CC' }))!;
    const middle = chunk({ index: 1, total: 3, chunk: 'BB' }) as Record<
      string,
      unknown
    >;
    delete middle.meta;
    const head = chunk({ index: 0, total: 3, chunk: 'AA' }) as Record<
      string,
      unknown
    >;
    delete head.meta;

    expect(assembler.accept(tail)).toBeNull();
    expect(assembler.accept(parseReplayChunk(middle)!)).toBeNull();
    const done = assembler.accept(parseReplayChunk(head)!);
    expect(done!.base64).toBe('AABBCC');
  });

  it('keeps two payloads apart when their chunks interleave', () => {
    const assembler = new ReplayAssembler();
    const one = chunk({
      captureId: 'one',
      index: 0,
      total: 2,
      chunk: '11',
    }) as Record<string, unknown>;
    delete one.meta;
    const two = chunk({
      captureId: 'two',
      index: 0,
      total: 2,
      chunk: '22',
    }) as Record<string, unknown>;
    delete two.meta;

    assembler.accept(parseReplayChunk(one)!);
    assembler.accept(parseReplayChunk(two)!);

    const oneDone = assembler.accept(
      parseReplayChunk(
        chunk({ captureId: 'one', index: 1, total: 2, chunk: 'AA' })
      )!
    );
    const twoDone = assembler.accept(
      parseReplayChunk(
        chunk({ captureId: 'two', index: 1, total: 2, chunk: 'BB' })
      )!
    );

    expect(oneDone!.base64).toBe('11AA');
    expect(twoDone!.base64).toBe('22BB');
  });
});
