# WarFaire → PiratePlunder Platform Integration

This guide shows how to integrate WarFaire into the PiratePlunder multi-game platform.

## Current Architecture

WarFaire is a standalone game with its own server. The PiratePlunder platform provides:
- ✅ User authentication (Google OAuth)
- ✅ Database (PostgreSQL with Prisma)
- ✅ Shared game infrastructure (`GameBase`, `GameRegistry`)
- ✅ Private package registry (Verdaccio)
- ✅ Multi-game UI shell

## Integration Workflow

```
WarFaire Repo                     Verdaccio Registry          PiratePlunder Platform
─────────────                     ──────────────────          ──────────────────────
1. Extend GameBase   ──build──>   2. Publish Package         3. Install & Register
   src/WarFaireGame.ts               @pirate/game-warfare        gameRegistry.register()
   manifest.json                     v0.1.0                      Both games in menu!
   package.json
```

## Step 1: Setup Dependencies

### Configure npm Registry

Create `.npmrc` in WarFaire root:
```
@pirate:registry=http://vps-0b87e710.tail751d97.ts.net:4873/
//vps-0b87e710.tail751d97.ts.net:4873/:_authToken="dummy-token"
```

### Install Platform Packages

```bash
npm install @pirate/game-sdk@latest
npm install @pirate/core-engine@latest
npm install typescript@latest --save-dev
npm install @types/node@latest --save-dev
```

## Step 2: Create TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowJs": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test.js", "server.js"]
}
```

## Step 3: Create Game Adapter

Create `src/WarFaireGame.ts` that wraps your existing game logic:

```typescript
import { GameBase, GameState, Seat, Player, WinnerResult } from '@pirate/game-sdk';
import { Game } from '../game.js'; // Your existing game logic

export class WarFaireGame extends GameBase {
  gameType = 'warfare';
  private warfaireInstance: Game | null = null;
  private pendingActions: Map<string, any> = new Map();
  private currentFair: number = 0;
  private currentRound: number = 0;

  constructor(io: any, tableConfig: any) {
    super(io, tableConfig);
    this.tableConfig.maxSeats = 10; // WarFaire supports up to 10 players
  }

  startHand(): void {
    if (!this.gameState) {
      console.log('🎪 Starting WarFaire game...');

      // Get player names from connected players
      const playerNames = Array.from(this.connectedPlayers.values()).map(p => p.name);

      // Initialize WarFaire game instance
      this.warfaireInstance = new Game(playerNames);
      this.currentFair = 1;
      this.currentRound = 0;

      // Setup first Fair
      this.warfaireInstance.setupFirstFair();

      // Initialize platform game state
      this.gameState = {
        phase: 'Waiting',
        seats: Array.from(this.connectedPlayers.values()).map((p, index) => ({
          playerId: p.id,
          name: p.name,
          isAI: p.isAI,
          tableStack: p.bankroll,
          currentBet: 0,
          hasFolded: false,
          hasActed: false,
          dice: [], // WarFaire uses cards, not dice
          // Custom WarFaire fields
          hand: [],
          playedCards: [],
          faceDownCards: [],
          ribbons: [],
          totalVP: 0
        })),
        pot: 0,
        currentBet: 0,
        // WarFaire-specific state
        activeCategories: this.warfaireInstance.activeCategories,
        categoryPrestige: this.warfaireInstance.categoryPrestige,
        currentFair: this.currentFair
      };
    }

    // Start first round
    this.startRound();
  }

  private startRound(): void {
    if (!this.warfaireInstance || !this.gameState) return;

    this.currentRound++;
    this.pendingActions.clear();

    console.log(`🎪 Fair ${this.currentFair}, Round ${this.currentRound}`);

    // Flip face-down cards
    for (const player of this.warfaireInstance.players) {
      if (player.faceDownCards.length > 0) {
        player.flipFaceDownCards();
      }
    }

    // Deal cards to each player
    for (const player of this.warfaireInstance.players) {
      for (let i = 0; i < 3; i++) {
        if (this.warfaireInstance.deck.length > 0) {
          player.addToHand(this.warfaireInstance.deck.pop());
        }
      }
    }

    // Update game state phase
    this.gameState.phase = `Fair${this.currentFair}Round${this.currentRound}`;

    // Sync state to platform seats
    this.syncWarFaireStateToSeats();

    // Broadcast state
    this.broadcastGameState();

    // Auto-play for AI after delay
    setTimeout(() => this.handleAITurns(), 1000);
  }

