import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  routes,
  SITE_URL,
  SITE_NAME,
  PARENT_ORG_NAME,
  PARENT_ORG_URL,
  ATTRIBUTION,
  homePage,
  HOME_GUARD_SOURCE,
} from './prerender-routes.mjs';

// Gera HTML estático (head por rota + conteúdo semântico em #prerender; o #root do React fica escondido
// até o handoff em src/utils/prerenderHandoff.ts) para as páginas
// públicas indexáveis. O index.html da raiz NÃO é alterado: ele é o shell SPA servido
// para todas as demais rotas (rewrite **), e conteúdo de marketing ali apareceria em
// rotas autenticadas antes do React montar.

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '../dist');
const templatePath = resolve(distDir, 'index.html');

if (!existsSync(templatePath)) {
  console.error(`[prerender] Erro: template base não encontrado em ${templatePath}. Rode o vite build antes.`);
  process.exit(1);
}

const baseHtml = readFileSync(templatePath, 'utf8');

// Chunk lazy de cada rota (App.tsx) e dependências diretas, para o navegador baixar em
// paralelo com o entry em vez de só depois de o React montar (reduz LCP).
const ROUTE_CHUNKS = {
  '/organizar-pelada': 'HowToOrganizePage',
  '/ranking-futebol-amador': 'AmateurRankingPage',
  '/gestao-de-pelada': 'PeladaManagementPage',
  '/como-funciona': 'HowItWorksPage',
  '/parcerias': 'PartnershipsPage',
};
const SHARED_CHUNKS = ['GrowthHeader', 'GrowthFooter', 'GrowthBreadcrumbs', 'GrowthCtaSection', 'GrowthFaq'];
const assetFiles = existsSync(resolve(distDir, 'assets')) ? readdirSync(resolve(distDir, 'assets')) : [];

function routeChunkFiles(route) {
  const names = [ROUTE_CHUNKS[route.path], ...SHARED_CHUNKS].filter(Boolean);
  return names
    .map((name) => assetFiles.find((f) => f.startsWith(`${name}-`) && f.endsWith('.js')))
    .filter(Boolean)
    .map((f) => `/assets/${f}`);
}

// Boot adiado (#4196): o JS do app só começa a ser baixado DEPOIS do first-contentful-paint. Nas páginas
// prerenderizadas o conteúdo já está no HTML, então o bundle (entry + modulepreloads) não precisa disputar
// banda/CPU com a primeira pintura nem com as fontes; o React monta em segundo plano e o handoff
// (src/utils/prerenderHandoff.ts) troca o estático pelo app. Arquivo externo e com hash no nome (não exige
// hash de CSP nem quebra o cache immutable). Lê os assets de um bloco JSON (não executável) no HTML.
const BOOT_SOURCE = `(function(){var c;try{c=JSON.parse(document.getElementById('boot-assets').textContent)}catch(e){return}var t=false;function go(){if(t)return;t=true;(c.preload||[]).forEach(function(h){var l=document.createElement('link');l.rel='modulepreload';l.href=h;document.head.appendChild(l)});var s=document.createElement('script');s.type='module';s.src=c.entry;document.head.appendChild(s)}if(document.documentElement.hasAttribute('data-no-prerender')){go();return}try{new PerformanceObserver(function(l,o){if(l.getEntriesByName('first-contentful-paint').length){o.disconnect();setTimeout(go,0)}}).observe({type:'paint',buffered:true})}catch(e){go();return}setTimeout(go,3000)})();`;
const BOOT_FILE = `boot-${createHash('sha256').update(BOOT_SOURCE).digest('hex').slice(0, 8)}.js`;
mkdirSync(resolve(distDir, 'assets'), { recursive: true });
writeFileSync(resolve(distDir, 'assets', BOOT_FILE), BOOT_SOURCE, 'utf8');

