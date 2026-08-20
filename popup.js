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
    const DEFAULT_UI_MODE = 'v1';
    const UI_MODE_STORAGE_KEY = 'catanUiMode';
    function isUiMode(value) {
        return value === 'v1' || value === 'v2';
    }
    function storageAvailable() {
        var _a;
        return typeof chrome !== 'undefined' && !!((_a = chrome === null || chrome === void 0 ? void 0 : chrome.storage) === null || _a === void 0 ? void 0 : _a.local);
    }
    /** Read the stored mode, falling back to the default on anything unexpected. */
    function readUiMode() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!storageAvailable())
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
            if (!storageAvailable())
                return;
            try {
                yield chrome.storage.local.set({ [UI_MODE_STORAGE_KEY]: mode });
            }
            catch (error) {
                console.warn('🎛️ Could not store the UI mode:', error);
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
    function main() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
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
        });
    }
    void main();

})();
