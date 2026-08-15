"use client";
import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PWAProvider() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    // 1) Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    }

    // 2) Handle Chrome / Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      
      const lastDismissed = localStorage.getItem('toka_pwa_dismissed');
      if (lastDismissed) {
        const diffDays = (Date.now() - parseInt(lastDismissed, 10)) / (1000 * 60 * 60 * 24);
        if (diffDays < 7) return;
      }

      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 3) Detect iOS Safari for manual Add to Home Screen instructions after delay
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent.toLowerCase() : '';
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = isAppleDevice && /safari/.test(userAgent) && !/crios|fxios|opios/.test(userAgent);
    const isStandalone = typeof window !== 'undefined' && 
      (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);

    let iosTimer: NodeJS.Timeout | null = null;
    if (isSafari && !isStandalone) {
      const iosDismissed = localStorage.getItem('toka_ios_pwa_dismissed');
      if (!iosDismissed) {
        iosTimer = setTimeout(() => {
          setIsIOS(true);
          setShowIOSPrompt(true);
        }, 2000);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    setShowInstallBanner(false);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User choice: ${outcome}`);
    setDeferredPrompt(null);
  };

  const handleDismissBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('toka_pwa_dismissed', Date.now().toString());
  };

  const handleDismissIOS = () => {
    setShowIOSPrompt(false);
    localStorage.setItem('toka_ios_pwa_dismissed', Date.now().toString());
  };

  return (
    <>
      {/* Android / Chrome Native Install Banner */}
      {showInstallBanner && (
        <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 z-50 max-w-sm bg-shaded-canopy/95 backdrop-blur-xl border border-toka-flare/40 rounded-3xl p-4 shadow-2xl shadow-toka-flare/20 animate-fade-in flex flex-col gap-3 font-sans select-none">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-toka-flare to-orange-700 p-0.5 shadow-md flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/icons/icon-192x192.png" alt="Toka" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <h4 className="text-xs font-black text-cloud-white tracking-tight">Install Toka App</h4>
              <p className="text-[10px] text-cloud-white/60 leading-tight mt-0.5">
                Add to your home screen for fast full-screen streaming.
              </p>
            </div>
            <button
              onClick={handleDismissBanner}
              className="text-cloud-white/40 hover:text-cloud-white p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDismissBanner}
              className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 text-cloud-white/70 hover:text-cloud-white rounded-xl text-xs font-bold transition-all text-center"
            >
              Not Now
            </button>
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2 px-3 bg-toka-flare hover:bg-toka-flare/90 text-cloud-white rounded-xl text-xs font-bold transition-all text-center shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              Install App
            </button>
          </div>
        </div>
      )}

      {/* iOS Safari Manual Add to Home Screen Banner */}
      {showIOSPrompt && isIOS && (
        <div className="fixed bottom-20 left-4 right-4 z-50 bg-shaded-canopy/95 backdrop-blur-xl border border-white/15 rounded-3xl p-4 shadow-2xl animate-fade-in flex flex-col gap-2 font-sans select-none">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-toka-flare to-orange-700 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                <img src="/icons/icon-192x192.png" alt="Toka" className="w-full h-full object-contain" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-cloud-white">Install Toka on iOS</h4>
                <p className="text-[10px] text-cloud-white/50">For the full-screen mobile experience</p>
              </div>
            </div>
            <button
              onClick={handleDismissIOS}
              className="text-cloud-white/40 hover:text-cloud-white p-1 rounded-full"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
          <p className="text-[11px] text-cloud-white/70 leading-relaxed bg-black/30 p-2.5 rounded-xl border border-white/5 flex items-center gap-2">
            <span>Tap the <strong>Share</strong> icon in Safari below, then select <strong>&quot;Add to Home Screen&quot; 📲</strong></span>
          </p>
        </div>
      )}
    </>
  );
}
