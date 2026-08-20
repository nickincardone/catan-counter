import { decode, encode } from '@msgpack/msgpack';
import type { GameLog } from './messageLogger.js';
import type { SpatialGameEvent } from './spatialGameState.js';
import type { TransportCapture } from './transportCapture.js';

export interface ExportAnonymization {
  playerNames: 'placement-order';
  opaqueTransportPayloadsRemoved: number;
}

export type AnonymizedGameLog = Omit<
  GameLog,
  'schemaVersion' | 'transportCaptures'
> & {
  schemaVersion: 6;
  transportCaptures: TransportCapture[];
  anonymization: ExportAnonymization;
};

interface PlayerAliases {
  byName: Map<string, string>;
  aliasesInOrder: string[];
}

function eventPlayerColor(event: SpatialGameEvent): number | null {
  return 'playerColor' in event ? event.playerColor : null;
}

function buildPlayerAliases(log: GameLog): PlayerAliases {
  const board = log.spatialCapture.board;
  const orderedColors: number[] = [];
  const addColor = (color: number) => {
    if (!orderedColors.includes(color)) orderedColors.push(color);
  };

  // A player's first settlement is the most direct observation of placement
  // order. The remaining sources make incomplete/mid-game captures deterministic.
  for (const event of log.spatialCapture.events) {
    if (event.kind === 'settlement-placed') addColor(event.playerColor);
  }
  for (const event of log.spatialCapture.events) {
    const color = eventPlayerColor(event);
    if (color !== null) addColor(color);
  }
  for (const color of board?.playOrder ?? []) addColor(color);
  for (const player of board?.players ?? []) addColor(player.color);

  const usernameByColor = new Map(
    (board?.players ?? []).map(player => [player.color, player.username])
  );
  const byName = new Map<string, string>();
  const aliasesInOrder: string[] = [];

  const addName = (name: string | null | undefined) => {
    if (!name || byName.has(name)) return;
    const alias = `Player ${aliasesInOrder.length + 1}`;
    byName.set(name, alias);
    aliasesInOrder.push(alias);
  };

  for (const color of orderedColors) addName(usernameByColor.get(color));
  for (const name of log.players) addName(name);
  addName(log.youPlayerName);

  return { byName, aliasesInOrder };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function replacePlayerNames(
  value: string,
  byName: Map<string, string>
): string {
  const replacements = new Map<string, string>();
  for (const [name, alias] of byName) {
    replacements.set(name, alias);
    replacements.set(escapeHtml(name), alias);
  }
  const names = [...replacements.keys()].filter(Boolean);
  if (names.length === 0) return value;
  names.sort((a, b) => b.length - a.length);
  const pattern = new RegExp(names.map(escapeRegExp).join('|'), 'g');
  return value.replace(pattern, match => replacements.get(match) ?? match);
}

function redactUnknown(value: unknown, byName: Map<string, string>): unknown {
  if (typeof value === 'string') return replacePlayerNames(value, byName);
  if (Array.isArray(value))
    return value.map(item => redactUnknown(item, byName));
  if (value instanceof Uint8Array || value instanceof Date) return value;
  if (value instanceof Map) {
    return new Map(
      [...value].map(([key, item]) => [
        redactUnknown(key, byName),
        redactUnknown(item, byName),
      ])
    );
  }
  if (typeof value === 'object' && value !== null) {
    const redacted: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      redacted[key] = redactUnknown(item, byName);
    }
    return redacted;
  }
  return value;
}

function base64ToBytes(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize)
    );
  }
  return window.btoa(binary);
}

function anonymizeTransportCapture(
  capture: TransportCapture,
  byName: Map<string, string>
): { capture: TransportCapture; removedOpaquePayload: boolean } {
  if (!capture.data) {
    return { capture: { ...capture }, removedOpaquePayload: false };
  }

  if (capture.encoding === 'text' || capture.encoding === 'json') {
    return {
      capture: {
        ...capture,
        data: replacePlayerNames(capture.data, byName),
      },
      removedOpaquePayload: false,
    };
  }

  if (capture.encoding === 'base64' && !capture.truncated) {
    try {
      const decoded = decode(base64ToBytes(capture.data));
      const redacted = redactUnknown(decoded, byName);
      const redactedBytes = encode(redacted);
      return {
        capture: {
          ...capture,
          data: bytesToBase64(redactedBytes),
          byteLength: redactedBytes.byteLength,
        },
        removedOpaquePayload: false,
      };
    } catch {
      // Colonist's outbound protocol includes framing that is not a standalone
      // MessagePack value. Do not leak an uninspected payload into an export.
    }
  }

  return {
    capture: { ...capture, encoding: 'none', data: null },
    removedOpaquePayload: true,
  };
}

/** Create an anonymous export without mutating the live/resumable game log. */
export function anonymizeGameLog(log: GameLog): AnonymizedGameLog {
  const aliases = buildPlayerAliases(log);
  let opaqueTransportPayloadsRemoved = 0;
  const transportCaptures = log.transportCaptures.map(original => {
    const result = anonymizeTransportCapture(original, aliases.byName);
    if (result.removedOpaquePayload) opaqueTransportPayloadsRemoved++;
    return result.capture;
  });

  return {
    ...log,
    schemaVersion: 6,
    youPlayerName: log.youPlayerName
      ? (aliases.byName.get(log.youPlayerName) ?? null)
      : null,
    players: aliases.aliasesInOrder,
    messages: log.messages.map(message => ({
      ...message,
      text: replacePlayerNames(message.text, aliases.byName),
      html: replacePlayerNames(message.html, aliases.byName),
    })),
    transportCaptures,
    spatialCapture: redactUnknown(
      log.spatialCapture,
      aliases.byName
    ) as GameLog['spatialCapture'],
    anonymization: {
      playerNames: 'placement-order',
      opaqueTransportPayloadsRemoved,
    },
  };
}
