import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PUBLIC_ROUTE_METADATA,
  SEO_PARENT_COMPANY_URL,
  SEO_PRODUCT_ATTRIBUTION,
  SEO_SITE_URL,
  applySeoMetadata,
} from './metadata';
// @ts-expect-error módulo .mjs de script de build, sem tipos
import { routes, SITE_URL } from '../../../scripts/prerender-routes.mjs';

interface PrerenderRoute {
  path: string;
  title: string;
  description: string;
  ogImage: string;
}

// Garante que o HTML prerenderizado (scripts/prerender-routes.mjs) não diverge dos
// metadados aplicados em runtime (metadata.ts) — #4177.
describe('prerender x metadata.ts', () => {
  it('usa o mesmo domínio canônico', () => {
    expect(SITE_URL).toBe(SEO_SITE_URL);
  });

  it.each((routes as PrerenderRoute[]).map((r) => [r.path, r] as const))(
    '%s coincide com PUBLIC_ROUTE_METADATA',
    (path, route) => {
      const meta = PUBLIC_ROUTE_METADATA[path];
      expect(meta).toBeDefined();
      expect(route.title).toBe(meta.title);
      expect(route.description).toBe(meta.description);
      expect(route.ogImage).toBe(meta.ogImage);
      expect(meta.canonicalPath).toBe(path);
    },
  );

  it('cobre todas as rotas públicas indexáveis exceto a raiz e /launch', () => {
    const expected = Object.entries(PUBLIC_ROUTE_METADATA)
      .filter(([path, meta]) => meta.index && path !== '/' && path !== '/launch')
      .map(([path]) => path)
      .sort();
    expect((routes as PrerenderRoute[]).map((r) => r.path).sort()).toEqual(expected);
  });
});

// Branding Tech Fernandes: web/index.html (estático) e metadata.ts (runtime) em sincronia.
describe('branding Tech Fernandes: index.html x metadata.ts', () => {
  const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

  function staticJsonLd(id: string): Record<string, unknown> {
    const match = indexHtml.match(
      new RegExp(`<script[^>]*id="${id}"[^>]*>([\\s\\S]*?)</script>`),
    );
    expect(match, `JSON-LD ${id} ausente em index.html`).not.toBeNull();
    return JSON.parse(match![1]);
  }

  function runtimeJsonLd(id: string): Record<string, unknown> {
    applySeoMetadata('/');
    const el = document.head.querySelector(`script#${id}`);
    expect(el).not.toBeNull();
    return JSON.parse(el!.textContent ?? '{}');
  }

  it('JSON-LD Organization (parentOrganization) idêntico', () => {
    const stat = staticJsonLd('seo-organization-jsonld');
    expect(stat.parentOrganization).toEqual({
      '@type': 'Organization',
      name: 'Tech Fernandes LTDA',
      url: SEO_PARENT_COMPANY_URL,
    });
    expect(runtimeJsonLd('seo-organization-jsonld')).toEqual(stat);
  });

  it('JSON-LD SoftwareApplication idêntico', () => {
    expect(runtimeJsonLd('seo-software-application-jsonld')).toEqual(
      staticJsonLd('seo-software-application-jsonld'),
    );
  });

  it('OG/Twitter description estáticas carregam a atribuição', () => {
    expect(indexHtml).toContain(`${SEO_PRODUCT_ATTRIBUTION}" />`);
    expect(indexHtml.match(new RegExp(SEO_PRODUCT_ATTRIBUTION.replace('.', '\\.'), 'g'))?.length).toBeGreaterThanOrEqual(2);
  });
});
