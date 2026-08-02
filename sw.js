const CACHE_NAME = 'smp-portal-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Biarkan semua request langsung ke internet (online-first)
  // agar data dari API Google Apps Script selalu update & real-time
  event.respondWith(fetch(event.request));
});
