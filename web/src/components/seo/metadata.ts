export const SEO_SITE_URL = 'https://futebadosparcas.com.br';
export const SEO_SITE_NAME = 'Futeba dos Parças';
export const SEO_IMAGE_URL = `${SEO_SITE_URL}/og-futeba-dos-parcas.jpg`;
const SEO_LOGO_URL = `${SEO_SITE_URL}/logo.png`;
// O Futeba dos Parças é um produto da Tech Fernandes LTDA (techfernandes.com.br).
// A atribuição aparece no rodapé da landing e nos metadados OG/Twitter/JSON-LD.
export const SEO_PARENT_COMPANY_NAME = 'Tech Fernandes';
export const SEO_PARENT_COMPANY_URL = 'https://techfernandes.com.br';
export const SEO_PRODUCT_ATTRIBUTION = 'Um produto da Tech Fernandes.';

const DEFAULT_DESCRIPTION =
  'Organize peladas, monte times equilibrados, acompanhe estatísticas e gerencie seu futebol amador com o Futeba dos Parças.';

const LAUNCH_DESCRIPTION =
  'Chega de bagunça no grupo: organize confirmações, monte times equilibrados, acompanhe estatísticas e gerencie sua pelada.';

export interface SeoRouteMetadata {
  title: string;
  description: string;
  canonicalPath: string;
  index: boolean;
  type?: 'website' | 'article';
  ogImage?: string;
  category?: string;
}

export const PUBLIC_ROUTE_METADATA: Readonly<Record<string, SeoRouteMetadata>> = {
  '/': {
    title: `${SEO_SITE_NAME} | Organize sua pelada`,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: '/',
    index: true,
    ogImage: SEO_IMAGE_URL,
    type: 'website',
  },
  '/launch': {
    title: `${SEO_SITE_NAME} | Organize peladas, times e campeonatos`,
    description: LAUNCH_DESCRIPTION,
    canonicalPath: '/',
    index: true,
    ogImage: SEO_IMAGE_URL,
    type: 'website',
  },
  '/organizar-pelada': {
    title: `Como Organizar Pelada de Futebol: Guia Passo a Passo | ${SEO_SITE_NAME}`,
    description:
      'Checklist completo para organizar peladas sem confusão: confirmação de presença, sorteio de times equilibrados, vagas e lista de espera.',
    canonicalPath: '/organizar-pelada',
    index: true,
    ogImage: `${SEO_SITE_URL}/og/og-organizar-pelada.png`,
    type: 'article',
    category: 'Organização',
  },
  '/ranking-futebol-amador': {
    title: `Ranking de Futebol Amador: Estatísticas, Artilharia e MVP | ${SEO_SITE_NAME}`,
    description:
      'Como criar e gerenciar o ranking da sua pelada: XP por presença, gols, assistências e defesas, e votação de MVP, melhor goleiro e bola murcha.',
    canonicalPath: '/ranking-futebol-amador',
    index: true,
    ogImage: `${SEO_SITE_URL}/og/og-ranking-futebol-amador.png`,
    type: 'article',
    category: 'Estatísticas',
  },
  '/gestao-de-pelada': {
    title: `Gestão de Pelada: Mensalistas, Caixa Financeiro e Despesas | ${SEO_SITE_NAME}`,
    description:
      'Guia para organizar mensalistas, diaristas, rateio da quadra e o caixa do racha, com o painel de finanças do Futeba dos Parças.',
    canonicalPath: '/gestao-de-pelada',
    index: true,
    ogImage: `${SEO_SITE_URL}/og/og-gestao-de-pelada.png`,
    type: 'article',
    category: 'Gestão Financeira',
  },
  '/como-funciona': {
    title: `Como Funciona o Futeba dos Parças | Para Organizadores, Jogadores e Quadras`,
    description:
      'Conheça todos os fluxos do Futeba dos Parças: sorteio de times equilibrados, confirmação de presença, check-in, XP e ranking e locais de quadras.',
    canonicalPath: '/como-funciona',
    index: true,
    ogImage: `${SEO_SITE_URL}/og/og-como-funciona.png`,
    type: 'website',
    category: 'Produto',
  },
  '/parcerias': {
    title: `Parcerias para Quadras e Arenas Society | ${SEO_SITE_NAME}`,
    description:
      'Divulgue sua arena para quem organiza peladas no Futeba dos Parças, um produto da Tech Fernandes. Entre em contato para cadastrar sua quadra.',
    canonicalPath: '/parcerias',
    index: true,
    ogImage: `${SEO_SITE_URL}/og/og-parcerias.png`,
    type: 'website',
    category: 'Parcerias',
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
    ogImage: SEO_IMAGE_URL,
    type: 'website',
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
  const ogImageUrl = metadata.ogImage ?? SEO_IMAGE_URL;
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
    content: `${metadata.description} ${SEO_PRODUCT_ATTRIBUTION}`,
  });
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: metadata.type ?? 'website' });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url });
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: ogImageUrl });
  upsertMeta('meta[property="og:image:type"]', { property: 'og:image:type', content: 'image/jpeg' });
  upsertMeta('meta[property="og:image:width"]', { property: 'og:image:width', content: '1200' });
  upsertMeta('meta[property="og:image:height"]', { property: 'og:image:height', content: '630' });
  upsertMeta('meta[property="og:image:alt"]', {
    property: 'og:image:alt',
    content: `${metadata.title} — ${SEO_SITE_NAME}`,
  });
  upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SEO_SITE_NAME });
  upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'pt_BR' });
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: metadata.title });
  upsertMeta('meta[name="twitter:description"]', {
    name: 'twitter:description',
    content: `${metadata.description} ${SEO_PRODUCT_ATTRIBUTION}`,
  });
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: ogImageUrl });
  upsertMeta('meta[name="twitter:image:alt"]', {
    name: 'twitter:image:alt',
    content: `${metadata.title} — ${SEO_SITE_NAME}`,
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
    parentOrganization: {
      '@type': 'Organization',
      name: 'Tech Fernandes LTDA',
      url: SEO_PARENT_COMPANY_URL,
    },
  });

  upsertJsonLd('seo-software-application-jsonld', {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${SEO_SITE_URL}/#software-application`,
    name: SEO_SITE_NAME,
    applicationCategory: 'SportsApplication',
    operatingSystem: 'Web, Android',
    url: `${SEO_SITE_URL}/`,
    description: DEFAULT_DESCRIPTION,
    inLanguage: 'pt-BR',
    publisher: { '@id': `${SEO_SITE_URL}/#organization` },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BRL',
    },
  });

  if (metadata.canonicalPath !== '/' && metadata.index) {
    upsertJsonLd('seo-breadcrumb-jsonld', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Início',
          item: `${SEO_SITE_URL}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: metadata.title.split('|')[0].trim(),
          item: url,
        },
      ],
    });
  }

  return metadata;
}
