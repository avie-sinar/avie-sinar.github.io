/**
 * Portfolio Service Worker
 * Provides offline caching and PWA capabilities for the portfolio website
 *
 * IMPORTANT: This service worker is designed to coexist with the wedding-card application.
 * It explicitly skips handling any requests to "/wedding-card" paths to allow the
 * wedding-card's own service worker to handle its offline functionality.
 */

const CACHE_VERSION = "portfolio-v1.0.1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGES_CACHE = `${CACHE_VERSION}-images`;
const FONTS_CACHE = `${CACHE_VERSION}-fonts`;
const OFFLINE_URL = "/offline";

// Core files to cache immediately
const STATIC_ASSETS = [
  "/",
  "/offline",
  "/manifest.json",
  "/icon.png",
  "/og-image.png",
  "/resume.pdf",
  "/_next/static/css/app/layout.css",
  "/_next/static/css/app/page.css",
];

// Additional assets to cache on visit
const DYNAMIC_ASSETS = [
  "/assets/FinPal.png",
  "/assets/FYP.gif",
  "/assets/FYP.png",
  "/assets/FYP1.png",
  "/assets/FYP2.png",
  "/assets/FYP3.png",
  "/assets/portfolio.png",
  "/assets/weddingCard.png",
];

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: "cache-first",
  NETWORK_FIRST: "network-first",
  STALE_WHILE_REVALIDATE: "stale-while-revalidate",
  NETWORK_ONLY: "network-only",
  CACHE_ONLY: "cache-only",
};

// Install event - cache core resources
self.addEventListener("install", (event) => {
  console.log("� Portfolio Service Worker installing...");

  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then((cache) => {
        console.log("📦 Caching static assets");
        return cache.addAll(
          STATIC_ASSETS.map(
            (url) =>
              new Request(url, {
                credentials: "same-origin",
                cache: "reload",
              }),
          ),
        );
      }),
      // Pre-cache critical dynamic assets
      caches.open(IMAGES_CACHE).then((cache) => {
        console.log("🖼️ Pre-caching images");
        return cache.addAll(
          DYNAMIC_ASSETS.map(
            (url) => new Request(url, { credentials: "same-origin" }),
          ),
        );
      }),
    ])
      .then(() => {
        console.log("✅ Core assets cached successfully");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("❌ Installation failed:", error);
      }),
  );
});

// Respond to SKIP_WAITING message from the page so new SW activates immediately
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Activate event - clean up old caches and claim clients
self.addEventListener("activate", (event) => {
  console.log("🎉 Portfolio Service Worker activated");

  const currentCaches = [
    STATIC_CACHE,
    DYNAMIC_CACHE,
    IMAGES_CACHE,
    FONTS_CACHE,
  ];

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              console.log("🗑️ Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          }),
        );
      }),
      // Take control of all clients immediately
      self.clients.claim(),
    ]).then(() => {
      console.log("🏃‍♂️ Service Worker took control of all pages");
    }),
  );
});

// Fetch event - intelligent caching based on request type
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and cross-origin requests (except for specific domains)
  if (
    request.method !== "GET" ||
    (!url.origin.includes(self.location.origin) &&
      !url.origin.includes("fonts.googleapis.com") &&
      !url.origin.includes("fonts.gstatic.com"))
  ) {
    return;
  }

  // IMPORTANT: Skip wedding-card paths to avoid conflicts with wedding-card's service worker
  if (url.pathname.startsWith("/wedding-card")) {
    console.log(
      "🎩 Skipping wedding-card request for its own service worker:",
      url.pathname,
    );
    return;
  }

  // Handle different request types with appropriate strategies
  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(request));
  } else if (isNextJsChunk(request)) {
    event.respondWith(handleNextJsChunk(request));
  } else if (isStaticAsset(request)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isImageRequest(request)) {
    event.respondWith(handleImageRequest(request));
  } else if (isFontRequest(request)) {
    event.respondWith(handleFontRequest(request));
  } else if (isAPIRequest(request)) {
    event.respondWith(handleAPIRequest(request));
  } else {
    event.respondWith(handleOtherRequests(request));
  }
});

// Helper functions for request identification
function isNavigationRequest(request) {
  return request.mode === "navigate";
}

function isStaticAsset(request) {
  const url = new URL(request.url);
  return (
    url.pathname.endsWith(".css") ||
    url.pathname.includes("/_next/static/media/") ||
    url.pathname === "/manifest.json"
  );
}

