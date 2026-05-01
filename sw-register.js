/**
 * Service Worker Registration Script
 * Registers the service worker and handles updates
 */

const IS_PROD =
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1";

if (IS_PROD) {
  // Keep production console clean for SW registration/online state logs.
  window.console.log = () => {};
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      console.log(
        "✅ Service Worker registered successfully:",
        registration.scope,
      );

      // Handle service worker updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        console.log("🔄 New service worker installing...");

        newWorker?.addEventListener("statechange", () => {
          if (newWorker.state === "installed") {
            if (navigator.serviceWorker.controller) {
              // Immediately activate the new SW so stale chunks are replaced
              newWorker.postMessage({ type: "SKIP_WAITING" });
            } else {
              // Service worker installed for the first time
              console.log("💾 Content cached for offline use");
              showOfflineReady();
            }
          }
        });
      });

      // Reload the page when a new SW takes control so fresh chunks are used
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });

      // Handle service worker messages
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "SKIP_WAITING") {
          window.location.reload();
        }
      });
    } catch (error) {
      console.error("❌ Service Worker registration failed:", error);
    }
  });

  // Handle online/offline status
  window.addEventListener("online", () => {
    console.log("🌐 Back online");
    updateOnlineStatus(true);
  });

  window.addEventListener("offline", () => {
    console.log("📱 Offline mode");
    updateOnlineStatus(false);
  });
}

function showUpdateAvailable() {
  // Create a simple notification for new content
  const notification = document.createElement("div");
  notification.id = "sw-update-notification";
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--accent-color, #00d4ff);
      color: var(--bg-color, #0a0a0a);
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      font-family: var(--font-roboto, system-ui);
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    ">
      <div style="font-weight: 600; margin-bottom: 8px;">Update Available</div>
      <div style="font-size: 14px; margin-bottom: 12px;">New content is available. Refresh to update.</div>
      <button onclick="refreshApp()" style="
        background: transparent;
        border: 1px solid currentColor;
        color: inherit;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        margin-right: 8px;
      ">Refresh</button>
      <button onclick="dismissUpdate()" style="
        background: transparent;
        border: none;
        color: inherit;
        padding: 6px 12px;
        cursor: pointer;
        opacity: 0.7;
      ">Later</button>
    </div>
    <style>
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    </style>
  `;
  document.body.appendChild(notification);
}

function showOfflineReady() {
  console.log("💾 App is ready to work offline");
  // Optionally show a subtle notification that the app is cached
}

function updateOnlineStatus(isOnline) {
  // Update UI to reflect online/offline status
  document.documentElement.setAttribute("data-online", isOnline.toString());

  // Dispatch custom event for components to listen to
  window.dispatchEvent(
    new CustomEvent("onlinestatuschange", {
      detail: { isOnline },
    }),
  );
}

function refreshApp() {
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
  } else {
    window.location.reload();
  }
}

function dismissUpdate() {
  const notification = document.getElementById("sw-update-notification");
  if (notification) {
    notification.remove();
  }
}

// Initialize online status
updateOnlineStatus(navigator.onLine);
