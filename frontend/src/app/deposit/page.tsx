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
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#09090B] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
          
          {successState ? (
            // Success Card State
            <div className="flex flex-col items-center text-center gap-3 py-3 animate-fade-in select-none">
              <span className="material-symbols-outlined text-fintech-mint text-[56px] animate-bounce">check_circle</span>
              <h2 className="text-lg font-bold text-cloud-white">Top Up Successful!</h2>
              <p className="text-xs text-cloud-white/60">
                Your payment session was processed successfully. Your updated balance of 
                <strong className="text-fintech-mint block text-base font-mono mt-1">R {mongooseUser.walletBalance.toFixed(2)}</strong> 
                has been credited.
              </p>
              <Link href="/" className="mt-2 px-6 py-2.5 bg-fintech-mint hover:bg-fintech-mint/90 text-midnight-boma rounded-[0.625rem] font-bold transition-all text-xs active:scale-95 shadow-lg">
                Go back to Feed
              </Link>
            </div>
          ) : (
            // Deposit checkout Form State
            <>
              <div className="text-center select-none">
                <span className="material-symbols-outlined text-toka-flare text-[36px] mb-1">account_balance_wallet</span>
                <h2 className="text-base font-black tracking-tight text-cloud-white">Top Up Wallet</h2>
                <p className="text-[11px] text-cloud-white/50 mt-0.5">Secure deposits powered by Paystack.</p>
              </div>

              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/35 text-red-500 text-xs font-bold px-3.5 py-2.5 rounded-[0.625rem] flex items-center gap-2 select-none">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleDeposit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="amount-input" className="text-[10px] font-bold text-cloud-white/50 uppercase select-none">Amount (ZAR)</label>
                  <div className="relative flex items-center bg-[#18181B]/60 border border-white/10 rounded-[0.625rem] overflow-hidden focus-within:border-toka-flare transition-colors">
                    <span className="pl-4 text-cloud-white/40 font-bold font-mono text-xs">R</span>
                    <input
                      id="amount-input"
                      type="number"
                      min="10"
                      step="5"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full bg-transparent py-3 pl-2 pr-4 text-cloud-white font-bold font-mono text-base outline-none placeholder:text-cloud-white/20"
                    />
                  </div>
                </div>

                {/* Recessed Segmented Preset Amount buttons */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-cloud-white/50 uppercase select-none">Quick Amounts</span>
                  <div className="grid grid-cols-3 bg-[#09090B] p-1 rounded-[0.625rem] border border-white/10 text-xs font-medium gap-1 select-none">
                    {['20', '50', '100'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAmount(val)}
                        className={`py-2 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
                          amount === val
                            ? 'bg-toka-flare text-white shadow-sm font-semibold'
                            : 'text-cloud-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        R {val}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loadingCheckout}
                  className="w-full bg-toka-flare hover:bg-toka-flare/90 disabled:opacity-50 text-cloud-white py-3 rounded-[0.625rem] font-bold transition-all text-xs active:scale-[0.98] shadow-lg shadow-toka-flare/20 flex justify-center items-center gap-2 select-none cursor-pointer mt-1"
                >
                  {loadingCheckout ? (
                    <>
                      <span className="w-4 h-4 border-2 border-cloud-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Redirecting to Paystack...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">credit_card</span>
                      <span>Initialize Deposit Checkout</span>
                    </>
                  )}
                </button>
              </form>

              <div className="flex justify-center items-center gap-1.5 select-none text-[10px] text-cloud-white/40 border-t border-white/5 pt-3">
                <span className="material-symbols-outlined text-[13px]">shield</span>
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
