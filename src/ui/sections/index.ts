// sections/index.ts
// Registers every section. Importing this module is what makes them available
// to the shell; the layout alone decides which are placed, and where.
//
// `players` is registered but not in the default layout — add its id to any
// gutter to turn it on.

import { registerSection } from './registry.js';
import { blockedRobberSection } from './blockedRobber.js';
import { devDeckSection } from './devDeck.js';
import { diceSection } from './dice.js';
import { handsSection } from './hands.js';
import { playersSection } from './players.js';
import { unknownStealsSection } from './unknownSteals.js';

registerSection(handsSection);
registerSection(unknownStealsSection);
registerSection(blockedRobberSection);
registerSection(diceSection);
registerSection(devDeckSection);
registerSection(playersSection);
