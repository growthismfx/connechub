// Service worker for Web Push notifications
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "New notification", body: event.data ? event.data.text() : "" };
  }

  const isCall = data.kind === "call";
  const title = data.title || "ConnectHub";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/icon-192.png",
    tag: data.tag || "default",
    renotify: data.renotify !== false, // re-alert per push
    data: { url: data.url || "/", kind: data.kind, callId: data.callId, ...(data.data || {}) },
    requireInteraction: !!data.requireInteraction || isCall,
    vibrate: data.vibrate || (isCall ? [500, 300, 500, 300, 500, 300, 500] : [200, 100, 200]),
    silent: false,
    actions: isCall
      ? [
          { action: "accept", title: "Receive" },
          { action: "decline", title: "Decline" },
        ]
      : [],
  };

  event.waitUntil(
    (async () => {
      // Notify open clients so they can play in-app ringtone/UI
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clientList) {
        try { c.postMessage({ type: "push", payload: data }); } catch {}
      }
      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let targetUrl = data.url || "/";

  if (data.kind === "call") {
    if (event.action === "decline") {
      targetUrl = `/calls?decline=${encodeURIComponent(data.callId || "")}`;
    } else {
      // accept or default click → open call screen
      targetUrl = data.url || `/call/${data.callId}?role=callee`;
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
