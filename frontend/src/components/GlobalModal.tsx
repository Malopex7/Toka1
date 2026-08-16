"use client";
import React from 'react';
import { useModalStore } from '@/store/useModalStore';
import { useLiveStore } from '@/store/useLiveStore';
import GoLiveOverlay from './live/GoLiveOverlay';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';

export default function GlobalModal() {
  const {
    isOpen,
    type,
    title,
    description,
    placeholder,
    inputValue,
    onConfirm,
    onCancel,
    setInputValue,
    close,
  } = useModalStore();

  const isGoLiveOpen = useLiveStore((s) => s.isGoLiveOpen);
  const closeGoLive = useLiveStore((s) => s.closeGoLive);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm();
  };

  return (
    <>
      {isGoLiveOpen && (
        <GoLiveOverlay onClose={closeGoLive} />
      )}

      {isOpen && type && (
        <AlertDialog open={isOpen} onOpenChange={(open) => { if (!open) close(); }}>
          <AlertDialogContent className="bg-midnight-boma border border-white/10 rounded-2xl shadow-2xl p-6 max-w-sm w-[calc(100%-2rem)] text-cloud-white font-sans">
            <AlertDialogHeader className="space-y-2">
              <AlertDialogTitle className="text-base font-bold text-toka-flare select-none">
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-cloud-white/70 leading-relaxed select-none">
                {description}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {type === 'prompt' && (
              <form onSubmit={handleSubmit} className="mt-4">
                <input
                  type="text"
                  autoFocus
                  placeholder={placeholder}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="w-full bg-shaded-canopy border border-white/10 focus:border-toka-flare rounded-xl px-3 py-2.5 text-xs text-cloud-white placeholder-cloud-white/20 focus:outline-none transition-colors"
                />
                <button type="submit" className="hidden" />
              </form>
            )}

            <AlertDialogFooter className="mt-6 flex flex-row justify-end gap-2 shrink-0">
              {(type === 'confirm' || type === 'prompt') && (
                <button
                  onClick={onCancel}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-white/10 text-cloud-white/60 hover:text-cloud-white hover:bg-white/5 active:scale-95 transition-all text-xs font-bold font-sans cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => onConfirm()}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-toka-flare hover:bg-toka-flare/90 active:scale-95 transition-all text-xs font-bold text-cloud-white font-sans cursor-pointer shadow-lg shadow-toka-flare/10"
              >
                {type === 'confirm' ? 'Confirm' : 'OK'}
              </button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
