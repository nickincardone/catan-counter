import { ResourceObjectType } from './types.js';
import { game, ensurePlayerExists, updateResources, youPlayerName, hasAskedForYouPlayer, markYouPlayerAsked, isWaitingForYouPlayerSelection, resetGameState } from './gameState.js';
import { 
  getPlayerName, 
  getDiceRollTotal, 
  getResourceType, 
  getResourceTypeFromAlt, 
  getTradePartner, 
  getResourcesFromImages, 
  RESOURCE_STRING 
} from './domUtils.js';
import { updateGameStateDisplay, showYouPlayerDialog } from './overlay.js';

export function updateGameFromChat(element: HTMLElement): void {
  // If we're waiting for "you" player selection, don't process new messages
  if (isWaitingForYouPlayerSelection) {
    return;
  }

  const messageText = element.textContent || '';
  let playerName = getPlayerName(element);

  // getting correct player name when it says "You stole"
  if (messageText.includes('You stole') && messageText.includes('from')) {
    // Get the previous sibling element to find the actual player name
    const previousElement = element.previousElementSibling as HTMLElement;
    if (previousElement) {
      const actualPlayerName = getPlayerName(previousElement);
      if (actualPlayerName) {
        // Override the playerName with the actual player from previous element
        playerName = actualPlayerName;
      }
    }
  }

  // Handle "[Player] stole [resource] from you" scenario
  if (messageText.includes('stole') && messageText.includes('from you')) {
    const stolenResource = getResourceType(element);
    if (stolenResource && playerName && youPlayerName) {
      // Player stole from "you"
      updateResources(playerName, { [stolenResource]: 1 } as any);
      updateResources(youPlayerName, { [stolenResource]: -1 } as any);
      console.log(`🦹 ${playerName} stole ${stolenResource} from you (${youPlayerName})`);
      updateGameStateDisplay();
      return; // Exit early since we've handled this message
    }
  }

  // Scenario 1: Place settlement (keyword: "placed a")
  if (
    messageText.includes('placed a') &&
    element.querySelector('img[alt="settlement"]')
  ) {
    if (playerName) {
      ensurePlayerExists(playerName);
      const player = game.players.find(p => p.name === playerName);
      if (player && player.settlements > 0) {
        player.settlements--;
        console.log(
          `🏠 ${playerName} placed a settlement. Remaining settlements: ${player.settlements}`
        );
      }
    }
  }
  // Scenario 2: Roll dice (keyword: "rolled")
  else if (messageText.includes('rolled')) {
    const diceTotal = getDiceRollTotal(element);
    if (diceTotal && diceTotal >= 2 && diceTotal <= 12) {
      (game.diceRolls as any)[diceTotal]++;
      console.log(
        `🎲 Dice rolled: ${diceTotal}. Total rolls for ${diceTotal}: ${(game.diceRolls as any)[diceTotal]}`
      );
      
      // Show "you" player dialog on the first dice roll
      if (!hasAskedForYouPlayer && game.players.length > 0) {
        markYouPlayerAsked();
        showYouPlayerDialog();
      }
    }
  }
  // Scenario 3: Place road (keyword: "placed a" + road image)
  else if (
    messageText.includes('placed a') &&
    element.querySelector('img[alt="road"]')
  ) {
    if (playerName) {
      ensurePlayerExists(playerName);
      const player = game.players.find(p => p.name === playerName);
      if (player && player.roads > 0) {
        player.roads--;
        console.log(
          `🛣️ ${playerName} placed a road. Remaining roads: ${player.roads}`
        );
      }
    }
  }
  // Scenario 4: Known trade (keyword: "gave" and "got" and "from")
  else if (
    messageText.includes('gave') &&
    messageText.includes('got') &&
    messageText.includes('from')
  ) {
    if (playerName) {
      const tradePartner = getTradePartner(element);
      if (tradePartner) {
        // Split the message to separate what was given from what was received
        const messageParts = messageText.split(' and got ');
        if (messageParts.length === 2) {
          const gaveSection = messageParts[0];
          const gotSection = messageParts[1].split(' from ')[0];

          // Get all resource images in the element
          const allResourceImages = element.querySelectorAll(RESOURCE_STRING);

          // Count resources in the "gave" section by looking at text position
          const gaveResources: Partial<ResourceObjectType> = {};
          const gotResources: Partial<ResourceObjectType> = {};

          // Find the position where "and got" appears in the HTML
          const elementHTML = element.innerHTML;
          const gaveEndIndex = elementHTML.indexOf(' and got ');

          if (gaveEndIndex !== -1) {
            // Create temporary elements to count resources in each section
            const tempGaveDiv = document.createElement('div');
            tempGaveDiv.innerHTML = elementHTML.substring(0, gaveEndIndex);
            const gaveImages = tempGaveDiv.querySelectorAll(RESOURCE_STRING);

            const tempGotDiv = document.createElement('div');
            const gotStartIndex = gaveEndIndex + ' and got '.length;
            const gotEndIndex = elementHTML.indexOf(' from ');
            tempGotDiv.innerHTML = elementHTML.substring(
              gotStartIndex,
              gotEndIndex
            );
            const gotImages = tempGotDiv.querySelectorAll(RESOURCE_STRING);

            // Count gave resources
            gaveImages.forEach(img => {
              const resourceType = getResourceTypeFromAlt(
                img.getAttribute('alt')
              );
              if (resourceType) {
                gaveResources[resourceType] =
                  (gaveResources[resourceType] || 0) + 1;
              }
            });

            // Count got resources
            gotImages.forEach(img => {
              const resourceType = getResourceTypeFromAlt(
                img.getAttribute('alt')
              );
              if (resourceType) {
                gotResources[resourceType] =
                  (gotResources[resourceType] || 0) + 1;
              }
            });

            // Apply trade to both players
            if (
              Object.keys(gaveResources).length > 0 &&
              Object.keys(gotResources).length > 0
            ) {
              // Update player who initiated trade (loses gave resources, gains got resources)
              const playerChanges: Partial<ResourceObjectType> = {};
              Object.keys(gaveResources).forEach(resource => {
                const key = resource as keyof ResourceObjectType;
                playerChanges[key] = -(gaveResources[key] || 0);
              });
              Object.keys(gotResources).forEach(resource => {
                const key = resource as keyof ResourceObjectType;
                playerChanges[key] =
                  (playerChanges[key] || 0) + (gotResources[key] || 0);
              });
              updateResources(playerName, playerChanges);

              // Update trade partner (gains gave resources, loses got resources)
              const partnerChanges: Partial<ResourceObjectType> = {};
              Object.keys(gaveResources).forEach(resource => {
                const key = resource as keyof ResourceObjectType;
                partnerChanges[key] = gaveResources[key] || 0;
              });
              Object.keys(gotResources).forEach(resource => {
                const key = resource as keyof ResourceObjectType;
                partnerChanges[key] =
                  (partnerChanges[key] || 0) - (gotResources[key] || 0);
              });
              updateResources(tradePartner, partnerChanges);

              console.log(
                `🤝 ${playerName} traded ${JSON.stringify(gaveResources)} for ${JSON.stringify(gotResources)} with ${tradePartner}`
              );
            }
          }
        }
      }
    }
  }
  // Scenario 5: Get resources (keyword: "got")
  else if (messageText.includes('got')) {
    if (playerName) {
      ensurePlayerExists(playerName);
      const gotResources = getResourcesFromImages(element, RESOURCE_STRING);
      updateResources(playerName, gotResources);
      console.log(
        `🌾 ${playerName} got resources: ${JSON.stringify(gotResources)}`
      );
    }
  }
  // Scenario 6: Steal known (keyword: "stole" and "from")
  else if (messageText.includes('stole') && messageText.includes('from')) {
    const stolenResource = getResourceType(element);
    if (stolenResource) {
      const victimSpan = element.querySelector(
        'span[style*="font-weight:600"]'
      );
      const victim = victimSpan?.textContent || null;
      if (victim && playerName) {
        updateResources(playerName, { [stolenResource]: 1 } as any);
        updateResources(victim, { [stolenResource]: -1 } as any);
        console.log(`🦹 ${playerName} stole ${stolenResource} from ${victim}`);
      }
    }
  }
  // Scenario 7: Buy dev card (keyword: "bought" + development card image)
  else if (
    messageText.includes('bought') &&
    element.querySelector('img[alt="development card"]')
  ) {
    if (playerName) {
      ensurePlayerExists(playerName);
      game.devCards--;
      // Cost: 1 wheat, 1 sheep, 1 ore
      updateResources(playerName, { wheat: -1, sheep: -1, ore: -1 });
      console.log(
        `🃏 ${playerName} bought a development card. Remaining dev cards: ${game.devCards}`
      );
    }
  }
  // Scenario 8: Bank trade (keyword: "gave bank" and "took")
  else if (messageText.includes('gave bank') && messageText.includes('took')) {
    if (playerName) {
      const resourceImages = element.querySelectorAll(RESOURCE_STRING);
      const gaveResources = getResourcesFromImages(element, RESOURCE_STRING);

      // The last image is what they took, everything before is what they gave
      if (resourceImages.length > 1) {
        const tookImage = resourceImages[resourceImages.length - 1];
        const tookType = getResourceTypeFromAlt(tookImage.getAttribute('alt'));

        if (tookType) {
          // Remove what they took from the gave count
          gaveResources[tookType]--;

          // Update player resources (negative for gave, positive for took)
          const playerChanges = { ...gaveResources };
          Object.keys(playerChanges).forEach(key => {
            playerChanges[key as keyof ResourceObjectType] *= -1;
          });
          playerChanges[tookType] = 1;

          updateResources(playerName, playerChanges);

          console.log(
            `🏦 ${playerName} traded with bank: gave ${JSON.stringify(gaveResources)}, got ${tookType}`
          );
        }
      }
    }
  }
  // Scenario 9: Used knight (keyword: "used" + "Knight")
  else if (messageText.includes('used') && messageText.includes('Knight')) {
    if (playerName) {
      ensurePlayerExists(playerName);
      const player = game.players.find(p => p.name === playerName);
      if (player) {
        player.knights++;
        player.discoveryCards.knights--;
        console.log(
          `⚔️ ${playerName} used a knight. Total knights played: ${player.knights}`
        );
      }
    }
  }
  // Scenario 10: Buy settlement (keyword: "built a" + settlement image)
  else if (
    messageText.includes('built a') &&
    element.querySelector('img[alt="settlement"]')
  ) {
    if (playerName) {
      ensurePlayerExists(playerName);
      const player = game.players.find(p => p.name === playerName);
      if (player) {
        // Cost: 1 wood, 1 wheat, 1 brick, 1 sheep
        updateResources(playerName, {
          tree: -1,
          wheat: -1,
          brick: -1,
          sheep: -1,
        });
        player.settlements--;
        player.victoryPoints++;
        console.log(
          `🏠 ${playerName} built a settlement. VP: ${player.victoryPoints}, Remaining settlements: ${player.settlements}`
        );
      }
    }
  }
  // Scenario 11: Buy city (keyword: "built a" + city image)
  else if (
    messageText.includes('built a') &&
    element.querySelector('img[alt="city"]')
  ) {
    if (playerName) {
      ensurePlayerExists(playerName);
      const player = game.players.find(p => p.name === playerName);
      if (player) {
        updateResources(playerName, { ore: -3, wheat: -2 });
        player.cities--;
        player.settlements++; // City replaces settlement
        player.victoryPoints++;
        console.log(
          `🏰 ${playerName} built a city. VP: ${player.victoryPoints}, Remaining cities: ${player.cities}`
        );
      }
    }
  }
  // Scenario 12: Buy road (keyword: "built a" + road image)
  else if (
    messageText.includes('built a') &&
    element.querySelector('img[alt="road"]')
  ) {
    if (playerName) {
      ensurePlayerExists(playerName);
      const player = game.players.find(p => p.name === playerName);
      if (player) {
        // Cost: 1 wood, 1 brick
        updateResources(playerName, { tree: -1, brick: -1 });
        player.roads--;
        console.log(
          `🛣️ ${playerName} built a road. Remaining roads: ${player.roads}`
        );
      }
    }
  }
  // Scenario 13: Moved robber (keyword: "moved Robber")
  else if (messageText.includes('moved Robber')) {
    if (playerName) {
      ensurePlayerExists(playerName);
      const player = game.players.find(p => p.name === playerName);
      if (player) {
        player.totalRobbers++;
        console.log(
          `🔒 ${playerName} moved the robber. Total robber moves: ${player.totalRobbers}`
        );
      }
    }
  }
  // Scenario 14: Used Year of Plenty (keyword: "used" + "Year of Plenty")
  else if (
    messageText.includes('used') &&
    messageText.includes('Year of Plenty')
  ) {
    if (playerName) {
      ensurePlayerExists(playerName);
      const player = game.players.find(p => p.name === playerName);
      if (player) {
        game.yearOfPlenties--;
        player.discoveryCards.yearOfPlenties--;
        console.log(
          `🎯 ${playerName} used Year of Plenty. Remaining: ${game.yearOfPlenties}`
        );
      }
    }
  }
  // Scenario 15: Year of Plenty cards taken (keyword: "took from bank")
  else if (messageText.includes('took from bank')) {
    if (playerName) {
      ensurePlayerExists(playerName);
      const takenResources = getResourcesFromImages(element, RESOURCE_STRING);

      // Add resources to player (and remove from bank automatically)
      updateResources(playerName, takenResources);

      console.log(
        `🎯 ${playerName} took from bank via Year of Plenty: ${JSON.stringify(takenResources)}`
      );
    }
  }
  // Scenario 16: Used Road Building (keyword: "used" + "Road Building")
  else if (
    messageText.includes('used') &&
    messageText.includes('Road Building')
  ) {
    if (playerName) {
      ensurePlayerExists(playerName);
      const player = game.players.find(p => p.name === playerName);
      if (player) {
        game.roadBuilders--;
        player.discoveryCards.roadBuilders--;
        console.log(
          `🛣️ ${playerName} used Road Building. Remaining: ${game.roadBuilders}`
        );
      }
    }
  }
  // Scenario 17: Used Monopoly (keyword: "used" + "Monopoly")
  else if (messageText.includes('used') && messageText.includes('Monopoly')) {
    if (playerName) {
      ensurePlayerExists(playerName);
      const player = game.players.find(p => p.name === playerName);
      if (player) {
        game.monopolies--;
        player.discoveryCards.monopolies--;
        console.log(
          `💰 ${playerName} used Monopoly. Remaining: ${game.monopolies}`
        );
      }
    }
  }
  // Scenario 18: Monopoly cards stolen (keyword: "stole" + number)
  else if (messageText.includes('stole') && /stole \d+/.test(messageText)) {
    if (playerName) {
      ensurePlayerExists(playerName);
      const player = game.players.find(p => p.name === playerName);
      const resourceType = getResourceType(element);

      if (player && resourceType) {
        // Extract the number of cards stolen
        const match = messageText.match(/stole (\d+)/);
        const stolenCount = match ? parseInt(match[1]) : 0;

        if (stolenCount > 0) {
          // Add stolen resources to monopoly player
          updateResources(playerName, { [resourceType]: stolenCount });

          // Remove resources from all other players for this resource type
          game.players.forEach(otherPlayer => {
            if (otherPlayer.name !== playerName) {
              otherPlayer.resources[resourceType] = 0;
            }
          });

          console.log(
            `💰 ${playerName} monopolized ${stolenCount} ${resourceType} from all players`
          );
        }
      }
    }
  }
  // Scenario 19: Starting resources (keyword: "received starting resources")
  else if (messageText.includes('received starting resources')) {
    if (playerName) {
      ensurePlayerExists(playerName);
      const startingResources = getResourcesFromImages(
        element,
        RESOURCE_STRING
      );

      // Add starting resources to player (and remove from bank automatically)
      updateResources(playerName, startingResources);

      console.log(
        `🏁 ${playerName} received starting resources: ${JSON.stringify(startingResources)}`
      );
    }
  }
  // Scenario 20: Disconnection messages (ignore)
  else if (
    messageText.includes('has disconnected') ||
    messageText.includes('will take over')
  ) {
    console.log(`🔌 Player disconnection message (ignored)`);
  }
  // Scenario 21: Reconnection messages (ignore)
  else if (messageText.includes('has reconnected')) {
    console.log(`🔌 Player reconnection message (ignored)`);
  }
  // Scenario 22: Robber blocking messages (ignore)
  else if (
    messageText.includes('is blocked by the Robber') ||
    messageText.includes('No resources produced')
  ) {
    console.log(`🚫 Robber blocking message (ignored)`);
  }
  // Scenario 23: Wants to give (ignore - no actual trade happens)
  else if (messageText.includes('wants to give')) {
    // Ignore these messages as they don't represent actual trades
    console.log(`💭 ${playerName} wants to trade (ignored - no actual trade)`);
  }
  // Scenario 24: Discards (keyword: "discarded")
  else if (messageText.includes('discarded')) {
    if (playerName) {
      ensurePlayerExists(playerName);
      const discardedResources = getResourcesFromImages(
        element,
        RESOURCE_STRING
      );

      // Remove resources from player (negative values, automatically adds to bank)
      const playerChanges: Partial<ResourceObjectType> = {};

      Object.keys(discardedResources).forEach(resource => {
        const key = resource as keyof ResourceObjectType;
        const count = discardedResources[key];
        if (count > 0) {
          playerChanges[key] = -count;
        }
      });

      updateResources(playerName, playerChanges);

      console.log(
        `🗑️ ${playerName} discarded resources: ${JSON.stringify(discardedResources)}`
      );
    }
  }
  // Scenario 25: Ignore hr elements
  else if (element.querySelector('hr')) {
  }
  // Log any unknown messages
  else {
    console.log('💬💬💬  New unknown message:', element);
  }

  console.log('🎲 Game object:', game);
  updateGameStateDisplay();
} 