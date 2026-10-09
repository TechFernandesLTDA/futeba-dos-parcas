// Lighthouse CI configuration for Futeba dos Parças
// Audits all public growth and editorial routes (#4187, #4196).
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'node scripts/serve-dist.mjs dist 4173 ../firebase.json',
      url: [
        'http://localhost:4173/',
        'http://localhost:4173/organizar-pelada',
        'http://localhost:4173/ranking-futebol-amador',
        'http://localhost:4173/gestao-de-pelada',
        'http://localhost:4173/como-funciona',
        'http://localhost:4173/parcerias',
      ],
      numberOfRuns: 3,
      settings: {
        chromeFlags: ['--no-sandbox'],
      },
    },
    assert: {
      assertions: {
        // Meta #4196: >= 0.9 no preset mobile. Método de referência (servidor que replica o firebase.json, máquina
        // dedicada, reports/lighthouse-perf): mobile 91-97, desktop 100. No runner Linux compartilhado (WSL, 4 jobs em
        // paralelo) o TBT infla e a mediana fica em 0,88-0,97; por isso o gate bloqueante é 0.85 (a versão sem o
        // prerender/boot adiado ficava em 0,67-0,69) e 0.9 segue como meta. a11y e SEO são bloqueantes.
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'interaction-to-next-paint': 'off',
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
};
