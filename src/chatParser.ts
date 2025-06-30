import {
  getDiceRollTotal,
  getPlayerColor,
  getPlayerName,
  getResourcesFromImages,
  getResourceType,
  getStealVictim,
  getTradePartner,
  parseBankTrade,
  parseCounterOfferResources,
  parseTradeResources,
  RESOURCE_STRING,
  getBlockedDiceNumber,
  getBlockedResourceType,
} from './domUtils.js';
import {
  bankTrade,
  buildCity,
  buildRoad,
  buildSettlement,
  buyDevCard,
  knownSteal,
  monopolySteal,
  moveRobber,
  placeInitialRoad,
  placeSettlement,
  playerDiscard,
  playerGetResources,
  playerOffer,
  playerTrade,
  receiveStartingResources,
  rollDice,
  stealFromYou,
  unknownSteal,
  useKnight,
  useMonopoly,
  useRoadBuilding,
  useYearOfPlenty,
  yearOfPlentyTake,
  blockedDiceRoll,
} from './gameActions.js';
import { game, isWaitingForYouPlayerSelection } from './gameState.js';
import { updateGameStateDisplay } from './overlay.js';
import { ResourceObjectType } from './types.js';

/**
 * Check if an element should be ignored (not processed)
 */
function ignoreElement(element: HTMLElement, messageText: string): boolean {
  return (
    // Disconnection messages
    messageText.includes('has disconnected') ||
    messageText.includes('will take over') ||
    // Reconnection messages
    messageText.includes('has reconnected') ||
    // HR elements
    element.querySelector('hr') !== null ||
    // Learn how to play messages
    messageText.includes('Learn how to play')
  );
}

