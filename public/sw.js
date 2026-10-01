const CACHE = "arigreet-v5";
const MEDIA = "arigreet-guest-media:";
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches.open(CACHE).then(async (c) => {
      const root = await fetch("/app");
      const html = await root.clone().text();
      const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((v) => v.startsWith("/assets/"));
      await c.put("/app", root);
      await c.addAll([
        "/manifest.json",
        "/icon.svg",
        "/icon-192.png",
        "/fonts/InterVariable.woff2",
        ...assets,
      ]);
      await self.skipWaiting();
    }),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k.startsWith("arigreet-v") && k !== CACHE)
              .map((k) => caches.delete(k)),
          ),
        ),
    ]),
  ),
);
self.addEventListener("message", (event) => {
  const { type, token, urls, expires } = event.data || {};
  if (!/^[a-f0-9]{48}$/.test(token || "")) return;
  if (type === "CLEAR_PICKUP_MEDIA")
    event.waitUntil(caches.delete(MEDIA + token));
  if (type === "CACHE_PICKUP_MEDIA")
    event.waitUntil(
      (async () => {
        const cache = await caches.open(MEDIA + token);
        await cache.put(
          "/__arigreet-expiry",
          new Response(
            String(
              Math.min(
                Number(expires) || Date.now() + 86400000,
                Date.now() + 86400000,
              ),
            ),
          ),
        );
        await Promise.allSettled(
          (urls || []).slice(0, 2).map(async (value) => {
            if (!["greeter", "vehicle"].includes(value.role)) return;
            const alias = "/pickup-media/" + token + "/" + value.role;
            const url = new URL(value.url, self.location.origin);
            if (
              !["http:", "https:"].includes(url.protocol) ||
              (await cache.match(alias))
            )
              return;
            const response = await fetch(url.href, {
              mode: "no-cors",
              credentials: "omit",
            });
            if (response.ok || response.type === "opaque")
              await cache.put(alias, response);
          }),
        );
        const count = (
          await Promise.all(
            (urls || []).map((v) =>
              cache.match("/pickup-media/" + token + "/" + v.role),
            ),
          )
        ).filter(Boolean).length;
        event.source?.postMessage({ type: "PICKUP_MEDIA_READY", token, count });
      })(),
    );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/"))
    return;
  const alias = url.pathname.match(
    /^\/pickup-media\/([a-f0-9]{48})\/(greeter|vehicle)$/,
  );
  if (alias) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(MEDIA + alias[1]);
        const expiry = await cache.match("/__arigreet-expiry");
        if (!expiry || Number(await expiry.text()) <= Date.now()) {
          await caches.delete(MEDIA + alias[1]);
          return new Response("", { status: 404 });
        }
        return (
          (await cache.match(url.pathname)) || new Response("", { status: 404 })
        );
      })(),
    );
    return;
  }
  if (event.request.destination === "image") {
    event.respondWith(
      (async () => {
        const client = await self.clients.get(event.clientId);
        const token =
          client?.url &&
          new URL(client.url).pathname.match(/^\/g\/([a-f0-9]{48})/)?.[1];
        let cache = token ? await caches.open(MEDIA + token) : null;
        const expiry = cache && (await cache.match("/__arigreet-expiry"));
        if (cache && (!expiry || Number(await expiry.text()) <= Date.now())) {
          await caches.delete(MEDIA + token);
          cache = null;
        }
        const saved =
          cache && (await cache.match(event.request, { ignoreVary: true }));
        if (saved) return saved;
        const res = await fetch(event.request);
        return res;
      })(),
    );
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok)
          caches.open(CACHE).then((c) => c.put(event.request, res.clone()));
        return res;
      })
      .catch(() =>
        caches.match(event.request).then((r) => r || caches.match("/app")),
      ),
  );
});
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Arigreet", {
      body: data.body,
      icon: "/icon-192.png",
      tag: "arigreet-update",
      data: { url: data.url || "/app" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
