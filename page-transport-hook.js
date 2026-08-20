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
     * MAIN-world viewport control for the v2 gutter UI.
     *
     * Colonist has no single page root to pad: it absolutely-positions its canvas
     * layers and `#ui-game` on <body> and writes inline pixel sizes onto them,
     * recomputed from `window.innerWidth`/`innerHeight` whenever a resize fires.
     * The only way to make it lay out inside a smaller area — crisply, at native
     * resolution, without touching its own transforms — is to make it read smaller
     * numbers and tell it to re-measure.
     *
     * That has to happen in the page's own JavaScript world, so this module runs
     * alongside the transport hook and takes its commands from the isolated content
     * script over the same window.postMessage bridge.
     */
    const PAGE_VIEWPORT_SOURCE = 'catan-counter-page-viewport-v1';
    /** Elements colonist positions itself; the union of these is "the game". */
    const CONTENT_SELECTORS = ['#game-canvas', '#ui-game'];
    const ZERO_INSET = {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    };
    function isViewportCommand(value) {
        const command = value;
        return (!!command &&
            command.source === PAGE_VIEWPORT_SOURCE &&
            (command.type === 'set-inset' ||
                command.type === 'release' ||
                command.type === 'measure'));
    }
    function measureContent() {
        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        let found = false;
        for (const selector of CONTENT_SELECTORS) {
            const element = document.querySelector(selector);
            if (!element)
                continue;
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0)
                continue;
            found = true;
            left = Math.min(left, rect.left);
            top = Math.min(top, rect.top);
            right = Math.max(right, rect.right);
            bottom = Math.max(bottom, rect.bottom);
        }
        return found ? { left, top, right, bottom } : null;
    }
    /**
     * Install the override. Safe to call more than once; only the first call wires
     * anything up. Returns immediately — nothing changes until an inset arrives.
     */
    function installViewportControl() {
        const flagged = window;
        if (flagged.__catanCounterViewportInstalled)
            return;
        flagged.__catanCounterViewportInstalled = true;
        // Captured before any override so release always restores the truth, even if
        // something else on the page redefines them later.
        const nativeWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
        const nativeHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
        const realWidth = () => (nativeWidth === null || nativeWidth === void 0 ? void 0 : nativeWidth.get) ? Number(nativeWidth.get.call(window)) : window.innerWidth;
        const realHeight = () => (nativeHeight === null || nativeHeight === void 0 ? void 0 : nativeHeight.get)
            ? Number(nativeHeight.get.call(window))
            : window.innerHeight;
        let inset = Object.assign({}, ZERO_INSET);
        let overridden = false;
        function applyOverride() {
            if (overridden)
                return;
            overridden = true;
            Object.defineProperty(window, 'innerWidth', {
                configurable: true,
                get: () => Math.max(0, realWidth() - inset.left - inset.right),
            });
            Object.defineProperty(window, 'innerHeight', {
                configurable: true,
                get: () => Math.max(0, realHeight() - inset.top - inset.bottom),
            });
        }
        function removeOverride() {
            if (!overridden)
                return;
            overridden = false;
            if (nativeWidth)
                Object.defineProperty(window, 'innerWidth', nativeWidth);
            else
                delete window.innerWidth;
            if (nativeHeight)
                Object.defineProperty(window, 'innerHeight', nativeHeight);
            else
                delete window.innerHeight;
        }
        function report(nonce) {
            const message = {
                source: PAGE_VIEWPORT_SOURCE,
                type: 'report',
                nonce,
                real: { width: realWidth(), height: realHeight() },
                reported: { width: window.innerWidth, height: window.innerHeight },
                content: measureContent(),
            };
            window.postMessage(message, window.location.origin);
        }
        window.addEventListener('message', event => {
            var _a;
            if (event.source !== window || event.origin !== window.location.origin)
                return;
            if (!isViewportCommand(event.data))
                return;
            const command = event.data;
            const nonce = typeof command.nonce === 'number' ? command.nonce : 0;
            if (command.type === 'release') {
                inset = Object.assign({}, ZERO_INSET);
                removeOverride();
                window.dispatchEvent(new Event('resize'));
                // Let colonist finish laying out at full size before reporting back.
                requestAnimationFrame(() => report(nonce));
                return;
            }
            if (command.type === 'measure') {
                report(nonce);
                return;
            }
            inset = Object.assign(Object.assign({}, ZERO_INSET), ((_a = command.inset) !== null && _a !== void 0 ? _a : ZERO_INSET));
            applyOverride();
            window.dispatchEvent(new Event('resize'));
            requestAnimationFrame(() => report(nonce));
        });
    }

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
    // The v2 gutter UI needs colonist to lay out inside a smaller area, which only
    // works from this world — see pageViewport.ts. It stays inert until the content
    // script asks for an inset.
    installViewportControl();

})();
