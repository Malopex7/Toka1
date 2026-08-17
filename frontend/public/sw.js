// Toka Service Worker with offline caching & FCM push support
const CACHE_NAME = 'toka-pwa-v2';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
  '/images/logo/logo.png',
  '/images/audio-album.jpg',
  '/favicon.ico'
];

// Install Event - Pre-cache core shell assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching warning:', err);
      });
    })
  );
});

// Activate Event - Clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network first with cache fallback for navigation & static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests and cross-origin video streams
  if (request.method !== 'GET' || request.url.includes('/api/videos/stream/')) {
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/') || caches.match(request);
      })
    );
    return;
  }

  // Cache static image and font assets
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'style' ||
    request.destination === 'script'
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached and fetch in background to revalidate
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => {
          return caches.match(request);
        });
      })
    );
  }
});

// Optional Firebase Messaging integration in Service Worker
try {
  importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

  firebase.initializeApp({
    apiKey: "AIzaSyDMNpwqkjrvfndPcsnEz7TlbrIek5_7NeA",
    authDomain: "toka-cd0bb.firebaseapp.com",
    projectId: "toka-cd0bb",
    storageBucket: "toka-cd0bb.firebasestorage.app",
    messagingSenderId: "510564121374",
    appId: "1:510564121374:web:88eb99b1a7c754ab4c270f"
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background push notification:', payload);
    const title = payload.notification?.title || 'Toka Alert';
    const options = {
      body: payload.notification?.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: payload.data
    };
    self.registration.showNotification(title, options);
  });
} catch (e) {
  console.warn('[SW] Firebase messaging init in sw skipped:', e);
}