const ENTRY_RE = /[ \t]*<script type="module" crossorigin src="(\/assets\/index-[^"]+\.js)"><\/script>\r?\n?/i;
const MODULEPRELOAD_RE = /[ \t]*<link rel="modulepreload" crossorigin href="([^"]+)"[^>]*>\r?\n?/gi;
const entryMatch = baseHtml.match(ENTRY_RE);
if (!entryMatch) {
  console.error('[prerender] Erro: script de entrada do Vite não encontrado em dist/index.html.');
  process.exit(1);
}
const BASE_PRELOADS = [...baseHtml.matchAll(MODULEPRELOAD_RE)].map((m) => m[1]);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function replaceOnce(html, pattern, replacement, label, route) {
  const found = typeof pattern === 'string' ? html.includes(pattern) : pattern.test(html);
  if (!found) {
    console.error(`[prerender] Erro: marcador "${label}" não encontrado em dist/index.html (rota ${route.path}).`);
    process.exit(1);
  }
  // Função evita interpretação de "$" no texto de substituição.
  return html.replace(pattern, () => replacement);
}

// Estilos espelham a hero das páginas React (GrowthHeader/Breadcrumbs + hero) para que a troca
// pelo React não mude o layout nem o elemento de LCP (medidas conferidas no navegador).
const PRERENDER_CSS = `
body{margin:0}
.pr{font-family:Poppins,"Plus Jakarta Sans","SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#fcfcfc;color:#1a1c1e;min-height:100vh;line-height:1.5}
.pr *{box-sizing:border-box}
.pr a{color:inherit;text-decoration:none}
.pr-wrap{max-width:1200px;margin:0 auto;padding:0 16px;width:100%}
.pr-header{height:65px;background:rgba(255,255,255,.96);border-bottom:1px solid #e5e3e6}
.pr-header .pr-wrap{height:64px;display:flex;align-items:center;justify-content:space-between}
.pr-logo{font-weight:800;font-size:20px;color:#1a1c1e}
.pr-nav{display:none;gap:24px;align-items:center;font-size:14px;font-weight:600;color:#444746}
.pr-cta{display:inline-flex;align-items:center;min-height:44px;padding:0 20px;border-radius:999px;background:#00852a;color:#fff!important;font-weight:800;font-size:14px}
.pr-crumb{height:68px;display:flex;align-items:center;font-size:14px;color:#444746}
.pr-crumb strong{color:#1a1c1e;margin-left:8px}
.pr-hero{background:rgba(0,133,42,.03);padding:32px 0 48px}
.pr-chip{display:inline-block;height:24px;line-height:24px;padding:0 12px;border-radius:12px;background:rgba(0,133,42,.1);color:#00852a;font-weight:800;font-size:13px;letter-spacing:.5px;margin-bottom:12px}
.pr-h1{margin:0;font-size:2rem;line-height:1.15;font-weight:900;letter-spacing:-1px}
.pr-lead{margin:20px 0 0;font-size:1.0625rem;line-height:1.6;color:#444746}
.pr-btn{display:inline-flex;align-items:center;min-height:48px;margin-top:28px;padding:0 28px;border-radius:999px;background:#00852a;color:#fff!important;font-weight:800;font-size:15px}
.pr-body{padding:48px 0}
.pr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}
.pr-card{background:#fff;padding:24px;border-radius:12px;border:1px solid #e5e3e6}
.pr-card h2{margin:0 0 12px;font-size:20px;font-weight:800}
.pr-card p{margin:0;font-size:15px;line-height:1.6;color:#444746}
.pr-footer{padding:32px 16px;border-top:1px solid #e5e3e6;background:#fff;text-align:center;color:#444746;font-size:14px}
.pr-footer p{margin:0 0 8px}
@media(min-width:600px){.pr-wrap{padding:0 24px}.pr-h1{font-size:2.75rem}}
@media(min-width:1200px){.pr-nav{display:flex}}@media(min-width:900px){.pr-header{height:73px}.pr-header .pr-wrap{height:72px}.pr-hero{padding:64px 0 80px}.pr-h1{font-size:3.25rem}.pr-lead{font-size:1.2rem}.pr-hero-col{width:calc((100% + 40px) * 7 / 12 - 40px)}}
`.replace(/\n/g, '');

