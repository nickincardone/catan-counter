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
import { MessageOrderBuffer, isChatRowReady } from './messageOrderBuffer.js';
import { loadChatHistory } from './chatHistory.js';
import { startTransportCaptureBridge } from './transportCapture.js';
import { startReplayCaptureBridge } from './replayCapture.js';
import { storeReplayCapture } from './replayStore.js';

// Start listening immediately so the MAIN-world hook can replay WebSocket
// traffic captured before Colonist rendered the chat or board.
startTransportCaptureBridge(logTransportCapture);

// Replays arrive whole, over XHR, once per page load — see pageReplayHook.ts.
// Holding them here rather than downloading one per game is what lets a harvest
// of any size end in a single export from the popup.
startReplayCaptureBridge(capture => {
  void storeReplayCapture(capture).then(outcome => {
    if (outcome !== 'ignored') {
      console.info(
        `📼 Replay ${capture.gameId} ${outcome} (${capture.byteLength} bytes) — export from the extension popup`
      );
    }
  });
});

/** The chat container, once found, so a gap can be checked against the DOM. */
let chatRoot: HTMLElement | null = null;

/**
 * Look a chat index up on screen, for drain() to decide what a gap means.
 *
 * Logging happens here because a row adopted this way never went through
 * captureRow: the observer missed it, and the log would otherwise have a hole
 * where the parser does not. The logger dedups by index, so saying it twice is
 * harmless.
 */
function resolveChatRow(index: number): HTMLElement | null {
  const row = chatRoot?.querySelector<HTMLElement>(`[data-index="${index}"]`);
  if (!row) return null;
  if (isChatRowReady(row)) logChatMessage(row);
  return row;
}

// All chat rows flow through this buffer so the parser always sees them in
// strict data-index order — the parser's dedup is a monotonic high-water mark,
// so an out-of-order row would permanently lock out everything before it.
const messageBuffer = new MessageOrderBuffer(
  updateGameFromChat,
  resolveChatRow
);
let blockedFlushTimer: number | null = null;

/**
 * A row the virtual scroller has created but not yet filled in.
 *
 * Colonist's scroller mints rows with a data-index well before their content
 * exists — in a replay, hundreds of them at once. They carry no text and no
 * icons, so there is nothing to read yet.
 */
function isPlaceholderRow(element: HTMLElement): boolean {
  return !isChatRowReady(element);
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
    // Rows can be populated/recycled without adding a new direct child.
    const target =
      mutation.target.nodeType === Node.ELEMENT_NODE
        ? (mutation.target as HTMLElement)
        : mutation.target.parentElement;
    const changedRow = target?.closest<HTMLElement>('[data-index]');
    if (changedRow) {
      captureRow(changedRow);
      sawRows = true;
    }
    mutation.addedNodes.forEach(addedNode => {
      if (addedNode.nodeType === Node.ELEMENT_NODE) {
        captureRow(addedNode as HTMLElement);
        (addedNode as HTMLElement)
          .querySelectorAll<HTMLElement>('[data-index]')
          .forEach(captureRow);
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

function tryFindChat(): void {
  const chatContainer = findChatContainer();

  if (chatContainer) {
    console.log('✅ Chat container found!');
    // Gap resolution reads the live chat, so it needs to know where it is.
    chatRoot = chatContainer;

    // Stop polling now that we've located the chat.
    clearInterval(intervalId);

    autoDetectCurrentPlayer();

    // Start recording chat messages for this game (resumes any stored log for
    // the same game id, e.g. after a refresh). History replay below will feed
    // every message through the logger via captureRow.
    const loggerReady = initMessageLogger();

    // Show the game state overlay
    showGameStateOverlay();

    // Scroll through and process the full chat history (handles page refresh,
    // where only the most recent messages are initially rendered), then watch
    // for new messages.
    console.log('📜 Loading chat history...');
    setHistoryLoading(true);
    loggerReady
      .then(() =>
        loadChatHistory(chatContainer, captureRow, {
          onCapture: logChatMessage,
        })
      )
      .then(() => {
        messageBuffer.drain();
        console.log('✅ Finished processing chat history');
        // The replay just caught up to the present, so the live hand counts in
        // colonist's player panel are valid evidence against the rebuilt tree
        // (this is what resolves post-monopoly ambiguity after a refresh).
        applyHandCountResolution();
        setHistoryLoading(false);
      })
      .catch(error => {
        console.error('Could not rebuild complete chat history:', error);
        setHistoryLoading(
          false,
          'Some chat messages could not be recovered. Counts are unavailable.'
        );
      })
      .finally(() => {
        const observer = new MutationObserver(chatMutationCallback);
        observer.observe(chatContainer, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['data-index', 'alt', 'src'],
        });
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
