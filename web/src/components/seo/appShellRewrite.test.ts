import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// #4327: o rewrite ** do Firebase Hosting responde 200 para qualquer caminho. O shell que ele serve não pode
// se declarar indexável nem apontar o canonical para a home (soft 404 / duplicata da raiz).
const repoRoot = resolve(process.cwd(), '..');
const firebase = JSON.parse(readFileSync(resolve(repoRoot, 'firebase.json'), 'utf8')) as {
  hosting: { rewrites: Array<{ source: string; destination: string }> };
};
const rewrites = firebase.hosting.rewrites;
const prerenderScript = readFileSync(resolve(process.cwd(), 'scripts/prerender-public-pages.mjs'), 'utf8');

describe('shell SPA das rotas desconhecidas (#4327)', () => {
  it('o catch-all ** aponta para o app-shell noindex, nunca para o index.html da raiz', () => {
    const catchAll = rewrites.find((r) => r.source === '**');
    expect(catchAll?.destination).toBe('/app-shell.html');
    expect(rewrites.filter((r) => r.destination === '/index.html').map((r) => r.source)).not.toContain('**');
    expect(rewrites[rewrites.length - 1].source).toBe('**');
  });

  it('/launch continua servindo o index.html indexável, antes do catch-all', () => {
    const launchIdx = rewrites.findIndex((r) => r.source === '/launch');
    const catchAllIdx = rewrites.findIndex((r) => r.source === '**');
    expect(launchIdx).toBeGreaterThanOrEqual(0);
    expect(launchIdx).toBeLessThan(catchAllIdx);
    expect(rewrites[launchIdx].destination).toBe('/index.html');
  });

  it('o prerender gera dist/app-shell.html com robots noindex e sem canonical', () => {
    expect(prerenderScript).toContain("resolve(distDir, 'app-shell.html')");
    expect(prerenderScript).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(prerenderScript).toMatch(/replaceOnce\(appShell, CANONICAL_RE, ''/);
  });
});
