import { describe, it, expect, beforeEach } from '@jest/globals';
import { updateGameFromChat } from '../chatParser';
import { resetGameState, game, setYouPlayerForTesting } from '../gameState';
import { readFileSync } from 'fs';
import { join } from 'path';

// //todo fix this test
// describe('Chat Parser Integration - Steal Tracker Scenario', () => {
//   beforeEach(() => {
//     resetGameState();
//     // Set "you" player for testing to bypass the selection dialog
//     setYouPlayerForTesting('NickTheSwift');
//   });

//   it('should parse the steal tracker HTML scenario and produce correct final game state', () => {
//     // Load the HTML file
//     const htmlPath = join(__dirname, 'scenarios', 'stealTracker.html');
//     const htmlContent = readFileSync(htmlPath, 'utf-8');
    
//     // Create a DOM from the HTML
//     document.body.innerHTML = htmlContent;
    
//     // Get body -> first div -> all children in DOM order
//     const firstDiv = document.body.firstElementChild as HTMLElement;
//     if (firstDiv) {
//       // Process each child element in DOM order
//       Array.from(firstDiv.children).forEach(element => {
//         if (element.querySelector('span')) {
//           updateGameFromChat(element as HTMLElement);
//         }
//       });
//     }
    
//     // Debug: Log the game state
//     console.log('Players found:', game.players.map(p => p.name));
//     console.log('Total players:', game.players.length);
//     console.log('Game resources:', game.gameResources);
    
//     // Find players by name
//     const nickTheSwift = game.players.find(p => p.name === 'NickTheSwift');
//     const madel = game.players.find(p => p.name === 'Madel');
//     const ahab = game.players.find(p => p.name === 'Ahab');
//     const canada = game.players.find(p => p.name === 'Canada');
    
//     // Verify expected final game state
//     // NickTheSwift should have: 1 wheat (100% probability)
//     expect(nickTheSwift).toBeDefined();
//     expect(nickTheSwift!.resources.wheat).toBe(1);
//     expect(nickTheSwift!.resourceProbabilities.wheat).toBe(0);
//     expect(nickTheSwift!.resources.brick).toBe(0);
//     expect(nickTheSwift!.resources.tree).toBe(0);
//     expect(nickTheSwift!.resources.sheep).toBe(0);
//     expect(nickTheSwift!.resources.ore).toBe(0);
    
//     // Madel should have: 1 brick (100% probability)
//     expect(madel).toBeDefined();
//     expect(madel!.resources.brick).toBe(1);
//     expect(madel!.resourceProbabilities.brick).toBe(0);
//     expect(madel!.resources.wheat).toBe(0);
//     expect(madel!.resources.tree).toBe(0);
//     expect(madel!.resources.sheep).toBe(0);
//     expect(madel!.resources.ore).toBe(0);
    
//     // Ahab should have: 1 sheep, 4 wheat, 1 tree, 1 ore (various probabilities)
//     expect(ahab).toBeDefined();
//     const ahabTotal = ahab!.resources.sheep + ahab!.resourceProbabilities.sheep +
//                      ahab!.resources.wheat + ahab!.resourceProbabilities.wheat +
//                      ahab!.resources.tree + ahab!.resourceProbabilities.tree +
//                      ahab!.resources.ore + ahab!.resourceProbabilities.ore;
//     expect(ahabTotal).toBeCloseTo(7, 1); // 1 sheep + 4 wheat + 1 tree + 1 ore = 7 total
    
//     // Canada should have: 2 sheep, 2 wheat, 1 ore (various probabilities)  
//     expect(canada).toBeDefined();
//     const canadaTotal = canada!.resources.sheep + canada!.resourceProbabilities.sheep +
//                        canada!.resources.wheat + canada!.resourceProbabilities.wheat +
//                        canada!.resources.ore + canada!.resourceProbabilities.ore +
//                        canada!.resources.tree + canada!.resourceProbabilities.tree +
//                        canada!.resources.brick + canada!.resourceProbabilities.brick;
//     expect(canadaTotal).toBeCloseTo(5, 1); // 2 sheep + 2 wheat + 1 ore = 5 total
    
