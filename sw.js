// Service worker de la calculadora: permite instalarla como app y usarla sin conexión.
// - data.json: primero la red (precios al día); sin conexión, la última copia guardada.
// - Resto de ficheros propios y tipografías: se sirve la copia guardada y se actualiza por detrás,
//   así una versión nueva de la página llega en la siguiente apertura.
const VERSION = "gasoleo-v2";
const BASICOS = [
  "./", "index.html", "data.json", "manifest.webmanifest",
  "img/trimodos.png", "img/stinsa.png", "img/transargi.png",
  "img/favicon.png", "img/apple-touch-icon.png", "img/icon-192.png", "img/icon-512.png", "img/maskable-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Precios: red primero (la clave de caché no lleva la marca de tiempo de la consulta)
  if (url.origin === location.origin && url.pathname.endsWith("/data.json")) {
    const clave = new Request(new URL("data.json", self.registration.scope));
    e.respondWith(
      fetch(req, { cache: "no-store" })
        .then((r) => {
          if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(clave, copia)); }
          return r;
        })
        .catch(() => caches.match(clave))
    );
    return;
  }

  const propio = url.origin === location.origin;
  const fuentes = url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com";
  if (!propio && !fuentes) return;

  // Navegación: la página guardada aunque la URL lleve ?lang=en
  const clave = req.mode === "navigate" ? new Request(new URL("./", self.registration.scope)) : req;
  e.respondWith(
    caches.open(VERSION).then((c) =>
      c.match(clave).then((guardada) => {
        const red = fetch(req)
          .then((r) => { if (r.ok || r.type === "opaque") c.put(clave, r.clone()); return r; })
          .catch(() => guardada);
        return guardada || red;
      })
    )
  );
});
