/**
 * MiniCardChip - Presentational Component
 * Compact card representation for Board rows
 * Shows 28px thumbnail with value pill to the right
 */

import React from 'react';
import { getCardArt } from './cardArt';

interface MiniCardChipProps {
  categoryId: string;
  value: number;
  className?: string;
}

export function MiniCardChip({ categoryId, value, className = '' }: MiniCardChipProps) {
  const artPath = getCardArt(categoryId.toLowerCase());

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {/* Card art thumbnail */}
      <img
        src={artPath}
        alt=""
        width="28"
        height="28"
        style={{
          objectFit: 'contain',
          borderRadius: '4px',
          border: '1px solid rgb(203, 213, 225)'
        }}
      />

      {/* Value pill */}
      <div
        className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-bold text-slate-900"
        style={{ minWidth: '20px', textAlign: 'center' }}
      >
        {value}
      </div>
    </div>
  );
}
