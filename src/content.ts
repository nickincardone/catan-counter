// content.ts
// For context, this code is meant to be run as a chrome extension on colonist.io. It tracks the game state
// for the standard game of catan. It is not meant to be run as a standalone script.

import { updateGameFromChat } from './chatParser.js';
import { findChatContainer } from './domUtils.js';
import { showGameStateOverlay } from './overlay.js';

const chatMutationCallback = (mutationsList: MutationRecord[]) => {
  for (const mutation of mutationsList) {
    mutation.addedNodes.forEach(addedNode => {
      if (addedNode.nodeType === Node.ELEMENT_NODE) {
        const element = addedNode as HTMLElement;
        updateGameFromChat(element);
      }
    });
  }
};

function tryFindChat(): void {
  const chatContainer = findChatContainer();

  if (chatContainer) {
    console.log('✅ Chat container found!');

    // Show the game state overlay
    showGameStateOverlay();

    // Process existing messages in case user refreshed the page
    const existingMessages = chatContainer.children;
    console.log(
      `📜 Processing ${existingMessages.length} existing messages...`
    );

    for (let i = 0; i < existingMessages.length; i++) {
      const element = existingMessages[i] as HTMLElement;
      if (element.nodeType === Node.ELEMENT_NODE) {
        updateGameFromChat(element);
      }
    }

    console.log('✅ Finished processing existing messages');

    // Set up observer for new messages
    const observer = new MutationObserver(chatMutationCallback);
    observer.observe(chatContainer, { childList: true });
    clearInterval(intervalId);
  } else {
    console.log('⏳ Chat container not found, retrying...');
  }
}

// Start polling every 2 seconds
const intervalId: number = window.setInterval(tryFindChat, 2000);

// Optionally run immediately
tryFindChat();
