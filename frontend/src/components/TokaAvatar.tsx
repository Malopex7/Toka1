"use client";
import React from 'react';

interface TokaAvatarProps {
  src?: string | null;
  alt?: string;
  username?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
  innerClassName?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  title?: string;
  interactive?: boolean;
}

export default function TokaAvatar({
  src,
  alt,
  username = '',
  size = 'md',
  className = '',
  innerClassName = '',
  onClick,
  title,
  interactive = false
}: TokaAvatarProps) {
  const sizeMap: Record<string, { outer: string; haloPadding: string; textSize: string }> = {
    xs: { outer: 'w-6 h-6', haloPadding: 'p-[1.5px]', textSize: 'text-[9px]' },
    sm: { outer: 'w-8 h-8', haloPadding: 'p-[2px]', textSize: 'text-xs' },
    md: { outer: 'w-10 h-10', haloPadding: 'p-[2.5px]', textSize: 'text-sm' },
    lg: { outer: 'w-12 h-12', haloPadding: 'p-[2.5px]', textSize: 'text-base' },
    xl: { outer: 'w-16 h-16', haloPadding: 'p-[3px]', textSize: 'text-xl' },
    '2xl': { outer: 'w-24 h-24', haloPadding: 'p-[3.5px]', textSize: 'text-3xl' },
    '3xl': { outer: 'w-28 h-28 md:w-32 md:h-32', haloPadding: 'p-[4px]', textSize: 'text-4xl' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;
  const initial = username ? username.charAt(0).toUpperCase() : (alt ? alt.charAt(0).toUpperCase() : 'T');

  return (
    <div
      onClick={onClick}
      title={title || (username ? `@${username}` : undefined)}
      className={`toka-rainbow-halo ${currentSize.outer} ${currentSize.haloPadding} ${
        onClick || interactive ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform' : ''
      } ${className}`}
    >
      <div className={`toka-rainbow-halo-inner ${innerClassName}`}>
        {src ? (
          <img
            src={src}
            alt={alt || username || 'Avatar'}
            className="w-full h-full object-cover select-none"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <span className={`font-black text-cloud-white select-none ${currentSize.textSize} uppercase font-sans`}>
            {initial}
          </span>
        )}
      </div>
    </div>
  );
}
