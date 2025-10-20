/**
 * LeaderChip - Presentational Component
 * Shows leader avatar with points and delta to second place
 */

import React from 'react';

interface LeaderChipProps {
  avatarText: string;  // First letter of player name
  points: number;
  delta?: number;  // Difference to second place
  className?: string;
}

export function LeaderChip({ avatarText, points, delta, className = '' }: LeaderChipProps) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Avatar */}
      <div
        className="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center text-xs font-bold text-purple-800"
      >
        {avatarText}
      </div>

      {/* Points badge */}
      <div
        className="px-2 py-0.5 bg-purple-100 rounded-full text-xs font-bold text-purple-800"
        style={{ minWidth: '24px', textAlign: 'center' }}
      >
        {points}
      </div>

      {/* Delta to second */}
      {delta !== undefined && delta > 0 && (
        <div
          className="text-xs text-slate-600"
          style={{ fontSize: '12px', lineHeight: '16px' }}
        >
          +{delta}
        </div>
      )}
    </div>
  );
}
