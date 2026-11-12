// Service worker de la calculadora de ACTM (alcance /actm/): app instalable y uso sin conexión.
// - Precios (../data.json, compartidos con la calculadora principal): primero la red; sin conexión, la última copia.
// - La página: primero la red; sin conexión, la copia guardada.
// - Imágenes, manifiesto y tipografías: copia guardada y actualización por detrás.
const VERSION = "actm-gasoleo-v1";
const BASICOS = [
  "./", "manifest.webmanifest", "../data.json",
  "img/actm-marca.png", "img/favicon.png", "img/apple-touch-icon.png",
  "img/icon-192.png", "img/icon-512.png", "img/maskable-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith("actm-") && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === location.origin && url.pathname.endsWith("/data.json")) {
    const clave = new Request(new URL("../data.json", self.registration.scope));
    e.respondWith(
      fetch(req, { cache: "no-store" })
        .then((r) => { if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(clave, copia)); } return r; })
        .catch(() => caches.match(clave))
    );
    return;
  }

  const propio = url.origin === location.origin;
  const fuentes = url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com";
  if (!propio && !fuentes) return;

  if (req.mode === "navigate") {
    const pagina = new Request(new URL("./", self.registration.scope));
    e.respondWith(
      fetch(req, { cache: "no-cache" })
        .then((r) => { if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(pagina, copia)); } return r; })
        .catch(() => caches.match(pagina))
    );
    return;
  }

  e.respondWith(
    caches.open(VERSION).then((c) =>
      c.match(req).then((guardada) => {
        const red = fetch(req)
          .then((r) => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; })
          .catch(() => guardada);
        return guardada || red;
      })
    )
  );
});
