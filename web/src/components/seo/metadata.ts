export const SEO_SITE_URL = 'https://futebadosparcas.com.br';
export const SEO_SITE_NAME = 'Futeba dos Parças';
export const SEO_IMAGE_URL = `${SEO_SITE_URL}/og-futeba-dos-parcas.png`;
const SEO_LOGO_URL = `${SEO_SITE_URL}/logo.png`;

const DEFAULT_DESCRIPTION =
  'Organize peladas, monte times equilibrados, acompanhe estatísticas e gerencie seu futebol amador com o Futeba dos Parças.';

const LAUNCH_DESCRIPTION =
  'Chega de bagunça no grupo: organize confirmações, monte times equilibrados, acompanhe estatísticas e gerencie sua pelada.';

export interface SeoRouteMetadata {
  title: string;
  description: string;
  canonicalPath: string;
  index: boolean;
  type?: 'website';
}

const PUBLIC_ROUTE_METADATA: Readonly<Record<string, SeoRouteMetadata>> = {
  '/': {
    title: `${SEO_SITE_NAME} | Organize sua pelada`,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: '/',
    index: true,
  },
  '/launch': {
    title: `${SEO_SITE_NAME} | Organize peladas, times e campeonatos`,
    description: LAUNCH_DESCRIPTION,
    canonicalPath: '/',
    index: true,
  },
};

const PRIVATE_ROUTE_METADATA: Readonly<Record<string, Pick<SeoRouteMetadata, 'title' | 'description'>>> = {
  '/welcome': {
    title: `Boas-vindas | ${SEO_SITE_NAME}`,
    description: 'Comece a organizar suas peladas com o Futeba dos Parças.',
  },
  '/login': {
    title: `Entrar | ${SEO_SITE_NAME}`,
    description: 'Entre na sua conta do Futeba dos Parças.',
  },
  '/register': {
    title: `Criar conta | ${SEO_SITE_NAME}`,
    description: 'Crie sua conta no Futeba dos Parças.',
  },
  '/forgot-password': {
    title: `Recuperar senha | ${SEO_SITE_NAME}`,
    description: 'Recupere o acesso à sua conta do Futeba dos Parças.',
  },
};

function normalizePathname(pathname: string): string {
  const cleanPath = pathname.split(/[?#]/, 1)[0] || '/';
  if (cleanPath === '/') return cleanPath;
  return `/${cleanPath.replace(/^\/+|\/+$/g, '')}`;
}

export function getSeoMetadata(pathname: string): SeoRouteMetadata {
  const normalizedPath = normalizePathname(pathname);
  const publicMetadata = PUBLIC_ROUTE_METADATA[normalizedPath];
  if (publicMetadata) return publicMetadata;

  const privateMetadata = PRIVATE_ROUTE_METADATA[normalizedPath];
  return {
    title: privateMetadata?.title ?? `Aplicativo | ${SEO_SITE_NAME}`,
    description: privateMetadata?.description ?? DEFAULT_DESCRIPTION,
    canonicalPath: normalizedPath,
    index: false,
  };
}

function canonicalUrl(path: string): string {
  return path === '/' ? `${SEO_SITE_URL}/` : `${SEO_SITE_URL}${path}`;
}

function upsertMeta(selector: string, attributes: Record<string, string>): HTMLMetaElement {
  const existing = Array.from(document.head.querySelectorAll<HTMLMetaElement>(selector));
  const element = existing.shift() ?? document.createElement('meta');
  existing.forEach((duplicate) => duplicate.remove());

  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  element.dataset.seoManaged = 'true';
  if (!element.isConnected) document.head.appendChild(element);
  return element;
}

function upsertCanonical(href: string): void {
  const existing = Array.from(
    document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'),
  );
  const element = existing.shift() ?? document.createElement('link');
  existing.forEach((duplicate) => duplicate.remove());
  element.rel = 'canonical';
  element.href = href;
  element.dataset.seoManaged = 'true';
  if (!element.isConnected) document.head.appendChild(element);
}

function upsertJsonLd(id: string, payload: Record<string, unknown>): void {
  const existing = Array.from(document.head.querySelectorAll<HTMLScriptElement>(`script#${id}`));
  const element = existing.shift() ?? document.createElement('script');
  existing.forEach((duplicate) => duplicate.remove());
  element.id = id;
  element.type = 'application/ld+json';
  element.dataset.seoManaged = 'true';
  element.textContent = JSON.stringify(payload);
  if (!element.isConnected) document.head.appendChild(element);
}

export function applySeoMetadata(pathname: string): SeoRouteMetadata {
  const metadata = getSeoMetadata(pathname);
  const url = canonicalUrl(metadata.canonicalPath);
  const robots = metadata.index
    ? 'index, follow, max-image-preview:large'
    : 'noindex, nofollow';

  document.title = metadata.title;
  upsertCanonical(url);
  upsertMeta('meta[name="description"]', { name: 'description', content: metadata.description });
  upsertMeta('meta[name="robots"]', { name: 'robots', content: robots });
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: metadata.title });
  upsertMeta('meta[property="og:description"]', {
    property: 'og:description',
    content: metadata.description,
  });
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: metadata.type ?? 'website' });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url });
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: SEO_IMAGE_URL });
  upsertMeta('meta[property="og:image:type"]', { property: 'og:image:type', content: 'image/png' });
  upsertMeta('meta[property="og:image:width"]', { property: 'og:image:width', content: '1200' });
  upsertMeta('meta[property="og:image:height"]', { property: 'og:image:height', content: '630' });
  upsertMeta('meta[property="og:image:alt"]', {
    property: 'og:image:alt',
    content: `${SEO_SITE_NAME} — organize sua pelada`,
  });
  upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SEO_SITE_NAME });
  upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'pt_BR' });
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: metadata.title });
  upsertMeta('meta[name="twitter:description"]', {
    name: 'twitter:description',
    content: metadata.description,
  });
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: SEO_IMAGE_URL });
  upsertMeta('meta[name="twitter:image:alt"]', {
    name: 'twitter:image:alt',
    content: `${SEO_SITE_NAME} — organize sua pelada`,
  });

  upsertJsonLd('seo-organization-jsonld', {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SEO_SITE_URL}/#organization`,
    name: SEO_SITE_NAME,
    alternateName: 'Futeba dos Parcas',
    url: `${SEO_SITE_URL}/`,
    logo: {
      '@type': 'ImageObject',
      url: SEO_LOGO_URL,
      width: 512,
      height: 512,
    },
  });
  upsertJsonLd('seo-software-application-jsonld', {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${SEO_SITE_URL}/#software-application`,
    name: SEO_SITE_NAME,
    applicationCategory: 'SportsApplication',
    operatingSystem: 'Web, Android, iOS',
    url,
    description: metadata.description,
    inLanguage: 'pt-BR',
    publisher: { '@id': `${SEO_SITE_URL}/#organization` },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BRL',
    },
  });

  return metadata;
}
