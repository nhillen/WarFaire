import React, { useState, useEffect } from 'react';

// Category emojis
const CATEGORY_EMOJIS: Record<string, string> = {
  'Carrots': '🥕',
  'Pumpkins': '🎃',
  'Tomatoes': '🍅',
  'Corn': '🌽',
  'Pies': '🥧',
  'Cakes': '🎂',
  'Cookies': '🍪',
  'Breads': '🍞',
  'Pigs': '🐷',
  'Cows': '🐄',
  'Chickens': '🐔',
  'Goats': '🐐',
  'Produce': '🌾',
  'Baking': '🧁',
  'Livestock': '🐮'
};

type Card = {
  category: string;
  value: number;
  isGroupCard: boolean;
  playedAtFair?: number;
  playedAtRound?: number;
  getEffectiveCategory?: () => string; // Method from backend Card class
};

type Seat = {
  playerId: string;
  name: string;
  isAI: boolean;
  hand?: Card[];
  playedCards?: Card[];
  ribbons?: any[];
  totalVP?: number;
  hasActed?: boolean;
};

type Category = {
  name: string;
  group: string;
};

type WarFaireGameState = {
  phase: string;
  seats: Seat[];
  activeCategories?: Category[];
  categoryPrestige?: Record<string, number>;
  currentFair?: number;
  currentRound?: number;
};

type WarFaireClientProps = {
  game: WarFaireGameState | null;
  meId: string;
  onPlayerAction: (action: string, data?: any) => void;
  onSitDown: (seatIndex: number, buyInAmount: number) => void;
  onStandUp: () => void;
  isSeated: boolean;
};

