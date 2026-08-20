import { decode } from '@msgpack/msgpack';
import type { GameChatEntry } from './normalizedChat.js';
import { getPlayerColorName } from './playerColors.js';
import type { PlayerColorName } from './playerColors.js';
import type { TransportCapture } from './transportCapture.js';

export type TerrainType =
  | 'desert'
  | 'lumber'
  | 'brick'
  | 'wool'
  | 'grain'
  | 'ore'
  | 'unknown';

export type PortType =
  | 'generic'
  | 'lumber'
  | 'brick'
  | 'wool'
  | 'grain'
  | 'ore'
  | 'unknown';

export interface BoardHex {
  id: number;
  x: number;
  y: number;
  terrain: TerrainType;
  terrainCode: number;
  diceNumber: number;
}

export interface BoardCorner {
  id: number;
  x: number;
  y: number;
  z: number;
  ownerColor?: number;
  building?: 'settlement' | 'city' | 'unknown';
  buildingCode?: number;
}

export interface BoardEdge {
  id: number;
  x: number;
  y: number;
  z: number;
  ownerColor?: number;
  roadCode?: number;
}

export interface BoardPort {
  id: number;
  x: number;
  y: number;
  z: number;
  port: PortType;
  portCode: number;
}

export interface BoardPlayer {
  color: number;
  colorName: PlayerColorName;
  username: string;
  isBot: boolean;
}

export interface SpatialBoardState {
  source: 'colonist-msgpack';
  capturedAt: string;
  protocolSequence: number;
  capturingPlayerColor: number;
  capturingPlayerColorName: PlayerColorName;
  playOrder: number[];
  players: BoardPlayer[];
  hexes: BoardHex[];
  corners: BoardCorner[];
  edges: BoardEdge[];
  ports: BoardPort[];
  robberHexId: number | null;
}

export type SpatialGameEvent =
  | {
      kind: 'settlement-placed' | 'city-built';
      capturedAt: string;
      protocolSequence: number;
      playerColor: number;
      cornerId: number;
      buildingCode: number;
    }
  | {
      kind: 'road-placed';
      capturedAt: string;
      protocolSequence: number;
      playerColor: number;
      edgeId: number;
      roadCode: number;
    }
  | {
      kind: 'robber-moved';
      capturedAt: string;
      protocolSequence: number;
      hexId: number;
    };

export interface SpatialCaptureSnapshot {
  board: SpatialBoardState | null;
  events: SpatialGameEvent[];
  /** Complete ordered Colonist feed, including conversational player chat. */
  chatLog: GameChatEntry[];
  decodedIncomingCaptures: number;
  decodeFailures: number;
}

type UnknownRecord = Record<string, unknown>;

const TERRAIN_TYPES: Record<number, TerrainType> = {
  0: 'desert',
  1: 'lumber',
  2: 'brick',
  3: 'wool',
  4: 'grain',
  5: 'ore',
};

