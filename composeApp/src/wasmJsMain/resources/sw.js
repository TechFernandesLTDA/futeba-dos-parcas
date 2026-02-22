const CACHE_NAME = 'futeba-v1';
const STATIC_CACHE = 'futeba-static-v1';
const DYNAMIC_CACHE = 'futeba-dynamic-v1';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/composeApp.wasm',
    '/composeApp.js',
    '/skiko.js',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js'
];

const CACHE_FIRST_PATTERNS = [
    /\.wasm$/,
    /\.js$/,
    /\.css$/,
    /\.png$/,
    /\.jpg$/,
    /\.svg$/,
    /\.ico$/,
    /skiko\.js$/,
    /composeApp\.js$/,
    /composeApp\.wasm$/
];

const NETWORK_FIRST_PATTERNS = [
    /firebaseio\.com/,
    /googleapis\.com/,
    /firebase\.app/,
    /firestore/,
    /auth/
];

self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Cache aberto, adicionando assets estáticos');
                return cache.addAll(STATIC_ASSETS).catch((err) => {
                    console.warn('[SW] Alguns assets falharam ao cachear:', err);
                });
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Ativando Service Worker...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
                        .map((name) => {
                            console.log('[SW] Removendo cache antigo:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') {
        return;
    }

    if (isNetworkFirst(request.url)) {
        event.respondWith(networkFirst(request));
    } else if (isCacheFirst(request.url)) {
        event.respondWith(cacheFirst(request));
    } else {
        event.respondWith(staleWhileRevalidate(request));
    }
});

function isCacheFirst(url) {
    return CACHE_FIRST_PATTERNS.some(pattern => pattern.test(url));
}

function isNetworkFirst(url) {
    return NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(url));
}

async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.warn('[SW] Falha ao buscar:', request.url);
        return new Response('Offline', { status: 503 });
    }
}

async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.log('[SW] Network falhou, tentando cache:', request.url);
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);

    const fetchPromise = fetch(request)
        .then((networkResponse) => {
            if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        })
        .catch(() => cachedResponse);

    return cachedResponse || fetchPromise;
}

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('[SW] Service Worker carregado');
