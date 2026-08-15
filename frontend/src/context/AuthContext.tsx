"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification
} from 'firebase/auth';
import { auth, getFCM } from '@/lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { useFeedStore } from '@/store/useFeedStore';

export interface MongooseUser {
  id: string;
  _id: string;
  firebaseUid: string;
  email: string;
  username: string;
  role: 'creator' | 'brand' | 'moderator' | 'fan';
  walletBalance: number;
  isBrandSafeVerified: boolean;
  verificationRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  strikeCount: number;
  avatarUrl?: string;
  followListPrivacy?: 'everyone' | 'followers_only' | 'only_me';
  followers?: string[];
  following?: string[];
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  mongooseUser: MongooseUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  profileSetupRequired: boolean;
  emailVerificationRequired: boolean;
  pendingVerificationEmail: string;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string, role: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  completeProfileSetup: (username: string, role: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  checkEmailVerified: () => Promise<boolean>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [mongooseUser, setMongooseUser] = useState<MongooseUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [profileSetupRequired, setProfileSetupRequired] = useState<boolean>(false);
  const [emailVerificationRequired, setEmailVerificationRequired] = useState<boolean>(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string>('');

  // Sync user profile from Firebase token with Mongoose Backend
  const syncWithBackend = async (fUser: FirebaseUser, customData?: { username: string; role: string }) => {
    try {
      const token = await fUser.getIdToken(true);
      const body = customData ? JSON.stringify(customData) : JSON.stringify({});
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body
      });
      const data = await res.json();
      if (data.status === 'success') {
        if (data.profileRequired) {
          setProfileSetupRequired(true);
          setMongooseUser(null);
        } else {
          setMongooseUser(data.data.user);
          setProfileSetupRequired(false);
          setEmailVerificationRequired(false);
        }
      } else if (data.emailVerificationRequired) {
        setEmailVerificationRequired(true);
        setPendingVerificationEmail(fUser.email || '');
        setMongooseUser(null);
      } else {
        throw new Error(data.message || 'Failed to sync user profile.');
      }
    } catch (err) {
      console.error('Error syncing user profile:', err);
      setMongooseUser(null);
    }
  };

  const initFcmNotifications = async (fUser: FirebaseUser) => {
    if (typeof window === 'undefined') return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('[FCM] Notification permissions denied.');
        return;
      }

      const messaging = await getFCM();
      if (!messaging) {
        console.log('[FCM] Firebase messaging not supported.');
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.log('[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY is not configured in .env.local. Skipping push registration.');
        return;
      }

      const token = await getToken(messaging, { vapidKey });

      if (token) {
        console.log('[FCM] Token retrieved:', token.substring(0, 15) + '...');
        const idToken = await fUser.getIdToken();
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/fcm-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`
          },
          body: JSON.stringify({ fcmToken: token })
        });

        onMessage(messaging, (payload) => {
          console.log('[FCM] Message received in foreground:', payload);
          if (payload.notification) {
            new Notification(payload.notification.title || 'Toka Alert', {
              body: payload.notification.body,
              icon: '/favicon.ico'
            });
            useFeedStore.getState().addNotification({
              title: payload.notification.title || 'Toka Alert',
              body: payload.notification.body || ''
            });
          }
        });
      }
    } catch (err) {
      console.warn('[FCM] Init skipped or failed:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const isPasswordUser = user.providerData.some(p => p.providerId === 'password');
        if (isPasswordUser && !user.emailVerified) {
          setEmailVerificationRequired(true);
          setPendingVerificationEmail(user.email || '');
          setMongooseUser(null);
          setIsLoading(false);
          return;
        }

        setEmailVerificationRequired(false);
        setPendingVerificationEmail('');
        await syncWithBackend(user);
        initFcmNotifications(user);
      } else {
        setMongooseUser(null);
        setProfileSetupRequired(false);
        setEmailVerificationRequired(false);
        setPendingVerificationEmail('');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync user wallet balance and reload role-filtered feed on authentication status change
  useEffect(() => {
    if (mongooseUser) {
      useFeedStore.getState().setWalletBalance(mongooseUser.walletBalance);
    } else {
      useFeedStore.getState().setWalletBalance(100);
    }
    // Reset feed and load first page with correct session filters
    useFeedStore.getState().resetFeed();
    useFeedStore.getState().fetchNextPage();
  }, [mongooseUser]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (!userCredential.user.emailVerified) {
        setEmailVerificationRequired(true);
        setPendingVerificationEmail(userCredential.user.email || email);
        setMongooseUser(null);
        return;
      }
      setEmailVerificationRequired(false);
      await syncWithBackend(userCredential.user);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, username: string, role: string) => {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Save pending profile setup in sessionStorage for activation after email confirmation
      try {
        sessionStorage.setItem('toka_pending_profile', JSON.stringify({ username, role }));
      } catch (e) {
        console.warn('Could not cache pending profile to sessionStorage', e);
      }

      // Send Firebase confirmation email
      try {
        await sendEmailVerification(userCredential.user);
        console.log('[Auth] Verification email sent to:', email);
      } catch (err) {
        console.error('[Auth] Failed to send verification email:', err);
      }

      setEmailVerificationRequired(true);
      setPendingVerificationEmail(email);
      setMongooseUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('No user currently signed in.');
    await sendEmailVerification(auth.currentUser);
    console.log('[Auth] Resent verification email to:', auth.currentUser.email);
  };

  const checkEmailVerified = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    if (auth.currentUser.emailVerified) {
      setEmailVerificationRequired(false);
      setPendingVerificationEmail('');

      let pendingProfile: { username: string; role: string } | null = null;
      try {
        const saved = sessionStorage.getItem('toka_pending_profile');
        if (saved) pendingProfile = JSON.parse(saved);
      } catch {}

      if (pendingProfile?.username && pendingProfile?.role) {
        await syncWithBackend(auth.currentUser, pendingProfile);
        try {
          sessionStorage.removeItem('toka_pending_profile');
        } catch {}
      } else {
        await syncWithBackend(auth.currentUser);
      }
      return true;
    }
    return false;
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      setEmailVerificationRequired(false);
      await syncWithBackend(userCredential.user);
    } finally {
      setIsLoading(false);
    }
  };

  const completeProfileSetup = async (username: string, role: string) => {
    if (!firebaseUser) throw new Error('No authenticated user found.');
    setIsLoading(true);
    try {
      await syncWithBackend(firebaseUser, { username, role });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await firebaseSignOut(auth);
      setMongooseUser(null);
      setProfileSetupRequired(false);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMongooseUser(data.data.user);
      }
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
  };

  const isAuthenticated = !!firebaseUser && !!mongooseUser;

  return (
    <AuthContext.Provider value={{
      firebaseUser,
      mongooseUser,
      isAuthenticated,
      isLoading,
      profileSetupRequired,
      emailVerificationRequired,
      pendingVerificationEmail,
      login,
      signup,
      loginWithGoogle,
      completeProfileSetup,
      resendVerificationEmail,
      checkEmailVerified,
      logout,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthContextProvider');
  }
  return context;
}