const PORT_TYPES: Record<number, PortType> = {
  1: 'generic',
  2: 'lumber',
  3: 'brick',
  4: 'wool',
  5: 'grain',
  6: 'ore',
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sortedNumericEntries(value: unknown): Array<[number, UnknownRecord]> {
  if (!isRecord(value)) return [];
  return Object.entries(value)
    .map(([id, state]) => [Number(id), state] as const)
    .filter(
      (entry): entry is [number, UnknownRecord] =>
        Number.isSafeInteger(entry[0]) && isRecord(entry[1])
    )
    .sort((a, b) => a[0] - b[0]);
}

function buildingName(code: number): 'settlement' | 'city' | 'unknown' {
  if (code === 1) return 'settlement';
  if (code === 2) return 'city';
  return 'unknown';
}

function decodeIncomingCapture(
  capture: TransportCapture
): UnknownRecord | null {
  if (
    capture.direction !== 'incoming' ||
    capture.event !== 'message' ||
    capture.encoding !== 'base64' ||
    !capture.data
  )
    return null;

  const binary = window.atob(capture.data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  const decoded = decode(bytes);
  return isRecord(decoded) ? decoded : null;
}

/**
 * Incrementally turns Colonist's inbound MessagePack snapshots/diffs into a
 * stable spatial board model. Numeric protocol codes are retained beside the
 * friendly names so future Colonist changes remain diagnosable.
 */
export class SpatialGameTracker {
  private board: SpatialBoardState | null = null;
  private readonly events: SpatialGameEvent[] = [];
  private decodedIncomingCaptures = 0;
  private decodeFailures = 0;

  reset(): void {
    this.board = null;
    this.events.length = 0;
    this.decodedIncomingCaptures = 0;
    this.decodeFailures = 0;
  }

  ingest(capture: TransportCapture): void {
    let envelope: UnknownRecord | null;
    try {
      envelope = decodeIncomingCapture(capture);
    } catch {
      if (
        capture.direction === 'incoming' &&
        capture.event === 'message' &&
        capture.encoding === 'base64'
      ) {
        this.decodeFailures++;
      }
      return;
    }
    if (!envelope) return;
    this.decodedIncomingCaptures++;

    const data = isRecord(envelope.data) ? envelope.data : null;
    if (!data) return;
    const messageType = numberValue(data.type);
    const protocolSequence = numberValue(data.sequence) ?? -1;

    if (messageType === 4 && isRecord(data.payload)) {
      this.applyFullSnapshot(
        data.payload,
        capture.capturedAt,
        protocolSequence
      );
      return;
    }
    if (messageType === 91 && isRecord(data.payload)) {
      const diff = isRecord(data.payload.diff) ? data.payload.diff : null;
      if (diff) this.applyDiff(diff, capture.capturedAt, protocolSequence);
    }
  }

  snapshot(): SpatialCaptureSnapshot {
    return {
      board: this.board,
      events: [...this.events],
      chatLog: [],
      decodedIncomingCaptures: this.decodedIncomingCaptures,
      decodeFailures: this.decodeFailures,
    };
  }

  private applyFullSnapshot(
    payload: UnknownRecord,
    capturedAt: string,
    protocolSequence: number
  ): void {
    const gameState = isRecord(payload.gameState) ? payload.gameState : null;
    const mapState =
      gameState && isRecord(gameState.mapState) ? gameState.mapState : null;
    if (!mapState) return;

    const hexes = sortedNumericEntries(mapState.tileHexStates).map(
      ([id, state]): BoardHex => {
        const terrainCode = numberValue(state.type) ?? -1;
        return {
          id,
          x: numberValue(state.x) ?? 0,
          y: numberValue(state.y) ?? 0,
          terrain: TERRAIN_TYPES[terrainCode] ?? 'unknown',
          terrainCode,
          diceNumber: numberValue(state.diceNumber) ?? 0,
        };
      }
    );
    const corners = sortedNumericEntries(mapState.tileCornerStates).map(
      ([id, state]): BoardCorner => this.toCorner(id, state)
    );
    const edges = sortedNumericEntries(mapState.tileEdgeStates).map(
      ([id, state]): BoardEdge => this.toEdge(id, state)
    );
    const ports = sortedNumericEntries(mapState.portEdgeStates).map(
      ([id, state]): BoardPort => {
        const portCode = numberValue(state.type) ?? -1;
        return {
          id,
          x: numberValue(state.x) ?? 0,
          y: numberValue(state.y) ?? 0,
          z: numberValue(state.z) ?? 0,
          port: PORT_TYPES[portCode] ?? 'unknown',
          portCode,
        };
      }
    );
    const robberState = isRecord(gameState?.mechanicRobberState)
      ? gameState.mechanicRobberState
      : null;
    const users = Array.isArray(payload.playerUserStates)
      ? payload.playerUserStates
      : [];
    const players = users.filter(isRecord).map(
      (user): BoardPlayer => ({
        color: numberValue(user.selectedColor) ?? -1,
        colorName: getPlayerColorName(numberValue(user.selectedColor) ?? -1),
        username: typeof user.username === 'string' ? user.username : 'unknown',
        isBot: user.isBot === true,
      })
    );

    const capturingPlayerColor = numberValue(payload.playerColor) ?? -1;
    this.board = {
      source: 'colonist-msgpack',
      capturedAt,
      protocolSequence,
      capturingPlayerColor,
      capturingPlayerColorName: getPlayerColorName(capturingPlayerColor),
      playOrder: Array.isArray(payload.playOrder)
        ? payload.playOrder.filter(
            (color): color is number => typeof color === 'number'
          )
        : [],
      players,
      hexes,
      corners,
      edges,
      ports,
      robberHexId: numberValue(robberState?.locationTileIndex),
    };
  }

  private applyDiff(
    diff: UnknownRecord,
    capturedAt: string,
    protocolSequence: number
  ): void {
    if (!this.board) return;
    const mapState = isRecord(diff.mapState) ? diff.mapState : null;

    for (const [id, patch] of sortedNumericEntries(
      mapState?.tileCornerStates
    )) {
      const corner = this.board.corners.find(item => item.id === id);
      if (!corner) continue;
      const previousBuildingCode = corner.buildingCode;
      const ownerColor = numberValue(patch.owner);
      const buildingCode = numberValue(patch.buildingType);
      if (ownerColor !== null) corner.ownerColor = ownerColor;
      if (buildingCode !== null) {
        corner.buildingCode = buildingCode;
        corner.building = buildingName(buildingCode);
      }
      if (
        ownerColor !== null &&
        (buildingCode === 1 || buildingCode === 2) &&
        previousBuildingCode !== buildingCode
      ) {
        this.events.push({
          kind: buildingCode === 2 ? 'city-built' : 'settlement-placed',
          capturedAt,
          protocolSequence,
          playerColor: ownerColor,
          cornerId: id,
          buildingCode,
        });
      }
    }

    for (const [id, patch] of sortedNumericEntries(mapState?.tileEdgeStates)) {
      const edge = this.board.edges.find(item => item.id === id);
      if (!edge) continue;
      const previousOwner = edge.ownerColor;
      const ownerColor = numberValue(patch.owner);
      const roadCode = numberValue(patch.type);
      if (ownerColor !== null) edge.ownerColor = ownerColor;
      if (roadCode !== null) edge.roadCode = roadCode;
      if (ownerColor !== null && previousOwner !== ownerColor) {
        this.events.push({
          kind: 'road-placed',
          capturedAt,
          protocolSequence,
          playerColor: ownerColor,
          edgeId: id,
          roadCode: roadCode ?? -1,
        });
      }
    }

    const robberState = isRecord(diff.mechanicRobberState)
      ? diff.mechanicRobberState
      : null;
    const robberHexId = numberValue(robberState?.locationTileIndex);
    if (robberHexId !== null && robberHexId !== this.board.robberHexId) {
      this.board.robberHexId = robberHexId;
      this.events.push({
        kind: 'robber-moved',
        capturedAt,
        protocolSequence,
        hexId: robberHexId,
      });
    }
  }

  private toCorner(id: number, state: UnknownRecord): BoardCorner {
    const buildingCode = numberValue(state.buildingType);
    const ownerColor = numberValue(state.owner);
    return {
      id,
      x: numberValue(state.x) ?? 0,
      y: numberValue(state.y) ?? 0,
      z: numberValue(state.z) ?? 0,
      ...(ownerColor === null ? {} : { ownerColor }),
      ...(buildingCode === null
        ? {}
        : { buildingCode, building: buildingName(buildingCode) }),
    };
  }

  private toEdge(id: number, state: UnknownRecord): BoardEdge {
    const ownerColor = numberValue(state.owner);
    const roadCode = numberValue(state.type);
    return {
      id,
      x: numberValue(state.x) ?? 0,
      y: numberValue(state.y) ?? 0,
      z: numberValue(state.z) ?? 0,
      ...(ownerColor === null ? {} : { ownerColor }),
      ...(roadCode === null ? {} : { roadCode }),
    };
  }
}
