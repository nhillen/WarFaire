import { GameBase, GameState, Seat, Player, WinnerResult } from '@pirate/game-sdk';
import { Game } from '../game.js';
import { scoreFair } from '../scorer.js';

export class WarFaireGame extends GameBase {
  gameType = 'warfaire';
  private warfaireInstance: Game | null = null;
  private pendingActions: Map<string, any> = new Map();
  private currentFair: number = 0;
  private currentRound: number = 0;
  private aiTurnTimer: NodeJS.Timeout | null = null;
  private groupSelectionTimer: NodeJS.Timeout | null = null;
  private gameEndTimer: NodeJS.Timeout | null = null;
  private isProcessingRound: boolean = false;

  constructor(tableConfig: any) {
    super(tableConfig);
    this.tableConfig.maxSeats = 10; // WarFaire supports up to 10 players
    this.initializeGameState('Lobby'); // Initialize with lobby state
  }

  /**
   * Override sitPlayer to remove bankroll requirement for WarFaire
   * WarFaire doesn't use betting, so players can join with 0 bankroll
   */
  public sitPlayer(player: Player, seatIndex?: number, buyInAmount?: number): { success: boolean; error?: string; seatIndex?: number } {
    if (!this.gameState) {
      return { success: false, error: 'Game not initialized' };
    }

    // WarFaire doesn't require bankroll - players can join with 0
    const requiredBuyIn = 0;

    // Find empty seat
    let targetSeat = seatIndex;
    if (targetSeat === undefined) {
      targetSeat = this.gameState.seats.findIndex(s => s === null);
      if (targetSeat === -1) {
        return { success: false, error: 'No empty seats' };
      }
    }

    // Check if seat is empty
    if (this.gameState.seats[targetSeat] !== null) {
      return { success: false, error: 'Seat already taken' };
    }

    // Create seat
    const seat: Seat = {
      playerId: player.id,
      name: player.name,
      isAI: player.isAI,
      tableStack: requiredBuyIn,
      hasFolded: false,
      currentBet: 0,
      hasActed: false,
      totalContribution: 0,
      ...(player.cosmetics && { cosmetics: player.cosmetics }),
    };

    this.gameState.seats[targetSeat] = seat;

    // No bankroll deduction for WarFaire
    player.tableStack = requiredBuyIn;

    return { success: true, seatIndex: targetSeat };
  }

