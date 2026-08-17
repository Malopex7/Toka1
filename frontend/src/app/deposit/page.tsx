"use client";
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/PageHeader';

function DepositContent() {
  const { mongooseUser, isAuthenticated, firebaseUser, isLoading, refreshProfile } = useAuth();
  const searchParams = useSearchParams();
  
  const [amount, setAmount] = useState<string>('50');
  const [loadingCheckout, setLoadingCheckout] = useState<boolean>(false);
  const [successState, setSuccessState] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check if redirecting back from a successful Paystack payment session
  useEffect(() => {
    const status = searchParams.get('status');
    const reference = searchParams.get('reference') || searchParams.get('trxref');

    if (status === 'success' && reference && firebaseUser) {
      const verifyAndCredit = async () => {
        try {
          const token = await firebaseUser.getIdToken();
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/transactions/verify-deposit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ reference })
          });
          const data = await res.json();
          if (data.status === 'success') {
            // Refresh auth profile to pull updated walletBalance from DB
            await refreshProfile();
            setSuccessState(true);
          } else {
            setErrorMsg(data.message || 'Payment verification failed. Please contact support.');
          }
        } catch (e) {
          console.error('[VerifyDeposit] Error:', e);
          // Fallback: still show success and refresh profile in case webhook ran first
          await refreshProfile();
          setSuccessState(true);
        }
      };

      verifyAndCredit();
    } else if (status === 'success') {
      // No reference available — just refresh and show success (webhook may have run)
      refreshProfile().then(() => setSuccessState(true));
    }
  }, [searchParams, firebaseUser, refreshProfile]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }

    setLoadingCheckout(true);
    setErrorMsg(null);

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/transactions/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount: depositAmount })
      });

      const data = await res.json();
      if (data.status === 'success' && data.data?.authorization_url) {
        // Redirect to Paystack Checkout URL
        window.location.href = data.data.authorization_url;
      } else {
        setErrorMsg(data.message || 'Failed to initialize deposit checkout.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Network error. Failed to top up.');
    } finally {
      setLoadingCheckout(false);
    }
  };

  // Auth loading gate
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-midnight-boma text-cloud-white font-sans">
        <span className="w-10 h-10 border-4 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
      </div>
    );
  }

  // Security gate
  if (!isAuthenticated || !mongooseUser) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-midnight-boma text-cloud-white gap-4 font-sans px-6 text-center select-none">
        <span className="material-symbols-outlined text-[64px] text-red-500 animate-pulse">lock</span>
        <h1 className="text-2xl font-black tracking-tight">Access Restricted</h1>
        <p className="text-sm text-cloud-white/60 max-w-sm">Please sign in to deposit funds and top up your Toka wallet.</p>
        <Link href="/" className="px-6 py-3 bg-toka-flare hover:bg-toka-flare/90 rounded-xl font-bold transition-all text-xs active:scale-95 shadow-lg">
          Return to Homepage
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-midnight-boma text-cloud-white min-h-screen flex flex-col antialiased font-sans">
      
      <PageHeader
        title="Deposit Workspace"
        right={
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-cloud-white/60">@{mongooseUser.username}</span>
            <span className="bg-fintech-mint/10 border border-fintech-mint/35 text-fintech-mint text-xs font-mono font-bold px-3 py-1 rounded-lg">
              Balance: R {mongooseUser.walletBalance.toFixed(2)}
            </span>
          </div>
        }
      />

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-shaded-canopy border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col gap-6">
          
          {successState ? (
            // Success Card State
            <div className="flex flex-col items-center text-center gap-4 py-4 animate-fade-in select-none">
              <span className="material-symbols-outlined text-fintech-mint text-[72px] animate-bounce">check_circle</span>
              <h2 className="text-xl font-bold text-cloud-white">Top Up Successful!</h2>
              <p className="text-sm text-cloud-white/60">
                Your payment session was processed successfully. Your updated balance of 
                <strong className="text-fintech-mint block text-lg font-mono mt-1">R {mongooseUser.walletBalance.toFixed(2)}</strong> 
                has been credited.
              </p>
              <Link href="/" className="mt-4 px-8 py-3.5 bg-fintech-mint hover:bg-fintech-mint/90 text-midnight-boma rounded-xl font-bold transition-all text-xs active:scale-95 shadow-lg">
                Go back to Feed
              </Link>
            </div>
          ) : (
            // Deposit checkout Form State
            <>
              <div className="text-center select-none">
                <span className="material-symbols-outlined text-toka-flare text-[48px] mb-2">account_balance_wallet</span>
                <h2 className="text-xl font-black tracking-tight text-cloud-white">Top Up Wallet</h2>
                <p className="text-xs text-cloud-white/50 mt-1">Secure deposits powered by Paystack.</p>
              </div>

              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/35 text-red-500 text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2 select-none">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleDeposit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label htmlFor="amount-input" className="text-xs font-bold text-cloud-white/50 uppercase select-none">Amount (ZAR)</label>
                  <div className="relative flex items-center bg-black/40 border border-white/10 rounded-2xl overflow-hidden focus-within:border-toka-flare transition-colors">
                    <span className="pl-5 text-cloud-white/60 font-semibold font-mono text-sm">R</span>
                    <input
                      id="amount-input"
                      type="number"
                      min="10"
                      step="5"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full bg-transparent py-4 pl-2 pr-5 text-cloud-white font-bold font-mono text-lg outline-none placeholder:text-cloud-white/20"
                    />
                  </div>
                </div>

                {/* Preset Amount buttons */}
                <div className="grid grid-cols-3 gap-3 select-none">
                  {['20', '50', '100'].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmount(val)}
                      className={`py-3.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                        amount === val
                          ? 'bg-toka-flare border-toka-flare text-cloud-white shadow-[0_0_12px_rgba(255,79,0,0.25)]'
                          : 'bg-black/20 hover:bg-black/40 border-white/10 text-cloud-white/70 hover:text-cloud-white'
                      }`}
                    >
                      R {val}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={loadingCheckout}
                  className="w-full bg-toka-flare hover:bg-toka-flare/90 disabled:opacity-50 text-cloud-white py-4 rounded-xl font-bold transition-all text-xs active:scale-95 shadow-[0_4px_20px_rgba(255,79,0,0.3)] flex justify-center items-center gap-2 select-none"
                >
                  {loadingCheckout ? (
                    <>
                      <span className="w-4 h-4 border-2 border-cloud-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Redirecting to Paystack...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">credit_card</span>
                      <span>Initialize Deposit Checkout</span>
                    </>
                  )}
                </button>
              </form>

              <div className="flex justify-center items-center gap-2 select-none text-[10px] text-cloud-white/40 border-t border-white/5 pt-4">
                <span className="material-symbols-outlined text-[14px]">shield</span>
                <span>Fully encrypted connection and data storage.</span>
              </div>
            </>
          )}

        </div>
      </main>

    </div>
  );
}

export default function DepositPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen items-center justify-center bg-midnight-boma text-cloud-white font-sans">
        <span className="w-10 h-10 border-4 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
      </div>
    }>
      <DepositContent />
    </Suspense>
  );
}
