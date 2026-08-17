'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  backHref?: string;
  right?: ReactNode;
}

/**
 * Unified sticky page header used across all desktop sidebar-linked pages.
 * Keeps back-button styling, height, background, and border consistent.
 */
export default function PageHeader({ title, backHref = '/', right }: PageHeaderProps) {
  return (
    <header className="sticky top-0 w-full h-16 z-50 border-b border-white/10 bg-shaded-canopy/95 backdrop-blur-md flex items-center justify-between px-6 select-none shrink-0">
      {/* Left: back + page title */}
      <div className="flex items-center gap-4">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 text-sm font-semibold text-cloud-white/70 hover:text-cloud-white transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back
        </Link>
        <h1 className="text-base font-bold text-toka-flare tracking-tight border-l border-white/15 pl-4">
          {title}
        </h1>
      </div>

      {/* Right: optional action slot */}
      {right && (
        <div className="flex items-center gap-3">
          {right}
        </div>
      )}
    </header>
  );
}
