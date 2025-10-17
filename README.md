# WarFaire

A strategic card game about showcasing produce and baked goods across a series of State Fairs.

## About

State Fair (working title) is a card game where players compete to win ribbons in multiple categories that belong to groups. Players must balance short-term wins with long-term strategy, as categories rise and fall in prestige between Fairs.

See [GDD.md](./GDD.md) for the complete Game Design Document.

## Quick Start

### Prerequisites

- Node.js (v14 or higher)

### Installation

```bash
npm install
```

### Running the Game

Run a test game with 2 Fairs (default):

```bash
npm start
```

Run a game with a custom number of Fairs:

```bash
node index.js 3
```

## Project Structure

- `GDD.md` - Complete Game Design Document
- `index.js` - Game runner and entry point
- `game.js` - Main game logic and Fair management
- `card.js` - Card, Category, and Group definitions
- `player.js` - Player class and state management
- `scorer.js` - Scoring and ribbon award logic
- `package.json` - Node.js package configuration

## Game Components

- **12 Categories** across 3 Groups (Produce, Baking, Livestock)
- **13 Value Cards** per category (2,2,2,2,3,3,3,3,4,4,5,5,6)
- **Group Cards** - Wild cards that can be played in any category within their group
- **Ribbons** - Gold (2 VP), Silver (1 VP), Bronze (0 VP) - values increase with category prestige
- **Progressive Prestige** - Popular categories become more valuable over time

## Current Implementation Status

This is a JavaScript prototype implementing the core game mechanics:

- ✅ Card system with categories and groups
- ✅ Player management (4-10 players)
- ✅ Round structure (3 rounds per Fair)
- ✅ Face-down card system (forward planning)
- ✅ Scoring system with ribbons
- ✅ Progressive category prestige
- ✅ Category rotation (for < 10 players)
- ✅ Group scoring

### Not Yet Implemented

- Interactive player decisions (currently random AI)
- UI/Graphics
- Multiplayer networking
- Advanced variants from GDD
- Save/load game state

## Development

The current prototype uses random card selection for automated testing. To implement interactive gameplay, modify the card selection logic in `game.js` (playRound method).

## License

MIT
