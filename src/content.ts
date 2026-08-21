// content.ts
// For context, this code is meant to be run as a chrome extension on colonist.io. It tracks the game state
// for the standard game of catan. It is not meant to be run as a standalone script.

import { updateGameFromChat, applyHandCountResolution } from './chatParser.js';
import { findChatContainer } from './domUtils.js';
import {
  showGameStateOverlay,
  setHistoryLoading,
  updateGameStateDisplay,
} from './ui/index.js';
import { resetGameState, autoDetectCurrentPlayer } from './gameState.js';
import {
  initMessageLogger,
  logChatMessage,
  logTransportCapture,
  exportAllGameLogs,
} from './messageLogger.js';
import { MessageOrderBuffer } from './messageOrderBuffer.js';
import { startTransportCaptureBridge } from './transportCapture.js';

// Start listening immediately so the MAIN-world hook can replay WebSocket
// traffic captured before Colonist rendered the chat or board.
startTransportCaptureBridge(logTransportCapture);

// All chat rows flow through this buffer so the parser always sees them in
// strict data-index order — the parser's dedup is a monotonic high-water mark,
// so an out-of-order row would permanently lock out everything before it.
const messageBuffer = new MessageOrderBuffer(updateGameFromChat);
let blockedFlushTimer: number | null = null;

/**
 * A row the virtual scroller has created but not yet filled in.
 *
 * Colonist's scroller mints rows with a data-index well before their content
 * exists — in a replay, hundreds of them at once. They carry no text and no
 * icons, so there is nothing to read yet.
 */
function isPlaceholderRow(element: HTMLElement): boolean {
  return !element.textContent?.trim() && element.querySelector('img') === null;
}

/**
 * Capture one rendered chat row: log it verbatim (the logger dedups by index
 * itself) and queue it for in-order parsing.
 *
 * Placeholders are skipped rather than captured. Capturing one would spend its
 * data-index in the parser's high-water mark and the logger's dedup, and the
 * real message would then be thrown away as already-seen when it finally
 * rendered — quietly losing whatever it said.
 */
function captureRow(element: HTMLElement): void {
  if (isPlaceholderRow(element)) return;
  logChatMessage(element);
  messageBuffer.capture(element);
}

/**
 * If rows are stuck behind a gap the scroller never rendered, give the gap a
 * few seconds to fill (a re-render or user scroll may still supply it), then
 * process what we have anyway so live tracking doesn't stall forever.
 */
function scheduleBlockedFlush(): void {
  if (!messageBuffer.hasPending()) {
    if (blockedFlushTimer !== null) {
      clearTimeout(blockedFlushTimer);
      blockedFlushTimer = null;
    }
    return;
  }
  if (blockedFlushTimer !== null) return;
  blockedFlushTimer = window.setTimeout(() => {
    blockedFlushTimer = null;
    messageBuffer.drain();
    if (messageBuffer.hasPending()) {
      console.warn(
        '⚠️ Chat gap never rendered — processing buffered rows out of contiguity'
      );
      messageBuffer.flush();
    }
    updateGameStateDisplay();
  }, 3000);
}

const chatMutationCallback = (mutationsList: MutationRecord[]) => {
  let sawRows = false;
  for (const mutation of mutationsList) {
    mutation.addedNodes.forEach(addedNode => {
      if (addedNode.nodeType === Node.ELEMENT_NODE) {
        captureRow(addedNode as HTMLElement);
        sawRows = true;
      }
    });
  }

  if (sawRows) {
    messageBuffer.drain();
    scheduleBlockedFlush();
    // Wait for colonist's player-information panel to reflect this message, then
    // refine the variant tree by the live hand counts. Deferring a frame avoids
    // reading stale counts (and pruneByHandCounts no-ops if they don't help).
    requestAnimationFrame(() => {
      applyHandCountResolution();
      updateGameStateDisplay();
    });
  }
};

/** Capture all currently-rendered rows and parse the contiguous prefix. */
function captureRenderedMessages(chatContainer: HTMLElement): void {
  chatContainer
    .querySelectorAll<HTMLElement>('[data-index]')
    .forEach(row => captureRow(row));
  messageBuffer.drain();
}

/**
 * Rebuild full game history after a page load/refresh.
 *
 * Colonist renders the chat as a virtual scroller that only keeps ~15 message
 * rows in the DOM at once, so on refresh the extension would otherwise see only
 * the most recent messages and miscount. We scroll from top to bottom capturing
 * each rendered window; the MessageOrderBuffer feeds the parser in data-index
 * order regardless of render order.
 *
 * The sweep reads scrollTop/scrollHeight live on every step — the scroller
 * corrects its estimated height as rows render, and re-pins to the bottom when
 * a live message arrives mid-sweep, so a precomputed position would jump over
 * whole stretches of the log (seen in practice as rows 68–243 never rendering).
 * If a sweep ends with rows still stuck behind a gap, it re-sweeps up to two
 * more times, then flushes whatever was captured.
 */
