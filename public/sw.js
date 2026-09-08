self.addEventListener("push", (event) => {
    if (!event.data) {
      return;
    }
  
    let data;
  
    try {
      data = event.data.json();
    } catch {
      data = {
        title: "Pause Gourmande",
        body: event.data.text(),
      };
    }
  
    const title = data.title || "Pause Gourmande";
  
    const options = {
      body: data.body || "Nouvelle notification",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: {
        url: data.url || "/dashboard",
      },
      vibrate: [200, 100, 200],
      tag: data.tag || "pause-gourmande-notification",
    };
  
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  });
  
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
  
    const url = event.notification.data?.url || "/dashboard";
  
    event.waitUntil(
      clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      }).then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
  
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
    );
  });