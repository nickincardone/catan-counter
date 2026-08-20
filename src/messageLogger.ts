// messageLogger.ts
// Records every colonist.io chat message (raw HTML + plain text) for the current
// game so real games can be exported as example datasets — and, longer term,
// pooled across many users to train a Catan-playing bot. Logging is independent
// of the parser: it keeps its own data-index dedup and saves messages verbatim,
// so the log stays complete even for messages the parser ignores.
//
// Persistence: each game is auto-saved to chrome.storage.local under
// `catanGameLog:<gameId>` (debounced), so finished games survive navigation and
// tab closes without any user action. The overlay's 💾 button downloads the
// current game as JSON; exportAllGameLogs() downloads every stored game.

import { game } from './gameState.js';
import { anonymizeGameLog } from './gameLogAnonymizer.js';
import type { AnonymizedGameLog } from './gameLogAnonymizer.js';
import { normalizeChatLog } from './normalizedChat.js';
import type { KnownChatPlayer } from './normalizedChat.js';
import { getPlayerColorName } from './playerColors.js';
import { SpatialGameTracker } from './spatialGameState.js';
import type { SpatialCaptureSnapshot } from './spatialGameState.js';
import type { TransportCapture } from './transportCapture.js';

// Minimal typing for the pieces of the extension API we use — the project
// doesn't depend on @types/chrome, and `chrome` is undefined under Jest/jsdom.
declare const chrome:
  | {
      storage?: {
        local: {
          get(keys: string | string[] | null): Promise<Record<string, unknown>>;
          set(items: Record<string, unknown>): Promise<void>;
        };
      };
    }
  | undefined;

export interface LoggedMessage {
  /** colonist's data-index for the chat row — unique, chronological */
  index: number;
  /** plain text of the message (what a human reads) */
  text: string;
  /** verbatim outerHTML — preserves player colors, resource icons, etc. */
  html: string;
  /** ISO timestamp of when this client first saw the message. During a
   * post-refresh history replay this is capture time, not game time. */
  loggedAt: string;
}

export interface GameLog {
  /** bump when the shape changes so pooled logs from many users stay parseable */
  schemaVersion: 5;
  gameId: string;
  url: string;
  startedAt: string;
  updatedAt: string;
  /** which player this log was captured by (null until identified) */
  youPlayerName: string | null;
  players: string[];
  messages: LoggedMessage[];
  /** Raw, bounded WebSocket observations from the MAIN-world capture POC. */
  transportCaptures: TransportCapture[];
  /** Number of captures discarded after reaching the per-game safety cap. */
  droppedTransportCaptures: number;
  /** Decoded canonical board plus ordered spatial actions derived from captures. */
  spatialCapture: SpatialCaptureSnapshot;
}

const STORAGE_KEY_PREFIX = 'catanGameLog:';
const PERSIST_DEBOUNCE_MS = 1000;
const MAX_TRANSPORT_CAPTURES_PER_GAME = 20_000;
const MAX_TRANSPORT_CAPTURE_DATA_PER_GAME = 50_000_000;
const MAX_PENDING_TRANSPORT_CAPTURES = 2_000;
const MAX_PENDING_TRANSPORT_DATA = 10_000_000;

let currentLog: GameLog | null = null;
const seenIndices = new Set<number>();
const seenTransportCaptureIds = new Set<string>();
const pendingTransportCaptures: TransportCapture[] = [];
let currentTransportCaptureDataLength = 0;
let pendingTransportCaptureDataLength = 0;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const spatialGameTracker = new SpatialGameTracker();

function withNormalizedChat(
  snapshot: SpatialCaptureSnapshot,
  messages: LoggedMessage[],
  playerNames: string[]
): SpatialCaptureSnapshot {
  const knownPlayers = new Map<string, KnownChatPlayer>();
  for (const player of snapshot.board?.players ?? []) {
    knownPlayers.set(player.username, {
      name: player.username,
      color: player.color,
      colorName: player.colorName,
    });
  }
  for (const name of playerNames) {
    if (!knownPlayers.has(name)) {
      knownPlayers.set(name, {
        name,
        color: null,
        colorName: getPlayerColorName(-1),
      });
    }
  }
  snapshot.chatLog = normalizeChatLog(messages, [...knownPlayers.values()]);
  return snapshot;
}

function storageAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.storage?.local;
}