function generateSemanticContent(route) {
  const nav = [
    ['/como-funciona', 'Como Funciona'],
    ['/organizar-pelada', 'Organizar Pelada'],
    ['/ranking-futebol-amador', 'Ranking & MVP'],
    ['/gestao-de-pelada', 'Gestão & Caixa'],
    ['/parcerias', 'Parcerias'],
  ]
    .map(([href, label]) => `<a href="${href}">${label}</a>`)
    .join('');
  const sections = route.sections
    .map(
      (s) => `<section class="pr-card"><h2>${escapeHtml(s.title)}</h2><p>${escapeHtml(s.text)}</p></section>`,
    )
    .join('');
  const register = (medium) => `/register?utm_source=prerender&amp;utm_medium=${medium}&amp;utm_campaign=growth`;
  return `<style>${PRERENDER_CSS}</style><div class="pr">
    <header class="pr-header"><div class="pr-wrap">
      <a class="pr-logo" href="/">${SITE_NAME}</a>
      <nav class="pr-nav" aria-label="Principal">${nav}</nav>
      <a class="pr-cta" href="${register('nav')}">Criar Pelada</a>
    </div></header>
    <div class="pr-crumb"><div class="pr-wrap"><nav aria-label="breadcrumb"><a href="/">Início</a> › <strong>${escapeHtml(route.breadcrumb)}</strong></nav></div></div>
    <main>
      <section class="pr-hero"><div class="pr-wrap"><div class="pr-hero-col">
        <span class="pr-chip">${escapeHtml(route.chip)}</span>
        <h1 class="pr-h1">${escapeHtml(route.contentHeading)}</h1>
        <p class="pr-lead">${escapeHtml(route.contentLead)}</p>
        <a class="pr-btn" href="${register('hero_cta')}">Criar Minha Conta</a>
      </div></div></section>
      <section class="pr-body"><div class="pr-wrap"><div class="pr-grid">${sections}</div></div></section>
    </main>
    <footer class="pr-footer">
      <p><strong>${SITE_NAME}</strong></p>
      <p>Um produto da <a href="${PARENT_ORG_URL}" target="_blank" rel="noopener noreferrer" style="color:#00852a;font-weight:700">Tech Fernandes</a>.</p>
      <p>© ${new Date().getFullYear()} ${PARENT_ORG_NAME}. Todos os direitos reservados.</p>
    </footer>
  </div>`;
}

function breadcrumbJsonLd(route) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: route.breadcrumb, item: `${SITE_URL}${route.path}` },
    ],
  }).replace(/</g, '\\u003c');
}

