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
  const [selectedFaceUp, setSelectedFaceUp] = useState<{ card: Card; index: number } | null>(null);
  const [selectedFaceDown, setSelectedFaceDown] = useState<{ card: Card; index: number } | null>(null);
  const [faceUpCategory, setFaceUpCategory] = useState<string>('');
  const [faceDownCategory, setFaceDownCategory] = useState<string>('');

  const mySeat = game?.seats?.find(s => s && s.playerId === meId);
  const myHand = mySeat?.hand || [];
  const myPlayedCards = mySeat?.playedCards || [];
  const myRibbons = mySeat?.ribbons || [];
  const myTotalVP = mySeat?.totalVP || 0;

  const activeCategories = game?.activeCategories || [];
  const categoryPrestige = game?.categoryPrestige || {};
  const currentFair = game?.currentFair || 1;
  const currentRound = game?.currentRound || 1;

  // Reset selections when hand changes
  useEffect(() => {
    setSelectedFaceUp(null);
    setSelectedFaceDown(null);
    setFaceUpCategory('');
    setFaceDownCategory('');
  }, [currentRound, currentFair]);

  const selectCard = (card: Card, index: number) => {
    // If card is already selected, deselect it
    if (selectedFaceUp?.index === index) {
      setSelectedFaceUp(null);
      setFaceUpCategory('');
      return;
    }
    if (selectedFaceDown?.index === index) {
      setSelectedFaceDown(null);
      setFaceDownCategory('');
      return;
    }

    // Add to first empty slot
    if (!selectedFaceUp) {
      setSelectedFaceUp({ card, index });
      // Set default category for group cards
      if (card.isGroupCard) {
        const validCats = activeCategories.filter(c => c.group === card.category);
        if (validCats.length > 0) {
          setFaceUpCategory(validCats[0].name);
        }
      }
    } else if (!selectedFaceDown) {
      setSelectedFaceDown({ card, index });
      // Set default category for group cards
      if (card.isGroupCard) {
        const validCats = activeCategories.filter(c => c.group === card.category);
        if (validCats.length > 0) {
          setFaceDownCategory(validCats[0].name);
        }
      }
    }
  };

  const clearSelection = () => {
    setSelectedFaceUp(null);
    setSelectedFaceDown(null);
    setFaceUpCategory('');
    setFaceDownCategory('');
  };

  const submitCards = () => {
    if (!selectedFaceUp || !selectedFaceDown) {
      return;
    }

    const groupSelections: any = {};
    if (selectedFaceUp.card.isGroupCard) {
      groupSelections.faceUp = faceUpCategory;
    }
    if (selectedFaceDown.card.isGroupCard) {
      groupSelections.faceDown = faceDownCategory;
    }

    onPlayerAction('play_cards', {
      faceUpCard: selectedFaceUp.card,
      faceDownCard: selectedFaceDown.card,
      groupSelections
    });

    clearSelection();
  };

  const canSubmit = selectedFaceUp && selectedFaceDown &&
    (!selectedFaceUp.card.isGroupCard || faceUpCategory) &&
    (!selectedFaceDown.card.isGroupCard || faceDownCategory);

  const renderCard = (card: Card, index: number, selectable: boolean = true) => {
    const isSelected = selectedFaceUp?.index === index || selectedFaceDown?.index === index;
    const emoji = CATEGORY_EMOJIS[card.category] || '';

    return (
      <div
        key={index}
        onClick={() => selectable && selectCard(card, index)}
        className={`
          relative border-2 rounded-lg p-3 cursor-pointer transition-all
          ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'}
          ${!selectable && 'cursor-default'}
        `}
      >
        <div className="text-sm font-semibold text-gray-700">
          {emoji} {card.category}
        </div>
        <div className="text-3xl font-bold text-center mt-2">{card.value}</div>
        {card.isGroupCard && (
          <div className="absolute top-1 right-1 text-xs bg-purple-500 text-white px-2 py-1 rounded">
            GROUP
          </div>
        )}
      </div>
    );
  };

  if (!game) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-xl text-gray-500">Loading game...</div>
      </div>
    );
  }

  if (!isSeated) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">🎪 War Faire</h2>
          <p className="text-gray-600 mb-6">A strategic card game of rivalry and prestige</p>
          <button
            onClick={() => onSitDown(0, 1000)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Join Game
          </button>
        </div>
      </div>
    );
  }

  // Lobby view - show table and seats before game starts
  if (game.phase === 'Lobby') {
    const seatedPlayers = game.seats.filter((s: any) => s && s.playerId);
    const canStart = seatedPlayers.length >= 2;
    const emptySeats = game.seats.filter((s: any) => !s || !s.playerId).length;

    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-green-50 to-yellow-50">
        <div className="max-w-5xl w-full">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold mb-2">🎪 War Faire Lobby</h2>
            <p className="text-lg text-gray-600">Waiting for players to join...</p>
            <p className="text-sm text-gray-500 mt-1">
              {seatedPlayers.length} / 10 players seated • Minimum 2 players to start
            </p>
          </div>

          {/* Table with seats */}
          <div className="bg-white rounded-xl shadow-xl p-6 mb-4">
            <div className="grid grid-cols-5 gap-3">
              {game.seats.map((seat: any, index: number) => (
                <div
                  key={index}
                  className={`
                    relative border-2 rounded p-2 text-center transition-all
                    ${seat && seat.playerId
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 bg-gray-50 border-dashed'
                    }
                    ${seat && seat.playerId === meId ? 'ring-2 ring-blue-400' : ''}
                  `}
                >
                  {seat && seat.playerId ? (
                    <>
                      <div className="text-xl mb-1">
                        {seat.isAI ? '🤖' : '👤'}
                      </div>
                      <div className="font-semibold text-xs truncate">
                        {seat.name}
                        {seat.playerId === meId && ' (You)'}
                      </div>
                      {seat.isAI && (
                        <div className="text-[10px] text-gray-500">AI</div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-xl mb-1 text-gray-300">💺</div>
                      <div className="text-[10px] text-gray-400">Seat {index + 1}</div>
                      <div className="text-[10px] text-gray-400">Empty</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 justify-center flex-wrap">
            {canStart && (
              <button
                onClick={() => onPlayerAction('start_hand')}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-lg"
              >
                🎮 Start Game
              </button>
            )}
            {emptySeats > 0 && (
              <button
                onClick={() => onPlayerAction('fill_ai')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-lg"
              >
                🤖 Fill with AI ({emptySeats} seats)
              </button>
            )}
            <button
              onClick={onStandUp}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-lg"
            >
              🚪 Leave Table
            </button>
          </div>

          {!canStart && (
            <div className="text-center mt-3 text-gray-600">
              <p>⏳ Waiting for at least one more player...</p>
              <p className="text-sm text-gray-500 mt-1">
                Click "Fill with AI" or invite friends!
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const hasActed = mySeat?.hasActed || false;
  const waitingForOthers = hasActed || (game.phase.includes('Round') && myHand.length === 0);
  const [showStandings, setShowStandings] = useState(false);
  const [activeTab, setActiveTab] = useState<'hand' | 'played'>('hand');

  return (
    <div className="h-full flex flex-col bg-slate-100">
      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-slate-900">Faire {currentFair} · Round {currentRound}</h1>
            <div className="flex items-center gap-3 text-sm">
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded font-medium">{mySeat?.name}</span>
              <span className="text-slate-600">🏆 {myTotalVP} VP</span>
              <span className="text-slate-600">🎖️ {myRibbons.length} ribbons</span>
            </div>
          </div>
          <button
            onClick={() => setShowStandings(!showStandings)}
            className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded transition-colors"
          >
            {showStandings ? 'Hide' : 'Show'} Standings
          </button>
        </div>
      </div>

      {/* Main 12-Column Grid */}
      <div className="flex-1 overflow-auto pb-24">
        <div className="grid grid-cols-12 gap-4 p-4 h-full">
          {/* Left: Categories - 4 columns */}
          <div className="col-span-4 space-y-3">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <h2 className="text-base font-bold text-slate-900 mb-3">Active Categories</h2>
              <div className="space-y-2">
                {activeCategories.map(cat => {
                  const emoji = CATEGORY_EMOJIS[cat.name] || '';
                  const prestige = categoryPrestige[cat.name] || 0;
                  return (
                    <div
                      key={cat.name}
                      className="border border-slate-200 rounded-lg p-3 hover:border-purple-300 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm text-slate-800">
                          {emoji} {cat.name}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                          {prestige}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">{cat.group}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Center: Board - 6 columns */}
          <div className="col-span-6 space-y-3">
            {/* Visible Plays */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <h2 className="text-base font-bold text-slate-900 mb-3">Visible Plays</h2>
              <div className="space-y-2">
                {game.seats
                  .filter(s => s && s.playerId)
                  .map((seat: any) => {
                    const card = seat.currentFaceUpCard;
                    const emoji = card ? CATEGORY_EMOJIS[card.category] || '' : '';
                    return (
                      <div
                        key={seat.playerId}
                        className={`flex items-center gap-3 p-2 rounded border ${
                          seat.playerId === meId
                            ? 'bg-purple-50 border-purple-300'
                            : 'border-slate-200'
                        }`}
                      >
                        <span className={`flex-1 text-sm font-medium ${
                          seat.playerId === meId ? 'text-purple-900' : 'text-slate-700'
                        }`}>
                          {seat.name}
                        </span>
                        {card ? (
                          <span className="text-sm font-bold text-purple-600">
                            {emoji} {card.value}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Hand / Played Tabs */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
              <div className="border-b border-slate-200 px-4 pt-3 pb-0 flex gap-4">
                <button
                  onClick={() => setActiveTab('hand')}
                  className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'hand'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Hand
                </button>
                <button
                  onClick={() => setActiveTab('played')}
                  className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'played'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  This round's plays
                </button>
              </div>

              <div className="p-4">
                {activeTab === 'hand' ? (
                  waitingForOthers ? (
                    <p className="text-center py-6 text-sm text-slate-500">⏳ Waiting for other players...</p>
                  ) : myHand.length === 0 ? (
                    <p className="text-center py-6 text-sm text-slate-500">No cards in hand</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {myHand.map((card, i) => {
                        const isSelected = selectedFaceUp?.index === i || selectedFaceDown?.index === i;
                        const emoji = CATEGORY_EMOJIS[card.category] || '';
                        return (
                          <div
                            key={i}
                            onClick={() => selectCard(card, i)}
                            className={`relative border-2 rounded-lg p-3 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-purple-500 bg-purple-50 shadow-md'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-lg">{emoji}</span>
                              <span className="px-2 py-0.5 bg-slate-100 rounded-full text-sm font-bold text-slate-700">
                                {card.value}
                              </span>
                            </div>
                            <div className="text-xs font-medium text-slate-700">{card.category}</div>
                            {card.isGroupCard && (
                              <div className="absolute top-1 right-1 text-[9px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full uppercase font-bold">
                                Group
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  myPlayedCards.length === 0 ? (
                    <p className="text-center py-6 text-sm text-slate-500">No cards played yet</p>
                  ) : (
                    <div className="grid grid-cols-6 gap-2">
                      {myPlayedCards.map((card, i) => {
                        const emoji = CATEGORY_EMOJIS[card.category] || '';
                        return (
                          <div key={i} className="border border-slate-200 rounded p-2 text-center">
                            <div className="text-sm mb-1">{emoji}</div>
                            <div className="text-lg font-bold text-slate-700">{card.value}</div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Right: Standings - 2 columns */}
          <div className="col-span-2 space-y-3">
            {showStandings && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                <h2 className="text-base font-bold text-slate-900 mb-3">Standings</h2>
                <div className="space-y-2">
                  {game.seats
                    .filter(s => s && s.playerId)
                    .sort((a, b) => (b.totalVP || 0) - (a.totalVP || 0))
                    .map((seat, index) => (
                      <div
                        key={seat.playerId}
                        className={`flex items-center gap-2 p-2 rounded ${
                          seat.playerId === meId
                            ? 'bg-purple-50 border border-purple-300'
                            : 'border border-slate-100'
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-500 w-6">#{index + 1}</span>
                        <span className="flex-1 text-xs font-medium text-slate-700 truncate">
                          {seat.name}
                        </span>
                        <span className="text-sm font-bold text-purple-600">{seat.totalVP || 0}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Action Bar */}
      {!waitingForOthers && myHand.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-300 shadow-lg p-4 z-10">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            {/* Selection Tray */}
            <div className="flex-1 flex gap-4">
              {/* Face-Up Slot */}
              <div className="flex-1 border-2 border-dashed border-slate-300 rounded-lg p-3 min-h-[80px]">
                <div className="text-xs font-semibold text-slate-600 mb-1">Face-Up (scores now)</div>
                {selectedFaceUp ? (
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{CATEGORY_EMOJIS[selectedFaceUp.card.category]}</span>
                    <span className="text-sm font-medium text-slate-700">{selectedFaceUp.card.category}</span>
                    <span className="ml-auto text-lg font-bold text-purple-600">{selectedFaceUp.card.value}</span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center mt-2">Select a card</p>
                )}
                {selectedFaceUp?.card.isGroupCard && (
                  <select
                    value={faceUpCategory}
                    onChange={(e) => setFaceUpCategory(e.target.value)}
                    className="mt-2 w-full border border-slate-300 rounded p-1 text-xs"
                  >
                    {activeCategories
                      .filter(c => c.group === selectedFaceUp.card.category)
                      .map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                  </select>
                )}
              </div>

              {/* Face-Down Slot */}
              <div className="flex-1 border-2 border-dashed border-slate-300 rounded-lg p-3 min-h-[80px]">
                <div className="text-xs font-semibold text-slate-600 mb-1">Face-Down (next faire)</div>
                {selectedFaceDown ? (
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{CATEGORY_EMOJIS[selectedFaceDown.card.category]}</span>
                    <span className="text-sm font-medium text-slate-700">{selectedFaceDown.card.category}</span>
                    <span className="ml-auto text-lg font-bold text-purple-600">{selectedFaceDown.card.value}</span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center mt-2">Select a card</p>
                )}
                {selectedFaceDown?.card.isGroupCard && (
                  <select
                    value={faceDownCategory}
                    onChange={(e) => setFaceDownCategory(e.target.value)}
                    className="mt-2 w-full border border-slate-300 rounded p-1 text-xs"
                  >
                    {activeCategories
                      .filter(c => c.group === selectedFaceDown.card.category)
                      .map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                  </select>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={submitCards}
                disabled={!canSubmit}
                className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all ${
                  canSubmit
                    ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-md hover:shadow-lg'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                Submit
              </button>
              <button
                onClick={clearSelection}
                className="px-4 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-semibold"
              >
                Clear
              </button>
              <button
                onClick={onStandUp}
                className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
