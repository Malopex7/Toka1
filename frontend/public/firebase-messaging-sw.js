// Import the Firebase scripts inside the service worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker background context
firebase.initializeApp({
  apiKey: "AIzaSyDMNpwqkjrvfndPcsnEz7TlbrIek5_7NeA",
  authDomain: "toka-cd0bb.firebaseapp.com",
  projectId: "toka-cd0bb",
  storageBucket: "toka-cd0bb.firebasestorage.app",
  messagingSenderId: "510564121374",
  appId: "1:510564121374:web:88eb99b1a7c754ab4c270f"
});

// Retrieve an instance of Firebase Cloud Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification.title || 'Toka Notification';
  const notificationOptions = {
    body: payload.notification.body || '',
    icon: '/favicon.ico',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
