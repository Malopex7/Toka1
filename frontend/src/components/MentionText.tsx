"use client";
import React from 'react';
import Link from 'next/link';

interface MentionTextProps {
  text: string;
  className?: string;
  mentionClassName?: string;
}

export default function MentionText({
  text,
  className = '',
  mentionClassName = 'text-toka-flare hover:underline font-semibold cursor-pointer select-none'
}: MentionTextProps) {
  if (!text) return null;

  // Split string by @mentions (matches @username where username is alphanumeric and underscore)
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('@') && part.length > 1) {
          const rawUsername = part.slice(1);
          return (
            <Link
              key={index}
              href={`/profile?username=${rawUsername}`}
              onClick={(e) => e.stopPropagation()}
              className={mentionClassName}
            >
              {part}
            </Link>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}
