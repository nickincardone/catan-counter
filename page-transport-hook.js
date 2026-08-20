(function () {
    'use strict';

    /**
     * Types and bridge code for the Colonist transport-capture POC.
     *
     * `pageTransportHook.ts` runs in the page's MAIN JavaScript world so it can
     * observe WebSocket traffic. This module runs in the extension's ISOLATED
     * world, validates messages crossing the window.postMessage boundary, and
     * forwards them to the game logger.
     */
    const PAGE_TRANSPORT_SOURCE = 'catan-counter-page-transport-v1';
    const EXTENSION_BRIDGE_SOURCE = 'catan-counter-extension-bridge-v1';
    const TRANSPORT_CAPTURE_VERSION = 1;

    /**
     * MAIN-world WebSocket capture POC.
     *
     * This entry point is intentionally independent of the extension APIs. It runs
     * at document_start in Colonist's own JavaScript world, wraps the native
     * WebSocket constructor/send method, and relays bounded copies of traffic to
     * the isolated content script with window.postMessage.
     */
    const MAX_CAPTURE_DATA_LENGTH = 262144;
    const MAX_STARTUP_BACKLOG = 2000;
    const MAX_STARTUP_BACKLOG_DATA_LENGTH = 5000000;
    function createPageSessionId() {
        const randomPart = Math.random().toString(36).slice(2, 12);
        return `${Date.now().toString(36)}-${randomPart}`;
    }
    function sanitizeConnectionUrl(value) {
        try {
            const url = new URL(value, window.location.href);
            return `${url.protocol}//${url.host}${url.pathname}`;
        }
        catch (_a) {
            return value.split(/[?#]/, 1)[0].slice(0, 2000);
        }
    }
    function bytesToBase64(bytes) {
        let binary = '';
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            const chunk = bytes.subarray(offset, offset + chunkSize);
            binary += String.fromCharCode(...Array.from(chunk));
        }
        return window.btoa(binary);
    }
    function installTransportHook() {
        if (window.__catanCounterTransportHookInstalled)
            return;
        window.__catanCounterTransportHookInstalled = true;
        const NativeWebSocket = window.WebSocket;
        if (!NativeWebSocket)
            return;
        const pageSessionId = createPageSessionId();
        const socketIds = new WeakMap();
        const socketUrls = new WeakMap();
        const startupBacklog = [];
        let startupBacklogDataLength = 0;
        let bridgeReady = false;
        let nextConnectionId = 0;
        let nextSequence = 0;
        console.info('[Catan Counter] WebSocket capture POC installed');
        function deliver(capture) {
            var _a, _b, _c, _d, _e;
            if (!bridgeReady) {
                const captureDataLength = (_b = (_a = capture.data) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
                while (startupBacklog.length > 0 &&
                    (startupBacklog.length >= MAX_STARTUP_BACKLOG ||
                        startupBacklogDataLength + captureDataLength >
                            MAX_STARTUP_BACKLOG_DATA_LENGTH)) {
                    startupBacklogDataLength -= (_e = (_d = (_c = startupBacklog.shift()) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0;
                }
                startupBacklog.push(capture);
                startupBacklogDataLength += captureDataLength;
                return;
            }
            window.postMessage({ source: PAGE_TRANSPORT_SOURCE, capture }, window.location.origin);
        }
        function makeCapture(socket, direction, event) {
            var _a, _b;
            const sequence = nextSequence++;
            return {
                captureVersion: TRANSPORT_CAPTURE_VERSION,
                id: `${pageSessionId}:${sequence}`,
                pageSessionId,
                sequence,
                capturedAt: new Date().toISOString(),
                direction,
                connectionId: (_a = socketIds.get(socket)) !== null && _a !== void 0 ? _a : 0,
                connectionUrl: (_b = socketUrls.get(socket)) !== null && _b !== void 0 ? _b : '',
                event,
                encoding: 'none',
                data: null,
                byteLength: null,
                truncated: false,
            };
        }
        function captureText(socket, direction, text) {
            const capture = makeCapture(socket, direction, 'message');
            capture.encoding = 'text';
            capture.byteLength = text.length;
            capture.truncated = text.length > MAX_CAPTURE_DATA_LENGTH;
            capture.data = text.slice(0, MAX_CAPTURE_DATA_LENGTH);
            deliver(capture);
        }
        function captureBytes(socket, direction, bytes, capture) {
            const result = capture !== null && capture !== void 0 ? capture : makeCapture(socket, direction, 'message');
            const capturedBytes = bytes.subarray(0, MAX_CAPTURE_DATA_LENGTH);
            result.encoding = 'base64';
            result.byteLength = bytes.byteLength;
            result.truncated = bytes.byteLength > capturedBytes.byteLength;
            result.data = bytesToBase64(capturedBytes);
            deliver(result);
        }
        function captureSocketData(socket, direction, data) {
            if (typeof data === 'string') {
                captureText(socket, direction, data);
                return;
            }
            if (data instanceof Blob) {
                const capture = makeCapture(socket, direction, 'message');
                void data
                    .arrayBuffer()
                    .then(buffer => captureBytes(socket, direction, new Uint8Array(buffer), capture))
                    .catch(() => {
                    capture.event = 'error';
                    capture.direction = 'lifecycle';
                    deliver(capture);
                });
                return;
            }
            if (ArrayBuffer.isView(data)) {
                captureBytes(socket, direction, new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
                return;
            }
            captureBytes(socket, direction, new Uint8Array(data));
        }
        window.addEventListener('message', event => {
            if (event.source !== window || event.origin !== window.location.origin)
                return;
            const data = event.data;
            if (!data ||
                data.source !== EXTENSION_BRIDGE_SOURCE ||
                data.type !== 'ready')
                return;
            if (bridgeReady)
                return;
            bridgeReady = true;
            for (const capture of startupBacklog) {
                window.postMessage({ source: PAGE_TRANSPORT_SOURCE, capture }, window.location.origin);
            }
            startupBacklog.length = 0;
            startupBacklogDataLength = 0;
        });
        const nativeSend = NativeWebSocket.prototype.send;
        NativeWebSocket.prototype.send = function (data) {
            if (socketIds.has(this))
                captureSocketData(this, 'outgoing', data);
            nativeSend.call(this, data);
        };
        const InstrumentedWebSocket = new Proxy(NativeWebSocket, {
            construct(target, args, newTarget) {
                var _a;
                const socket = Reflect.construct(target, args, newTarget);
                const connectionId = ++nextConnectionId;
                socketIds.set(socket, connectionId);
                socketUrls.set(socket, sanitizeConnectionUrl(String((_a = args[0]) !== null && _a !== void 0 ? _a : '')));
                console.info(`[Catan Counter] Observing WebSocket ${connectionId}: ${socketUrls.get(socket)}`);
                deliver(makeCapture(socket, 'lifecycle', 'constructed'));
                socket.addEventListener('open', () => deliver(makeCapture(socket, 'lifecycle', 'open')));
                socket.addEventListener('message', event => captureSocketData(socket, 'incoming', event.data));
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
                socket.addEventListener('error', () => deliver(makeCapture(socket, 'lifecycle', 'error')));
                return socket;
            },
        });
        window.WebSocket = InstrumentedWebSocket;
    }
    installTransportHook();

})();
