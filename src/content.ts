// content.ts
// For context, this code is meant to be run as a chrome extension on colonist.io. It tracks the game state
// for the standard game of catan. It is not meant to be run as a standalone script.

import { updateGameFromChat, applyHandCountResolution } from './chatParser.js';
import { findChatContainer } from './domUtils.js';
import {
  showGameStateOverlay,
  setHistoryLoading,
  updateGameStateDisplay,
} from './overlay.js';
import { resetGameState, autoDetectCurrentPlayer } from './gameState.js';

const chatMutationCallback = (mutationsList: MutationRecord[]) => {
  let processedAny = false;
  for (const mutation of mutationsList) {
    mutation.addedNodes.forEach(addedNode => {
      if (addedNode.nodeType === Node.ELEMENT_NODE) {
        const element = addedNode as HTMLElement;
        updateGameFromChat(element);
        processedAny = true;
      }
    });
  }

  if (processedAny) {
    // Wait for colonist's player-information panel to reflect this message, then
    // refine the variant tree by the live hand counts. Deferring a frame avoids
    // reading stale counts (and pruneByHandCounts no-ops if they don't help).
    requestAnimationFrame(() => {
      applyHandCountResolution();
      updateGameStateDisplay();
    });
  }
};

/**
 * Process all currently-rendered message rows, sorted by data-index ascending so
 * resources are applied in chronological order. Already-processed rows are
 * skipped by the parser's data-index dedup, so calling this repeatedly is safe.
 */
function processRenderedMessages(chatContainer: HTMLElement): void {
  const rows = Array.from(
    chatContainer.querySelectorAll<HTMLElement>('[data-index]')
  ).sort(
    (a, b) =>
      Number(a.getAttribute('data-index')) -
      Number(b.getAttribute('data-index'))
  );
  for (const row of rows) {
    updateGameFromChat(row);
  }
}

/**
 * Rebuild full game history after a page load/refresh.
 *
 * Colonist renders the chat as a virtual scroller that only keeps ~15 message
 * rows in the DOM at once, so on refresh the extension would otherwise see only
 * the most recent messages and miscount. We scroll the chat container from top to
 * bottom; each scroll step renders a fresh window of rows which we process in
 * ascending data-index order. Going top→bottom means indices are encountered in
 * chronological order, so the data-index dedup applies each message exactly once.
 */
async function loadChatHistory(chatContainer: HTMLElement): Promise<void> {
  // The scrollable element is the chat container's parent (the virtual scroller
  // itself has full height; its parent has overflow-y:auto).
  const scrollEl = chatContainer.parentElement;
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Not virtualized (or everything already fits): just process what's rendered.
  if (!scrollEl || scrollEl.scrollHeight <= scrollEl.clientHeight + 5) {
    processRenderedMessages(chatContainer);
    return;
  }

  const maxScroll = () => scrollEl.scrollHeight - scrollEl.clientHeight;
  // Step by ~half a viewport so consecutive windows overlap (no skipped rows).
  const step = Math.max(50, Math.floor(scrollEl.clientHeight * 0.5));

  scrollEl.scrollTop = 0;
  await sleep(120); // let the scroller render the top of the log

  let pos = 0;
  let guard = 0;
  while (guard++ < 1000) {
    processRenderedMessages(chatContainer);
    if (pos >= maxScroll()) break;
    pos = Math.min(pos + step, maxScroll());
    scrollEl.scrollTop = pos;
    await sleep(90); // wait for the next window of rows to render
  }
  // Final pass at the bottom in case the last window rendered after the loop.
  processRenderedMessages(chatContainer);
}

function tryFindChat(): void {
  const chatContainer = findChatContainer();

  if (chatContainer) {
    console.log('✅ Chat container found!');

    // Stop polling now that we've located the chat.
    clearInterval(intervalId);

    autoDetectCurrentPlayer();

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

// Start polling every 2 seconds
const intervalId: number = window.setInterval(tryFindChat, 2000);

// Optionally run immediately
tryFindChat();
