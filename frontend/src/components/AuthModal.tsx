"use client";
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { 
    login, 
    signup, 
    loginWithGoogle, 
    completeProfileSetup, 
    profileSetupRequired,
    emailVerificationRequired,
    pendingVerificationEmail,
    resendVerificationEmail,
    checkEmailVerified,
    logout,
    firebaseUser,
    isLoading 
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Input fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'creator' | 'brand' | 'moderator' | 'fan'>('creator');
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  if (!isOpen) return null;

  const handleCheckVerified = async () => {
    setErrorMsg(null);
    setVerificationNotice(null);
    setCheckingStatus(true);
    try {
      const isVerified = await checkEmailVerified();
      if (isVerified) {
        setSuccessMsg('Email verified successfully! Welcome to Toka.');
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setErrorMsg('Your email is not verified yet. Please check your inbox (and Spam) and click the verification link.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Could not verify status. Please try again.');
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleResendEmail = async () => {
    setErrorMsg(null);
    setVerificationNotice(null);
    setResending(true);
    try {
      await resendVerificationEmail();
      setVerificationNotice('Verification email resent! Please check your inbox.');
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setVerificationNotice(null);

    // Sanitize username by trimming and removing any leading '@'
    const sanitizedUsername = username.trim().replace(/^@+/, '');

    try {
      if (profileSetupRequired) {
        if (!sanitizedUsername || !role) {
          setErrorMsg('Username and role are required.');
          return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(sanitizedUsername)) {
          setErrorMsg('Username can only contain letters, numbers, and underscores (_).');
          return;
        }
        if (sanitizedUsername.length < 3) {
          setErrorMsg('Username must be at least 3 characters.');
          return;
        }
        await completeProfileSetup(sanitizedUsername, role);
        onClose();
      } else if (activeTab === 'login') {
        if (!email || !password) {
          setErrorMsg('Please enter your email and password.');
          return;
        }
        await login(email, password);
        if (!emailVerificationRequired) {
          onClose();
        }
      } else {
        if (!email || !password || !confirmPassword || !sanitizedUsername || !role) {
          setErrorMsg('All fields are required.');
          return;
        }
        if (password !== confirmPassword) {
          setErrorMsg('Passwords do not match.');
          return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(sanitizedUsername)) {
          setErrorMsg('Username can only contain letters, numbers, and underscores (_).');
          return;
        }
        if (sanitizedUsername.length < 3) {
          setErrorMsg('Username must be at least 3 characters.');
          return;
        }
        await signup(email, password, sanitizedUsername, role);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Authentication failed. Please try again.');
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    try {
      await loginWithGoogle();
      if (!profileSetupRequired) {
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Google authentication failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div className="relative w-full max-w-[400px] bg-shaded-canopy border border-white/10 rounded-[20px] p-6 shadow-2xl overflow-hidden flex flex-col gap-6">
        
        {/* Close Button */}
        {!profileSetupRequired && !emailVerificationRequired && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-cloud-white/60 hover:text-cloud-white hover:bg-white/10 p-1.5 rounded-full transition-all active:scale-95 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}

        {/* Modal Title */}
        <div className="flex flex-col gap-1 text-center items-center">
          <div className="mb-2 select-none flex justify-center items-center">
            <img 
              src="/images/TokaLogo.svg" 
              alt="Toka" 
              className="h-12 w-auto object-contain" 
            />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-cloud-white">
            {emailVerificationRequired 
              ? 'Verify Your Email'
              : profileSetupRequired 
                ? 'Setup Profile' 
                : activeTab === 'login' 
                  ? 'Welcome Back' 
                  : 'Create Account'}
          </h2>
          <p className="text-xs text-cloud-white/60">
            {emailVerificationRequired
              ? 'Confirm your email address before accessing Toka.'
              : profileSetupRequired 
                ? 'Complete your profile setup to join the Toka community.' 
                : activeTab === 'login' 
                  ? 'Sign in to tip your favorite creators and view personalized feeds.' 
                  : 'Join Toka as a creator or advertiser brand.'}
          </p>
        </div>

        {/* Error message */}
        {errorMsg && !emailVerificationRequired && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs py-2.5 px-3.5 rounded-xl font-medium flex gap-2 items-center">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-fintech-mint/10 border border-fintech-mint/20 text-fintech-mint text-xs py-2.5 px-3.5 rounded-xl font-medium flex gap-2 items-center">
            <span className="material-symbols-outlined text-[16px] text-fintech-mint">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Email Verification Screen */}
        {emailVerificationRequired ? (
          <div className="flex flex-col items-center gap-4 text-center py-1 animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-toka-flare/15 border border-toka-flare/30 flex items-center justify-center text-toka-flare shadow-lg animate-pulse">
              <span className="material-symbols-outlined text-[28px]">mark_email_unread</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-cloud-white/70 leading-relaxed max-w-xs">
                We’ve sent a confirmation link to:
              </p>
              <span className="text-xs font-mono font-bold text-toka-flare bg-toka-flare/10 border border-toka-flare/20 px-3 py-1 rounded-full inline-block break-all select-all">
                {pendingVerificationEmail || firebaseUser?.email || email}
              </span>
              <p className="text-[11px] text-cloud-white/50 mt-1 leading-relaxed">
                Please check your inbox (and Spam folder) and click the link to activate your Toka account.
              </p>
            </div>

            {verificationNotice && (
              <div className="w-full bg-fintech-mint/10 border border-fintech-mint/20 text-fintech-mint text-xs py-2 px-3 rounded-xl font-medium flex gap-2 items-center justify-center">
                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                <span>{verificationNotice}</span>
              </div>
            )}

            {errorMsg && (
              <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-2 px-3 rounded-xl font-medium flex gap-2 items-center justify-center">
                <span className="material-symbols-outlined text-[15px]">error</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="w-full flex flex-col gap-2.5 mt-2">
              <button
                type="button"
                onClick={handleCheckVerified}
                disabled={checkingStatus}
                className="w-full py-3 bg-toka-flare hover:bg-toka-flare/90 text-cloud-white rounded-xl font-bold transition-all disabled:opacity-50 active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 text-xs cursor-pointer"
              >
                {checkingStatus ? (
                  <span className="w-4 h-4 border-2 border-cloud-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    I’ve Verified My Email
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleResendEmail}
                disabled={resending || resendCooldown > 0}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-cloud-white/80 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">send</span>
                {resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : 'Resend Verification Link'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  await logout();
                  setErrorMsg(null);
                  setVerificationNotice(null);
                }}
                className="text-[11px] text-cloud-white/40 hover:text-red-400 transition-colors mt-1 hover:underline flex items-center justify-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[13px]">logout</span>
                Use a different email / Sign Out
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tab Selectors (Omitted during profile setup) */}
            {!profileSetupRequired && (
              <div className="grid grid-cols-2 bg-black/30 p-1 rounded-xl border border-white/5">
                <button
                  onClick={() => { setActiveTab('login'); setErrorMsg(null); setPassword(''); setConfirmPassword(''); }}
                  className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'login' 
                      ? 'bg-shaded-canopy text-cloud-white shadow-md' 
                      : 'text-cloud-white/50 hover:text-cloud-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setActiveTab('register'); setErrorMsg(null); setPassword(''); setConfirmPassword(''); }}
                  className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'register' 
                      ? 'bg-shaded-canopy text-cloud-white shadow-md' 
                      : 'text-cloud-white/50 hover:text-cloud-white'
                  }`}
                >
                  Register
                </button>
              </div>
            )}

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Profile Setup Screen */}
          {profileSetupRequired ? (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-cloud-white/60 tracking-wider uppercase">Choose Username</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-cloud-white/40 text-sm font-semibold select-none">@</span>
                  <input
                    type="text"
                    required
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    className="w-full pl-8 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-toka-flare transition-all text-cloud-white"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-cloud-white/60 tracking-wider uppercase">Select Your Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['creator', 'brand'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`py-3 px-2 border rounded-xl text-xs font-bold capitalize transition-all flex flex-col items-center gap-1 ${
                        role === r 
                          ? 'border-toka-flare bg-toka-flare/10 text-toka-flare shadow-inner' 
                          : 'border-white/10 bg-black/10 text-cloud-white/60 hover:border-white/20 hover:text-cloud-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {r === 'creator' ? 'videocam' : 'storefront'}
                      </span>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Credentials Fields */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-cloud-white/60 tracking-wider uppercase">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-toka-flare transition-all text-cloud-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-cloud-white/60 tracking-wider uppercase">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-toka-flare transition-all text-cloud-white"
                />
              </div>

              {/* Additional Registration Fields */}
              {activeTab === 'register' && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-cloud-white/60 tracking-wider uppercase">Confirm Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-toka-flare transition-all text-cloud-white"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-cloud-white/60 tracking-wider uppercase">Username</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-cloud-white/40 text-sm font-semibold select-none">@</span>
                      <input
                        type="text"
                        required
                        placeholder="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        className="w-full pl-8 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-toka-flare transition-all text-cloud-white"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-cloud-white/60 tracking-wider uppercase">Register As</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['creator', 'brand'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`py-2 px-1 border rounded-xl text-xs font-bold capitalize transition-all flex flex-col items-center gap-1 ${
                            role === r 
                              ? 'border-toka-flare bg-toka-flare/10 text-toka-flare shadow-inner' 
                              : 'border-white/10 bg-black/10 text-cloud-white/60 hover:border-white/20 hover:text-cloud-white'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {r === 'creator' ? 'videocam' : 'storefront'}
                          </span>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 bg-toka-flare hover:bg-toka-flare/90 text-cloud-white rounded-xl font-bold transition-all disabled:opacity-50 active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 text-sm"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-cloud-white border-t-transparent rounded-full animate-spin"></span>
            ) : profileSetupRequired ? (
              'Complete Onboarding'
            ) : activeTab === 'login' ? (
              'Sign In'
            ) : (
              'Create Profile'
            )}
          </button>
        </form>

        {/* Separator & Google Sign-In (Omitted during profile setup) */}
        {!profileSetupRequired && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-[1px] bg-white/10"></div>
              <span className="text-[10px] font-bold text-cloud-white/40 tracking-wider uppercase">Or Continue With</span>
              <div className="flex-1 h-[1px] bg-white/10"></div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-cloud-white rounded-xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-xs"
            >
              <svg className="w-4 h-4 text-cloud-white shrink-0 fill-current" viewBox="0 0 24 24">
                <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.488 0-6.319-2.825-6.319-6.315 0-3.49 2.831-6.315 6.319-6.315 1.6 0 3.03.6 4.13 1.58l3.05-3.04C19.34 2.14 16 1 12.24 1 6.033 1 1 6.027 1 12.238 1 18.45 6.033 23.48 12.24 23.48c6.47 0 11.233-4.55 11.233-11.2 0-.68-.06-1.3-.18-1.995H12.24z" />
              </svg>
              Google Account
            </button>
          </>
        )}
          </>
        )}
      </div>
    </div>
  );
}
