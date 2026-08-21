// replay/cli.ts
// Turn saved raw replays into decoded records.
//
//   node scripts/decode-replay.js <file | directory> [--out <dir>]
//                                 [--anonymize] [--quiet]
//
// Takes either a single raw replay or an export bundle from the extension
// popup, which holds a whole harvest in one file. A bundle is unpacked into one
// raw replay per game first, so both routes leave the same thing on disk.
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

interface BundleEntry {
  gameId?: string;
  payload?: unknown;
}

/** A popup export, as opposed to one game's raw payload. */
function asBundle(value: unknown): BundleEntry[] | null {
  const bundle = value as { bundleVersion?: unknown; replays?: unknown };
  if (!bundle || typeof bundle !== 'object') return null;
  if (typeof bundle.bundleVersion !== 'number') return null;
  if (!Array.isArray(bundle.replays)) return null;
  return bundle.replays as BundleEntry[];
}

/**
 * Split a bundle into the per-game raw files the rest of the tool expects.
 * Returns the paths written.
 */
function unpackBundle(
  entries: BundleEntry[],
  outDir: string,
  quiet: boolean
): string[] {
  const written: string[] = [];
  for (const entry of entries) {
    if (!entry || entry.payload === undefined) continue;
    const gameId = typeof entry.gameId === 'string' ? entry.gameId : 'unknown';
    const path = join(outDir, `colonist-replay-${gameId}.json`);
    writeFileSync(path, JSON.stringify(entry.payload));
    written.push(path);
  }
  if (!quiet) {
    console.log(`Unpacked ${written.length} replay(s) from the bundle.`);
  }
  return written;
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

  let files = options.targets.flatMap(collect);
  if (files.length === 0) {
    console.error('No replay files found.');
    return 1;
  }

  // A bundle stands in for the games inside it, so everything downstream only
  // ever deals with one game per file.
  const expanded: string[] = [];
  for (const file of files) {
    let entries: BundleEntry[] | null = null;
    try {
      entries = asBundle(JSON.parse(readFileSync(file, 'utf8')));
    } catch {
      /* handled per-file below, where the error can be reported */
    }
    if (entries) {
      const outDir = options.outDir
        ? resolve(options.outDir)
        : resolve(file, '..');
      expanded.push(...unpackBundle(entries, outDir, options.quiet));
    } else {
      expanded.push(file);
    }
  }
  files = expanded;

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

      // A winner short of the target means a victory-point source is weighted
      // wrongly, or the game is a variant scoring on rules this does not model.
      // Overshooting is fine — two-point achievements move a player past the
      // line — so only falling short is worth saying anything about.
      const check = record.diagnostics.victoryPointsCheck;
      if (!check.consistent) {
        console.warn(
          `  warning: ${basename(file)} winner scores ${check.winnerTotal}, ` +
            `short of the ${check.target} the game was played to. ` +
            'A victory-point source is mapped wrongly, or this is a variant.'
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