//     // Bank should have: 17 ore, 17 sheep, 12 wheat, 18 brick, 18 wood
//     expect(game.gameResources.ore).toBe(17);
//     expect(game.gameResources.sheep).toBe(17);
//     expect(game.gameResources.wheat).toBe(12);
//     expect(game.gameResources.brick).toBe(18);
//     expect(game.gameResources.tree).toBe(18); // 'wood' is called 'tree' in the type
    
//     // Verify no unknown transactions remain unresolved
//     expect(game.unknownTransactions.filter((t: any) => !t.isResolved)).toHaveLength(0);
//   });
// }); 

// can we make a scenario for the intitialResource.html?

describe('Chat Parser Integration - Initial Resources Scenario', () => {
  beforeEach(() => {
    resetGameState();
    // Set "you" player for testing to bypass the selection dialog
    setYouPlayerForTesting('NickTheSwift');
  });

  it('should parse the initial resources HTML scenario and produce correct final game state', () => {
    // Load the HTML file
    const htmlPath = join(__dirname, 'scenarios', 'initialResources.html');
    const htmlContent = readFileSync(htmlPath, 'utf-8');
    
    // Create a DOM from the HTML
    document.body.innerHTML = htmlContent;
    
    // Get body -> first div -> all children in DOM order
    const firstDiv = document.body.firstElementChild as HTMLElement;
    if (firstDiv) {
      // Process each child element in DOM order
      Array.from(firstDiv.children).forEach(element => {
        updateGameFromChat(element as HTMLElement);
      });
    }
    
    // Debug: Log the game state
    console.log('Players found:', game.players.map(p => p.name));
    console.log('Total players:', game.players.length);
    console.log('Game resources:', game.gameResources);
    
    // Find players by name
    const nickTheSwift = game.players.find(p => p.name === 'NickTheSwift');
    const madel = game.players.find(p => p.name === 'Madel');
    const ahab = game.players.find(p => p.name === 'Ahab');
    const canada = game.players.find(p => p.name === 'Canada');
    
    // Verify expected final game state based on HTML comment:
    // NickTheSwift 1 wheat, 1 brick, 1 ore
    expect(nickTheSwift).toBeDefined();
    expect(nickTheSwift!.resources.wheat).toBe(1);
    expect(nickTheSwift!.resources.brick).toBe(1);
    expect(nickTheSwift!.resources.ore).toBe(1);
    expect(nickTheSwift!.resources.sheep).toBe(0);
    expect(nickTheSwift!.resources.tree).toBe(0);
    
    // Madel 1 brick, 1 tree
    expect(madel).toBeDefined();
    expect(madel!.resources.brick).toBe(1);
    expect(madel!.resources.tree).toBe(1);
    expect(madel!.resources.wheat).toBe(0);
    expect(madel!.resources.sheep).toBe(0);
    expect(madel!.resources.ore).toBe(0);
    
    // Ahab 1 tree, 1 wheat
    expect(ahab).toBeDefined();
    expect(ahab!.resources.tree).toBe(1);
    expect(ahab!.resources.wheat).toBe(1);
    expect(ahab!.resources.brick).toBe(0);
    expect(ahab!.resources.sheep).toBe(0);
    expect(ahab!.resources.ore).toBe(0);
    
    // Canada 1 sheep, 1 wheat
    expect(canada).toBeDefined();
    expect(canada!.resources.sheep).toBe(1);
    expect(canada!.resources.wheat).toBe(1);
    expect(canada!.resources.brick).toBe(0);
    expect(canada!.resources.tree).toBe(0);
    expect(canada!.resources.ore).toBe(0);
    
    // Bank should have: 18 ore, 18 sheep, 16 wheat, 17 brick, 17 wood
    expect(game.gameResources.ore).toBe(18);
    expect(game.gameResources.sheep).toBe(18);
    expect(game.gameResources.wheat).toBe(16);
    expect(game.gameResources.brick).toBe(17);
    expect(game.gameResources.tree).toBe(17);
  });
}); 