  private syncWarFaireStateToSeats(): void {
    if (!this.warfaireInstance || !this.gameState) return;

    this.warfaireInstance.players.forEach((wfPlayer, index) => {
      const seat = this.gameState!.seats[index];
      if (seat) {
        seat.hand = wfPlayer.hand.map(c => ({
          category: c.category,
          value: c.value,
          isGroupCard: c.isGroupCard
        }));
        seat.playedCards = wfPlayer.playedCards;
        seat.ribbons = wfPlayer.ribbons;
        seat.totalVP = wfPlayer.totalVP;
      }
    });
  }

  handlePlayerAction(playerId: string, action: string, data?: any): void {
    if (!this.warfaireInstance || !this.gameState) return;

    switch(action) {
      case 'play_cards':
        this.handlePlayCards(playerId, data);
        break;
      case 'select_category':
        // Handle group card category selection
        break;
    }
  }

  private handlePlayCards(playerId: string, data: any): void {
    const { faceUpCard, faceDownCard, groupSelections } = data;

    // Store pending action
    this.pendingActions.set(playerId, {
      faceUpCard,
      faceDownCard,
      groupSelections
    });

    // Check if all players have acted
    const nonFoldedSeats = this.gameState!.seats.filter(s => !s.hasFolded);
    if (this.pendingActions.size === nonFoldedSeats.length) {
      this.processRound();
    }
  }

  private handleAITurns(): void {
    // Auto-play for AI players using existing WarFaire AI logic
    // (Similar to server.js playAITurns function)
  }

  private processRound(): void {
    if (!this.warfaireInstance || !this.gameState) return;

    // Apply all pending actions
    for (const [playerId, action] of this.pendingActions) {
      const seatIndex = this.gameState.seats.findIndex(s => s?.playerId === playerId);
      if (seatIndex === -1) continue;

      const player = this.warfaireInstance.players[seatIndex];

      // Find and play cards (logic from server.js)
      const faceUpCard = player.hand.find(c =>
        c.category === action.faceUpCard.category &&
        c.value === action.faceUpCard.value
      );

      const faceDownCard = player.hand.find(c =>
        c.category === action.faceDownCard.category &&
        c.value === action.faceDownCard.value &&
        c !== faceUpCard
      );

      if (faceUpCard && faceDownCard) {
        // Apply group selections
        if (faceUpCard.isGroupCard && action.groupSelections?.faceUp) {
          faceUpCard.selectedCategory = action.groupSelections.faceUp;
        }
        if (faceDownCard.isGroupCard && action.groupSelections?.faceDown) {
          faceDownCard.selectedCategory = action.groupSelections.faceDown;
        }

        player.playCardFaceUp(faceUpCard);
        player.playCardFaceDown(faceDownCard);
      }
    }

    this.pendingActions.clear();

    // Check if Fair is complete (3 rounds)
    if (this.currentRound >= 3) {
      this.endFair();
    } else {
      this.startRound();
    }
  }

  private endFair(): void {
    // Import scoring and run Fair scoring
    // Update player VP and ribbons
    // Check if game is complete (3 Fairs) or start next Fair

    if (this.currentFair >= 3) {
      this.endGame();
    } else {
      this.warfaireInstance!.prepareNextFair();
      this.currentFair++;
      this.currentRound = 0;
      this.startRound();
    }
  }

  private endGame(): void {
    const winners = this.evaluateWinners();

    // Distribute winnings
    winners.forEach(winner => {
      const player = this.connectedPlayers.get(winner.playerId);
      if (player) {
        player.bankroll += winner.payout;
      }
    });

    // Mark game as complete
    this.gameState!.phase = 'GameComplete';
    this.broadcastGameState();
  }

