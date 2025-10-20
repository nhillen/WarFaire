import React, { useState, useEffect } from 'react';
import { CardShell } from './components/presentational/CardShell';
import { CardBack } from './components/presentational/CardBack';
import { MiniCardChip } from './components/presentational/MiniCardChip';
import { LeaderChip } from './components/presentational/LeaderChip';
import { getCardArt } from './components/presentational/cardArt';

// Category emojis (kept for summary/results screens, removed from main UI)
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
  const [mousePos, setMousePos] = useState<{ x: number, y: number }>({ x: 0, y: 0 });

  // ===== DERIVED DATA FROM EXISTING PROPS =====
  const mySeat = game?.seats?.find(s => s && s.playerId === meId);
  const myHand = mySeat?.hand || [];
  const myPlayedCards = mySeat?.playedCards || [];
  const myTotalVP = mySeat?.totalVP || 0;

  const activeCategories = game?.activeCategories || [];
  const categoryPrestige = game?.categoryPrestige || {};
  const currentFair = game?.currentFair || 1;
  const currentRound = game?.currentRound || 1;

  // ===== SEAT SELECTION HANDLER =====
  const handleSeatClick = (seatIndex: number, seat: any) => {
    // If seat is occupied, do nothing
    if (seat && seat.playerId) {
      return;
    }

    // If not seated, sit down
    if (!isSeated) {
      console.log(`🪑 Player ${meId} sitting at seat ${seatIndex}`);
      onSitDown(seatIndex, 1000);
    } else {
      // If already seated, add AI to this seat
      console.log(`🪑 Adding AI to seat ${seatIndex}`);
      onPlayerAction('add_ai', { count: 1, seatIndex });
    }
  };

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
            <p className="text-sm text-slate-600 mb-2">{seatedPlayers.length} / 10 seated</p>
            {!isSeated && (
              <p className="text-xs text-purple-600 font-medium">Click an empty seat to join</p>
            )}
            {isSeated && (
              <p className="text-xs text-slate-500">Click empty seats to add AI players</p>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
            <div className="grid grid-cols-5 gap-2">
              {game.seats.map((seat: any, index: number) => (
                <div
                  key={index}
                  onClick={() => handleSeatClick(index, seat)}
                  className={`
                    border rounded p-2 text-center text-xs transition-all
                    ${seat && seat.playerId
                      ? 'border-green-500 bg-green-50 cursor-default'
                      : 'border-slate-300 bg-slate-50 cursor-pointer hover:border-purple-500 hover:bg-purple-50 hover:shadow-md'
                    }
                    ${seat && seat.playerId === meId ? 'ring-2 ring-blue-500' : ''}
                  `}
                >
                  {seat && seat.playerId ? (
                    <>
                      <div className="text-lg mb-1">{seat.isAI ? '🤖' : '👤'}</div>
                      <div className="font-medium truncate">{seat.name.split(' ')[0]}</div>
                    </>
                  ) : (
                    <>
                      <div className="text-lg mb-1 text-slate-400">💺</div>
                      <div className="text-slate-400 text-[10px]">
                        {isSeated ? 'Add AI' : 'Sit Here'}
                      </div>
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

  // ===== ROUND SUMMARY VIEW =====
  if (game.phase.startsWith('RoundSummary')) {
    const roundPlays = (game as any).roundPlays || [];
    const roundNumber = (game as any).completedRound || 1;

    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="max-w-2xl w-full bg-white rounded-lg border border-slate-300 shadow-lg p-8">
          <h1 className="text-3xl font-bold text-center mb-6">Round {roundNumber} Complete!</h1>

          {/* Cards Played This Round */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Cards Played (Face-Up)</h2>
            <div className="space-y-2">
              {roundPlays.map((play: any) => (
                <div
                  key={play.playerId}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    play.playerId === meId
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{play.isAI ? '🤖' : '👤'}</span>
                    <span className="font-medium">{play.playerName}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-purple-100 border border-purple-300 rounded-lg">
                    <span className="text-lg">{CATEGORY_EMOJIS[play.category] || '🎪'}</span>
                    <span className="font-semibold">{play.category}</span>
                    <span className="text-lg font-bold text-purple-600">{play.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Continue Button */}
          <button
            onClick={() => onPlayerAction('continue_from_summary')}
            className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold text-lg"
          >
            {roundNumber >= 3 ? 'View Fair Results' : `Continue to Round ${roundNumber + 1}`}
          </button>
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

  // ===== UNSEATED PLAYER VIEW (not in lobby and not seated) =====
  if (!isSeated && game.phase !== 'Lobby') {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-lg border border-slate-300 shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Game in Progress</h2>
          <p className="text-slate-600 mb-6">
            A game is currently underway. Please wait for the current game to finish before joining.
          </p>
          <div className="text-sm text-slate-500">
            Phase: {game.phase}
          </div>
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
    <div className="app-shell h-full flex flex-col">
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
        <div className="page">

          {/* Categories Section */}
          <section className="section-categories">
            <h2 className="text-xl mb-4 font-semibold text-white">Categories</h2>
            {/* Group categories by group */}
            {(() => {
              const groupedCategories = activeCategories.reduce((acc, cat) => {
                if (!acc[cat.group]) acc[cat.group] = [];
                acc[cat.group].push(cat);
                return acc;
              }, {} as Record<string, typeof activeCategories>);

              const sortedGroups = Object.keys(groupedCategories).sort();

              return sortedGroups.map(groupName => (
                <div key={groupName} className="mb-6">
                  {/* Group Header */}
                  <h3 className="text-base font-semibold text-white mb-3 px-2">{groupName}</h3>

                  {/* Categories in this group */}
                  <div className="category-grid">
                    {groupedCategories[groupName].map(cat => {
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
                      className="category-tile"
                      onMouseEnter={() => setHoveredCategory(cat.name)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                    >
                      <div className="left">
                        <img className="icon-24" src={getCardArt(cat.name.toLowerCase())} alt="" />
                        <div>
                          <div className="name">{cat.name}</div>
                          <div className="sub">{cat.group}</div>
                        </div>
                      </div>
                      <div className="right">
                        {leaders.length > 0 && (
                          <>
                            <div className="leader-chip">
                              <div className="avatar">{leaders[0].name.charAt(0)}</div>
                              <div className="points">{leaders[0].score}</div>
                            </div>
                            {leaders.length > 1 && (
                              <div className="sub">+{leaders[0].score - leaders[1].score}</div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Popover on hover - follows mouse */}
                    {hoveredCategory === cat.name && allScores.length > 0 && (
                      <div
                        className="fixed z-50 w-72 rounded-lg shadow-2xl overflow-hidden pointer-events-none"
                        style={{
                          left: `${Math.min(mousePos.x + 10, window.innerWidth - 300)}px`,
                          top: `${Math.min(mousePos.y + 10, window.innerHeight - 300)}px`,
                          backgroundColor: 'rgba(255, 255, 255, 0.98)',
                          border: '3px solid rgb(100, 116, 139)',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        }}
                      >
                        <div className="px-4 py-3 border-b-2 border-slate-400" style={{ backgroundColor: 'rgba(241, 245, 249, 0.98)' }}>
                          <div className="flex items-center gap-2">
                            <img
                              src={getCardArt(cat.name.toLowerCase())}
                              alt=""
                              width="20"
                              height="20"
                              style={{ objectFit: 'contain' }}
                            />
                            <span className="text-sm font-bold text-slate-900">{cat.name}</span>
                          </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 border-b-2 border-slate-300" style={{ backgroundColor: 'rgba(241, 245, 249, 0.98)' }}>
                              <tr>
                                <th className="text-left px-4 py-2 font-semibold text-slate-900">Player</th>
                                <th className="text-right px-4 py-2 font-semibold text-slate-900">Points</th>
                              </tr>
                            </thead>
                            <tbody>
                              {allScores.map((player, idx) => (
                                <tr
                                  key={player.playerId}
                                  className={`border-t border-slate-200`}
                                  style={{
                                    backgroundColor: player.playerId === meId ? 'rgba(243, 232, 255, 0.98)' : 'rgba(255, 255, 255, 0.98)'
                                  }}
                                >
                                  <td className="px-4 py-2 font-medium text-slate-900">{player.name}</td>
                                  <td className="px-4 py-2 text-right font-bold text-slate-900">
                                    {player.score}
                                    {player.delta > 0 && (
                                      <span className="text-xs text-green-700 font-semibold ml-1">+{player.delta}</span>
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
                </div>
              ));
            })()}
          </section>

          {/* Board Section */}
          <section className="section-board">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Board</h2>
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
            <div className="panel board-rows">
              {boardPlayers.map((seat: any) => {
                const card = seat.currentFaceUpCard;

                return (
                  <div key={seat.playerId} className="row">
                    <div className="w-6 h-6 rounded-full bg-slate-400 flex items-center justify-center text-xs font-bold text-white">
                      {seat.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-white">{seat.name}</span>
                    <div className="chips">
                      {card && (
                        <MiniCardChip
                          categoryId={card.category.toLowerCase()}
                          value={card.value}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Hand Section */}
          <section className="section-hand">
            <div className="panel overflow-hidden">
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
                    <div className="hand-grid">
                      {myHand.slice(0, 3).map((card, i) => {
                        const isSelected = slotA?.index === i || slotB?.index === i;
                        // Find the group for this category
                        const categoryInfo = activeCategories.find(cat => cat.name === card.category);
                        return (
                          <CardShell
                            key={i}
                            categoryId={card.category.toLowerCase()}
                            name={card.category}
                            group={categoryInfo?.group}
                            value={card.value}
                            selected={isSelected}
                            onClick={() => selectCard(card, i)}
                          />
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
            {slotA ? (
              !isFaceUp ? (
                <div className="slot-mini">
                  <img src="/assets/card_art/card_back.png" alt="Card back" />
                  <div className="next-chip">next fair</div>
                </div>
              ) : (
                <div className="slot-mini">
                  <img src={getCardArt(slotA.card.category.toLowerCase())} alt="" />
                </div>
              )
            ) : (
              <div className="slot-mini">
                <span className="text-xs text-slate-400">Slot A</span>
              </div>
            )}

            {/* Slot B */}
            {slotB ? (
              isFaceUp ? (
                <div className="slot-mini">
                  <img src="/assets/card_art/card_back.png" alt="Card back" />
                  <div className="next-chip">next fair</div>
                </div>
              ) : (
                <div className="slot-mini">
                  <img src={getCardArt(slotB.card.category.toLowerCase())} alt="" />
                </div>
              )
            ) : (
              <div className="slot-mini">
                <span className="text-xs text-slate-400">Slot B</span>
              </div>
            )}

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
