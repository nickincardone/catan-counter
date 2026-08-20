// sections/index.ts
// Registers every section. Importing this module is what makes them available
// to the shell; the layout alone decides which are placed, and where.
//
// `players` and `card-flow-ledger` are registered but not in the default
// layout — the settings menu is what turns them on.

import { registerSection } from './registry.js';
import { blockedRobberSection } from './blockedRobber.js';
import { cardFlowSection } from './cardFlow.js';
import { cardFlowLedgerSection } from './cardFlowLedger.js';
import { devDeckSection } from './devDeck.js';
import { diceSection } from './dice.js';
import { handsSection } from './hands.js';
import { playersSection } from './players.js';
import { unknownStealsSection } from './unknownSteals.js';

registerSection(handsSection);
registerSection(unknownStealsSection);
registerSection(cardFlowSection);
registerSection(cardFlowLedgerSection);
registerSection(blockedRobberSection);
registerSection(diceSection);
registerSection(devDeckSection);
registerSection(playersSection);
