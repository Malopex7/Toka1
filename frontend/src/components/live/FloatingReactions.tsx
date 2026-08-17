"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface Particle {
  id: number;
  emoji: string;
  x: number;
  startedAt: number;
}

const EMOJIS = ["❤️", "🔥", "😍", "👏", "💯", "🎉", "💸"];
const DURATION_MS = 2800;

interface Props {
  /** Call this ref to programmatically trigger a reaction (e.g. from socket event) */
  triggerRef?: React.MutableRefObject<(() => void) | null>;
  className?: string;
}

let _id = 0;

export default function FloatingReactions({ triggerRef, className = "" }: Props) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const spawnReaction = useCallback((emoji?: string) => {
    const containerWidth = containerRef.current?.offsetWidth || 60;
    const chosen = emoji || EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    const x = 4 + Math.random() * (containerWidth - 40);
    const id = ++_id;
    setParticles((prev) => [...prev, { id, emoji: chosen, x, startedAt: Date.now() }]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, DURATION_MS + 200);
  }, []);

  // Expose trigger to parent via ref
  useEffect(() => {
    if (triggerRef) triggerRef.current = () => spawnReaction();
  }, [triggerRef, spawnReaction]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      aria-hidden
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute bottom-16 will-change-transform"
          style={{
            left: p.x,
            animation: `floatUp ${DURATION_MS}ms ease-out forwards`,
          }}
        >
          <span className="text-2xl select-none">{p.emoji}</span>
        </div>
      ))}
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1);   opacity: 1; }
          60%  { transform: translateY(-180px) scale(1.3); opacity: 0.9; }
          100% { transform: translateY(-320px) scale(0.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