function getGameIdFromUrl(): string {
  const hash = window.location.hash.replace(/^#/, '');
  return hash || 'unknown';
}

/**
 * Start (or resume) logging for the game identified by the current URL. If a
 * log for this game already exists in chrome.storage.local (e.g. after a page
 * refresh), it is loaded and new messages are merged into it.
 */
export async function initMessageLogger(): Promise<void> {
  const gameId = getGameIdFromUrl();
  const now = new Date().toISOString();

  spatialGameTracker.reset();
  currentLog = {
    schemaVersion: 5,
    gameId,
    url: window.location.href,
    startedAt: now,
    updatedAt: now,
    youPlayerName: null,
    players: [],
    messages: [],
    transportCaptures: [],
    droppedTransportCaptures: 0,
    spatialCapture: spatialGameTracker.snapshot(),
  };
  seenIndices.clear();
  seenTransportCaptureIds.clear();
  currentTransportCaptureDataLength = 0;

  if (storageAvailable()) {
    try {
      const key = STORAGE_KEY_PREFIX + gameId;
      const stored = await chrome!.storage!.local.get(key);
      const existing = stored[key] as Partial<GameLog> | undefined;
      if (existing?.messages) {
        // Older logs progressively added transport and spatial state. Upgrade
        // them in memory without discarding any previously captured data.
        currentLog = {
          ...(existing as Omit<GameLog, 'schemaVersion'>),
          schemaVersion: 5,
          updatedAt: now,
          transportCaptures: Array.isArray(existing.transportCaptures)
            ? existing.transportCaptures
            : [],
          droppedTransportCaptures:
            typeof existing.droppedTransportCaptures === 'number'
              ? existing.droppedTransportCaptures
              : 0,
          spatialCapture: spatialGameTracker.snapshot(),
        };
        for (const message of currentLog.messages) {
          seenIndices.add(message.index);
        }
        for (const capture of currentLog.transportCaptures) {
          seenTransportCaptureIds.add(capture.id);
          currentTransportCaptureDataLength += capture.data?.length ?? 0;
          spatialGameTracker.ingest(capture);
        }
        currentLog.spatialCapture = withNormalizedChat(
          spatialGameTracker.snapshot(),
          currentLog.messages,
          currentLog.players
        );
        console.log(
          `📼 Resumed game log for "${gameId}" (${currentLog.messages.length} messages)`
        );
      }
    } catch (error) {
      console.warn('📼 Could not load stored game log:', error);
    }
  }

  // The transport hook starts at document_start, before the chat (and thus the
  // game logger) exists. Merge that startup window after any stored log is
  // loaded so the initial board snapshot is not lost.
  const startupCaptures = pendingTransportCaptures.splice(0);
  pendingTransportCaptureDataLength = 0;
  for (const capture of startupCaptures) appendTransportCapture(capture);
  if (startupCaptures.length > 0) {
    console.log(
      `📡 Attached ${startupCaptures.length} startup transport captures to game "${gameId}"`
    );
    schedulePersist();
  }
}

/**
 * Record one chat row. Safe to call repeatedly with the same element (history
 * replay re-renders overlapping windows) — rows are deduped by data-index.
 */
export function logChatMessage(element: HTMLElement): void {
  if (!currentLog) return;

  const dataIndexAttr = element.getAttribute('data-index');
  if (dataIndexAttr === null) return;
  const index = parseInt(dataIndexAttr, 10);
  if (isNaN(index) || seenIndices.has(index)) return;

  seenIndices.add(index);
  currentLog.messages.push({
    index,
    text: element.textContent?.trim() ?? '',
    html: element.outerHTML,
    loggedAt: new Date().toISOString(),
  });
  schedulePersist();
}

function appendTransportCapture(capture: TransportCapture): void {
  if (!currentLog || seenTransportCaptureIds.has(capture.id)) return;
  seenTransportCaptureIds.add(capture.id);

  const captureDataLength = capture.data?.length ?? 0;
  if (
    currentLog.transportCaptures.length >= MAX_TRANSPORT_CAPTURES_PER_GAME ||
    currentTransportCaptureDataLength + captureDataLength >
      MAX_TRANSPORT_CAPTURE_DATA_PER_GAME
  ) {
    currentLog.droppedTransportCaptures++;
    return;
  }
  currentLog.transportCaptures.push(capture);
  currentTransportCaptureDataLength += captureDataLength;
  spatialGameTracker.ingest(capture);
}

/**
 * Record one capture from the MAIN-world WebSocket hook. Captures that arrive
 * before the chat initializes the per-game logger are held in a bounded memory
 * queue, which is critical for preserving Colonist's initial game snapshot.
 */
export function logTransportCapture(capture: TransportCapture): void {
  if (!currentLog) {
    const captureDataLength = capture.data?.length ?? 0;
    while (
      pendingTransportCaptures.length > 0 &&
      (pendingTransportCaptures.length >= MAX_PENDING_TRANSPORT_CAPTURES ||
        pendingTransportCaptureDataLength + captureDataLength >
          MAX_PENDING_TRANSPORT_DATA)
    ) {
      pendingTransportCaptureDataLength -=
        pendingTransportCaptures.shift()?.data?.length ?? 0;
    }
    pendingTransportCaptures.push(capture);
    pendingTransportCaptureDataLength += captureDataLength;
    return;
  }

  const previousLength = currentLog.transportCaptures.length;
  const previousDropped = currentLog.droppedTransportCaptures;
  appendTransportCapture(capture);
  if (
    currentLog.transportCaptures.length !== previousLength ||
    currentLog.droppedTransportCaptures !== previousDropped
  ) {
    schedulePersist();
  }
}

/** Refresh the metadata snapshot from live game state and keep messages sorted. */
function snapshotMetadata(log: GameLog): void {
  log.updatedAt = new Date().toISOString();
  log.youPlayerName = game.youPlayerName;
  log.players = game.players.map(p => p.name);
  log.messages.sort((a, b) => a.index - b.index);
  log.transportCaptures.sort(
    (a, b) =>
      a.capturedAt.localeCompare(b.capturedAt) ||
      a.pageSessionId.localeCompare(b.pageSessionId) ||
      a.sequence - b.sequence
  );
  log.spatialCapture = withNormalizedChat(
    spatialGameTracker.snapshot(),
    log.messages,
    log.players
  );
}

function schedulePersist(): void {
  if (!storageAvailable()) return;
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistCurrentLog();
  }, PERSIST_DEBOUNCE_MS);
}

