export type PlayerColorName =
  | 'red'
  | 'blue'
  | 'orange'
  | 'white'
  | 'black'
  | 'unknown';

// These codes were verified against the live protocol and rendered chat
// colors. Unobserved/custom codes stay "unknown" rather than being guessed.
const PLAYER_COLOR_NAMES: Record<number, PlayerColorName> = {
  1: 'red',
  2: 'blue',
  3: 'orange',
  9: 'black',
};

export function getPlayerColorName(colorCode: number): PlayerColorName {
  return PLAYER_COLOR_NAMES[colorCode] ?? 'unknown';
}
