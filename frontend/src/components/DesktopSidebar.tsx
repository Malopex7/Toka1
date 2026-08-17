"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useFeedStore } from '@/store/useFeedStore';
import AuthModal from './AuthModal';
import UploadModal from './UploadModal';
import GoLiveOverlay from './live/GoLiveOverlay';
import {
  TokaHomeIcon,
  TokaDiscoverIcon,
  TokaLiveIcon,
  TokaInboxIcon,
  TokaSponsorshipsIcon,
  IconProps
} from './icons/TokaIcons';
import { useLiveStore } from '@/store/useLiveStore';

interface NavItem {
  label: string;
  href: string;
  customIcon?: React.ComponentType<IconProps>;
  icon?: string;
  active: boolean;
  badge?: boolean;
  liveBadge?: boolean;
  onClick?: () => void;
}

export default function DesktopSidebar() {
  const pathname = usePathname();
  const { isAuthenticated, mongooseUser, logout } = useAuth();
  const notifications = useFeedStore((state) => state.notifications);
  const markNotificationsAsRead = useFeedStore((state) => state.markNotificationsAsRead);
  const openGoLive = useLiveStore((state) => state.openGoLive);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const hasUnreadInbox = notifications.some((n) => !n.read);

  const clearInboxDot = () => {
    if (hasUnreadInbox) {
      markNotificationsAsRead();
    }
  };

  const navItems: NavItem[] = [
    {
      label: 'Home',
      href: '/',
      customIcon: TokaHomeIcon,
      active: pathname === '/'
    },
    {
      label: 'Discover',
      href: '/discover',
      customIcon: TokaDiscoverIcon,
      active: pathname === '/discover'
    },
    {
      label: 'Live',
      href: '/live',
      customIcon: TokaLiveIcon,
      active: pathname === '/live' || pathname.startsWith('/live/')
    },
    {
      label: 'Inbox',
      href: '/inbox',
      customIcon: TokaInboxIcon,
      active: pathname === '/inbox',
      badge: hasUnreadInbox,
      onClick: clearInboxDot
    }
  ];

  if (isAuthenticated && mongooseUser?.isBrandSafeVerified) {
    navItems.push({
      label: 'Sponsorships',
      href: '/sponsorships',
      customIcon: TokaSponsorshipsIcon,
      active: pathname === '/sponsorships'
    });
  }

  if (isAuthenticated && mongooseUser?.role === 'moderator') {
    navItems.push({
      label: 'Moderation',
      href: '/moderation',
      icon: 'shield',
      active: pathname === '/moderation'
    });
  }

  return (
    <>
      <aside className="hidden md:flex flex-col h-full w-64 bg-shaded-canopy border-r border-white/10 py-5 px-4 shrink-0 select-none">
        {/* Toka Brand Logo Header */}
        <div className="px-2 mb-8" style={{ marginTop: '2.5rem' }}>
          <Link
            href="/"
            className="flex items-center select-none hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <img
              src="/images/TokaLogo.svg"
              alt="Toka"
              className="h-10 w-auto object-contain drop-shadow-sm"
            />
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const CustomIcon = item.customIcon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={item.onClick}
                className={`flex items-center gap-4 px-3.5 py-2.5 rounded-xl transition-all text-left relative group ${item.active
                  ? 'bg-white/10 text-cloud-white font-bold shadow-sm'
                  : 'text-cloud-white/70 hover:bg-white/5 hover:text-cloud-white'
                  }`}
              >
                {CustomIcon ? (
                  <CustomIcon
                    size={24}
                    className={`shrink-0 transition-colors ${item.active
                      ? 'text-toka-flare'
                      : 'text-cloud-white/70 group-hover:text-cloud-white'
                      }`}
                  />
                ) : (
                  <span
                    className={`material-symbols-outlined text-[24px] ${item.active ? 'material-symbols-filled text-toka-flare' : ''
                      }`}
                  >
                    {item.icon}
                  </span>
                )}
                <span>{item.label}</span>
                {item.badge && (
                  <span className="absolute top-4 right-4 w-2 h-2 bg-toka-flare rounded-full"></span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Anchored Bottom Tray Area */}
        <div className="mt-auto pt-4 flex flex-col gap-3">
          {/* Action Buttons: Side-by-side + Create and Go Live */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (isAuthenticated) {
                  setIsUploadModalOpen(true);
                } else {
                  setIsAuthModalOpen(true);
                }
              }}
              className="flex-1 py-2 px-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-cloud-white rounded-full font-bold text-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Create</span>
            </button>

            {isAuthenticated && (
              <button
                onClick={openGoLive}
                title="Go Live"
                className="py-2 px-3 bg-red-950/40 hover:bg-red-900/40 border border-red-800/60 text-red-400 hover:text-red-300 rounded-[6px] font-semibold text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shrink-0"
              >
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>Go Live</span>
              </button>
            )}
          </div>

          {/* Redesigned Creator Profile & Wallet Card */}
          {isAuthenticated ? (
            <div className="bg-[#18181B] border border-white/10 rounded-[10px] p-3 shadow-lg flex flex-col gap-2.5 select-none">
              {/* Header: Avatar + @username + Signout Icon */}
              <div className="flex items-center justify-between gap-2">
                <Link
                  href="/profile"
                  className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-90 transition-opacity"
                >
                  <div className="toka-rainbow-halo w-9 h-9 shrink-0">
                    <div className="toka-rainbow-halo-inner text-xs font-bold text-cloud-white">
                      {mongooseUser?.avatarUrl ? (
                        <img
                          src={mongooseUser.avatarUrl}
                          alt={mongooseUser.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (mongooseUser?.username?.charAt(0) || 'U').toUpperCase()
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-xs text-cloud-white truncate flex items-center gap-1">
                      @{mongooseUser?.username}
                      {mongooseUser?.isBrandSafeVerified && (
                        <span className="material-symbols-outlined text-[13px] text-[#10B981]">
                          verified
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-cloud-white/50 capitalize truncate">
                      {mongooseUser?.role || 'Creator'}
                    </span>
                  </div>
                </Link>

                <button
                  onClick={logout}
                  title="Sign Out"
                  className="w-7 h-7 rounded-[8px] hover:bg-red-500/15 text-cloud-white/40 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                </button>
              </div>

              {/* Fintech Balance Pill (Geist Mono + Fintech Mint #10B981) */}
              <Link
                href="/deposit"
                className="flex items-center justify-between px-2.5 py-1.5 bg-black/40 hover:bg-black/60 border border-white/5 hover:border-[#10B981]/30 rounded-[8px] transition-all group"
              >
                <span className="text-[11px] text-cloud-white/60 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  Wallet Balance
                </span>
                <span className="font-mono font-bold text-[#10B981] text-xs tracking-tight">
                  ZAR {mongooseUser?.walletBalance ? mongooseUser.walletBalance.toFixed(2) : '0.00'}
                </span>
              </Link>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full py-2.5 bg-[#FF4F00] hover:bg-[#FF4F00]/90 text-cloud-white rounded-[10px] font-bold text-sm shadow-lg shadow-[#FF4F00]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">login</span>
              <span>Sign In</span>
            </button>
          )}
        </div>
      </aside>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </>
  );
}
