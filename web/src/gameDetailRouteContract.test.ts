import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// #4408: /game/:gameId é público para visitante e inalterado para o logado.
const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

describe('contrato da rota /game/:gameId (#4408)', () => {
  it('é declarada uma vez, via GameDetailRoute, com GameDetailScreen como index', () => {
    expect(app.match(/path="\/game\/:gameId"/g)).toHaveLength(1);
    expect(app).toContain('<Route path="/game/:gameId" element={<GameDetailRoute />}>');
    const block = app.slice(app.indexOf('<Route path="/game/:gameId" element={<GameDetailRoute />}>'));
    expect(block.slice(0, block.indexOf('</Route>'))).toContain('<GameDetailScreen />');
  });

  it('GameDetailRoute: visitante vê PublicGameScreen, logado mantém ProtectedRoute + AppLayout', () => {
    const fn = app.slice(app.indexOf('function GameDetailRoute()'), app.indexOf('function NotFoundRoute()'));
    expect(fn).toContain('useLoginRedirectReady(activeUser, loading)');
    expect(fn).toMatch(/if \(!activeUser\) \{[\s\S]*<PublicGameScreen \/>/);
    expect(fn).toMatch(/<ProtectedRoute>\s*<Suspense fallback=\{<RouteFallback \/>\}><AppLayout \/><\/Suspense>\s*<\/ProtectedRoute>/);
  });

  it('/game/create continua dentro do layout protegido com VerifiedRoute', () => {
    expect(app).toContain('<Route path="/game/create" element={<VerifiedRoute>');
  });
});
