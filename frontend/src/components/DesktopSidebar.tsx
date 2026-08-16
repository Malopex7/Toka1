"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useFeedStore } from '@/store/useFeedStore';
import AuthModal from './AuthModal';
import UploadModal from './UploadModal';
import { TokaHomeIcon, TokaDiscoverIcon, TokaSponsorshipsIcon, IconProps } from './icons/TokaIcons';

interface NavItem {
  label: string;
  href: string;
  customIcon?: React.ComponentType<IconProps>;
  icon?: string;
  active: boolean;
  badge?: boolean;
  onClick?: () => void;
}

export default function DesktopSidebar() {
  const pathname = usePathname();
  const { isAuthenticated, mongooseUser, logout } = useAuth();
  const notifications = useFeedStore((state) => state.notifications);
  const markNotificationsAsRead = useFeedStore((state) => state.markNotificationsAsRead);
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
      label: 'Inbox',
      href: '/inbox',
      icon: 'mail',
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
      <aside className="hidden md:flex flex-col h-full w-64 bg-shaded-canopy border-r border-white/10 py-6 px-4 shrink-0 select-none">
        {/* Toka Logo */}
        <Link href="/" className="mb-8 px-4 flex items-center select-none block hover:opacity-90 transition-opacity">
          <img
            src="/images/logo/logo.png"
            alt="Toka"
            className="h-28 w-auto object-contain"
          />
        </Link>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => {
            const CustomIcon = item.customIcon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={item.onClick}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-left relative group ${
                  item.active
                    ? 'bg-white/10 text-cloud-white font-bold'
                    : 'text-cloud-white/70 hover:bg-white/5 hover:text-cloud-white'
                }`}
              >
                {CustomIcon ? (
                  <CustomIcon
                    size={24}
                    className={`shrink-0 transition-colors ${
                      item.active
                        ? 'text-toka-flare'
                        : 'text-cloud-white/70 group-hover:text-cloud-white'
                    }`}
                  />
                ) : (
                  <span
                    className={`material-symbols-outlined text-[24px] ${
                      item.active ? 'material-symbols-filled text-toka-flare' : ''
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

        {/* Create Video Action Button */}
        <div className="mt-4 px-1">
          <button
            onClick={() => {
              if (isAuthenticated) {
                setIsUploadModalOpen(true);
              } else {
                setIsAuthModalOpen(true);
              }
            }}
            className="w-full py-3 bg-toka-flare text-cloud-white rounded-xl font-bold hover:bg-toka-flare/90 transition-all shadow-lg flex justify-center items-center gap-2 text-sm active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Create
          </button>
        </div>

        {/* User / Auth Section at Bottom */}
        <div className="mt-auto pt-4">
          {isAuthenticated ? (
            <div className="flex flex-col gap-1.5 px-4 py-3 bg-black/25 border border-white/10 rounded-xl select-none">
              <Link
                href="/profile"
                className={`flex items-center gap-2.5 hover:opacity-90 transition-opacity ${
                  pathname === '/profile' ? 'text-toka-flare font-bold' : ''
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[20px] ${
                    pathname === '/profile'
                      ? 'material-symbols-filled text-toka-flare'
                      : 'text-toka-flare'
                  }`}
                >
                  person
                </span>
                <span className="font-bold text-sm text-cloud-white truncate">
                  @{mongooseUser?.username}
                </span>
              </Link>
              <Link
                href="/deposit"
                className="flex justify-between items-center text-xs mt-1 text-cloud-white/60 hover:text-cloud-white font-mono cursor-pointer transition-colors group"
              >
                <span>Wallet:</span>
                <span className="font-bold text-fintech-mint group-hover:underline">
                  ZAR {mongooseUser?.walletBalance ? mongooseUser.walletBalance.toFixed(2) : '0.00'}
                </span>
              </Link>
              <button
                onClick={logout}
                className="text-left text-xs font-bold text-red-500 hover:text-red-400 mt-2.5 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full py-3 bg-gradient-to-r from-toka-flare to-orange-600 rounded-xl text-cloud-white font-bold text-sm shadow-lg shadow-toka-flare/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">login</span>
              Sign In
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
