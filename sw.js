// Service worker de la calculadora: permite instalarla como app y usarla sin conexión.
// - data.json: primero la red (precios al día); sin conexión, la última copia guardada.
// - La página: primero la red (así se ve siempre la última versión); sin conexión, la copia guardada.
// - Imágenes, manifiesto y tipografías: se sirve la copia guardada y se actualiza por detrás.
const VERSION = "gasoleo-v4";
const BASICOS = [
  "./", "index.html", "data.json", "manifest.webmanifest", "trimodos-loader.js",
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

  // La página: primero la red, para ver siempre la última versión; sin conexión, la copia guardada
  // (la misma aunque la URL lleve ?lang=en)
  if (req.mode === "navigate") {
    const pagina = new Request(new URL("./", self.registration.scope));
    e.respondWith(
      fetch(req, { cache: "no-cache" })
        .then((r) => { if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(pagina, copia)); } return r; })
        .catch(() => caches.match(pagina))
    );
    return;
  }

  // Imágenes, manifiesto y tipografías: copia guardada y actualización por detrás
  const clave = req;
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
