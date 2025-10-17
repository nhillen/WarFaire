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

  const mySeat = game?.seats?.find(s => s.playerId === meId);
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

  const hasActed = mySeat?.hasActed || false;
  const waitingForOthers = hasActed || (game.phase.includes('Round') && myHand.length === 0);

  return (
    <div className="h-full flex flex-col p-4 bg-gray-50 overflow-auto">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">
              🎪 Faire {currentFair} - Round {currentRound}
            </h2>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="font-semibold">{mySeat?.name}</span>
            </div>
            <div>
              🏆 VP: <span className="font-bold">{myTotalVP}</span>
            </div>
            <div>
              🎖️ Ribbons: <span className="font-bold">{myRibbons.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-4">
        {/* Left Panel - Categories */}
        <div className="col-span-3 bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-bold mb-4">🏅 Active Categories</h3>
          <div className="space-y-2">
            {activeCategories.map(cat => {
              const emoji = CATEGORY_EMOJIS[cat.name] || '';
              const prestige = categoryPrestige[cat.name] || 0;
              return (
                <div
                  key={cat.name}
                  className="border border-gray-200 rounded p-2"
                >
                  <div className="font-semibold text-sm">
                    {emoji} {cat.name}
                  </div>
                  <div className="text-xs text-gray-600">{cat.group}</div>
                  <div className="text-xs text-purple-600">Prestige: {prestige}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Panel - Game Area */}
        <div className="col-span-6 space-y-4">
          {/* Played Cards */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-bold mb-3">🎴 Your Played Cards This Faire</h3>
            <div className="grid grid-cols-6 gap-2">
              {myPlayedCards.length === 0 ? (
                <p className="col-span-6 text-gray-400 text-center py-4">No cards played yet</p>
              ) : (
                myPlayedCards.map((card, i) => renderCard(card, -i - 1, false))
              )}
            </div>
          </div>

          {/* Hand */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-bold mb-3">🃏 Your Hand</h3>
            {waitingForOthers ? (
              <p className="text-gray-400 text-center py-4">⏳ Waiting for other players...</p>
            ) : (
              <div className="grid grid-cols-6 gap-2">
                {myHand.length === 0 ? (
                  <p className="col-span-6 text-gray-400 text-center py-4">No cards in hand</p>
                ) : (
                  myHand.map((card, i) => renderCard(card, i, true))
                )}
              </div>
            )}
          </div>

          {/* Selection Area */}
          {!waitingForOthers && myHand.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-bold mb-3">📋 Select Cards to Play</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Face Up */}
                <div>
                  <h4 className="font-semibold mb-2">⬆️ Face-Up (scores this Faire)</h4>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[120px]">
                    {selectedFaceUp ? (
                      <>
                        {renderCard(selectedFaceUp.card, -100, false)}
                        {selectedFaceUp.card.isGroupCard && (
                          <select
                            value={faceUpCategory}
                            onChange={(e) => setFaceUpCategory(e.target.value)}
                            className="mt-2 w-full border border-gray-300 rounded p-2"
                          >
                            {activeCategories
                              .filter(c => c.group === selectedFaceUp.card.category)
                              .map(c => (
                                <option key={c.name} value={c.name}>{c.name}</option>
                              ))}
                          </select>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-400 text-center">Click a card to select</p>
                    )}
                  </div>
                </div>

                {/* Face Down */}
                <div>
                  <h4 className="font-semibold mb-2">⬇️ Face-Down (next Faire)</h4>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[120px]">
                    {selectedFaceDown ? (
                      <>
                        {renderCard(selectedFaceDown.card, -200, false)}
                        {selectedFaceDown.card.isGroupCard && (
                          <select
                            value={faceDownCategory}
                            onChange={(e) => setFaceDownCategory(e.target.value)}
                            className="mt-2 w-full border border-gray-300 rounded p-2"
                          >
                            {activeCategories
                              .filter(c => c.group === selectedFaceDown.card.category)
                              .map(c => (
                                <option key={c.name} value={c.name}>{c.name}</option>
                              ))}
                          </select>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-400 text-center">Click a card to select</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={submitCards}
                  disabled={!canSubmit}
                  className={`
                    flex-1 px-6 py-3 rounded-lg font-semibold transition-colors
                    ${canSubmit
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  ✅ Submit Cards
                </button>
                <button
                  onClick={clearSelection}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  🔄 Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Standings */}
        <div className="col-span-3 bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-bold mb-4">📊 Standings</h3>
          <div className="space-y-2">
            {game.seats
              .filter(s => s.playerId)
              .sort((a, b) => (b.totalVP || 0) - (a.totalVP || 0))
              .map((seat, index) => (
                <div
                  key={seat.playerId}
                  className={`
                    border rounded p-2
                    ${seat.playerId === meId ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                  `}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-500">#{index + 1}</span>
                    <span className="flex-1 font-semibold">{seat.name}</span>
                    <span className="font-bold text-green-600">{seat.totalVP || 0} VP</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    🎖️ {seat.ribbons?.length || 0} ribbons
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Leave Game Button */}
      <div className="mt-4 text-center">
        <button
          onClick={onStandUp}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Leave Game
        </button>
      </div>
    </div>
  );
}
