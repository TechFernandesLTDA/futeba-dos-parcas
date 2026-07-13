// Bump version a cada deploy que precisa invalidar cache.
// v1 → v2: corrige bug em que cache-first travava assets antigos
// mesmo após hash de bundle mudar (BadgesScreen-BexbiUlU.js sticky).
// v2 → v3: precache de /offline.html como fallback offline dedicado (#2204).
// v3 → v4: purga o index.html cacheado que carregava o CSP estrito (#2314)
// que bloqueava o Google Sign-In. Força re-precache do index novo (CSP
// corrigido, #2356) na proxima ativacao. Bump invalida o cache antigo.
// v4 → v5: ignora schemes nao-cacheaveis (ex: chrome-extension://) para
// evitar erro Cache.put quando extensoes interceptam requests.
// v5 → v6: invalida assets antigos apos correcoes criticas no fluxo de perfil.
// v6 → v7: invalida bundle antigo apos correcao critica do OTP no web mobile.
// v7 → v8: limpa HTML/chunks antigos presos no PWA mobile apos hotfix de assets.
// v8 → v9: inclui metadados/icone de instalacao PWA mobile.
// v9 → v10: invalida caches apos watchdog de inicializacao auth para Vivaldi mobile.
// v10 → v11: restringe o cache a requests HTTP(S) da mesma origem. Evita que
// assets de terceiros sejam administrados pelo app e substitui allowlists por
// substring que aceitavam hosts parecidos com dominios do Firebase/Google.
// v11 → v12: invalida index.html e bundles antigos presos no cache apos
// remover crossOrigin=anonymous do player de video (CORS blockava TODOS os
// videos do mural). Sem este bump o SW servia o bundle antigo mesmo apos
// hard refresh do usuario.
// v12 → v13: invalida HTML cacheado com CSP antigo (sem media-src) que
// blockava <video> de carregar do Firebase Storage. CSP novo adiciona
// media-src permitindo firebasestorage.googleapis.com.
// v13 → v14: invalida bundle antigo apos adicionar fullscreen lightbox de
// video no mobile (Dialog fullScreen) e botao de tela cheia nativo no player.
// v14 → v15: corrige duplicacao de botao ampliar/tela cheia no card inline.
const CACHE_NAME = 'futeba-v15';
const OFFLINE_URL = '/offline.html';
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Instalar: cachear assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

// Ativar: limpar TODOS os caches antigos (qualquer nome != CACHE_NAME)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch:
// - HTML (navigate): network-first (sempre busca versão atual do SPA root)
// - Assets hashed (.js/.css/...): stale-while-revalidate (cache imediato + atualiza em bg)
// - Firebase APIs: passthrough
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // O service worker administra somente conteúdo GET da própria origem. APIs
  // Firebase, fontes e qualquer outro terceiro seguem direto para a rede.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
  if (!isHttp || url.origin !== self.location.origin) return;

  // Navegação (HTML): network-first com fallback de cache offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cachear cópia em background pra fallback offline
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          // #2204: fallback offline dedicado em vez de texto cru "Offline".
          caches.match(request).then((cached) =>
            cached || caches.match(OFFLINE_URL) || caches.match('/') ||
            new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
          )
        )
    );
    return;
  }

  // Assets estáticos: stale-while-revalidate
  // Vite gera hashes únicos por build (BadgesScreen-XXXX.js), então cache hit
  // de um hash não bloqueia novos hashes — entram via network e populam o cache.
  // Para um arquivo de mesmo nome que mudou (raro com hash, mas pode acontecer
  // em manifest.json), pegamos cache imediato e revalidamos em background.
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2?|webp|ico)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached); // Sem rede: usa cache
        // Stale-while-revalidate: serve cache se houver, atualiza em bg
        return cached || networkFetch;
      })
    );
    return;
  }
});

// Permitir que cliente force ativação imediata (ex: prompt "Atualizar app")
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
