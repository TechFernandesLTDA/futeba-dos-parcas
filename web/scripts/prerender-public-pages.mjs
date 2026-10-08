import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  routes,
  SITE_URL,
  SITE_NAME,
  PARENT_ORG_NAME,
  PARENT_ORG_URL,
  ATTRIBUTION,
} from './prerender-routes.mjs';

// Gera HTML estático (head por rota + conteúdo semântico no #root) para as páginas
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

function chunkPreloads(route) {
  const names = [ROUTE_CHUNKS[route.path], ...SHARED_CHUNKS].filter(Boolean);
  const files = names
    .map((name) => assetFiles.find((f) => f.startsWith(`${name}-`) && f.endsWith('.js')))
    .filter(Boolean);
  return files.map((f) => `    <link rel="modulepreload" crossorigin href="/assets/${f}">`).join('\n');
}

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

  html = replaceOnce(
    html,
    /<\/head>/i,
    `${chunkPreloads(route)}\n    <script type="application/ld+json" id="seo-breadcrumb-jsonld">${breadcrumbJsonLd(route)}</script>\n  </head>`,
    'head end',
    route,
  );
  html = replaceOnce(
    html,
    '<div id="root"></div>',
    `<div id="root">${generateSemanticContent(route)}</div>`,
    'root',
    route,
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

console.log(`[prerender] ${routes.length} páginas geradas.`);
