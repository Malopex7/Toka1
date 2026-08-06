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
import { auth } from '@/lib/firebase';

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await syncWithBackend(user);
      } else {
        setMongooseUser(null);
        setProfileSetupRequired(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
      logout
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
