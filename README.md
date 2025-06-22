# Catan Counter Chrome Extension

A Chrome extension that automatically tracks game state for Settlers of Catan games played on [colonist.io](https://colonist.io). The extension monitors chat messages and maintains a real-time count of resources, development cards, dice rolls, and player statistics.

## Features

### 🎲 **Game State Tracking**
- **Player Resources**: Tracks wheat, sheep, brick, wood, and ore for all players
- **Development Cards**: Monitors knights, victory points, year of plenty, road builders, and monopolies
- **Dice Rolls**: Records frequency of all dice roll results (2-12)
- **Building Counts**: Tracks settlements, cities, and roads remaining for each player
- **Victory Points**: Monitors VP progress for all players

### 📊 **Real-time Monitoring**
- **Live Updates**: Game state updates automatically as chat messages appear
- **Draggable Overlay**: Visual display of current game state in JSON format
- **Page Refresh Support**: Processes existing chat history when page is refreshed
- **Comprehensive Logging**: Detailed console output for debugging

### 🎯 **Supported Game Events**
- Resource collection from dice rolls
- Building placement (settlements, cities, roads)
- Development card purchases and usage
- Player-to-player trades
- Bank trades (4:1 and port trades)
- Resource stealing (robber and knight)
- Development card effects (Year of Plenty, Monopoly, Road Building)
- Resource discarding
- Starting resource distribution

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm
- Google Chrome browser

### Setup
1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd catan-counter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select the `catan-counter` folder

## Development

### Available Scripts

- **`npm run build`** - Bundle TypeScript modules into single JavaScript file using Rollup
- **`npm run watch`** - Watch for TypeScript changes and auto-bundle
- **`npm run format`** - Format all files with Prettier
- **`npm run format:check`** - Check if files are properly formatted
- **`npm run dev`** - Development mode: auto-format and bundle on file changes

### Development Workflow
1. **Start development mode**
   ```bash
   npm run dev
   ```

2. **Make changes** to any TypeScript files in the `src/` directory

3. **Reload extension** in Chrome (click refresh icon on extension card)

4. **Test on colonist.io** by starting or joining a game

## Usage

1. **Navigate to colonist.io** and start/join a Catan game

2. **Extension activates automatically** when it detects a game chat

3. **View game state** in the draggable overlay that appears in the top-right corner

4. **Monitor real-time updates** as the game progresses

### Game State Display
The overlay shows a JSON object containing:
```json
{
  "players": [
    {
      "name": "PlayerName",
      "resources": { "sheep": 2, "wheat": 1, "brick": 0, "tree": 3, "ore": 1 },
      "settlements": 3,
      "cities": 4,
      "roads": 12,
      "victoryPoints": 4,
      "knights": 1,
      "totalRobbers": 2
    }
  ],
  "gameResources": { "sheep": 17, "wheat": 18, "brick": 19, "tree": 16, "ore": 18 },
  "diceRolls": { "2": 0, "3": 1, "4": 2, "5": 3, "6": 4, "7": 2, "8": 3, "9": 2, "10": 1, "11": 1, "12": 0 },
  "devCards": 22
}
```

## Technical Details

### Architecture
- **Modular TypeScript**: Organized into separate modules for maintainability
- **Rollup Bundling**: Multiple TypeScript files compiled into single JavaScript output
- **Content Script**: Injected into colonist.io pages
- **Chat Monitoring**: Uses MutationObserver to detect new messages
- **Pattern Matching**: Analyzes chat messages and HTML structure
- **State Management**: Maintains game state in memory with automatic persistence

### Message Processing
The extension recognizes 24+ different game scenarios including:
- Building placement and purchases
- Resource collection and trading
- Development card usage
- Special game events (robber movement, discarding, etc.)

### Modular Architecture
The codebase is organized into focused modules for better maintainability:

- **`types.ts`** - All TypeScript interface definitions and type declarations
- **`gameState.ts`** - Game state initialization, player management, and resource tracking
- **`domUtils.ts`** - DOM element querying, resource parsing, and utility functions
- **`overlay.ts`** - Draggable game state overlay UI with drag-and-drop functionality
- **`chatParser.ts`** - Core chat message parsing logic handling 24+ game scenarios
- **`content.ts`** - Main entry point, initialization, and mutation observer setup

All modules are bundled into a single `content.js` file using Rollup for optimal browser performance.

### Browser Compatibility
- Chrome (primary target)
- Other Chromium-based browsers (Edge, Brave, etc.)

## Project Structure

```
catan-counter/
├── src/
│   ├── content.ts          # Main entry point and initialization
│   ├── types.ts            # TypeScript interface definitions
│   ├── gameState.ts        # Game state management and utilities
│   ├── domUtils.ts         # DOM querying and utility functions
│   ├── overlay.ts          # Draggable overlay UI functionality
│   └── chatParser.ts       # Chat message parsing logic
├── manifest.json           # Chrome extension manifest
├── overlay.css            # Styling for game overlay
├── content.js             # Bundled JavaScript output (generated)
├── rollup.config.js       # Rollup bundler configuration
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── .prettierrc            # Code formatting rules
├── .prettierignore        # Files to ignore in formatting
└── README.md              # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run formatting (`npm run format`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is licensed under the ISC License - see the package.json file for details.

## Disclaimer

This extension is designed for educational and analytical purposes. It does not provide any unfair advantage in gameplay and only tracks information that is already visible in the game chat. 