async function persistCurrentLog(): Promise<void> {
  if (!currentLog || !storageAvailable()) return;
  snapshotMetadata(currentLog);
  try {
    await chrome!.storage!.local.set({
      [STORAGE_KEY_PREFIX + currentLog.gameId]: currentLog,
    });
  } catch (error) {
    console.warn('📼 Could not persist game log:', error);
  }
}

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function timestampSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Download the current game's log as a JSON file (wired to the overlay's 💾
 * button). Returns the exported log, or null when nothing has been captured.
 */
export function downloadCurrentGameLog(): AnonymizedGameLog | null {
  if (
    !currentLog ||
    (currentLog.messages.length === 0 &&
      currentLog.transportCaptures.length === 0)
  ) {
    console.warn('📼 No game data captured yet — nothing to download');
    return null;
  }
  snapshotMetadata(currentLog);
  const exportLog = anonymizeGameLog(currentLog);
  downloadJson(
    exportLog,
    `catan-game-${currentLog.gameId}-${timestampSlug()}.json`
  );
  return exportLog;
}

/**
 * Download every game log stored by this extension as one JSON file. Run from
 * the extension's content-script console context:
 *   __catanCounter.exportAllGameLogs()
 */
export async function exportAllGameLogs(): Promise<AnonymizedGameLog[]> {
  if (!storageAvailable()) {
    console.warn('📼 chrome.storage is not available');
    return [];
  }
  const all = await chrome!.storage!.local.get(null);
  const logs = Object.entries(all)
    .filter(([key]) => key.startsWith(STORAGE_KEY_PREFIX))
    .map(([, value]) => {
      const existing = value as Partial<GameLog>;
      const messages = Array.isArray(existing.messages)
        ? existing.messages
        : [];
      const players = Array.isArray(existing.players) ? existing.players : [];
      const transportCaptures = Array.isArray(existing.transportCaptures)
        ? existing.transportCaptures
        : [];
      const tracker = new SpatialGameTracker();
      for (const capture of transportCaptures) tracker.ingest(capture);
      const spatialCapture = withNormalizedChat(
        tracker.snapshot(),
        messages,
        players
      );
      return {
        ...existing,
        schemaVersion: 5,
        messages,
        players,
        transportCaptures,
        droppedTransportCaptures:
          typeof existing.droppedTransportCaptures === 'number'
            ? existing.droppedTransportCaptures
            : 0,
        spatialCapture,
      } as GameLog;
    })
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  if (logs.length === 0) {
    console.warn('📼 No stored game logs found');
    return [];
  }
  const exportLogs = logs.map(anonymizeGameLog);
  downloadJson(exportLogs, `catan-games-all-${timestampSlug()}.json`);
  return exportLogs;
}

/** Test-only: clear module state between tests. */
export function _resetMessageLoggerForTesting(): void {
  currentLog = null;
  seenIndices.clear();
  seenTransportCaptureIds.clear();
  pendingTransportCaptures.length = 0;
  currentTransportCaptureDataLength = 0;
  pendingTransportCaptureDataLength = 0;
  spatialGameTracker.reset();
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
}

/** Test-only: inspect the in-memory log. */
export function _getCurrentLogForTesting(): GameLog | null {
  return currentLog;
}