export function updateGameFromChat(element: HTMLElement): void {
  // If we're waiting for "you" player selection, don't process new messages
  if (isWaitingForYouPlayerSelection) return;

  const messageText = element.textContent?.replace(/\s+/g, ' ').trim() || '';

  if (ignoreElement(element, messageText)) return;

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

  // Scenario 0: Handle "[Player] stole [resource] from you" scenario
  if (messageText.includes('stole') && messageText.includes('from you')) {
    const stolenResource = getResourceType(element);
    if (stolenResource) {
      stealFromYou(playerName, game.youPlayerName, stolenResource);
    }
  }
  // Scenario 1: Place settlement (keyword: "placed a")
  else if (
    messageText.includes('placed a') &&
    element.querySelector('img[alt="settlement"]')
  ) {
    placeSettlement(playerName, getPlayerColor(element));
  }
  // Scenario 2: Roll dice (keyword: "rolled")
  else if (messageText.includes('rolled')) {
    const diceTotal = getDiceRollTotal(element);
    if (diceTotal) {
      rollDice(diceTotal);
    }
  }
  // Scenario 2.5: Blocked dice (keyword: "is blocked by the Robber")
  else if (messageText.includes('blocked by the Robber')) {
    const diceNumber = getBlockedDiceNumber(element);
    const resourceType = getBlockedResourceType(element);

    if (diceNumber !== null && resourceType) {
      blockedDiceRoll(diceNumber, resourceType);
    }
  }
  // Scenario 3: Place road (keyword: "placed a" + road image)
  else if (
    messageText.includes('placed a') &&
    element.querySelector('img[alt="road"]')
  ) {
    placeInitialRoad(playerName);
  }
  // Scenario 4: Known trade (keyword: "gave" and "got" and "from")
  else if (
    messageText.includes('gave') &&
    messageText.includes('got') &&
    messageText.includes('from')
  ) {
    const tradePartner = getTradePartner(element);
    const tradeData = parseTradeResources(element);

    if (tradeData) {
      // Calculate net resource changes for the 1stplayer (negative for gave, positive for got)
      const resourceChanges: Partial<ResourceObjectType> = {};

      // Add what they gave (negative values)
      Object.entries(tradeData.gave).forEach(([resource, count]) => {
        if (count && count > 0) {
          resourceChanges[resource as keyof ResourceObjectType] = -count;
        }
      });

      // Add what they got (positive values)
      Object.entries(tradeData.got).forEach(([resource, count]) => {
        if (count && count > 0) {
          resourceChanges[resource as keyof ResourceObjectType] =
            (resourceChanges[resource as keyof ResourceObjectType] || 0) +
            count;
        }
      });

      playerTrade(playerName, tradePartner, resourceChanges);
    }
  }
  // Scenario 5: Get resources (keyword: "got")
  else if (messageText.includes('got')) {
    const gotResources = getResourcesFromImages(element, RESOURCE_STRING);
    playerGetResources(playerName, gotResources);
  }
  // Scenario 6: Steal (keyword: "stole" and "from")
  else if (messageText.includes('stole') && messageText.includes('from')) {
    const victim = getStealVictim(element);
    const stolenResource = getResourceType(element);

    stolenResource
      ? knownSteal(playerName, victim, stolenResource)
      : unknownSteal(playerName, victim);
  }
  // Scenario 7: Buy dev card (keyword: "bought" + development card image)
  else if (
    messageText.includes('bought') &&
    element.querySelector('img[alt="development card"]')
  ) {
    buyDevCard(playerName);
  }
  // Scenario 8: Bank trade (keyword: "gave bank" and "took")
  else if (messageText.includes('gave bank') && messageText.includes('took')) {
    const resourceChanges = parseBankTrade(element);
    if (resourceChanges) {
      bankTrade(playerName, resourceChanges);
    }
  }
  // Scenario 9: Used knight (keyword: "used" + "Knight")
  else if (messageText.includes('used') && messageText.includes('Knight')) {
    useKnight(playerName);
  }
  // Scenario 10: Build settlement (keyword: "built a" + settlement image)
  else if (
    messageText.includes('built a') &&
    element.querySelector('img[alt="settlement"]')
  ) {
    buildSettlement(playerName);
  }
  // Scenario 11: Build city (keyword: "built a" + city image)
  else if (
    messageText.includes('built a') &&
    element.querySelector('img[alt="city"]')
  ) {
    buildCity(playerName);
  }
  // Scenario 12: Build road (keyword: "built a" + road image)
  else if (
    messageText.includes('built a') &&
    element.querySelector('img[alt="road"]')
  ) {
    buildRoad(playerName);
  }
  // Scenario 13: Move robber (keyword: "moved Robber")
  else if (messageText.includes('moved Robber')) {
    moveRobber(playerName);
  }
  // Scenario 14: Use Year of Plenty (keyword: "used" + "Year of Plenty")
  else if (
    messageText.includes('used') &&
    messageText.includes('Year of Plenty')
  ) {
    useYearOfPlenty(playerName);
  }
  // Scenario 15: Year of Plenty take (keyword: "took from bank")
  else if (messageText.includes('took from bank')) {
    const takenResources = getResourcesFromImages(element, RESOURCE_STRING);
    yearOfPlentyTake(playerName, takenResources);
  }
  // Scenario 16: Use Road Building (keyword: "used" + "Road Building")
  else if (
    messageText.includes('used') &&
    messageText.includes('Road Building')
  ) {
    useRoadBuilding(playerName);
  }
  // Scenario 17: Use Monopoly (keyword: "used" + "Monopoly")
  else if (messageText.includes('used') && messageText.includes('Monopoly')) {
    useMonopoly(playerName);
  }
  // Scenario 18: Monopoly steal (keyword: "stole" + number)
  else if (messageText.includes('stole') && /stole \d+/.test(messageText)) {
    const resourceType = getResourceType(element);
    const match = messageText.match(/stole (\d+)/);
    const stolenCount = match ? parseInt(match[1]) : 0;

    if (resourceType && stolenCount > 0) {
      monopolySteal(playerName, resourceType, stolenCount);
    }
  }
  // Scenario 19: Starting resources (keyword: "received starting resources")
  else if (messageText.includes('received starting resources')) {
    const startingResources = getResourcesFromImages(element, RESOURCE_STRING);
    receiveStartingResources(playerName, startingResources);
  }

  // Scenario 20: Wants to give (can resolve unknown transactions)
  else if (messageText.includes('wants to give')) {
    const offeredResources = getResourcesFromImages(
      element,
      RESOURCE_STRING,
      ' for '
    );
    playerOffer(playerName, offeredResources);
  }
  // Scenario 21: Discards (keyword: "discarded")
  else if (messageText.includes('discarded')) {
    const discardedResources = getResourcesFromImages(element, RESOURCE_STRING);
    playerDiscard(playerName, discardedResources);
  }
  // Scenario 22: Proposed counter offer
  else if (messageText.includes('proposed counter offer to')) {
    const offeredResources = parseCounterOfferResources(element);
    playerOffer(playerName, offeredResources);
  }
  // Log any unknown messages
  else {
    console.log('💬💬💬  New unknown message:', element);
  }
  updateGameStateDisplay();
}
