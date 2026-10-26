// SIGAP Smart Manufacturing - Clean No-Op Service Worker
// Automatically claims clients and self-unregisters to prevent stale caches or 404 spam
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.clients.claim().then(() => {
      // Clean unregistration if not actively needed
      return self.registration.unregister();
    })
  );
});
