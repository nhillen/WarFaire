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
  const [slotA, setSlotA] = useState<{ card: Card; index: number } | null>(null);
  const [slotB, setSlotB] = useState<{ card: Card; index: number } | null>(null);
  const [isFaceUp, setIsFaceUp] = useState(true);
  const [showStandings, setShowStandings] = useState(false);
  const [activeTab, setActiveTab] = useState<'hand' | 'played'>('hand');

  const mySeat = game?.seats?.find(s => s && s.playerId === meId);
  const myHand = mySeat?.hand || [];
  const myPlayedCards = mySeat?.playedCards || [];
  const myTotalVP = mySeat?.totalVP || 0;

  const activeCategories = game?.activeCategories || [];
  const categoryPrestige = game?.categoryPrestige || {};
  const currentFair = game?.currentFair || 1;
  const currentRound = game?.currentRound || 1;

  // Auto-sit player when they first see the game
  useEffect(() => {
    if (game && !isSeated && game.phase === 'Lobby') {
      // Find first empty seat
      const emptySeatIndex = game.seats.findIndex(s => !s || !s.playerId);
      if (emptySeatIndex !== -1) {
        onSitDown(emptySeatIndex, 1000);
      }
    }
  }, [game, isSeated]);

  // Reset selections when round changes
  useEffect(() => {
    setSlotA(null);
    setSlotB(null);
    setIsFaceUp(true);
  }, [currentRound, currentFair]);

  const selectCard = (card: Card, index: number) => {
    console.log('Card clicked:', { card, index, slotA, slotB });

    // If card already in slot A, remove it
    if (slotA?.index === index) {
      setSlotA(null);
      return;
    }
    // If card already in slot B, remove it
    if (slotB?.index === index) {
      setSlotB(null);
      return;
    }

    // Add to first empty slot
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
      console.log('Cannot submit - missing cards:', { slotA, slotB });
      return;
    }

    console.log('Submitting cards:', { slotA, slotB, isFaceUp });

    onPlayerAction('play_cards', {
      faceUpCard: isFaceUp ? slotA.card : slotB.card,
      faceDownCard: isFaceUp ? slotB.card : slotA.card,
      groupSelections: {}
    });

    clearSelection();
  };

  const canSubmit = slotA && slotB;

  if (!game) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-xl text-gray-500">Loading...</div>
      </div>
    );
  }

  // Lobby view
  if (game.phase === 'Lobby') {
    const seatedPlayers = game.seats.filter((s: any) => s && s.playerId);
    const canStart = seatedPlayers.length >= 2;
    const emptySeats = game.seats.filter((s: any) => !s || !s.playerId).length;

    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">War Faire</h2>
            <p className="text-sm text-slate-600">{seatedPlayers.length} / 10 seated</p>
          </div>

          {/* Compact seat grid */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
            <div className="grid grid-cols-5 gap-2">
              {game.seats.map((seat: any, index: number) => (
                <div
                  key={index}
                  className={`
                    border rounded p-2 text-center text-xs
                    ${seat && seat.playerId
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-200 bg-slate-50'
                    }
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

          {/* Action buttons */}
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
                onClick={() => onPlayerAction('add_ai', { count: 9 })}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                +9 AI
              </button>
            )}
            {emptySeats >= 4 && (
              <button
                onClick={() => onPlayerAction('add_ai', { count: 4 })}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                +4 AI
              </button>
            )}
            {emptySeats > 0 && (
              <button
                onClick={() => onPlayerAction('fill_ai')}
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

  const hasActed = mySeat?.hasActed || false;
  const waitingForOthers = hasActed;

  // Main game view - single screen, no scrolling
  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Top bar - 44px */}
      <div className="h-11 bg-white border-b border-slate-200 px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-bold">Fair {currentFair} · Round {currentRound}</h1>
          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">{mySeat?.name}</span>
          <span className="text-xs text-slate-600">{myTotalVP} VP</span>
        </div>
        <button
          onClick={() => setShowStandings(!showStandings)}
          className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded"
        >
          {showStandings ? 'Hide' : 'Show'} Stats
        </button>
      </div>

      {/* Main content - flex to fill remaining space */}
      <div className="flex-1 grid grid-cols-12 gap-3 p-3 overflow-hidden">
        {/* Left: Categories - 3 columns */}
        <div className="col-span-3 overflow-y-auto">
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <h2 className="text-sm font-bold mb-2">Categories</h2>
            <div className="grid grid-cols-2 gap-2">
              {activeCategories.map(cat => {
                const emoji = CATEGORY_EMOJIS[cat.name] || '';
                const prestige = categoryPrestige[cat.name] || 0;
                return (
                  <div
                    key={cat.name}
                    className="border border-slate-200 rounded p-2 h-14 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{emoji} {cat.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                        {prestige}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">{cat.group}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center: Board - 6 columns */}
        <div className="col-span-6 flex flex-col gap-2 overflow-hidden">
          {/* Board - visible plays */}
          <div className="bg-white rounded-lg border border-slate-200 p-3 flex-shrink-0">
            <h2 className="text-sm font-bold mb-2">Board</h2>
            <div className="space-y-1">
              {game.seats
                .filter(s => s && s.playerId)
                .map((seat: any) => {
                  const card = seat.currentFaceUpCard;
                  const emoji = card ? CATEGORY_EMOJIS[card.category] || '' : '';
                  return (
                    <div
                      key={seat.playerId}
                      className={`flex items-center gap-2 px-2 py-1 rounded border text-xs ${
                        seat.playerId === meId
                          ? 'bg-purple-50 border-purple-300'
                          : 'border-slate-100'
                      }`}
                    >
                      <span className="flex-1 font-medium truncate">{seat.name}</span>
                      {card ? (
                        <span className="font-bold text-purple-600">{emoji} {card.value}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Hand / Played tabs */}
          <div className="bg-white rounded-lg border border-slate-200 flex-1 flex flex-col overflow-hidden">
            <div className="border-b border-slate-200 px-3 pt-2 pb-0 flex gap-3">
              <button
                onClick={() => setActiveTab('hand')}
                className={`pb-2 px-1 text-xs font-medium border-b transition-colors ${
                  activeTab === 'hand'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-slate-600'
                }`}
              >
                Hand
              </button>
              <button
                onClick={() => setActiveTab('played')}
                className={`pb-2 px-1 text-xs font-medium border-b transition-colors ${
                  activeTab === 'played'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-slate-600'
                }`}
              >
                Plays
              </button>
            </div>

            <div className="p-3 overflow-y-auto flex-1">
              {activeTab === 'hand' ? (
                waitingForOthers ? (
                  <p className="text-center py-4 text-xs text-slate-500">Waiting for others...</p>
                ) : myHand.length === 0 ? (
                  <p className="text-center py-4 text-xs text-slate-500">No cards</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {myHand.map((card, i) => {
                      const isSelected = slotA?.index === i || slotB?.index === i;
                      const emoji = CATEGORY_EMOJIS[card.category] || '';
                      return (
                        <div
                          key={i}
                          onClick={() => selectCard(card, i)}
                          className={`relative border rounded p-2 cursor-pointer ${
                            isSelected
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-base">{emoji}</span>
                            <span className="px-1 py-0.5 bg-slate-100 rounded-full text-xs font-bold">
                              {card.value}
                            </span>
                          </div>
                          <div className="text-[10px] font-medium text-slate-700">{card.category}</div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                myPlayedCards.length === 0 ? (
                  <p className="text-center py-4 text-xs text-slate-500">No plays yet</p>
                ) : (
                  <div className="grid grid-cols-6 gap-1">
                    {myPlayedCards.map((card, i) => {
                      const emoji = CATEGORY_EMOJIS[card.category] || '';
                      return (
                        <div key={i} className="border border-slate-200 rounded p-1 text-center">
                          <div className="text-xs">{emoji}</div>
                          <div className="text-sm font-bold">{card.value}</div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Right: Stats - 3 columns */}
        <div className="col-span-3 overflow-y-auto">
          {showStandings && (
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <h2 className="text-sm font-bold mb-2">Standings</h2>
              <div className="space-y-1">
                {game.seats
                  .filter(s => s && s.playerId)
                  .sort((a, b) => (b.totalVP || 0) - (a.totalVP || 0))
                  .map((seat, index) => (
                    <div
                      key={seat.playerId}
                      className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                        seat.playerId === meId ? 'bg-purple-50 border border-purple-300' : ''
                      }`}
                    >
                      <span className="text-[10px] font-bold text-slate-500 w-4">#{index + 1}</span>
                      <span className="flex-1 truncate font-medium">{seat.name}</span>
                      <span className="font-bold text-purple-600">{seat.totalVP || 0}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar - 56px */}
      {!waitingForOthers && myHand.length > 0 && (
        <div className="h-14 bg-white border-t border-slate-200 px-4 flex items-center gap-3">
          {/* Slot A */}
          <div className="flex-1 border border-dashed border-slate-300 rounded p-2 h-10 flex items-center">
            {slotA ? (
              <div className="flex items-center gap-2 w-full">
                <span className="text-sm">{CATEGORY_EMOJIS[slotA.card.category]}</span>
                <span className="text-xs font-medium truncate">{slotA.card.category}</span>
                <span className="ml-auto font-bold text-purple-600">{slotA.card.value}</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400">Slot A</span>
            )}
          </div>

          {/* Slot B */}
          <div className="flex-1 border border-dashed border-slate-300 rounded p-2 h-10 flex items-center">
            {slotB ? (
              <div className="flex items-center gap-2 w-full">
                <span className="text-sm">{CATEGORY_EMOJIS[slotB.card.category]}</span>
                <span className="text-xs font-medium truncate">{slotB.card.category}</span>
                <span className="ml-auto font-bold text-purple-600">{slotB.card.value}</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400">Slot B</span>
            )}
          </div>

          {/* Face-Up toggle */}
          <button
            onClick={() => setIsFaceUp(!isFaceUp)}
            className={`px-3 py-2 rounded text-xs font-medium ${
              isFaceUp
                ? 'bg-purple-600 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {isFaceUp ? 'A Face-Up' : 'B Face-Up'}
          </button>

          {/* Submit */}
          <button
            onClick={submitCards}
            disabled={!canSubmit}
            className={`px-4 py-2 rounded text-xs font-semibold ${
              canSubmit
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            Submit
          </button>

          {/* Clear */}
          <button
            onClick={clearSelection}
            className="px-3 py-2 bg-slate-600 text-white rounded hover:bg-slate-700 text-xs font-medium"
          >
            Clear
          </button>

          {/* Leave */}
          <button
            onClick={onStandUp}
            className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium"
          >
            Leave
          </button>
        </div>
      )}
    </div>
  );
}
