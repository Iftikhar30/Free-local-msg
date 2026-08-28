// Service Worker for LocalLink Web Push Notifications & Background Alerts
// Handles incoming background calls, messages, and connection requests

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming Web Push notifications from server
self.addEventListener("push", (event) => {
  let data = {
    title: "LocalLink",
    body: "You have a new alert on LocalLink",
    type: "generic",
    url: "/",
    tag: "locallink-notification",
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const title = data.title || "LocalLink";
  const notificationOptions = {
    body: data.body,
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    tag: data.tag || `locallink-${data.type || "alert"}-${Date.now()}`,
    data: {
      url: data.url || "/",
      type: data.type,
      callId: data.callId,
      peerId: data.peerId,
    },
    // Vibration patterns for calls vs messages
    vibrate:
      data.type === "call"
        ? [500, 250, 500, 250, 500, 250, 500] // Long ring vibration
        : [200, 100, 200], // Short message chime vibration
    requireInteraction: data.type === "call", // Keep call notification active until user taps
    renotify: true,
    actions:
      data.type === "call"
        ? [
            { action: "answer", title: "📞 Answer" },
            { action: "dismiss", title: "Dismiss" },
          ]
        : [{ action: "open", title: "Open" }],
  };

  event.waitUntil(self.registration.showNotification(title, notificationOptions));
});

// Handle notification tap / action clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const urlToOpen = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If an existing window is open, focus it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if ("navigate" in client && urlToOpen !== "/") {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      // If no window is open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Keep subscription active on browser rotation
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription?.options || { userVisibleOnly: true })
      .then((newSubscription) => {
        return fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: newSubscription.toJSON(),
          }),
        });
      })
      .catch((err) => console.warn("Push subscription change error:", err))
  );
});
