// static/serviceWorker.js

// Basic service worker for PWA installability.
// It doesn't do any caching yet, but fulfills the requirement.

self.addEventListener('install', (event) => {
  // console.log('Service Worker: Installing...');
  // Skip waiting to activate the new service worker immediately.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // console.log('Service Worker: Activating...');
  // Take control of all clients immediately.
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // console.log('Service Worker: Fetching ', event.request.url);
  // Basic pass-through fetch handler. For offline capabilities,
  // you would add caching strategies here.
  event.respondWith(fetch(event.request));
}); 