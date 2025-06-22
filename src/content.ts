// content.ts
// For context, this code is meant to be run as a chrome extension on colonist.io. It tracks the game state
// for the standard game of catan. It is not meant to be run as a standalone script.

import { updateGameFromChat } from './chatParser.js';
import { findChatContainer } from './domUtils.js';
import { showGameStateOverlay, setYouPlayerSelectedCallback } from './overlay.js';
import { resetGameState } from './gameState.js';

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

// Set up the callback for when "you" player is selected
setYouPlayerSelectedCallback(reprocessAllMessages);

// Start polling every 2 seconds
const intervalId: number = window.setInterval(tryFindChat, 2000);

// Optionally run immediately
tryFindChat();
