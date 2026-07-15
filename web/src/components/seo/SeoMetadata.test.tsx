import { beforeEach, describe, expect, it } from 'vitest';
import { applySeoMetadata, getSeoMetadata, SEO_SITE_URL } from './metadata';

describe('getSeoMetadata', () => {
  it('returns indexable, canonical metadata for the launch page', () => {
    expect(getSeoMetadata('/launch?utm_source=whatsapp')).toMatchObject({
      canonicalPath: '/launch',
      index: true,
    });
  });

  it('keeps app and authentication routes out of search results by default', () => {
    expect(getSeoMetadata('/login').index).toBe(false);
    expect(getSeoMetadata('/group/private-id').index).toBe(false);
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

  it('updates canonical, social metadata and structured data for a public route', () => {
    applySeoMetadata('/launch');

    expect(document.title).toContain('Organize peladas');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${SEO_SITE_URL}/launch`,
    );
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain(
      'index',
    );
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      `${SEO_SITE_URL}/launch`,
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
      url: `${SEO_SITE_URL}/launch`,
    });
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