  startHand(): void {
    if (!this.gameState) return;

    console.log('🎪 Starting WarFaire game...');

    try {
      // Get player names from seated players (not connectedPlayers!)
      const seatedPlayers = this.gameState.seats.filter(s => s !== null);
      if (seatedPlayers.length < 2) {
        console.log('🎪 Not enough seated players to start');
        return;
      }

      const playerNames = seatedPlayers.map(s => s.name);
      console.log('🎪 Creating game instance with players:', playerNames);

      // Initialize WarFaire game instance
      this.warfaireInstance = new Game(playerNames);
      this.currentFair = 1;
      this.currentRound = 0;

      console.log('🎪 Setting up first fair...');
      // Setup first Fair
      this.warfaireInstance.setupFirstFair();
      console.log('🎪 First fair setup complete');

    // Initialize WarFaire-specific fields on seats
    this.gameState.seats.forEach((seat, index) => {
      if (seat) {
        seat.hand = [];
        seat.playedCards = [];
        seat.ribbons = [];
        seat.totalVP = 0;
        seat.hasActed = false; // Reset hasActed for new game
      }
    });

      // Update game state with WarFaire-specific data
      this.gameState.phase = 'Waiting';
      (this.gameState as any).activeCategories = this.warfaireInstance.activeCategories;
      (this.gameState as any).categoryPrestige = this.warfaireInstance.categoryPrestige;
      (this.gameState as any).currentFair = this.currentFair;

      // Sync initial state (including the 3 initial face-down cards)
      this.syncWarFaireStateToSeats();

      console.log('🎪 Starting first round...');
      // Start first round
      this.startRound();
      console.log('🎪 Game started successfully!');
    } catch (error) {
      console.error('🎪 ERROR starting WarFaire game:', error);
      this.gameState.phase = 'Lobby';
      this.broadcastGameState();
      throw error;
    }
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

    // Check if any face-down cards to flip are group cards needing category selection
    const fairToFlipFrom = this.currentFair === 1 ? 0 : this.currentFair - 1;
    const cardsToFlip: Array<{ player: any; card: any }> = [];

    for (const player of this.warfaireInstance.players) {
      const cardToFlip = player.faceDownCards.find(
        (card: any) => card.playedFaceDownAtFair === fairToFlipFrom &&
                      card.playedFaceDownAtRound === this.currentRound
      );
      if (cardToFlip) {
        cardsToFlip.push({ player, card: cardToFlip });
      }
    }

    // Check if any are group cards
    const hasGroupCards = cardsToFlip.some(({ card }) => card.isGroupCard);

    if (hasGroupCards) {
      // Auto-select for AI players BEFORE entering selection phase
      for (const { player, card } of cardsToFlip) {
        if (player.isAI && card.isGroupCard) {
          const validCategories = this.warfaireInstance.activeCategories.filter(
            (c: any) => c.group === card.category
          );
          if (validCategories.length > 0) {
            card.selectedCategory = validCategories[
              Math.floor(Math.random() * validCategories.length)
            ].name;
            console.log(`🎪 [AI] ${player.name} auto-selected ${card.selectedCategory} for group card flip`);
          }
        }
      }

      // Enter group card selection phase
      this.gameState.phase = `Fair${this.currentFair}Round${this.currentRound}GroupSelection`;
      (this.gameState as any).cardsToFlip = cardsToFlip.map(({ player, card }) => ({
        playerId: player.id,
        card: {
          category: card.category,
          value: card.value,
          isGroupCard: card.isGroupCard,
          selectedCategory: card.selectedCategory
        }
      }));
      this.syncWarFaireStateToSeats();
      this.broadcastGameState();

      // Check if all selections are complete (all group cards have selectedCategory)
      // AI selections are already done above, so just check if all group cards have a selection
      const allSelected = cardsToFlip.every(({ card }) =>
        !card.isGroupCard || card.selectedCategory
      );

      if (allSelected) {
        console.log(`🎪 All players ready (AI auto-selected), proceeding with flip`);
        // All selections made, proceed with flipping
        this.flipCardsAndContinue(cardsToFlip);
        return;
      }

      // We'll wait for human players to submit their selections via handlePlayerAction
      const pendingHumans = cardsToFlip.filter(({ player, card }) =>
        !player.isAI && card.isGroupCard && !card.selectedCategory
      );
      console.log(`🎪 Waiting for ${pendingHumans.length} human player(s) to select categories for group cards`);

      // Set a 15-second timer to auto-select for any remaining human players
      if (this.groupSelectionTimer) {
        clearTimeout(this.groupSelectionTimer);
      }
      this.groupSelectionTimer = setTimeout(() => {
        console.log(`🎪 Group selection timeout - auto-selecting for remaining players`);
        // Auto-select for any remaining group cards that don't have a selection
        for (const { player, card } of cardsToFlip) {
          if (card.isGroupCard && !card.selectedCategory) {
            const validCategories = this.warfaireInstance!.activeCategories.filter(
              (c: any) => c.group === card.category
            );
            if (validCategories.length > 0) {
              card.selectedCategory = validCategories[
                Math.floor(Math.random() * validCategories.length)
              ].name;
              console.log(`🎪 [TIMEOUT] Auto-selected ${card.selectedCategory} for ${player.name}'s group card`);
            }
          }
        }
        // Proceed with flipping
        this.flipCardsAndContinue(cardsToFlip);
      }, 15000); // 15 seconds

      return;
    }

    // No group cards, proceed with flipping
    this.flipCardsAndContinue(cardsToFlip);
  }

