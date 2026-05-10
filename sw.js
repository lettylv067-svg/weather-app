// Service Worker — 说人话天气预报
// v10: 时间戳版本号 + network-first 策略，每次部署自动刷新 PWA
const CACHE_NAME = 'weather-app-v10-' + Date.now();
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/storage.js',
  '/js/weather.js',
  '/js/compare.js',
  '/js/clothing.js',
  '/js/alerts.js',
  '/js/auth.js',
  '/js/sync.js',
  '/js/app.js',
  '/manifest.json',
];

// 安装：缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 请求拦截：静态资源走 network-first（确保新版本能拿到），失败走缓存
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API 请求：网络优先，失败走缓存
  if (url.hostname.includes('qweather.com') || url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 只缓存和风天气请求，不缓存 Supabase（认证数据不应缓存）
          if (url.hostname.includes('qweather.com')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 静态资源：网络优先，失败回落缓存（确保更新及时）
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
