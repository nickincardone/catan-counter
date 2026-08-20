import { describe, expect, it } from '@jest/globals';
import { getPlayerColorName } from '../playerColors';

describe('getPlayerColorName', () => {
  it('maps the color codes verified in the live Colonist game', () => {
    expect([1, 2, 3, 9].map(getPlayerColorName)).toEqual([
      'red',
      'blue',
      'orange',
      'black',
    ]);
  });

  it('preserves unverified/custom colors as unknown', () => {
    expect(getPlayerColorName(999)).toBe('unknown');
  });
});
