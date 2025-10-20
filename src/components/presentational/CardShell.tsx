/**
 * CardShell - Presentational Component
 * Main card container with art regions:
 * - Top-left: Category icon (20px placeholder)
 * - Top-right: ValueBadge
 * - Center: ArtFrame with card art
 * - Bottom: NameBar with category name and group
 */

import React from 'react';
import { getCardArt } from './cardArt';
import { ValueBadge } from './ValueBadge';

interface CardShellProps {
  categoryId: string;
  categoryName: string;
  groupName?: string;
  value: number;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CardShell({
  categoryId,
  categoryName,
  groupName,
  value,
  isSelected = false,
  onClick,
  className = ''
}: CardShellProps) {
  const artPath = getCardArt(categoryId.toLowerCase());

  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-lg overflow-hidden border bg-white
        transition-all cursor-pointer
        ${isSelected
          ? 'border-purple-500 shadow-lg ring-1 ring-purple-500'
          : 'border-slate-300 hover:border-slate-400 hover:shadow-md'
        }
        ${className}
      `}
      style={{ aspectRatio: '5 / 7' }}
    >
      {/* Top-left: Category Icon (20px placeholder until icons ready) */}
      <div className="absolute top-2 left-2 z-10">
        <img
          src={artPath}
          alt=""
          width="20"
          height="20"
          style={{ objectFit: 'contain' }}
        />
      </div>

      {/* Top-right: ValueBadge */}
      <ValueBadge value={value} />

      {/* Center: ArtFrame */}
      <div className="flex items-center justify-center p-4" style={{ height: '70%' }}>
        <picture>
          <img
            src={artPath}
            alt={categoryName}
            width="100%"
            decoding="async"
            loading="lazy"
            style={{
              aspectRatio: '5 / 3.5',
              width: '100%',
              objectFit: 'contain',
              display: 'block',
              background: 'transparent',
              borderRadius: '6px'
            }}
          />
        </picture>
      </div>

      {/* Bottom: NameBar */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/95 border-t border-slate-200 px-3 py-2">
        <div
          className="font-medium text-slate-900 truncate"
          style={{ fontSize: '14px', lineHeight: '20px' }}
        >
          {categoryName}
        </div>
        {groupName && (
          <div
            className="text-slate-600 truncate"
            style={{ fontSize: '12px', lineHeight: '16px' }}
          >
            {groupName}
          </div>
        )}
      </div>
    </div>
  );
}
