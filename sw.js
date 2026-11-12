// 離線用 Service Worker
// ・安裝時先把網頁需要的檔案存起來，沒有網路也能開啟、計算。
// ・網頁本身（index.html）優先抓網路上的最新版，抓不到才用存起來的版本。
// ・其他檔案（CSS、JS、圖示）優先用存起來的版本；檔名帶版本號，改版時會換新。
// 每次修改網頁檔案，請把 CACHE 的版本號加 1，並同步更新下方 ASSETS 的 ?v= 版本號。
const CACHE = "sucoot-qty-v7";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css?v=7",
  "./app.js?v=7",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("sucoot-qty-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  // 網頁本身：先抓網路，失敗才用離線版本
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // 其他檔案：先用存起來的，沒有才抓網路並存起來
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
