"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
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
  strikeCount: number;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  mongooseUser: MongooseUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  profileSetupRequired: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string, role: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  completeProfileSetup: (username: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [mongooseUser, setMongooseUser] = useState<MongooseUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [profileSetupRequired, setProfileSetupRequired] = useState<boolean>(false);

  // Sync user profile from Firebase token with Mongoose Backend
  const syncWithBackend = async (fUser: FirebaseUser) => {
    try {
      const token = await fUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.status === 'success') {
        if (data.profileRequired) {
          setProfileSetupRequired(true);
          setMongooseUser(null);
        } else {
          setMongooseUser(data.data.user);
          setProfileSetupRequired(false);
        }
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

      const token = await getToken(messaging, {
        vapidKey: 'BPTwssewY_iylmvXqxiweeFiexPFJID0u8EixJiaggUD8EW4Quu7wADFI-dk9NzeF4Q4v_f6MwqmAaQVs5P-PrM'
      });

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
        await syncWithBackend(user);
        initFcmNotifications(user);
      } else {
        setMongooseUser(null);
        setProfileSetupRequired(false);
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
      await syncWithBackend(userCredential.user);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, username: string, role: string) => {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ username, role })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMongooseUser(data.data.user);
        setProfileSetupRequired(false);
      } else {
        throw new Error(data.message || 'Failed to sync profile after signup.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      await syncWithBackend(userCredential.user);
    } finally {
      setIsLoading(false);
    }
  };

  const completeProfileSetup = async (username: string, role: string) => {
    if (!firebaseUser) throw new Error('No authenticated user found.');
    setIsLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ username, role })
      });
      const data = await res.json();
      if (data.status === 'success' && !data.profileRequired) {
        setMongooseUser(data.data.user);
        setProfileSetupRequired(false);
      } else {
        throw new Error(data.message || 'Failed to complete profile setup.');
      }
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
      login,
      signup,
      loginWithGoogle,
      completeProfileSetup,
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
