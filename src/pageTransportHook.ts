/**
 * MAIN-world WebSocket capture POC.
 *
 * This entry point is intentionally independent of the extension APIs. It runs
 * at document_start in Colonist's own JavaScript world, wraps the native
 * WebSocket constructor/send method, and relays bounded copies of traffic to
 * the isolated content script with window.postMessage.
 */

import {
  EXTENSION_BRIDGE_SOURCE,
  PAGE_TRANSPORT_SOURCE,
  TRANSPORT_CAPTURE_VERSION,
} from './transportCapture.js';
import type { TransportCapture } from './transportCapture.js';
import { installViewportControl } from './pageViewport.js';

const MAX_CAPTURE_DATA_LENGTH = 262_144;
const MAX_STARTUP_BACKLOG = 2_000;
const MAX_STARTUP_BACKLOG_DATA_LENGTH = 5_000_000;

declare global {
  interface Window {
    __catanCounterTransportHookInstalled?: boolean;
  }
}

function createPageSessionId(): string {
  const randomPart = Math.random().toString(36).slice(2, 12);
  return `${Date.now().toString(36)}-${randomPart}`;
}

function sanitizeConnectionUrl(value: string): string {
  try {
    const url = new URL(value, window.location.href);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return value.split(/[?#]/, 1)[0].slice(0, 2_000);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...Array.from(chunk));
  }
  return window.btoa(binary);
}

function installTransportHook(): void {
  if (window.__catanCounterTransportHookInstalled) return;
  window.__catanCounterTransportHookInstalled = true;

  const NativeWebSocket = window.WebSocket;
  if (!NativeWebSocket) return;

  const pageSessionId = createPageSessionId();
  const socketIds = new WeakMap<WebSocket, number>();
  const socketUrls = new WeakMap<WebSocket, string>();
  const startupBacklog: TransportCapture[] = [];
  let startupBacklogDataLength = 0;
  let bridgeReady = false;
  let nextConnectionId = 0;
  let nextSequence = 0;

  console.info('[Catan Counter] WebSocket capture POC installed');

  function deliver(capture: TransportCapture): void {
    if (!bridgeReady) {
      const captureDataLength = capture.data?.length ?? 0;
      while (
        startupBacklog.length > 0 &&
        (startupBacklog.length >= MAX_STARTUP_BACKLOG ||
          startupBacklogDataLength + captureDataLength >
            MAX_STARTUP_BACKLOG_DATA_LENGTH)
      ) {
        startupBacklogDataLength -= startupBacklog.shift()?.data?.length ?? 0;
      }
      startupBacklog.push(capture);
      startupBacklogDataLength += captureDataLength;
      return;
    }

    window.postMessage(
      { source: PAGE_TRANSPORT_SOURCE, capture },
      window.location.origin
    );
  }

  function makeCapture(
    socket: WebSocket,
    direction: TransportCapture['direction'],
    event: TransportCapture['event']
  ): TransportCapture {
    const sequence = nextSequence++;
    return {
      captureVersion: TRANSPORT_CAPTURE_VERSION,
      id: `${pageSessionId}:${sequence}`,
      pageSessionId,
      sequence,
      capturedAt: new Date().toISOString(),
      direction,
      connectionId: socketIds.get(socket) ?? 0,
      connectionUrl: socketUrls.get(socket) ?? '',
      event,
      encoding: 'none',
      data: null,
      byteLength: null,
      truncated: false,
    };
  }

  function captureText(
    socket: WebSocket,
    direction: TransportCapture['direction'],
    text: string
  ): void {
    const capture = makeCapture(socket, direction, 'message');
    capture.encoding = 'text';
    capture.byteLength = text.length;
    capture.truncated = text.length > MAX_CAPTURE_DATA_LENGTH;
    capture.data = text.slice(0, MAX_CAPTURE_DATA_LENGTH);
    deliver(capture);
  }

  function captureBytes(
    socket: WebSocket,
    direction: TransportCapture['direction'],
    bytes: Uint8Array,
    capture?: TransportCapture
  ): void {
    const result = capture ?? makeCapture(socket, direction, 'message');
    const capturedBytes = bytes.subarray(0, MAX_CAPTURE_DATA_LENGTH);
    result.encoding = 'base64';
    result.byteLength = bytes.byteLength;
    result.truncated = bytes.byteLength > capturedBytes.byteLength;
    result.data = bytesToBase64(capturedBytes);
    deliver(result);
  }

  function captureSocketData(
    socket: WebSocket,
    direction: TransportCapture['direction'],
    data: string | ArrayBufferLike | Blob | ArrayBufferView
  ): void {
    if (typeof data === 'string') {
      captureText(socket, direction, data);
      return;
    }
    if (data instanceof Blob) {
      const capture = makeCapture(socket, direction, 'message');
      void data
        .arrayBuffer()
        .then(buffer =>
          captureBytes(socket, direction, new Uint8Array(buffer), capture)
        )
        .catch(() => {
          capture.event = 'error';
          capture.direction = 'lifecycle';
          deliver(capture);
        });
      return;
    }
    if (ArrayBuffer.isView(data)) {
      captureBytes(
        socket,
        direction,
        new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      );
      return;
    }
    captureBytes(socket, direction, new Uint8Array(data));
  }

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== window.location.origin)
      return;
    const data = event.data as { source?: unknown; type?: unknown } | null;
    if (
      !data ||
      data.source !== EXTENSION_BRIDGE_SOURCE ||
      data.type !== 'ready'
    )
      return;

    if (bridgeReady) return;
    bridgeReady = true;
    for (const capture of startupBacklog) {
      window.postMessage(
        { source: PAGE_TRANSPORT_SOURCE, capture },
        window.location.origin
      );
    }
    startupBacklog.length = 0;
    startupBacklogDataLength = 0;
  });

  const nativeSend = NativeWebSocket.prototype.send;
  NativeWebSocket.prototype.send = function (
    data: string | ArrayBufferLike | Blob | ArrayBufferView
  ): void {
    if (socketIds.has(this)) captureSocketData(this, 'outgoing', data);
    nativeSend.call(this, data);
  };

  const InstrumentedWebSocket = new Proxy(NativeWebSocket, {
    construct(target, args, newTarget) {
      const socket = Reflect.construct(target, args, newTarget) as WebSocket;
      const connectionId = ++nextConnectionId;
      socketIds.set(socket, connectionId);
      socketUrls.set(socket, sanitizeConnectionUrl(String(args[0] ?? '')));

      console.info(
        `[Catan Counter] Observing WebSocket ${connectionId}: ${socketUrls.get(socket)}`
      );

      deliver(makeCapture(socket, 'lifecycle', 'constructed'));
      socket.addEventListener('open', () =>
        deliver(makeCapture(socket, 'lifecycle', 'open'))
      );
      socket.addEventListener('message', event =>
        captureSocketData(socket, 'incoming', event.data)
      );
      socket.addEventListener('close', event => {
        const capture = makeCapture(socket, 'lifecycle', 'close');
        const detail = JSON.stringify({
          code: event.code,
          reason: event.reason,
        });
        capture.encoding = 'json';
        capture.data = detail;
        capture.byteLength = detail.length;
        deliver(capture);
      });
      socket.addEventListener('error', () =>
        deliver(makeCapture(socket, 'lifecycle', 'error'))
      );

      return socket;
    },
  });

  window.WebSocket = InstrumentedWebSocket;
}

installTransportHook();
// The v2 gutter UI needs colonist to lay out inside a smaller area, which only
// works from this world — see pageViewport.ts. It stays inert until the content
// script asks for an inset.
installViewportControl();