  private flipCardsAndContinue(cardsToFlip: Array<{ player: any; card: any }>): void {
    if (!this.warfaireInstance || !this.gameState) return;

    const fairToFlipFrom = this.currentFair === 1 ? 0 : this.currentFair - 1;

    // Flip face-down cards → they become face-up played cards
    for (const { player, card } of cardsToFlip) {
      const index = player.faceDownCards.indexOf(card);
      player.faceDownCards.splice(index, 1);
      player.playCardFaceUp(card);  // PLAY to board, not add to hand!
      if (fairToFlipFrom === 0) {
        console.log(`🎪 ${player.name} flips initial face-down card #${this.currentRound} to board`);
      } else {
        console.log(`🎪 ${player.name} flips face-down card from Fair ${fairToFlipFrom} Round ${this.currentRound} to board`);
      }
    }

    // Deal cards to each player (unless Fair 3)
    if (this.currentFair < 3) {
      for (const player of this.warfaireInstance.players) {
        for (let i = 0; i < 3; i++) {
          if (this.warfaireInstance.deck.length > 0) {
            player.addToHand(this.warfaireInstance.deck.pop());
          }
        }
      }
    } else {
      console.log(`🎪 Fair 3 - no drawing, only playing face-down cards from Fair 2`);
    }

    // Update game state phase
    this.gameState.phase = `Fair${this.currentFair}Round${this.currentRound}`;

    // Sync state to platform seats
    this.syncWarFaireStateToSeats();

    // Broadcast state
    this.broadcastGameState();

    // Schedule AI turn check with timeout (in case no humans act)
    if (this.aiTurnTimer) {
      clearTimeout(this.aiTurnTimer);
    }
    this.aiTurnTimer = setTimeout(() => this.handleAITurns(), 5000); // 5 seconds for humans to act
  }