export default function WarFaireClient({
  game,
  meId,
  onPlayerAction,
  onSitDown,
  onStandUp,
  isSeated
}: WarFaireClientProps) {
  // ===== EXISTING STATE - DO NOT MODIFY =====
  const [slotA, setSlotA] = useState<{ card: Card; index: number } | null>(null);
  const [slotB, setSlotB] = useState<{ card: Card; index: number } | null>(null);
  const [isFaceUp, setIsFaceUp] = useState(true);
  const [showStandings, setShowStandings] = useState(false);
  const [activeTab, setActiveTab] = useState<'hand' | 'played'>('hand');
  const [boardTab, setBoardTab] = useState<'all' | 'you' | 'rivals'>('all');

  // ===== UI STATE FOR POPOVER =====
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // ===== DERIVED DATA FROM EXISTING PROPS =====
  const mySeat = game?.seats?.find(s => s && s.playerId === meId);
  const myHand = mySeat?.hand || [];
  const myPlayedCards = mySeat?.playedCards || [];
  const myTotalVP = mySeat?.totalVP || 0;

  const activeCategories = game?.activeCategories || [];
  const categoryPrestige = game?.categoryPrestige || {};
  const currentFair = game?.currentFair || 1;
  const currentRound = game?.currentRound || 1;

  // ===== EXISTING AUTO-SIT LOGIC - DO NOT MODIFY =====
  useEffect(() => {
    console.log(`🪑 Auto-sit check:`, {
      hasGame: !!game,
      isSeated,
      phase: game?.phase,
      meId,
      seatsCount: game?.seats?.length,
      seats: game?.seats?.map(s => s ? { playerId: s.playerId, name: s.name } : null)
    });

    if (game && !isSeated && game.phase === 'Lobby') {
      const alreadySeated = game.seats.some(s => s && s.playerId === meId);
      console.log(`🪑 Already seated check:`, alreadySeated, 'meId:', meId);

      if (!alreadySeated) {
        const emptySeatIndex = game.seats.findIndex(s => !s || !s.playerId);
        console.log(`🪑 Empty seat found at index:`, emptySeatIndex);

        if (emptySeatIndex !== -1) {
          console.log(`🪑 Auto-sitting player ${meId} at seat ${emptySeatIndex}`);
          onSitDown(emptySeatIndex, 1000);
        } else {
          console.log(`🪑 No empty seats available`);
        }
      } else {
        console.log(`🪑 Player ${meId} already seated, not auto-sitting again`);
      }
    }
  }, [game, isSeated, meId]);

  // ===== EXISTING RESET LOGIC - DO NOT MODIFY =====
  useEffect(() => {
    setSlotA(null);
    setSlotB(null);
    setIsFaceUp(true);
  }, [currentRound, currentFair]);

  // ===== EXISTING HANDLERS - DO NOT MODIFY =====
  const selectCard = (card: Card, index: number) => {
    if (slotA?.index === index) {
      setSlotA(null);
      return;
    }
    if (slotB?.index === index) {
      setSlotB(null);
      return;
    }
    if (!slotA) {
      setSlotA({ card, index });
    } else if (!slotB) {
      setSlotB({ card, index });
    }
  };

  const clearSelection = () => {
    setSlotA(null);
    setSlotB(null);
  };

  const submitCards = () => {
    if (!slotA || !slotB) {
      return;
    }
    onPlayerAction('play_cards', {
      faceUpCard: isFaceUp ? slotA.card : slotB.card,
      faceDownCard: isFaceUp ? slotB.card : slotA.card,
      groupSelections: {}
    });
    clearSelection();
  };

  const canSubmit = slotA && slotB;

  // ===== LOADING STATE =====
  if (!game) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-xl text-gray-500">Loading...</div>
      </div>
    );
  }

  // ===== LOBBY VIEW - KEEPING EXISTING LOGIC =====
  if (game.phase === 'Lobby') {
    const seatedPlayers = game.seats.filter((s: any) => s && s.playerId);
    const canStart = seatedPlayers.length >= 4; // Require 4 players minimum
    const emptySeats = game.seats.filter((s: any) => !s || !s.playerId).length;

    console.log('🎪 Lobby state:', {
      seatedPlayersCount: seatedPlayers.length,
      seatedPlayers: seatedPlayers.map((s: any) => ({ id: s.playerId, name: s.name, isAI: s.isAI })),
      emptySeats,
      canStart,
      myId: meId
    });

    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">War Faire</h2>
            <p className="text-sm text-slate-600">{seatedPlayers.length} / 10 seated</p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
            <div className="grid grid-cols-5 gap-2">
              {game.seats.map((seat: any, index: number) => (
                <div
                  key={index}
                  className={`
                    border rounded p-2 text-center text-xs
                    ${seat && seat.playerId ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-slate-50'}
                    ${seat && seat.playerId === meId ? 'ring-1 ring-blue-500' : ''}
                  `}
                >
                  {seat && seat.playerId ? (
                    <>
                      <div className="text-lg mb-1">{seat.isAI ? '🤖' : '👤'}</div>
                      <div className="font-medium truncate">{seat.name.split(' ')[0]}</div>
                    </>
                  ) : (
                    <>
                      <div className="text-lg mb-1 text-slate-300">💺</div>
                      <div className="text-slate-400">{index + 1}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-center flex-wrap">
            {canStart && (
              <button
                onClick={() => onPlayerAction('start_hand')}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium text-sm"
              >
                Start Game
              </button>
            )}
            {emptySeats >= 9 && (
              <button
                onClick={() => {
                  console.log('🎪 Clicked +9 AI button');
                  onPlayerAction('add_ai', { count: 9 });
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                +9 AI
              </button>
            )}
            {emptySeats >= 4 && (
              <button
                onClick={() => {
                  console.log('🎪 Clicked +4 AI button');
                  onPlayerAction('add_ai', { count: 4 });
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                +4 AI
              </button>
            )}
            {emptySeats > 0 && (
              <button
                onClick={() => {
                  console.log('🎪 Clicked Fill All button');
                  onPlayerAction('fill_ai');
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                Fill All
              </button>
            )}
            <button
              onClick={onStandUp}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== FAIR SUMMARY VIEW =====
  if (game.phase.startsWith('FairSummary')) {
    const fairResults = (game as any).fairResults || [];
    const fairNumber = (game as any).lastCompletedFair || 1;

    // Sort players by VP for display
    const sortedSeats = [...game.seats]
      .filter(s => s)
      .sort((a, b) => (b.totalVP || 0) - (a.totalVP || 0));

    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="max-w-2xl w-full bg-white rounded-lg border border-slate-300 shadow-lg p-8">
          <h1 className="text-3xl font-bold text-center mb-6">Fair {fairNumber} Complete!</h1>

          {/* Fair Results - Ribbons Won */}
          {fairResults && fairResults.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Ribbons Won</h2>
              <div className="space-y-2">
                {fairResults.map((result: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{CATEGORY_EMOJIS[result.category] || '🎪'}</span>
                      <div>
                        <div className="font-semibold">{result.category}</div>
                        <div className="text-sm text-slate-600">{result.winner}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-purple-600">+{result.vp} VP</div>
                      <div className="text-xs text-slate-500">{result.score} points</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Standings */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Current Standings</h2>
            <div className="space-y-2">
              {sortedSeats.map((seat: any, idx: number) => (
                <div
                  key={seat.playerId}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    seat.playerId === meId
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-slate-400">#{idx + 1}</span>
                    <span className="text-lg">{seat.isAI ? '🤖' : '👤'}</span>
                    <span className="font-medium">{seat.name}</span>
                  </div>
                  <div className="text-xl font-bold text-purple-600">{seat.totalVP || 0} VP</div>
                </div>
              ))}
            </div>
          </div>

          {/* Continue Button */}
          <button
            onClick={() => onPlayerAction('continue_from_summary')}
            className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold text-lg"
          >
            {fairNumber >= 3 ? 'View Final Results' : `Continue to Fair ${fairNumber + 1}`}
          </button>
        </div>
      </div>
    );
  }

  // ===== GAME END VIEW =====
  if (game.phase === 'GameEnd') {
    const gameWinners = (game as any).gameWinners || [];
    const winner = gameWinners[0];

    // Sort players by final VP
    const sortedSeats = [...game.seats]
      .filter(s => s)
      .sort((a, b) => (b.totalVP || 0) - (a.totalVP || 0));

    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="max-w-2xl w-full bg-white rounded-lg border border-slate-300 shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">Game Over!</h1>
            {winner && (
              <>
                <p className="text-2xl text-purple-600 font-semibold">{winner.name} Wins!</p>
                <p className="text-lg text-slate-600 mt-2">{winner.payout / 10} Victory Points</p>
              </>
            )}
          </div>

          {/* Final Standings */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Final Standings</h2>
            <div className="space-y-2">
              {sortedSeats.map((seat: any, idx: number) => {
                const isWinner = idx === 0;
                return (
                  <div
                    key={seat.playerId}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      isWinner
                        ? 'bg-yellow-50 border-yellow-400 ring-2 ring-yellow-400'
                        : seat.playerId === meId
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold">{isWinner ? '🏆' : `#${idx + 1}`}</span>
                      <span className="text-lg">{seat.isAI ? '🤖' : '👤'}</span>
                      <span className="font-medium text-lg">{seat.name}</span>
                    </div>
                    <div className="text-2xl font-bold text-purple-600">{seat.totalVP || 0} VP</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Return to Lobby Button */}
          <button
            onClick={() => onPlayerAction('return_to_lobby')}
            className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold text-lg"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  // ===== DERIVED DISPLAY DATA =====
  const hasActed = mySeat?.hasActed || false;
  const waitingForOthers = hasActed;

  console.log('🎮 Game state:', {
    phase: game.phase,
    hasActed,
    waitingForOthers,
    myHandSize: myHand.length,
    myPlayedCardsSize: myPlayedCards.length,
    myId: meId,
    mySeat: mySeat ? { name: mySeat.name, playerId: mySeat.playerId, hasActed: mySeat.hasActed } : null,
    allSeats: game.seats?.map(s => s ? { playerId: s.playerId, name: s.name, hasActed: s.hasActed } : null)
  });

  // Calculate per-category leaders (derived from existing data, no new logic)
  const getCategoryLeaders = (categoryName: string) => {
    const playerScores: Array<{ name: string; score: number; playerId: string }> = [];

    game.seats.forEach(seat => {
      if (seat && seat.playedCards) {
        const score = seat.playedCards
          .filter(card => card.category === categoryName)
          .reduce((sum, card) => sum + card.value, 0);
        if (score > 0) {
          playerScores.push({ name: seat.name, score, playerId: seat.playerId });
        }
      }
    });

    return playerScores.sort((a, b) => b.score - a.score).slice(0, 3);
  };

  // Get all player scores for popover (derived from existing data)
  const getAllCategoryScores = (categoryName: string) => {
    const playerScores: Array<{ name: string; score: number; delta: number; playerId: string }> = [];

    game.seats.forEach(seat => {
      if (seat && seat.playedCards) {
        // Calculate total score for this category
        const categoryCards = seat.playedCards.filter(card => {
          // Handle both plain category names and cards with getEffectiveCategory method
          const effectiveCategory = card.getEffectiveCategory ? card.getEffectiveCategory() : card.category;
          return effectiveCategory === categoryName;
        });

        const score = categoryCards.reduce((sum, card) => sum + card.value, 0);

        // Calculate delta (cards played in current round)
        const delta = categoryCards
          .filter(card => card.playedAtFair === currentFair && card.playedAtRound === currentRound)
          .reduce((sum, card) => sum + card.value, 0);

        if (score > 0) {
          playerScores.push({ name: seat.name, score, delta, playerId: seat.playerId });
        }
      }
    });

    return playerScores.sort((a, b) => b.score - a.score);
  };

  // Filter board players based on tab
  const getBoardPlayers = () => {
    const allPlayers = game.seats.filter(s => s && s.playerId);

    if (boardTab === 'you') {
      return allPlayers.filter(s => s.playerId === meId);
    }

    if (boardTab === 'rivals') {
      // Get top 2 by VP
      const sorted = [...allPlayers].sort((a, b) => (b.totalVP || 0) - (a.totalVP || 0));
      const topTwo = sorted.slice(0, 2).map(s => s.playerId);
      return allPlayers.filter(s => s.playerId === meId || topTwo.includes(s.playerId));
    }

    return allPlayers;
  };

  const boardPlayers = getBoardPlayers();

  // ===== MAIN GAME VIEW - LAYOUT ONLY, PRESERVE ALL LOGIC =====
  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Top bar - UNCHANGED as per spec */}
      <div className="h-11 bg-white border-b border-slate-200 px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Fair {currentFair} · Round {currentRound}</h1>
          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">{mySeat?.name}</span>
          <span className="text-xs text-slate-600">{myTotalVP} VP</span>
        </div>
        <button
          onClick={() => setShowStandings(!showStandings)}
          className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded"
          aria-label="Toggle stats drawer"
        >
          Stats
        </button>
      </div>

      {/* Main content - max-width 1280px, stacked sections */}
      <div className="flex-1 overflow-auto pb-24">
        <div className="max-w-[1280px] mx-auto px-4 py-6 space-y-6">

          {/* Categories Section */}
          <section>
            <h2 className="text-xl mb-4 font-semibold">Categories</h2>
            <div className="grid grid-cols-2 gap-4">
              {activeCategories.map(cat => {
                const emoji = CATEGORY_EMOJIS[cat.name] || '';
                const prestige = categoryPrestige[cat.name] || 0;
                const leaders = getCategoryLeaders(cat.name);
                const topScore = leaders[0]?.score || 0;
                const allScores = getAllCategoryScores(cat.name);

                return (
                  <div
                    key={cat.name}
                    className="relative"
                  >
                    <div
                      className="bg-white border border-slate-300 rounded-lg px-4 py-2 flex items-center gap-2 cursor-default hover:border-slate-400 transition-colors"
                      style={{ height: '56px' }}
                      onMouseEnter={() => setHoveredCategory(cat.name)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    >
                      {/* Left: Icon + Name + Sublabel */}
                      <span className="text-2xl" style={{ width: '24px', height: '24px', lineHeight: '24px' }}>{emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{cat.name}</div>
                        <div className="text-xs text-slate-500">{cat.group}</div>
                      </div>

                      {/* Right: Leader strip + Total */}
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {leaders.slice(0, 3).map((leader, idx) => (
                            <div key={leader.playerId} className="relative">
                              <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-[10px]">
                                {leader.name.charAt(0)}
                              </div>
                              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-purple-600 text-white text-[8px] flex items-center justify-center">
                                {leader.score}
                              </div>
                            </div>
                          ))}
                          {leaders.length > 3 && (
                            <div className="text-xs text-slate-500">+{leaders.length - 3}</div>
                          )}
                        </div>
                        <div className="text-sm font-bold text-slate-700 min-w-[32px] text-right">{topScore}</div>
                      </div>
                    </div>

                    {/* Popover on hover */}
                    {hoveredCategory === cat.name && allScores.length > 0 && (
                      <div
                        className="absolute z-30 mt-2 w-72 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden"
                        style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}
                        onMouseEnter={() => setHoveredCategory(cat.name)}
                        onMouseLeave={() => setHoveredCategory(null)}
                      >
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{emoji}</span>
                            <span className="text-sm font-semibold">{cat.name}</span>
                          </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 sticky top-0">
                              <tr>
                                <th className="text-left px-4 py-2 font-medium text-slate-600">Player</th>
                                <th className="text-right px-4 py-2 font-medium text-slate-600">Points</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white">
                              {allScores.map((player, idx) => (
                                <tr
                                  key={player.playerId}
                                  className={`border-t border-slate-100 ${player.playerId === meId ? 'bg-purple-50' : 'bg-white'}`}
                                >
                                  <td className="px-4 py-2">{player.name}</td>
                                  <td className="px-4 py-2 text-right font-medium">
                                    {player.score}
                                    {player.delta > 0 && (
                                      <span className="text-xs text-green-600 ml-1">+{player.delta}</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Board Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Board</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setBoardTab('all')}
                  className={`px-3 py-1 text-sm rounded ${boardTab === 'all' ? 'bg-purple-600 text-white' : 'bg-slate-200'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setBoardTab('you')}
                  className={`px-3 py-1 text-sm rounded ${boardTab === 'you' ? 'bg-purple-600 text-white' : 'bg-slate-200'}`}
                >
                  You
                </button>
                <button
                  onClick={() => setBoardTab('rivals')}
                  className={`px-3 py-1 text-sm rounded ${boardTab === 'rivals' ? 'bg-purple-600 text-white' : 'bg-slate-200'}`}
                >
                  Rivals
                </button>
              </div>
            </div>
            <div className="bg-white border border-slate-300 rounded-lg p-4 space-y-2">
              {boardPlayers.map((seat: any) => {
                const card = seat.currentFaceUpCard;
                const emoji = card ? CATEGORY_EMOJIS[card.category] || '' : '';

                return (
                  <div
                    key={seat.playerId}
                    className={`flex items-center gap-3 p-2 rounded border ${
                      seat.playerId === meId ? 'bg-purple-50 border-purple-300' : 'border-slate-200'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs">
                      {seat.name.charAt(0)}
                    </div>
                    <span className="flex-1 text-sm font-medium">{seat.name}</span>
                    {card && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs">
                        <span>{emoji}</span>
                        <span className="font-bold">{card.value}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Hand Section */}
          <section>
            <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
              <div className="border-b border-slate-200 px-4 pt-3 pb-0 flex gap-4">
                <button
                  onClick={() => setActiveTab('hand')}
                  className={`pb-3 px-2 text-sm font-medium border-b-2 ${
                    activeTab === 'hand' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-600'
                  }`}
                >
                  Hand
                </button>
                <button
                  onClick={() => setActiveTab('played')}
                  className={`pb-3 px-2 text-sm font-medium border-b-2 ${
                    activeTab === 'played' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-600'
                  }`}
                >
                  Plays
                </button>
              </div>

              <div className="p-4">
                {activeTab === 'hand' ? (
                  waitingForOthers ? (
                    <p className="text-center py-6 text-sm text-slate-500">Waiting for others...</p>
                  ) : myHand.length === 0 ? (
                    <p className="text-center py-6 text-sm text-slate-500">No cards</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-4">
                      {myHand.map((card, i) => {
                        const isSelected = slotA?.index === i || slotB?.index === i;
                        const emoji = CATEGORY_EMOJIS[card.category] || '';
                        return (
                          <div
                            key={i}
                            onClick={() => selectCard(card, i)}
                            className={`relative border rounded-lg p-3 cursor-pointer transition-all ${
                              isSelected ? 'border-purple-500 bg-purple-50 shadow' : 'border-slate-300 bg-white hover:border-slate-400'
                            }`}
                          >
                            {/* Top left: Icon */}
                            <div className="absolute top-2 left-2 text-lg">{emoji}</div>

                            {/* Top right: Value badge */}
                            <div className="absolute top-2 right-2 px-2 py-1 bg-slate-100 rounded-lg text-sm font-bold">
                              {card.value}
                            </div>

                            {/* Bottom center: Name */}
                            <div className="mt-8 text-center text-xs font-medium text-slate-700">
                              {card.category}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  myPlayedCards.length === 0 ? (
                    <p className="text-center py-6 text-sm text-slate-500">No plays yet</p>
                  ) : (
                    <div className="grid grid-cols-6 gap-2">
                      {myPlayedCards.map((card, i) => {
                        const emoji = CATEGORY_EMOJIS[card.category] || '';
                        return (
                          <div key={i} className="border border-slate-200 rounded p-2 text-center">
                            <div className="text-sm">{emoji}</div>
                            <div className="text-base font-bold">{card.value}</div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* Fixed Bottom Action Bar - PRESERVE ALL HANDLERS */}
      {!waitingForOthers && myHand.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-300 shadow-lg px-4 py-3 z-20">
          <div className="max-w-[1280px] mx-auto flex items-center gap-4">
            {/* Slot A */}
            <div className="flex-1 border border-dashed border-slate-300 rounded-lg p-3 min-h-[56px] flex items-center">
              {slotA ? (
                <div className="flex items-center gap-2 w-full">
                  <span className="text-sm">{CATEGORY_EMOJIS[slotA.card.category]}</span>
                  <span className="text-sm font-medium">{slotA.card.category}</span>
                  <span className="ml-auto font-bold text-purple-600">{slotA.card.value}</span>
                  {!isFaceUp && <span className="text-xs text-slate-500 ml-2">scores next round</span>}
                </div>
              ) : (
                <span className="text-sm text-slate-400">Slot A</span>
              )}
            </div>

            {/* Slot B */}
            <div className="flex-1 border border-dashed border-slate-300 rounded-lg p-3 min-h-[56px] flex items-center">
              {slotB ? (
                <div className="flex items-center gap-2 w-full">
                  <span className="text-sm">{CATEGORY_EMOJIS[slotB.card.category]}</span>
                  <span className="text-sm font-medium">{slotB.card.category}</span>
                  <span className="ml-auto font-bold text-purple-600">{slotB.card.value}</span>
                  {isFaceUp && <span className="text-xs text-slate-500 ml-2">scores next round</span>}
                </div>
              ) : (
                <span className="text-sm text-slate-400">Slot B</span>
              )}
            </div>

            {/* Face-Up Toggle */}
            <button
              onClick={() => setIsFaceUp(!isFaceUp)}
              className={`px-4 py-3 rounded-lg text-sm font-medium min-w-[100px] ${
                isFaceUp ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
              aria-label={isFaceUp ? 'Slot A is face-up' : 'Slot B is face-up'}
            >
              {isFaceUp ? 'A Face-Up' : 'B Face-Up'}
            </button>

            {/* Submit */}
            <button
              onClick={submitCards}
              disabled={!canSubmit}
              className={`px-6 py-3 rounded-lg text-sm font-semibold ${
                canSubmit ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
              aria-label="Submit selected cards"
            >
              Submit
            </button>

            {/* Clear */}
            <button
              onClick={clearSelection}
              className="px-4 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm font-medium"
              aria-label="Clear selection"
            >
              Clear
            </button>

            {/* Leave */}
            <button
              onClick={onStandUp}
              className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
              aria-label="Leave game"
            >
              Leave
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