  evaluateWinners(): WinnerResult[] {
    if (!this.warfaireInstance) return [];

    const winner = this.warfaireInstance.getWinner();
    const winnerIndex = this.warfaireInstance.players.indexOf(winner);
    const winningSeat = this.gameState!.seats[winnerIndex];

    if (!winningSeat) return [];

    // Award VP as pennies (1 VP = 10 cents = 10 pennies)
    return [{
      playerId: winningSeat.playerId,
      payout: winner.totalVP * 10
    }];
  }

  getValidActions(playerId: string): string[] {
    const phase = this.gameState?.phase || '';

    if (phase.startsWith('Fair') && phase.includes('Round')) {
      return ['play_cards', 'select_category'];
    }

    return [];
  }
}
```

## Step 4: Create Game Manifest

Create `manifest.json`:

```json
{
  "gameId": "warfare",
  "gameType": "warfare",
  "displayName": "War Faire",
  "version": "0.1.0",
  "description": "State Fair card game with prestige, ribbons, and competitive scoring",
  "minPlayers": 4,
  "maxPlayers": 10,
  "assets": {
    "serverPackage": "@pirate/game-warfare",
    "clientBundle": "warfare-client.js"
  },
  "deployment": {
    "timestamp": "",
    "commitHash": ""
  }
}
```

## Step 5: Update package.json

Modify your existing `package.json`:

```json
{
  "name": "@pirate/game-warfare",
  "version": "0.1.0",
  "description": "War Faire card game for Pirate Platform",
  "main": "dist/src/WarFaireGame.js",
  "types": "dist/src/WarFaireGame.d.ts",
  "type": "module",
  "files": [
    "dist/",
    "manifest.json",
    "public/",
    "game.js",
    "card.js",
    "player.js",
    "scorer.js"
  ],
  "scripts": {
    "start": "node index.js",
    "server": "node server.js",
    "test": "node test.js",
    "build": "tsc && cp manifest.json dist/",
    "publish:verdaccio": "npm publish --registry http://vps-0b87e710.tail751d97.ts.net:4873/"
  },
  "dependencies": {
    "@pirate/game-sdk": "^0.1.0",
    "@pirate/core-engine": "^0.1.0",
    "express": "^4.18.2",
    "socket.io": "^4.7.2"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.9.2"
  },
  "publishConfig": {
    "registry": "http://vps-0b87e710.tail751d97.ts.net:4873/"
  },
  "keywords": ["game", "card-game", "fair", "pirate-platform"],
  "author": "",
  "license": "MIT"
}
```

## Step 6: Build and Publish

```bash
# Build the TypeScript adapter
npm run build

# Publish to Verdaccio
npm run publish:verdaccio
```

## Step 7: Integrate into Platform

In the PiratePlunder repository:

```bash
# Install WarFaire package
cd /home/nathan/GitHub/PiratePlunder
npm install @pirate/game-warfare@latest

# Register in backend (games/pirate-plunder/backend/src/server.ts)
import { WarFaireGame } from '@pirate/game-warfare';
gameRegistry.registerGameType('warfare', WarFaireGame as any);

# Build and deploy
make build
./deploy-direct.sh
```

## Development Workflow

### Making Changes

1. Edit WarFaire code in this repo
2. Increment version in package.json (0.1.0 → 0.1.1)
3. `npm run build && npm run publish:verdaccio`
4. In PiratePlunder: `npm update @pirate/game-warfare`
5. Rebuild and redeploy platform

### Testing Locally

You can still run WarFaire standalone for development:
```bash
npm run server
```

Or test integrated with platform:
```bash
# Link for local development
npm link

# In PiratePlunder
npm link @pirate/game-warfare
```

## Benefits

✅ WarFaire keeps its own repo and git history
✅ Platform provides auth, database, deployment
✅ Both games available from one URL
✅ Shared user accounts and bankrolls
✅ Independent release cycles

## Next Steps

1. Set up `.npmrc` and install dependencies
2. Create TypeScript configuration
3. Write `src/WarFaireGame.ts` adapter
4. Test build process
5. Publish to Verdaccio
6. Integrate and deploy to platform

See the full guide at: `PiratePlunder/docs/game-integration-guide.md`
