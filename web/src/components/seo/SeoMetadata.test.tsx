import { beforeEach, describe, expect, it } from 'vitest';
import {
  applySeoMetadata,
  getSeoMetadata,
  PUBLIC_ROUTE_METADATA,
  SEO_SITE_URL,
} from './metadata';

describe('getSeoMetadata', () => {
  it('canonicalizes the legacy launch URL to the public root', () => {
    expect(getSeoMetadata('/launch?utm_source=whatsapp')).toMatchObject({
      canonicalPath: '/',
      index: true,
    });
  });

  it('provides valid metadata for all registered public growth routes', () => {
    const publicPaths = Object.keys(PUBLIC_ROUTE_METADATA).filter((p) => p !== '/launch');
    expect(publicPaths).toContain('/');
    expect(publicPaths).toContain('/organizar-pelada');
    expect(publicPaths).toContain('/ranking-futebol-amador');
    expect(publicPaths).toContain('/gestao-de-pelada');
    expect(publicPaths).toContain('/como-funciona');
    expect(publicPaths).toContain('/parcerias');

    for (const path of publicPaths) {
      const meta = getSeoMetadata(path);
      expect(meta.index).toBe(true);
      expect(meta.title).toBeTruthy();
      expect(meta.description).toBeTruthy();
      expect(meta.canonicalPath).toBe(path);
      expect(meta.ogImage).toBeTruthy();
    }
  });

  it('keeps app and authentication routes out of search results by default', () => {
    expect(getSeoMetadata('/login').index).toBe(false);
    expect(getSeoMetadata('/group/private-id').index).toBe(false);
    expect(getSeoMetadata('/admin/users').index).toBe(false);
    expect(getSeoMetadata('/settings').index).toBe(false);
  });
});

describe('applySeoMetadata', () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <title>Antigo</title>
      <meta name="description" content="antiga">
      <meta name="description" content="duplicada">
      <link rel="canonical" href="https://example.com/">
      <link rel="canonical" href="https://duplicate.example.com/">
      <script id="seo-organization-jsonld" type="application/ld+json">{}</script>
      <script id="seo-organization-jsonld" type="application/ld+json">{}</script>
    `;
  });

  it('updates canonical, social metadata and structured data for the public home', () => {
    applySeoMetadata('/');

    expect(document.title).toContain('Organize sua pelada');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${SEO_SITE_URL}/`,
    );
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain(
      'index',
    );
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      `${SEO_SITE_URL}/`,
    );
    expect(document.querySelector('meta[property="og:image:width"]')?.getAttribute('content')).toBe(
      '1200',
    );
    expect(document.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe(
      'summary_large_image',
    );

    const application = JSON.parse(
      document.querySelector('#seo-software-application-jsonld')?.textContent ?? '{}',
    ) as { '@type'?: string; url?: string };
    expect(application).toMatchObject({
      '@type': 'SoftwareApplication',
      url: `${SEO_SITE_URL}/`,
    });
  });

  it('applies distinct canonical, OG image and breadcrumb schema for /organizar-pelada', () => {
    applySeoMetadata('/organizar-pelada');

    expect(document.title).toContain('Como Organizar Pelada');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${SEO_SITE_URL}/organizar-pelada`,
    );
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toContain(
      'og-organizar-pelada.png',
    );
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      `${SEO_SITE_URL}/organizar-pelada`,
    );

    const breadcrumbs = JSON.parse(
      document.querySelector('#seo-breadcrumb-jsonld')?.textContent ?? '{}',
    ) as { '@type'?: string; itemListElement?: Array<{ name: string; item: string }> };

    expect(breadcrumbs['@type']).toBe('BreadcrumbList');
    expect(breadcrumbs.itemListElement).toHaveLength(2);
    expect(breadcrumbs.itemListElement?.[0]?.item).toBe(`${SEO_SITE_URL}/`);
    expect(breadcrumbs.itemListElement?.[1]?.item).toBe(`${SEO_SITE_URL}/organizar-pelada`);
  });

  it('applies distinct metadata and OG image for /parcerias', () => {
    applySeoMetadata('/parcerias');

    expect(document.title).toContain('Parcerias');
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toContain(
      'og-parcerias.png',
    );
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      `${SEO_SITE_URL}/parcerias`,
    );
  });

  it('marks private routes noindex and removes duplicate managed elements', () => {
    applySeoMetadata('/group/private-id');

    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
    expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.querySelectorAll('#seo-organization-jsonld')).toHaveLength(1);
    expect(document.querySelectorAll('#seo-software-application-jsonld')).toHaveLength(1);
  });
});