  private syncWarFaireStateToSeats(): void {
    if (!this.warfaireInstance || !this.gameState) return;

    console.log(`🎪 [SYNC] Syncing state - Fair ${this.currentFair}, Round ${this.currentRound}`);

    this.warfaireInstance.players.forEach((wfPlayer: any, index: number) => {
      const seat = this.gameState!.seats[index];
      if (seat) {
        seat.hand = wfPlayer.hand.map((c: any) => ({
          category: c.category,
          value: c.value,
          isGroupCard: c.isGroupCard,
          selectedCategory: c.selectedCategory,
          getEffectiveCategory: c.isGroupCard && c.selectedCategory
            ? () => c.selectedCategory
            : () => c.category
        }));
        seat.playedCards = wfPlayer.playedCards;
        seat.ribbons = wfPlayer.ribbons;
        seat.totalVP = wfPlayer.totalVP;

        // Add face-up and face-down cards separately
        (seat as any).faceUpCards = wfPlayer.faceUpCards || [];
        (seat as any).faceDownCards = wfPlayer.faceDownCards || [];

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
      case 'select_flip_category':
        // Handle group card category selection for face-down cards about to flip
        if (this.gameState.phase.includes('GroupSelection') && data?.category) {
          const fairToFlipFrom = this.currentFair === 1 ? 0 : this.currentFair - 1;
          const player = this.warfaireInstance?.players.find((p: any) => p.id === playerId);
          if (player) {
            const cardToFlip = player.faceDownCards.find(
              (card: any) => card.playedFaceDownAtFair === fairToFlipFrom &&
                            card.playedFaceDownAtRound === this.currentRound &&
                            card.isGroupCard
            );
            if (cardToFlip) {
              cardToFlip.selectedCategory = data.category;
              console.log(`🎪 ${player.name} selected category ${data.category} for flip card`);

              // Check if all players have selected
              if (!this.warfaireInstance) return;
              const cardsToFlip: Array<{ player: any; card: any }> = [];
              for (const p of this.warfaireInstance.players) {
                const card = p.faceDownCards.find(
                  (c: any) => c.playedFaceDownAtFair === fairToFlipFrom &&
                             c.playedFaceDownAtRound === this.currentRound
                );
                if (card) {
                  cardsToFlip.push({ player: p, card });
                }
              }

              // Update cardsToFlip in game state and broadcast
              (this.gameState as any).cardsToFlip = cardsToFlip.map(({ player: p, card }) => ({
                playerId: p.id,
                card: {
                  category: card.category,
                  value: card.value,
                  isGroupCard: card.isGroupCard,
                  selectedCategory: card.selectedCategory
                }
              }));
              this.syncWarFaireStateToSeats();
              this.broadcastGameState();

              const allSelected = cardsToFlip.every(({ card }) =>
                !card.isGroupCard || card.selectedCategory
              );

              if (allSelected) {
                // Clear the timer since we're proceeding
                if (this.groupSelectionTimer) {
                  clearTimeout(this.groupSelectionTimer);
                  this.groupSelectionTimer = null;
                }
                // All selections made, proceed with flipping
                this.flipCardsAndContinue(cardsToFlip);
              }
            }
          }
        }
        break;
      case 'continue_from_summary':
        if (this.gameState.phase.startsWith('RoundSummary')) {
          this.continueFromRoundSummary();
        } else if (this.gameState.phase.startsWith('FairSummary')) {
          // Check if game is complete (3 Fairs) or start next Fair
          if (this.currentFair >= 3) {
            this.endGame();
          } else if (this.warfaireInstance) {
            console.log(`🎪 Continuing to Fair ${this.currentFair + 1}...`);
            this.warfaireInstance.prepareNextFair();
            this.currentFair++;
            this.currentRound = 0;
            this.startRound();
          }
        }
        break;
      case 'return_to_lobby':
        if (this.gameState.phase === 'GameEnd') {
          // Clear the auto-return timer since user manually returned
          if (this.gameEndTimer) {
            clearTimeout(this.gameEndTimer);
            this.gameEndTimer = null;
          }
          this.returnToLobby();
        }
        break;
    }
  }

  private handlePlayCards(playerId: string, data: any): void {
    try {
      const { faceUpCard, faceDownCard, groupSelections } = data;

      console.log(`🎪 Received play_cards from ${playerId}:`, { faceUpCard, faceDownCard, fair: this.currentFair });

    // Store pending action
    // In Fair 3, faceDownCard will be null/undefined
    this.pendingActions.set(playerId, {
      faceUpCard,
      faceDownCard: this.currentFair < 3 ? faceDownCard : null,
      groupSelections
    });

    // Mark player as having acted
    const seat = this.gameState!.seats.find(s => s?.playerId === playerId);
    if (seat) {
      seat.hasActed = true;
    }

    // Broadcast updated state so player sees "waiting for others"
    this.broadcastGameState();

      // Clear any pending AI timer and trigger AI turns immediately
      if (this.aiTurnTimer) {
        clearTimeout(this.aiTurnTimer);
        this.aiTurnTimer = null;
      }
      setTimeout(() => this.handleAITurns(), 500);
    } catch (error) {
      console.error('🎪 ERROR in handlePlayCards:', error);
      console.error('🎪 Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      // Broadcast current state to show error to client
      this.broadcastGameState();
    }
  }

  private handleAITurns(): void {
    try {
      if (!this.warfaireInstance || !this.gameState) return;

      // Don't process if we're already in a summary phase
      if (this.gameState.phase.includes('Summary')) {
        console.log(`🎪 [AI] Skipping - already in summary phase: ${this.gameState.phase}`);
        return;
      }

      // Clear the timer reference since we're executing now
      this.aiTurnTimer = null;

      console.log(`🎪 [AI] Starting AI turns handler at ${Date.now()}`);
      let aiActionsCount = 0;

    // Auto-play for AI players using existing WarFaire AI logic
    this.gameState.seats.forEach((seat, index) => {
      console.log(`🎪 [AI] Checking seat ${index}:`, {
        hasSeat: !!seat,
        isAI: seat?.isAI,
        hasFolded: seat?.hasFolded,
        playerId: seat?.playerId,
        name: seat?.name
      });

      if (seat && seat.isAI && !seat.hasFolded && !seat.hasActed) {
        const player = this.warfaireInstance!.players[index];
        console.log(`🎪 [AI] AI player ${seat.name} at seat ${index} has ${player.hand.length} cards`);

        const minCards = this.currentFair < 3 ? 2 : 1; // Fair 3 only needs 1 card
        if (player.hand.length >= minCards) {
          console.log(`🎪 [AI] AI player ${seat.name} is playing cards...`);

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
          console.log(`🎪 [AI] AI ${seat.name} played face-up: ${faceUpCard.category} (${faceUpCard.value})`);

          // Play face-down only in Fairs 1 and 2
          if (this.currentFair < 3 && player.hand.length > 0) {
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
            console.log(`🎪 [AI] AI ${seat.name} played face-down for Fair ${this.currentFair + 1}: ${faceDownCard.category} (${faceDownCard.value})`);
          }

          seat.hasActed = true;
          aiActionsCount++;
          console.log(`🎪 [AI] AI ${seat.name} has acted (total AI actions: ${aiActionsCount})`);
        } else {
          console.log(`🎪 [AI] AI player ${seat.name} doesn't have enough cards (${player.hand.length} < ${minCards})`);
        }
      }
    });

    console.log(`🎪 [AI] AI turns complete. ${aiActionsCount} AI players acted.`);

    // Check if round should be processed
    const allActed = this.gameState.seats.every(s => !s || s.hasFolded || s.hasActed);
    console.log('🎪 [AI] Checking if all players acted:', {
      allActed,
      total: this.gameState.seats.filter(s => s).length,
      acted: this.gameState.seats.filter(s => s && s.hasActed).length,
      seatStates: this.gameState.seats.map((s, idx) => s ? {
        idx,
        name: s.name,
        isAI: s.isAI,
        hasActed: s.hasActed
      } : null).filter(Boolean)
    });

      if (allActed) {
        console.log('🎪 [AI] All players acted! Processing round...');
        this.processRound();
      } else {
        console.log('🎪 [AI] NOT all players acted yet. Waiting...');
      }
    } catch (error) {
      console.error('🎪 [AI] ERROR in handleAITurns:', error);
      console.error('🎪 [AI] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      // Broadcast current state and return to prevent crash
      this.broadcastGameState();
    }
  }

  private processRound(): void {
    try {
      if (!this.warfaireInstance || !this.gameState) return;

      // Prevent re-entry
      if (this.isProcessingRound) {
        console.log(`🎪 [GUARD] Already processing round, skipping`);
        return;
      }

      this.isProcessingRound = true;
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

      // In Fair 3, there's no face-down card
      const faceDownCard = action.faceDownCard ? player.hand.find((c: any) =>
        c.category === action.faceDownCard.category &&
        c.value === action.faceDownCard.value &&
        c !== faceUpCard
      ) : null;

      if (faceUpCard) {
        // Apply group selections
        if (faceUpCard.isGroupCard && action.groupSelections?.faceUp) {
          faceUpCard.selectedCategory = action.groupSelections.faceUp;
        }

        player.playCardFaceUp(faceUpCard);

        // Only play face-down in Fairs 1 and 2
        if (faceDownCard) {
          if (faceDownCard.isGroupCard && action.groupSelections?.faceDown) {
            faceDownCard.selectedCategory = action.groupSelections.faceDown;
          }
          player.playCardFaceDown(faceDownCard);
        }
      }
    }

    this.pendingActions.clear();

    // Sync state to show face-up cards
    this.syncWarFaireStateToSeats();

    // Store round summary data for display
    const roundPlays: any[] = [];
    this.gameState.seats.forEach((seat, idx) => {
      if (seat && this.warfaireInstance) {
        const player = this.warfaireInstance.players[idx];
        if (!player) {
          console.log(`🎪 [WARN] No player found at index ${idx} for seat ${seat.name}`);
          return;
        }

        const faceUpCard = player.faceUpCards && player.faceUpCards.length > 0
          ? player.faceUpCards[player.faceUpCards.length - 1]
          : null;

        const faceDownCard = player.faceDownCards && player.faceDownCards.length > 0
          ? player.faceDownCards[player.faceDownCards.length - 1]
          : null;

        roundPlays.push({
          playerName: seat.name,
          playerId: seat.playerId,
          isAI: seat.isAI,
          faceUpCard: faceUpCard ? {
            category: faceUpCard.getEffectiveCategory ? faceUpCard.getEffectiveCategory() : faceUpCard.category,
            value: faceUpCard.value
          } : null,
          faceDownCard: faceDownCard ? {
            category: faceDownCard.getEffectiveCategory ? faceDownCard.getEffectiveCategory() : faceDownCard.category,
            value: faceDownCard.value
          } : null
        });
      }
    });

    (this.gameState as any).roundPlays = roundPlays;
    (this.gameState as any).completedRound = this.currentRound;

    // Reset hasActed flags
    console.log(`🎪 Resetting hasActed flags for all seats`);
    this.gameState.seats.forEach(s => { if (s) s.hasActed = false; });

      // Transition to RoundSummary phase
      this.gameState.phase = `RoundSummary${this.currentFair}_${this.currentRound}`;
      console.log(`🎪 Entering RoundSummary phase`);

      this.isProcessingRound = false;
      this.broadcastGameState();
    } catch (error) {
      console.error('🎪 ERROR in processRound:', error);
      console.error('🎪 Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      this.isProcessingRound = false;
      // Try to recover by broadcasting current state
      if (this.gameState) {
        this.broadcastGameState();
      }
    }
  }

  private continueFromRoundSummary(): void {
    if (!this.gameState) return;

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

    console.log(`🎪 Ending Fair ${this.currentFair}...`);

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

    // Store Fair results in game state for display
    (this.gameState as any).fairResults = results;
    (this.gameState as any).lastCompletedFair = this.currentFair;

    // Transition to Fair Summary phase
    this.gameState.phase = `FairSummary${this.currentFair}`;
    console.log(`🎪 Entering FairSummary${this.currentFair} phase`);

    this.broadcastGameState();
  }

  private endGame(): void {
    if (!this.gameState) return;

    console.log(`🎪 Ending game after 3 Fairs...`);

    const winners = this.evaluateWinners();

    // Store winners for display
    (this.gameState as any).gameWinners = winners;

    // Transition to GameEnd phase
    this.gameState.phase = 'GameEnd';
    console.log(`🎪 Entering GameEnd phase`);

    this.broadcastGameState();

    // Set a 15-second timer to auto-return to lobby
    if (this.gameEndTimer) {
      clearTimeout(this.gameEndTimer);
    }
    this.gameEndTimer = setTimeout(() => {
      console.log(`🎪 Auto-returning to lobby after game end`);
      this.returnToLobby();
    }, 15000); // 15 seconds
  }

  private returnToLobby(): void {
    if (!this.gameState) return;

    // Clear any pending timers
    if (this.gameEndTimer) {
      clearTimeout(this.gameEndTimer);
      this.gameEndTimer = null;
    }
    if (this.groupSelectionTimer) {
      clearTimeout(this.groupSelectionTimer);
      this.groupSelectionTimer = null;
    }
    if (this.aiTurnTimer) {
      clearTimeout(this.aiTurnTimer);
      this.aiTurnTimer = null;
    }

    console.log(`🎪 Returning to lobby...`);

    const winners = (this.gameState as any).gameWinners || this.evaluateWinners();

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
