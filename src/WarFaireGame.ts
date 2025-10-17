import { GameBase, GameState, Seat, Player, WinnerResult } from '@pirate/game-sdk';
import { Game } from '../game.js';
import { scoreFair } from '../scorer.js';

export class WarFaireGame extends GameBase {
  gameType = 'warfaire';
  private warfaireInstance: Game | null = null;
  private pendingActions: Map<string, any> = new Map();
  private currentFair: number = 0;
  private currentRound: number = 0;

  constructor(tableConfig: any) {
    super(tableConfig);
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
      } as any;
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

    this.warfaireInstance.players.forEach((wfPlayer: any, index: number) => {
      const seat = this.gameState!.seats[index];
      if (seat) {
        seat.hand = wfPlayer.hand.map((c: any) => ({
          category: c.category,
          value: c.value,
          isGroupCard: c.isGroupCard
        }));
        seat.playedCards = wfPlayer.playedCards;
        seat.ribbons = wfPlayer.ribbons;
        seat.totalVP = wfPlayer.totalVP;
      }
    });

    // Update game-wide state
    (this.gameState as any).activeCategories = this.warfaireInstance.activeCategories;
    (this.gameState as any).categoryPrestige = this.warfaireInstance.categoryPrestige;
    (this.gameState as any).currentFair = this.currentFair;
    (this.gameState as any).currentRound = this.currentRound;
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
    if (!this.warfaireInstance || !this.gameState) return;

    // Auto-play for AI players using existing WarFaire AI logic
    this.gameState.seats.forEach((seat, index) => {
      if (seat && seat.isAI && !seat.hasFolded) {
        const player = this.warfaireInstance!.players[index];

        if (player.hand.length >= 2) {
          // Random AI selection (same as game.js)
          const faceUpCard = player.hand[Math.floor(Math.random() * player.hand.length)];
          const faceUpIndex = player.hand.indexOf(faceUpCard);

          // Handle group cards for face-up
          if (faceUpCard.isGroupCard) {
            const validCategories = this.warfaireInstance!.activeCategories.filter(
              (c: any) => c.group === faceUpCard.category
            );
            if (validCategories.length > 0) {
              faceUpCard.selectedCategory = validCategories[
                Math.floor(Math.random() * validCategories.length)
              ].name;
            }
          }

          player.playCardFaceUp(faceUpCard);

          // Play face-down
          if (player.hand.length > 0) {
            const faceDownCard = player.hand[Math.floor(Math.random() * player.hand.length)];

            // Handle group cards for face-down
            if (faceDownCard.isGroupCard) {
              const validCategories = this.warfaireInstance!.activeCategories.filter(
                (c: any) => c.group === faceDownCard.category
              );
              if (validCategories.length > 0) {
                faceDownCard.selectedCategory = validCategories[
                  Math.floor(Math.random() * validCategories.length)
                ].name;
              }
            }

            player.playCardFaceDown(faceDownCard);
          }

          seat.hasActed = true;
        }
      }
    });

    // Check if round should be processed
    const allActed = this.gameState.seats.every(s => s.hasFolded || s.hasActed);
    if (allActed) {
      this.processRound();
    }
  }

  private processRound(): void {
    if (!this.warfaireInstance || !this.gameState) return;

    // Apply all pending actions from human players
    for (const [playerId, action] of this.pendingActions) {
      const seatIndex = this.gameState.seats.findIndex(s => s?.playerId === playerId);
      if (seatIndex === -1) continue;

      const player = this.warfaireInstance.players[seatIndex];

      // Find and play cards
      const faceUpCard = player.hand.find((c: any) =>
        c.category === action.faceUpCard.category &&
        c.value === action.faceUpCard.value
      );

      const faceDownCard = player.hand.find((c: any) =>
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

    // Reset hasActed flags
    this.gameState.seats.forEach(s => { if (s) s.hasActed = false; });

    // Check if Fair is complete (3 rounds)
    if (this.currentRound >= 3) {
      this.endFair();
    } else {
      this.startRound();
    }
  }

  private endFair(): void {
    if (!this.warfaireInstance || !this.gameState) return;

    // Score the fair
    const results = scoreFair(
      this.warfaireInstance.players,
      this.warfaireInstance.activeCategories,
      this.warfaireInstance.categoryPrestige
    );

    // Update prestige
    const { updatePrestige } = require('../scorer.js');
    updatePrestige(
      this.warfaireInstance.activeCategories,
      this.warfaireInstance.categoryPrestige,
      results
    );

    // Sync final state
    this.syncWarFaireStateToSeats();
    this.broadcastGameState();

    // Check if game is complete (3 Fairs) or start next Fair
    if (this.currentFair >= 3) {
      this.endGame();
    } else {
      this.warfaireInstance.prepareNextFair();
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
      name: winningSeat.name,
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
