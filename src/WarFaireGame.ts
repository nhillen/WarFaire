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
    this.initializeGameState('Lobby'); // Initialize with lobby state
  }

  startHand(): void {
    if (!this.gameState) return;

    console.log('🎪 Starting WarFaire game...');

    // Get player names from seated players (not connectedPlayers!)
    const seatedPlayers = this.gameState.seats.filter(s => s !== null);
    if (seatedPlayers.length < 2) {
      console.log('🎪 Not enough seated players to start');
      return;
    }

    const playerNames = seatedPlayers.map(s => s.name);

    // Initialize WarFaire game instance
    this.warfaireInstance = new Game(playerNames);
    this.currentFair = 1;
    this.currentRound = 0;

    // Setup first Fair
    this.warfaireInstance.setupFirstFair();

    // Add WarFaire-specific fields to existing seats
    this.gameState.seats.forEach((seat, index) => {
      if (seat) {
        seat.hand = [];
        seat.playedCards = [];
        seat.faceDownCards = [];
        seat.ribbons = [];
        seat.totalVP = 0;
      }
    });

    // Update game state with WarFaire-specific data
    this.gameState.phase = 'Waiting';
    (this.gameState as any).activeCategories = this.warfaireInstance.activeCategories;
    (this.gameState as any).categoryPrestige = this.warfaireInstance.categoryPrestige;
    (this.gameState as any).currentFair = this.currentFair;

    // Start first round
    this.startRound();
  }

  private startRound(): void {
    if (!this.warfaireInstance || !this.gameState) return;

    this.currentRound++;
    this.pendingActions.clear();

    console.log(`🎪 Fair ${this.currentFair}, Round ${this.currentRound}`);

    // Update all players with current fair/round for metadata tracking
    for (const player of this.warfaireInstance.players) {
      player.currentFair = this.currentFair;
      player.currentRound = this.currentRound;
    }

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

        // Add current round's face-up card (last card in playedCards if any this round)
        const recentCards = wfPlayer.playedCards.slice(-1);
        (seat as any).currentFaceUpCard = recentCards.length > 0 ? recentCards[0] : null;
      }
    });

    // Update game-wide state
    (this.gameState as any).activeCategories = this.warfaireInstance.activeCategories;
    (this.gameState as any).categoryPrestige = this.warfaireInstance.categoryPrestige;
    (this.gameState as any).currentFair = this.currentFair;
    (this.gameState as any).currentRound = this.currentRound;
  }

  handlePlayerAction(playerId: string, action: string, data?: any): void {
    if (!this.gameState) return;

    switch(action) {
      case 'start_hand':
        if (this.gameState.phase === 'Lobby' && this.canStartHand()) {
          this.startHand();
        }
        break;
      case 'play_cards':
        if (!this.warfaireInstance) return;
        this.handlePlayCards(playerId, data);
        break;
      case 'select_category':
        // Handle group card category selection
        break;
    }
  }

  private handlePlayCards(playerId: string, data: any): void {
    const { faceUpCard, faceDownCard, groupSelections } = data;

    console.log(`🎪 Received play_cards from ${playerId}:`, { faceUpCard, faceDownCard });

    // Store pending action
    this.pendingActions.set(playerId, {
      faceUpCard,
      faceDownCard,
      groupSelections
    });

    // Mark player as having acted
    const seat = this.gameState!.seats.find(s => s?.playerId === playerId);
    if (seat) {
      seat.hasActed = true;
    }

    // Broadcast updated state so player sees "waiting for others"
    this.broadcastGameState();

    // Check if all players have acted
    const nonFoldedSeats = this.gameState!.seats.filter(s => s && !s.hasFolded);
    console.log(`🎪 Pending actions: ${this.pendingActions.size} / ${nonFoldedSeats.length} players`);

    if (this.pendingActions.size === nonFoldedSeats.length) {
      console.log('🎪 All players acted, processing round...');
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
    const allActed = this.gameState.seats.every(s => !s || s.hasFolded || s.hasActed);
    if (allActed) {
      this.processRound();
    } else {
      console.log('🎪 Not all players acted yet:', {
        total: this.gameState.seats.filter(s => s).length,
        acted: this.gameState.seats.filter(s => s && s.hasActed).length
      });
    }
  }

  private processRound(): void {
    if (!this.warfaireInstance || !this.gameState) return;

    console.log(`🎪 Processing round - Fair ${this.currentFair}, Round ${this.currentRound}`);

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
    console.log(`🎪 Resetting hasActed flags for all seats`);
    this.gameState.seats.forEach(s => { if (s) s.hasActed = false; });

    // Check if Fair is complete (3 rounds)
    if (this.currentRound >= 3) {
      console.log(`🎪 Fair ${this.currentFair} complete, ending fair...`);
      this.endFair();
    } else {
      console.log(`🎪 Starting next round...`);
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

    // Distribute winnings to table stacks
    this.payoutWinners(winners);

    // Broadcast winner announcement
    if (winners.length > 0) {
      this.broadcast('player_action', {
        playerName: winners[0].name,
        action: 'won',
        details: `${winners[0].payout / 10} VP`,
        isAI: false,
      });
    }

    // Use GameBase's endHand to clean up and return to Lobby
    this.endHand();
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

    if (phase === 'Lobby') {
      return this.canStartHand() ? ['start_hand'] : [];
    }

    if (phase.startsWith('Fair') && phase.includes('Round')) {
      return ['play_cards', 'select_category'];
    }

    return [];
  }
}
