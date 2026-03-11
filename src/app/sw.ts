/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { ExpirationPlugin, NetworkFirst, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Stratégie NetworkFirst dédiée aux routes mobiles /m/ — cache au premier accès,
// fallback cache si réseau indisponible ou lent (> 3 s).
const mobilePagesCaching = {
  matcher: ({ request, url }: { request: Request; url: URL }) =>
    request.mode === "navigate" && /\/m\//.test(url.pathname),
  handler: new NetworkFirst({
    cacheName: "mobile-pages",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 jours
      }),
    ],
    networkTimeoutSeconds: 3,
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [mobilePagesCaching, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// Warm cache : le client envoie la liste des routes mobiles à précacher.
// On fetch chaque URL et on la stocke dans le cache "mobile-pages" utilisé
// par la stratégie NetworkFirst ci-dessus.
const MOBILE_CACHE_NAME = "mobile-pages";
const WARM_BATCH_SIZE = 3;

self.addEventListener("message", (event) => {
  if (event.data?.type !== "WARM_CACHE") return;

  const urls = event.data.urls as string[];
  const source = event.source as Client | null;

  event.waitUntil(
    (async () => {
      const cache = await caches.open(MOBILE_CACHE_NAME);
      let cached = 0;

      for (let i = 0; i < urls.length; i += WARM_BATCH_SIZE) {
        const batch = urls.slice(i, i + WARM_BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (url) => {
            const response = await fetch(url, { credentials: "same-origin" });
            if (response.ok) {
              await cache.put(url, response);
              cached++;
            }
          }),
        );
        // Ne pas bloquer si certains échouent
        void results;
      }

      source?.postMessage({ type: "WARM_CACHE_DONE", cached });
    })(),
  );
});
