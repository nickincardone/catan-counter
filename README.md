# Catan Counter Chrome Extension

A Chrome extension that automatically tracks game state for Settlers of Catan games played on [colonist.io](https://colonist.io). The extension monitors chat messages and maintains a real-time count of resources, development cards, dice rolls, and player statistics.

## Features

### 🎲 **Game State Tracking**

- **Player Resources**: Tracks wheat, sheep, brick, wood, and ore for all players
- **Development Cards**: Monitors knights, victory points, year of plenty, road builders, and monopolies
- **Dice Rolls**: Records frequency of all dice roll results (2-12)
- **Building Counts**: Tracks settlements, cities, and roads remaining for each player
- **Victory Points**: Monitors VP progress for all players

### 📊 **Enhanced User Interface**

- **Modern Overlay**: Clean, organized display with resource tables and dice roll charts
- **Draggable & Resizable**: Move and scale the overlay to your preference
- **Minimize/Maximize**: Collapse to header-only for minimal screen usage
- **Responsive Tables**: Color-coded resource tracking with remaining bank resources
- **Interactive Charts**: Visual dice roll frequency with statistical bars

### 🎯 **Smart Player Identification**

- **"You" Player Setup**: One-time dialog to identify your player for accurate tracking
- **Automatic Detection**: Triggers on first dice roll when all players are loaded
- **Message Reprocessing**: Re-analyzes all chat history once your identity is known
- **Enhanced Theft Tracking**: Properly handles "stole [resource] from you" messages

### 📊 **Real-time Monitoring**

- **Live Updates**: Game state updates automatically as chat messages appear
- **Page Refresh Support**: Processes existing chat history when page is refreshed
- **Intelligent Processing**: Pauses during setup, then reprocesses for accuracy
- **Comprehensive Logging**: Detailed console output for debugging

### 🎯 **Supported Game Events**

- Resource collection from dice rolls
- Building placement (settlements, cities, roads)
- Development card purchases and usage
- Player-to-player trades
- Bank trades (4:1 and port trades)
- Resource stealing (robber and knight)
- **"From you" theft tracking** (requires player identification)
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

#### Testing Scripts

- **`npm test`** - Run all tests with Jest
- **`npm run test:watch`** - Run tests in watch mode (auto-rerun on changes)
- **`npm run test:coverage`** - Run tests and generate coverage report
- **`npm run test:ci`** - Run tests in CI mode (no watch, with coverage)
- **`npm run test:update`** - Update Jest snapshots

### Development Workflow

1. **Start development mode**

   ```bash
   npm run dev
   ```

2. **Make changes** to any TypeScript files in the `src/` directory

3. **Run tests** to ensure your changes work correctly

   ```bash
   npm test
   ```

4. **Reload extension** in Chrome (click refresh icon on extension card)

5. **Test on colonist.io** by starting or joining a game

### Testing

The project uses Jest 30.0.2 with TypeScript support for comprehensive testing.

#### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (reruns on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests in CI mode
npm run test:ci
```

#### Test Structure

- **`src/__tests__/`** - Contains all test files
- **`gameState.test.ts`** - Tests for game state management and unknown transaction system
- **`chatParser.simple.test.ts`** - Tests for chat parsing logic and message identification
- **`jest.config.js`** - Jest configuration with TypeScript support
- **`jest.setup.ts`** - Test environment setup with DOM mocking

#### Writing Tests

- Tests use TypeScript with Jest globals (`@jest/globals`)
- DOM environment is mocked for browser extension testing
- Game state functions are thoroughly tested including the probabilistic unknown transaction system
- Coverage targets: 80% for branches, functions, lines, and statements

#### Unknown Transaction Testing

The test suite includes comprehensive testing of the probabilistic resource tracking system:

- **Unknown steal creation** and probability calculation
- **Transaction resolution** when players use resources they shouldn't have
- **Multiple steal scenarios** and resolution priority
- **Real-world scenarios** matching the user's example cases

## Usage

1. **Navigate to colonist.io** and start/join a Catan game

2. **Extension activates automatically** when it detects a game chat

3. **Player identification setup** - On the first dice roll, a dialog will appear asking you to identify which player you are. This enables accurate tracking of "from you" messages.

4. **View game state** in the enhanced overlay that appears in the top-right corner

5. **Interact with the overlay**:
   - **Drag** the header to move the overlay
   - **Minimize** using the (−) button to collapse to header only
   - **Resize** by dragging the bottom-right corner to scale proportionally
6. **Monitor real-time updates** as the game progresses

### Game State Display

The overlay features an organized, visual layout with:

#### 📋 **Resource Table**

- **Player rows** showing current resource counts for each player
- **Header columns** with resource emojis (🐑🌾🧱🌲⛰️) and remaining bank resources
- **Color-coded cells** for easy resource identification

#### 📊 **Dice Roll Chart**

- **Visual bar graph** showing frequency of each dice roll (2-12)
- **Roll counts** displayed above each bar
- **Color coding**: Red for 7, teal for 6&8, blue for others

#### 🎛️ **Interactive Controls**

- **Header bar** for dragging and minimizing
- **Resize handle** in bottom-right corner for proportional scaling
- **Minimize button** to collapse to header-only view

## Technical Details

### Architecture

- **Modular TypeScript**: Organized into separate modules for maintainability
- **Rollup Bundling**: Multiple TypeScript files compiled into single JavaScript output
- **Content Script**: Injected into colonist.io pages
- **Chat Monitoring**: Uses MutationObserver to detect new messages
- **Pattern Matching**: Analyzes chat messages and HTML structure
- **State Management**: Maintains game state in memory with automatic persistence

### Message Processing

The extension recognizes 25+ different game scenarios including:

- Building placement and purchases
- Resource collection and trading
- Development card usage
- **Player theft scenarios** (including "from you" messages)
- Special game events (robber movement, discarding, etc.)

### Smart Reprocessing System

- **Player Detection**: Automatically identifies when player setup is needed
- **Processing Pause**: Stops processing new messages during player identification
- **Complete Reanalysis**: Re-examines all chat history with "you" player context
- **Accurate Attribution**: Ensures proper resource tracking for all theft events

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
│   ├── chatParser.ts       # Chat message parsing logic
│   └── __tests__/          # Test files directory
│       ├── gameState.test.ts        # Game state management tests
│       └── chatParser.simple.test.ts # Chat parser logic tests
├── manifest.json           # Chrome extension manifest
├── overlay.css            # Styling for game overlay
├── content.js             # Bundled JavaScript output (generated)
├── rollup.config.js       # Rollup bundler configuration
├── jest.config.js         # Jest testing configuration
├── jest.setup.ts          # Test environment setup
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