function generatePrerenderedHtml(route) {
  const canonical = `${SITE_URL}${route.path}`;
  const title = escapeHtml(route.title);
  const description = escapeHtml(route.description);
  const ogDescription = escapeHtml(`${route.description} ${ATTRIBUTION}`);
  const ogImage = escapeHtml(route.ogImage);
  let html = baseHtml;

  html = replaceOnce(html, /<title>.*?<\/title>/i, `<title>${title}</title>`, 'title', route);
  html = replaceOnce(html, /<meta name="description" content=".*?" \/>/i, `<meta name="description" content="${description}" />`, 'description', route);
  html = replaceOnce(html, /<link rel="canonical" href=".*?" \/>/i, `<link rel="canonical" href="${canonical}" />`, 'canonical', route);
  html = replaceOnce(html, /<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${title}" />`, 'og:title', route);
  html = replaceOnce(html, /<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${ogDescription}" />`, 'og:description', route);
  html = replaceOnce(html, /<meta property="og:url" content=".*?" \/>/i, `<meta property="og:url" content="${canonical}" />`, 'og:url', route);
  html = replaceOnce(html, /<meta property="og:image" content=".*?" \/>/i, `<meta property="og:image" content="${ogImage}" />`, 'og:image', route);
  html = replaceOnce(html, /<meta name="twitter:title" content=".*?" \/>/i, `<meta name="twitter:title" content="${title}" />`, 'twitter:title', route);
  html = replaceOnce(html, /<meta name="twitter:description" content=".*?" \/>/i, `<meta name="twitter:description" content="${ogDescription}" />`, 'twitter:description', route);
  html = replaceOnce(html, /<meta name="twitter:image" content=".*?" \/>/i, `<meta name="twitter:image" content="${ogImage}" />`, 'twitter:image', route);
  html = replaceOnce(html, /<meta name="twitter:url" content=".*?" \/>/i, `<meta name="twitter:url" content="${canonical}" />`, 'twitter:url', route);

  // O preload do hero é da landing da raiz; nas guias ele só disputa banda com o JS.
  html = replaceOnce(html, /[ \t]*<link rel="preload" as="image" href="\/og-futeba-dos-parcas-hero\.webp"[^>]*>\r?\n?/i, '', 'hero preload', route);

  html = replaceOnce(html, ENTRY_RE, '', 'entry script', route);
  html = html.replace(MODULEPRELOAD_RE, '');
  const preloads = [...new Set([...BASE_PRELOADS, ...routeChunkFiles(route)])];
  const bootAssets = JSON.stringify({ entry: entryMatch[1], preload: preloads });
  html = replaceOnce(
    html,
    /<\/head>/i,
    `    <script type="application/json" id="boot-assets">${bootAssets}</script>
    <script defer src="/assets/${BOOT_FILE}"></script>
    <script type="application/ld+json" id="seo-breadcrumb-jsonld">${breadcrumbJsonLd(route)}</script>
  </head>`,
    'head end',
    route,
  );
  html = replaceOnce(
    html,
    '<div id="root"></div>',
    `<div id="prerender">${generateSemanticContent(route)}</div><div id="root" style="display:none"></div>`,
    'root',
    route,
  );
  return html;
}

// ---------------------------------------------------------------------------------------------
// Home ("/"): hero estático no shell (dist/index.html). O shell atende todas as rotas do SPA, por isso o
// guard inline (HOME_GUARD_SOURCE) desliga o #prerender fora de "/" e para quem tem sessão conhecida.
const HOME_CSS = `
body{margin:0}
#prerender~#root{display:none}
[data-no-prerender] #prerender{display:none}
[data-no-prerender] #prerender~#root{display:block}
.ph{font-family:Poppins,"Plus Jakarta Sans","SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#fcfcfc;color:#1a1c1e;min-height:100vh;line-height:1.5;letter-spacing:.5px}
.ph *{box-sizing:border-box}
.ph a{text-decoration:none}
.ph-wrap{max-width:1200px;margin:0 auto;padding:0 16px}
.ph-header{background:rgba(255,255,255,.96);border-bottom:1px solid #e5e3e6;position:sticky;top:0;z-index:1100}
.ph-hrow{display:flex;align-items:center;justify-content:space-between;min-height:64px;padding-top:8px;padding-bottom:8px;gap:8px}
.ph-brand{display:flex;align-items:center;gap:10px;min-width:0}
.ph-logo{width:36px;height:36px;border-radius:50%;object-fit:contain;flex-shrink:0}
.ph-name{display:none;font-weight:900;font-size:1rem;white-space:nowrap}
.ph-actions{display:flex;gap:8px;flex-shrink:0}
.ph-hb{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 24px;border-radius:12px;font-size:13px;font-weight:600;white-space:nowrap;color:#00852a}
.ph-hb.f{background:#00852a;color:#fff}
.ph-hero{background:#00852a;color:#fff}
.ph-grid{display:grid;grid-template-columns:minmax(0,1fr);grid-template-areas:"intro" "heroImage" "details";row-gap:24px;align-items:center;padding:32px 0}
.ph-intro{grid-area:intro;max-width:720px}
.ph-over{display:block;font-size:11px;font-weight:800;line-height:2.66;letter-spacing:.14em;text-transform:uppercase;margin-bottom:24px}
.ph-h1{margin:0;font-size:36px;line-height:1.02;font-weight:900;letter-spacing:normal}
.ph-img{grid-area:heroImage;display:block;width:100%;max-width:500px;height:auto;aspect-ratio:1200/630;object-fit:cover;border-radius:48px;justify-self:center;box-shadow:0 7px 8px -4px rgba(0,0,0,.2),0 12px 17px 2px rgba(0,0,0,.14),0 5px 22px 4px rgba(0,0,0,.12)}
.ph-details{grid-area:details;max-width:720px}
.ph-lead{margin:0 0 24px;font-size:22px;line-height:32px;font-weight:600;opacity:.9;max-width:650px;letter-spacing:normal}
.ph-cta{display:flex;align-items:center;justify-content:center;min-height:46px;padding:8px 22px;border-radius:12px;background:#fff;color:#005a1c;font-size:15px;font-weight:600}
@media(min-width:600px){.ph-wrap{padding:0 24px}.ph-hrow{min-height:72px;padding-top:12px;padding-bottom:12px}.ph-logo{width:42px;height:42px}.ph-name{display:block}.ph-h1{font-size:39px}.ph-cta{display:inline-flex}}
@media(min-width:900px){.ph-grid{grid-template-columns:minmax(0,1fr) minmax(360px,500px);grid-template-areas:"intro heroImage" "details heroImage";column-gap:72px;padding:88px 0}.ph-h1{font-size:41.7px}.ph-lead{font-size:23.4px}}
`.replace(/\n/g, '');

function generateHomeContent() {
  const h = homePage;
  return `<style>${HOME_CSS}</style><div class="ph">
    <header class="ph-header"><div class="ph-wrap ph-hrow">
      <span class="ph-brand"><img class="ph-logo" src="/logo-96.webp" width="36" height="36" alt="${escapeHtml(h.logoAlt)}"><span class="ph-name">${escapeHtml(SITE_NAME)}</span></span>
      <span class="ph-actions"><a class="ph-hb" href="/login">${escapeHtml(h.headerLogin)}</a><a class="ph-hb f" href="/register">${escapeHtml(h.headerRegister)}</a></span>
    </div></header>
    <main><section class="ph-hero"><div class="ph-wrap"><div class="ph-grid">
      <div class="ph-intro"><span class="ph-over">${escapeHtml(h.overline)}</span><h1 class="ph-h1">${escapeHtml(h.heading)}</h1></div>
      <img class="ph-img" src="/og-futeba-dos-parcas-hero.webp" width="1200" height="630" alt="${escapeHtml(h.imageAlt)}" fetchpriority="high">
      <div class="ph-details"><p class="ph-lead">${escapeHtml(h.lead)}</p><a class="ph-cta" href="/register">${escapeHtml(h.cta)}</a></div>
    </div></div></section></main>
  </div>`;
}

function generateHomeShell() {
  const ctx = { path: '/' };
  let html = baseHtml;
  html = replaceOnce(html, ENTRY_RE, '', 'entry script', ctx);
  html = html.replace(MODULEPRELOAD_RE, '');
  const bootAssets = JSON.stringify({ entry: entryMatch[1], preload: BASE_PRELOADS });
  html = replaceOnce(
    html,
    /<\/head>/i,
    `    <script>${HOME_GUARD_SOURCE}</script>
    <script type="application/json" id="boot-assets">${bootAssets}</script>
    <script defer src="/assets/${BOOT_FILE}"></script>
  </head>`,
    'head end',
    ctx,
  );
  html = replaceOnce(
    html,
    '<div id="root"></div>',
    `<div id="prerender">${generateHomeContent()}</div><div id="root"></div>`,
    'root',
    ctx,
  );
  return html;
}

console.log('[prerender] Gerando HTML estático das rotas públicas...');

for (const route of routes) {
  const rendered = generatePrerenderedHtml(route);
  const routeDir = resolve(distDir, route.path.slice(1));
  mkdirSync(routeDir, { recursive: true });
  const outPath = resolve(routeDir, 'index.html');
  writeFileSync(outPath, rendered, 'utf8');
  console.log(`[prerender] ${outPath}`);
}

writeFileSync(templatePath, generateHomeShell(), 'utf8');
console.log(`[prerender] ${templatePath} (home + shell)`);
console.log(`[prerender] ${routes.length} páginas geradas.`);
