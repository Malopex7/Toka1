import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';

if (process.env.FIREBASE_PROJECT_ID && !process.env.GOOGLE_CLOUD_PROJECT) {
  process.env.GOOGLE_CLOUD_PROJECT = process.env.FIREBASE_PROJECT_ID;
}

let app;
try {
  app = getApps().length === 0 ? initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  }) : getApp();
  console.log("Firebase Admin initialized successfully with Project ID:", process.env.FIREBASE_PROJECT_ID);
} catch (error) {
  console.error("Firebase Admin initialization error:", error.message);
}

export const auth = getAuth(app);
export const messaging = getMessaging(app);
export const storage = getStorage(app);
