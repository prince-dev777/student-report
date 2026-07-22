// Progressive Web App (PWA) Service Worker for Staff Attendance App
const CACHE_NAME = 'staff-app-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Pass-through network fetch for fresh data
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