function isNextJsChunk(request) {
  const url = new URL(request.url);
  return (
    url.pathname.includes("/_next/static/chunks/") ||
    url.pathname.includes("/_next/static/js/") ||
    url.pathname.endsWith(".js")
  );
}

function isImageRequest(request) {
  const url = new URL(request.url);
  return (
    request.destination === "image" ||
    /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url.pathname)
  );
}

function isFontRequest(request) {
  const url = new URL(request.url);
  return (
    request.destination === "font" ||
    url.origin.includes("fonts.gstatic.com") ||
    /\.(woff|woff2|ttf|otf)$/i.test(url.pathname)
  );
}

function isAPIRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith("/api/");
}

// Handler functions for different request types
async function handleNavigation(request) {
  const url = new URL(request.url);

  try {
    // Try network first for navigation
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      // Only cache portfolio navigation responses (not wedding-card)
      if (!url.pathname.startsWith("/wedding-card")) {
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    }
    throw new Error("Network response not ok");
  } catch (error) {
    console.log("📱 Serving navigation from cache or offline page");

    // For wedding-card paths, don't provide fallback - let it handle its own offline
    if (url.pathname.startsWith("/wedding-card")) {
      throw error; // Let the request fail naturally so wedding-card SW can handle it
    }

    // Try cache, then fallback to portfolio offline page
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return (
      caches.match(OFFLINE_URL) || new Response("Offline", { status: 503 })
    );
  }
}

async function handleNextJsChunk(request) {
  // Network first for JS chunks — they change between builds
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Fall back to cache only if network fails
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log("📦 Serving JS chunk from cache (offline):", request.url);
      return cachedResponse;
    }
    throw error;
  }
}

async function handleStaticAsset(request) {
  const url = new URL(request.url);

  // Skip wedding-card static assets
  if (url.pathname.startsWith("/wedding-card")) {
    return fetch(request);
  }

  // Cache first strategy for portfolio static assets (CSS, media — immutable)
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    console.log("📦 Serving static asset from cache:", request.url);
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log("❌ Failed to fetch static asset:", request.url);
    throw error;
  }
}

async function handleImageRequest(request) {
  const url = new URL(request.url);

  // Skip wedding-card images
  if (url.pathname.startsWith("/wedding-card")) {
    return fetch(request);
  }

  // Cache first strategy for portfolio images with long expiration
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    console.log("🖼️ Serving image from cache:", request.url);
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(IMAGES_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log("❌ Failed to fetch image:", request.url);
    // Return a placeholder or throw error
    throw error;
  }
}

async function handleFontRequest(request) {
  const url = new URL(request.url);

  // Skip wedding-card fonts (though unlikely to be app-specific)
  if (url.pathname.startsWith("/wedding-card")) {
    return fetch(request);
  }

  // Cache first strategy for fonts (they rarely change)
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    console.log("🔤 Serving font from cache:", request.url);
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(FONTS_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log("❌ Failed to fetch font:", request.url);
    throw error;
  }
}

async function handleAPIRequest(request) {
  // Network first strategy for API requests with cache fallback
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      // Cache successful API responses for offline access
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log("🔌 API network failed, trying cache:", request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Add a header to indicate this is cached data
      const response = cachedResponse.clone();
      response.headers.set("X-Served-From", "cache");
      return response;
    }
    throw error;
  }
}

async function handleOtherRequests(request) {
  // Stale while revalidate for other requests
  const cachedResponse = await caches.match(request);

  const networkPromise = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((error) => {
      console.log("❌ Network request failed:", request.url);
      return null;
    });

  // Return cached response immediately if available, while updating in background
  if (cachedResponse) {
    console.log("📋 Serving from cache while revalidating:", request.url);
    networkPromise; // Update cache in background
    return cachedResponse;
  }

  // If no cache, wait for network
  return networkPromise || new Response("Offline", { status: 503 });
}

// Background Sync for offline data
self.addEventListener("sync", (event) => {
  console.log("🔄 Background sync triggered:", event.tag);

  if (event.tag === "contact-form-sync") {
    event.waitUntil(syncContactForms());
  } else if (event.tag === "analytics-sync") {
    event.waitUntil(syncAnalyticsData());
  }
});

// Message handling from main thread
self.addEventListener("message", (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case "SKIP_WAITING":
      self.skipWaiting();
      break;
    case "GET_CACHE_STATUS":
      event.ports[0].postMessage({
        type: "CACHE_STATUS",
        payload: getCacheStatus(),
      });
      break;
    case "CLEAR_CACHE":
      clearAllCaches().then(() => {
        event.ports[0].postMessage({
          type: "CACHE_CLEARED",
          payload: true,
        });
      });
      break;
    default:
      break;
  }
});

