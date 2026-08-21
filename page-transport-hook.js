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
        /**
         * Report once colonist has had a chance to re-lay out.
         *
         * A frame is the natural moment to measure, but requestAnimationFrame does
         * not fire at all in a background tab — and a game can easily be loaded, or
         * left, in one. Relying on it alone meant the reply never arrived there, the
         * content script timed out, and v2 silently fell back to covering the page
         * for the rest of the session. So race the frame against a timer and report
         * on whichever comes first.
         */
        function scheduleReport(nonce) {
            let done = false;
            const once = () => {
                if (done)
                    return;
                done = true;
                report(nonce);
            };
            requestAnimationFrame(once);
            window.setTimeout(once, 48);
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
                scheduleReport(nonce);
                return;
            }
            if (command.type === 'measure') {
                report(nonce);
                return;
            }
            inset = Object.assign(Object.assign({}, ZERO_INSET), ((_a = command.inset) !== null && _a !== void 0 ? _a : ZERO_INSET));
            applyOverride();
            window.dispatchEvent(new Event('resize'));
            scheduleReport(nonce);
        });
    }

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __rest(s, e) {
        var t = {};
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
            t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
                if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                    t[p[i]] = s[p[i]];
            }
        return t;
    }

    typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };

    /**
     * Types and bridge code for capturing Colonist's replay payload.
     *
     * A replay is not played over the WebSocket the live game uses. Colonist
     * requests the whole game in one shot:
     *
     *     GET /api/replay/data-from-game-id?gameId=<id>&playerColor=<seat>
     *
     * and it is an XMLHttpRequest, not fetch. That request can only be observed as
     * the page makes it: asking for the same URL again from page script is refused
     * by Cloudflare with 403 and `cf-mitigated: token`, so there is no re-fetching
     * it later and no fetching it from the extension's own world. The MAIN-world
     * hook in pageReplayHook.ts therefore tees the response at document_start, and
     * this module validates what crosses the postMessage boundary.
     *
     * Payloads are far larger than a chat line, so they cross in chunks and are
     * reassembled here.
     */
    const PAGE_REPLAY_SOURCE = 'catan-counter-page-replay-v1';
    const REPLAY_CAPTURE_VERSION = 1;
    /** postMessage copies structured data; keep each hop modest. */
    const REPLAY_CHUNK_LENGTH = 262144;

    /**
     * MAIN-world capture of Colonist's replay payload.
     *
     * Runs at document_start, before Colonist's bundle exists, because the replay
     * arrives once during page load and cannot be asked for again: repeating the
     * request from page script comes back 403 with `cf-mitigated: token`, from both
     * fetch and XHR, even for a game that tab never opened. A browser that is not
     * signed in gets 401. So the payload is teed as it passes or it is lost.
     *
     * Colonist uses XMLHttpRequest for this endpoint; fetch is wrapped too so a
     * change of transport does not silently end the capture.
     *
     * What lands here is one JSON document holding the entire game: the board, all
     * 500-700 events as state diffs, the structured game log, player chat, and the
     * end-game stats. Roughly 200 KB.
     */
    const REPLAY_PATH = '/api/replay/';
    /** Captures kept in memory for the page API; a page rarely loads more than one. */
    const MAX_RETAINED = 8;
    function bytesToBase64$1(bytes) {
        let binary = '';
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            binary += String.fromCharCode(...Array.from(bytes.subarray(offset, offset + chunkSize)));
        }
        return window.btoa(binary);
    }
    function isReplayUrl(value) {
        try {
            return new URL(value, window.location.href).pathname.startsWith(REPLAY_PATH);
        }
        catch (_a) {
            return false;
        }
    }
    /** Origin + pathname only, matching the transport hook's convention. */
    function sanitizeUrl(value) {
        try {
            const url = new URL(value, window.location.href);
            return `${url.protocol}//${url.host}${url.pathname}`;
        }
        catch (_a) {
            return value.split(/[?#]/, 1)[0].slice(0, 2000);
        }
    }
    /**
     * gameId names the record and playerColor records which seat's link produced
     * it, so both are read off the query string before it is dropped. The seat does
     * not change what the payload reveals — every hand is in there either way — but
     * it is worth keeping to show where a file came from.
     */
    function identify(value) {
        try {
            const params = new URL(value, window.location.href).searchParams;
            const gameId = params.get('gameId');
            const raw = params.get('playerColor');
            const playerColor = raw === null ? null : Number(raw);
            return {
                gameId: gameId && gameId.length <= 64 ? gameId : null,
                playerColor: playerColor !== null && Number.isSafeInteger(playerColor)
                    ? playerColor
                    : null,
            };
        }
        catch (_a) {
            return { gameId: null, playerColor: null };
        }
    }
    const captures = [];
    const waiters = [];
    let nextCaptureId = 0;
    function successful() {
        return captures.find(capture => capture.status === 200);
    }
    function decodeText(capture) {
        const binary = window.atob(capture.base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) {
            bytes[index] = binary.charCodeAt(index);
        }
        return new TextDecoder().decode(bytes);
    }
    function bridge(capture) {
        const captureId = `${Date.now().toString(36)}-${nextCaptureId++}`;
        const { base64 } = capture, meta = __rest(capture, ["base64"]);
        const total = Math.max(1, Math.ceil(base64.length / REPLAY_CHUNK_LENGTH));
        for (let index = 0; index < total; index++) {
            window.postMessage(Object.assign({ source: PAGE_REPLAY_SOURCE, captureId,
                index,
                total, chunk: base64.slice(index * REPLAY_CHUNK_LENGTH, (index + 1) * REPLAY_CHUNK_LENGTH) }, (index === total - 1 ? { meta } : {})), window.location.origin);
        }
    }
    function deliver(capture) {
        var _a;
        captures.push(capture);
        while (captures.length > MAX_RETAINED)
            captures.shift();
        console.info(`[Catan Counter] Replay ${(_a = capture.gameId) !== null && _a !== void 0 ? _a : '?'}: status ${capture.status}, ${capture.byteLength} bytes`);
        bridge(capture);
        if (capture.status === 200) {
            const pending = waiters.splice(0, waiters.length);
            for (const resolve of pending)
                resolve();
        }
    }
    function record(rawUrl, status, contentType, bytes) {
        const { gameId, playerColor } = identify(rawUrl);
        deliver({
            captureVersion: REPLAY_CAPTURE_VERSION,
            capturedAt: new Date().toISOString(),
            url: sanitizeUrl(rawUrl),
            gameId,
            playerColor,
            status,
            contentType,
            base64: bytesToBase64$1(bytes),
            byteLength: bytes.byteLength,
        });
    }
    /**
     * XHR hands back whatever shape responseType asked for, and Colonist may change
     * that; normalise every shape to bytes rather than assuming text.
     */
    function bodyToBytes(request) {
        const body = request.response;
        if (body instanceof ArrayBuffer)
            return new Uint8Array(body);
        if (ArrayBuffer.isView(body)) {
            const view = body;
            return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        }
        if (typeof body === 'string')
            return new TextEncoder().encode(body);
        if (body === null || body === undefined) {
            try {
                // responseType 'json' leaves response null when the body did not parse;
                // responseText still holds it for the text-ish types.
                if (request.responseText) {
                    return new TextEncoder().encode(request.responseText);
                }
            }
            catch (_a) {
                /* responseText throws for binary response types */
            }
            return null;
        }
        try {
            return new TextEncoder().encode(JSON.stringify(body));
        }
        catch (_b) {
            return null;
        }
    }
    function installPageApi() {
        const api = {
            version: 1,
            meta: () => captures.map((capture, index) => ({
                index,
                status: capture.status,
                byteLength: capture.byteLength,
                gameId: capture.gameId,
                playerColor: capture.playerColor,
                capturedAt: capture.capturedAt,
            })),
            ready: () => successful() !== undefined,
            whenReady: (timeoutMs = 20000) => new Promise(resolve => {
                if (successful()) {
                    resolve(true);
                    return;
                }
                let settled = false;
                const done = (value) => {
                    if (settled)
                        return;
                    settled = true;
                    resolve(value);
                };
                waiters.push(() => done(true));
                window.setTimeout(() => done(successful() !== undefined), timeoutMs);
            }),
            data(index) {
                const capture = index === undefined ? successful() : captures[index];
                if (!capture)
                    return null;
                return JSON.parse(decodeText(capture));
            },
            save(index) {
                var _a;
                const capture = index === undefined ? successful() : captures[index];
                if (!capture)
                    throw new Error('No replay payload has been captured yet');
                const name = `colonist-replay-${(_a = capture.gameId) !== null && _a !== void 0 ? _a : 'unknown'}.json`;
                const blob = new Blob([decodeText(capture)], {
                    type: 'application/json',
                });
                const href = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = href;
                link.download = name;
                document.body.appendChild(link);
                link.click();
                link.remove();
                // Give the download a turn to start before the blob goes away.
                window.setTimeout(() => URL.revokeObjectURL(href), 30000);
                return name;
            },
        };
        window.__catanCounterReplay = api;
    }
    function installReplayHook() {
        if (window.__catanCounterReplayHookInstalled)
            return;
        window.__catanCounterReplayHookInstalled = true;
        const nativeOpen = XMLHttpRequest.prototype.open;
        const nativeSend = XMLHttpRequest.prototype.send;
        const watched = new WeakMap();
        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            const raw = String(url);
            if (isReplayUrl(raw))
                watched.set(this, raw);
            // The remaining arguments are optional and positional; pass them through
            // untouched rather than reconstructing the overload set.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return nativeOpen.call(this, method, url, ...rest);
        };
        XMLHttpRequest.prototype.send = function (body) {
            const raw = watched.get(this);
            if (raw) {
                this.addEventListener('load', () => {
                    try {
                        const bytes = bodyToBytes(this);
                        if (bytes) {
                            record(raw, this.status, this.getResponseHeader('content-type'), bytes);
                        }
                    }
                    catch (error) {
                        console.warn('[Catan Counter] Replay capture failed:', error);
                    }
                });
            }
            return nativeSend.call(this, body !== null && body !== void 0 ? body : null);
        };
        const nativeFetch = window.fetch;
        if (typeof nativeFetch === 'function') {
            window.fetch = function (input, init) {
                const raw = typeof input === 'string'
                    ? input
                    : input instanceof URL
                        ? input.href
                        : input.url;
                const response = nativeFetch.call(window, input, init);
                if (isReplayUrl(String(raw))) {
                    void response
                        .then(result => 
                    // Clone, so Colonist still gets to read its own body.
                    result
                        .clone()
                        .arrayBuffer()
                        .then(buffer => record(String(raw), result.status, result.headers.get('content-type'), new Uint8Array(buffer))))
                        .catch(() => {
                        /* a request that failed is not a capture */
                    });
                }
                return response;
            };
        }
        installPageApi();
        console.info('[Catan Counter] Replay capture installed');
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
    // Replays never touch the WebSocket: Colonist downloads the whole game once,
    // during page load, over XHR. See pageReplayHook.ts.
    installReplayHook();
    // The v2 gutter UI needs colonist to lay out inside a smaller area, which only
    // works from this world — see pageViewport.ts. It stays inert until the content
    // script asks for an inset.
    installViewportControl();

})();
