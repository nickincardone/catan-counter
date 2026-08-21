// replay/cli.ts
// Turn saved raw replays into decoded records.
//
//   node scripts/decode-replay.js <raw.json | directory> [--out <dir>]
//                                 [--anonymize] [--quiet]
//
// Raw files are never modified: decoding writes a sibling `<name>.record.json`
// so the original bytes stay as the thing everything else can be re-derived
// from.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { anonymizeReplayRecord, decodeReplay } from './decode.js';
import type { RawReplay } from './schema.js';

interface Options {
  targets: string[];
  outDir: string | null;
  anonymize: boolean;
  quiet: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    targets: [],
    outDir: null,
    anonymize: false,
    quiet: false,
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--anonymize') options.anonymize = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--out') options.outDir = argv[++index] ?? null;
    else options.targets.push(arg);
  }
  return options;
}

/** Every raw replay under a path, whether it names a file or a directory. */
function collect(target: string): string[] {
  const full = resolve(target);
  if (statSync(full).isDirectory()) {
    return readdirSync(full)
      .filter(
        entry => entry.endsWith('.json') && !entry.endsWith('.record.json')
      )
      .map(entry => join(full, entry))
      .sort();
  }
  return [full];
}

/** The gameId is in the filename Colonist's own download name carries. */
function gameIdFrom(path: string): string | null {
  const match = /colonist-replay-([^.]+)\.json$/.exec(basename(path));
  return match ? match[1] : null;
}

function run(argv: string[]): number {
  const options = parseArgs(argv);
  if (options.targets.length === 0) {
    console.error(
      'usage: node scripts/decode-replay.js <raw.json | directory> [--out <dir>] [--anonymize] [--quiet]'
    );
    return 2;
  }

  const files = options.targets.flatMap(collect);
  if (files.length === 0) {
    console.error('No raw replay files found.');
    return 1;
  }

  let failures = 0;
  for (const file of files) {
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as RawReplay;
      const decoded = decodeReplay(raw, { gameId: gameIdFrom(file) });
      const record = options.anonymize
        ? anonymizeReplayRecord(decoded)
        : decoded;

      const outName = basename(file).replace(/\.json$/, '.record.json');
      const outPath = options.outDir
        ? join(resolve(options.outDir), outName)
        : join(resolve(file, '..'), outName);
      writeFileSync(outPath, JSON.stringify(record, null, 2));

      if (!options.quiet) {
        const unknown = Object.entries(record.diagnostics.unknownLogTypes);
        const winner = record.standings.find(standing => standing.isWinner);
        console.log(
          `${basename(file)} -> ${basename(outPath)}  ` +
            `${record.players.length} players, ${record.diagnostics.events} events, ` +
            `${record.diagnostics.actions} actions, ${record.rolls.length} rolls, ` +
            `${record.chat.length} chat, ${record.achievements.length} achievement changes` +
            (winner
              ? `, winner ${winner.color} on ${winner.totalPoints}`
              : '') +
            (unknown.length
              ? `  [unknown log types: ${unknown
                  .map(([type, count]) => `${type}x${count}`)
                  .join(', ')}]`
              : '')
        );
      }

      // A winner whose points do not reach the target means a victory-point
      // source is weighted wrongly; say so rather than writing a quiet lie.
      const check = record.diagnostics.victoryPointsCheck;
      if (!check.consistent) {
        console.warn(
          `  warning: ${basename(file)} winner scores ${check.winnerTotal}, ` +
            `but the game was played to ${check.target}. ` +
            'A victory-point source is probably mapped wrongly.'
        );
      }
    } catch (error) {
      failures++;
      console.error(
        `${basename(file)}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  return failures > 0 ? 1 : 0;
}

process.exit(run(process.argv.slice(2)));