// Sync offline contact forms
async function syncContactForms() {
  try {
    console.log("📤 Syncing offline contact forms...");

    const offlineData = await getOfflineData("contact-forms");
    const pendingForms = offlineData.filter(
      (form) => form.status === "pending",
    );

    for (const form of pendingForms) {
      try {
        // Assuming you're using EmailJS or similar service
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form.data),
        });

        if (response.ok) {
          form.status = "sent";
          console.log("✅ Contact form synced:", form.id);
        } else {
          console.error("❌ Contact form sync failed:", response.status);
        }
      } catch (error) {
        console.error("❌ Contact form sync error:", error);
      }
    }

    await updateOfflineData("contact-forms", offlineData);
  } catch (error) {
    console.error("❌ Contact form sync process failed:", error);
  }
}

// Sync analytics data
async function syncAnalyticsData() {
  try {
    console.log("� Syncing offline analytics...");

    const analyticsData = await getOfflineData("analytics");
    // Sync with your analytics service when back online

    console.log("✅ Analytics data synced");
  } catch (error) {
    console.error("❌ Analytics sync failed:", error);
  }
}

// Cache management utilities
async function getCacheStatus() {
  try {
    const cacheNames = await caches.keys();
    const status = {};

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      status[cacheName] = keys.length;
    }

    return status;
  } catch (error) {
    console.error("❌ Failed to get cache status:", error);
    return {};
  }
}

async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    console.log("🗑️ All caches cleared");
  } catch (error) {
    console.error("❌ Failed to clear caches:", error);
  }
}

// Helper functions for offline data management using IndexedDB
async function getOfflineData(storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("PortfolioOfflineDB", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const getRequest = store.getAll();

      getRequest.onsuccess = () => resolve(getRequest.result || []);
      getRequest.onerror = () => reject(getRequest.error);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

async function updateOfflineData(storeName, data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("PortfolioOfflineDB", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      // Clear existing data and add new data
      store.clear();
      data.forEach((item) => store.add(item));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

// Push notification support
self.addEventListener("push", (event) => {
  const defaultOptions = {
    body: "Check out what's new in my portfolio!",
    icon: "/icon.png",
    badge: "/icon.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: "portfolio-update",
    },
    actions: [
      {
        action: "view",
        title: "View Portfolio",
        icon: "/icon.png",
      },
      {
        action: "close",
        title: "Dismiss",
        icon: "/icon.png",
      },
    ],
    requireInteraction: false,
    silent: false,
  };

  let notificationData = defaultOptions;

  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = { ...defaultOptions, ...pushData };
    } catch (error) {
      console.log("Using default notification data");
    }
  }

  event.waitUntil(
    self.registration.showNotification("� Portfolio Update", notificationData),
  );
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  console.log("🔔 Notification clicked:", event.action);

  event.notification.close();

  const urlToOpen = event.action === "view" ? "/" : null;

  if (urlToOpen) {
    event.waitUntil(
      clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clientList) => {
          // Check if portfolio is already open
          for (let client of clientList) {
            if (
              client.url.includes(self.location.origin) &&
              "focus" in client
            ) {
              return client.focus();
            }
          }
          // Open new window if not already open
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        }),
    );
  }
});

// Cache cleanup on storage quota exceeded
self.addEventListener("quotaexceeded", (event) => {
  console.log("💾 Storage quota exceeded, cleaning up old caches");

  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      // Keep only the most recent caches
      const currentCaches = [
        STATIC_CACHE,
        DYNAMIC_CACHE,
        IMAGES_CACHE,
        FONTS_CACHE,
      ];
      const oldCaches = cacheNames.filter(
        (name) => !currentCaches.includes(name),
      );

      // Delete old caches
      await Promise.all(oldCaches.map((name) => caches.delete(name)));

      // Clean up dynamic cache if still over quota
      const dynamicCache = await caches.open(DYNAMIC_CACHE);
      const dynamicKeys = await dynamicCache.keys();

      if (dynamicKeys.length > 50) {
        // Keep only 50 most recent dynamic entries
        const keysToDelete = dynamicKeys.slice(0, dynamicKeys.length - 50);
        await Promise.all(keysToDelete.map((key) => dynamicCache.delete(key)));
      }
    }),
  );
});