async function loadChatHistory(chatContainer: HTMLElement): Promise<void> {
  // The scrollable element is the chat container's parent (the virtual scroller
  // itself has full height; its parent has overflow-y:auto).
  const scrollEl = chatContainer.parentElement;
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Not virtualized (or everything already fits): just process what's rendered.
  if (!scrollEl || scrollEl.scrollHeight <= scrollEl.clientHeight + 5) {
    captureRenderedMessages(chatContainer);
    messageBuffer.flush();
    return;
  }

  const MAX_SWEEPS = 3;
  for (let sweep = 1; sweep <= MAX_SWEEPS; sweep++) {
    scrollEl.scrollTop = 0;
    await sleep(120); // let the scroller render the top of the log

    let guard = 0;
    while (guard++ < 1000) {
      captureRenderedMessages(chatContainer);
      const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
      if (scrollEl.scrollTop >= maxScroll - 2) break;
      // Step by ~half a viewport so consecutive windows overlap (no skipped
      // rows), advancing from wherever the scroller ACTUALLY is right now.
      const step = Math.max(50, Math.floor(scrollEl.clientHeight * 0.5));
      scrollEl.scrollTop = Math.min(scrollEl.scrollTop + step, maxScroll);
      await sleep(90); // wait for the next window of rows to render
    }
    // Final pass at the bottom in case the last window rendered after the loop.
    captureRenderedMessages(chatContainer);

    if (!messageBuffer.hasPending()) return; // no gaps — history is complete
    console.warn(
      `⚠️ History sweep ${sweep}/${MAX_SWEEPS} left a gap in the chat log, ${
        sweep < MAX_SWEEPS ? 'retrying...' : 'giving up on the gap'
      }`
    );
  }
  // Gap rows never rendered; process everything captured after the gap anyway.
  messageBuffer.flush();
}

function tryFindChat(): void {
  const chatContainer = findChatContainer();

  if (chatContainer) {
    console.log('✅ Chat container found!');

    // Stop polling now that we've located the chat.
    clearInterval(intervalId);

    autoDetectCurrentPlayer();

    // Start recording chat messages for this game (resumes any stored log for
    // the same game id, e.g. after a refresh). History replay below will feed
    // every message through the logger via captureRow.
    void initMessageLogger();

    // Show the game state overlay
    showGameStateOverlay();

    // Scroll through and process the full chat history (handles page refresh,
    // where only the most recent messages are initially rendered), then watch
    // for new messages.
    console.log('📜 Loading chat history...');
    setHistoryLoading(true);
    loadChatHistory(chatContainer)
      .then(() => {
        console.log('✅ Finished processing chat history');
        // The replay just caught up to the present, so the live hand counts in
        // colonist's player panel are valid evidence against the rebuilt tree
        // (this is what resolves post-monopoly ambiguity after a refresh).
        applyHandCountResolution();
      })
      .finally(() => {
        // Calculations done: drop the loader and show the rebuilt counts.
        setHistoryLoading(false);
        const observer = new MutationObserver(chatMutationCallback);
        observer.observe(chatContainer, { childList: true });
      });
  } else {
    console.log('⏳ Chat container not found, retrying...');
  }
}

function reprocessAllMessages(): void {
  // Find all chat messages
  const chatElements = findAllChatMessages();

  if (chatElements.length > 0) {
    console.log(`🔄 Reprocessing ${chatElements.length} chat messages...`);

    // Reset game state but keep "you" player info
    resetGameState();

    // Process all messages in order
    chatElements.forEach((element, index) => {
      console.log(`Processing message ${index + 1}/${chatElements.length}`);
      updateGameFromChat(element);
    });

    console.log('✅ Finished reprocessing all messages');
  }
}

function findAllChatMessages(): HTMLElement[] {
  // Try to find the chat container using the same logic as domUtils
  const divs = document.querySelectorAll<HTMLDivElement>('div');

  for (const outerDiv of Array.from(divs)) {
    const firstChild = outerDiv.firstElementChild;

    if (firstChild?.tagName === 'DIV') {
      for (const child of Array.from(firstChild.children)) {
        if (child.tagName === 'SPAN') {
          const anchor = child.querySelector<HTMLAnchorElement>(
            'a[href="#open-rulebook"]'
          );
          if (anchor) {
            // Found the chat container, return all its child elements
            return Array.from(outerDiv.children) as HTMLElement[];
          }
        }
      }
    }
  }

  return [];
}

// Console access to the stored game logs. From the page's DevTools console,
// select the extension's content-script context, then run:
//   __catanCounter.exportAllGameLogs()
(window as unknown as Record<string, unknown>).__catanCounter = {
  exportAllGameLogs,
};

// Start polling every 2 seconds
const intervalId: number = window.setInterval(tryFindChat, 2000);

// Optionally run immediately
tryFindChat();
