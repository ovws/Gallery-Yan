/* Unregister legacy workers: this file intentionally uninstalls itself */
self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      const clients = await self.clients.matchAll({ type: "window" });
      await self.registration.unregister();
      for (const c of clients) {
        try {
          c.navigate(c.url);
        } catch (_) {}
      }
    })()
  );
});
