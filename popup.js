(function () {
    'use strict';

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

    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };

    // uiMode.ts
    /**
     * The gutter interface is what the extension shows unless someone has chosen
     * otherwise. The overlay stays available from the popup.
     */
    const DEFAULT_UI_MODE = 'v2';
    const UI_MODE_STORAGE_KEY = 'catanUiMode';
    function isUiMode(value) {
        return value === 'v1' || value === 'v2';
    }
    function storageAvailable$1() {
        var _a;
        return typeof chrome !== 'undefined' && !!((_a = chrome === null || chrome === void 0 ? void 0 : chrome.storage) === null || _a === void 0 ? void 0 : _a.local);
    }
    /** Read the stored mode, falling back to the default on anything unexpected. */
    function readUiMode() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!storageAvailable$1())
                return DEFAULT_UI_MODE;
            try {
                const stored = yield chrome.storage.local.get(UI_MODE_STORAGE_KEY);
                const value = stored[UI_MODE_STORAGE_KEY];
                return isUiMode(value) ? value : DEFAULT_UI_MODE;
            }
            catch (error) {
                console.warn('🎛️ Could not read the stored UI mode:', error);
                return DEFAULT_UI_MODE;
            }
        });
    }
    function writeUiMode(mode) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!storageAvailable$1())
                return;
            try {
                yield chrome.storage.local.set({ [UI_MODE_STORAGE_KEY]: mode });
            }
            catch (error) {
                console.warn('🎛️ Could not store the UI mode:', error);
            }
        });
    }

    // replayStore.ts
    const REPLAY_STORAGE_PREFIX = 'catanReplay:';
    const REPLAY_BUNDLE_VERSION = 1;
    function storageAvailable() {
        var _a;
        return typeof chrome !== 'undefined' && !!((_a = chrome === null || chrome === void 0 ? void 0 : chrome.storage) === null || _a === void 0 ? void 0 : _a.local);
    }
    function isStoredReplay(value) {
        const replay = value;
        return (!!replay &&
            typeof replay.gameId === 'string' &&
            typeof replay.capturedAt === 'string' &&
            typeof replay.json === 'string' &&
            typeof replay.byteLength === 'number');
    }
    function readAll() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!storageAvailable())
                return [];
            try {
                const all = yield chrome.storage.local.get(null);
                return Object.entries(all)
                    .filter(([key]) => key.startsWith(REPLAY_STORAGE_PREFIX))
                    .map(([, value]) => value)
                    .filter(isStoredReplay)
                    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
            }
            catch (error) {
                console.warn('📼 Could not read stored replays:', error);
                return [];
            }
        });
    }
    /** Everything held, without the payloads. */
    function listStoredReplays() {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield readAll()).map((_a) => {
                var summary = __rest(_a, ["json"]);
                return summary;
            });
        });
    }
    /**
     * Everything held, as one bundle.
     *
     * A replay whose stored text no longer parses is left out rather than allowed
     * to break the export — one bad entry should not cost the whole harvest.
     */
    function buildReplayBundle() {
        return __awaiter(this, void 0, void 0, function* () {
            const stored = yield readAll();
            const replays = [];
            for (const replay of stored) {
                try {
                    replays.push({
                        gameId: replay.gameId,
                        playerColor: replay.playerColor,
                        capturedAt: replay.capturedAt,
                        payload: JSON.parse(replay.json),
                    });
                }
                catch (_a) {
                    console.warn(`📼 Stored replay ${replay.gameId} did not parse; skipping`);
                }
            }
            return {
                bundleVersion: REPLAY_BUNDLE_VERSION,
                exportedAt: new Date().toISOString(),
                count: replays.length,
                replays,
            };
        });
    }
    /** Forget every stored replay. Returns how many were removed. */
    function clearStoredReplays() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!storageAvailable())
                return 0;
            try {
                const all = yield chrome.storage.local.get(null);
                const keys = Object.keys(all).filter(key => key.startsWith(REPLAY_STORAGE_PREFIX));
                if (keys.length > 0)
                    yield chrome.storage.local.remove(keys);
                return keys.length;
            }
            catch (error) {
                console.warn('📼 Could not clear stored replays:', error);
                return 0;
            }
        });
    }

    // popup.ts
    function paint(mode) {
        document
            .querySelectorAll('label[data-mode]')
            .forEach(el => {
            const selected = el.dataset.mode === mode;
            el.classList.toggle('selected', selected);
            const input = el.querySelector('input');
            if (input)
                input.checked = selected;
        });
    }
    function setStatus(text) {
        const status = document.getElementById('status');
        if (status)
            status.textContent = text;
    }
    /** Bytes, in the units a person reads. */
    function readableSize(bytes) {
        if (bytes < 1024)
            return `${bytes} B`;
        if (bytes < 1024 * 1024)
            return `${Math.round(bytes / 1024)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    /**
     * Save the whole harvest as one file.
     *
     * One download rather than one per game is the entire point: Chrome allows a
     * site a single automatic download and then blocks the rest without telling the
     * page, so a per-game save quietly loses most of a harvest. This runs on an
     * extension page, from a real click, and moves everything at once.
     */
    function exportReplays() {
        return __awaiter(this, void 0, void 0, function* () {
            const bundle = yield buildReplayBundle();
            if (bundle.count === 0) {
                setStatus('Nothing to export yet.');
                return;
            }
            const stamp = bundle.exportedAt.slice(0, 10);
            const blob = new Blob([JSON.stringify(bundle)], {
                type: 'application/json',
            });
            const href = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = href;
            link.download = `colonist-replays-${stamp}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(href), 30000);
            setStatus(`Exported ${bundle.count} replay${bundle.count === 1 ? '' : 's'}.`);
        });
    }
    /** Show what is held, and enable the buttons only when there is something. */
    function paintReplays() {
        return __awaiter(this, void 0, void 0, function* () {
            const stored = yield listStoredReplays();
            const count = document.getElementById('replay-count');
            const exportButton = document.getElementById('export-replays');
            const clearButton = document.getElementById('clear-replays');
            const total = stored.reduce((sum, replay) => sum + replay.byteLength, 0);
            if (count) {
                count.textContent =
                    stored.length === 0
                        ? 'None captured yet. Open a replay to collect one.'
                        : `${stored.length} game${stored.length === 1 ? '' : 's'} held · ${readableSize(total)}`;
            }
            if (exportButton)
                exportButton.disabled = stored.length === 0;
            if (clearButton)
                clearButton.disabled = stored.length === 0;
        });
    }
    function main() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            paint(yield readUiMode().catch(() => DEFAULT_UI_MODE));
            (_a = document.getElementById('modes')) === null || _a === void 0 ? void 0 : _a.addEventListener('change', event => {
                var _a;
                const value = (_a = event.target) === null || _a === void 0 ? void 0 : _a.value;
                if (!isUiMode(value))
                    return;
                paint(value);
                void writeUiMode(value).then(() => {
                    setStatus('Applied to any open colonist.io tab.');
                });
            });
            yield paintReplays();
            (_b = document.getElementById('export-replays')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => {
                void exportReplays();
            });
            (_c = document.getElementById('clear-replays')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', () => {
                void clearStoredReplays().then((removed) => __awaiter(this, void 0, void 0, function* () {
                    yield paintReplays();
                    setStatus(`Cleared ${removed} replay${removed === 1 ? '' : 's'}.`);
                }));
            });
        });
    }
    void main();

})();
