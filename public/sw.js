console.log("🟢 SW Pause Gourmande chargé");

const ALLOWED_NOTIFICATION_URLS = [
  "/",
  "/dashboard",
  "/orders-page",
  "/driver",
];

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;

  try {
    data = event.data.json();
  } catch {
    data = {
      title: "Pause Gourmande",
      body: event.data.text(),
    };
  }

  const title =
    typeof data.title === "string" && data.title.trim()
      ? data.title.trim()
      : "Pause Gourmande";

  const body =
    typeof data.body === "string" && data.body.trim()
      ? data.body.trim()
      : "Nouvelle notification";

  const requestedUrl =
    typeof data.url === "string" ? data.url : "/";

  const url = ALLOWED_NOTIFICATION_URLS.includes(requestedUrl)
    ? requestedUrl
    : "/";

  const tag =
    typeof data.tag === "string" && data.tag.trim()
      ? data.tag.trim()
      : "pause-gourmande-notification";

  const options = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url },
    vibrate: [200, 100, 200],
    tag,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const requestedUrl = event.notification.data?.url;

  const url = ALLOWED_NOTIFICATION_URLS.includes(requestedUrl)
    ? requestedUrl
    : "/";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then(async (clientList) => {
      const targetUrl = new URL(url, self.location.origin);

      // Réutiliser uniquement un onglet appartenant à Pause Gourmande.
      const sameOriginClient = clientList.find((client) => {
        try {
          return new URL(client.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });

      if (sameOriginClient) {
        await sameOriginClient.navigate(targetUrl.href);
        return sameOriginClient.focus();
      }

      return clients.openWindow
        ? clients.openWindow(targetUrl.href)
        : undefined;
    })
  );
});

