// Budgets calibrados pra CI (self-hosted Mac ARM64 sob carga compartilhada pode
// ser 2-3x mais lento que device real). Refinar com baseline P75 real via
// Web Vitals (#1088) coletado em prod nos próximos 7 dias.
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview -- --port 4173',
      url: ['http://localhost:4173/'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        // Categoria: warning até baseline real coletada
        'categories:performance': ['warn', { minScore: 0.7 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        // LCP: 6000ms tolera runner lento; refinar pós-baseline
        'largest-contentful-paint': ['warn', { maxNumericValue: 6000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        // INP via Lighthouse synthetic = 0 (sem interação)
        'interaction-to-next-paint': 'off',
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
};
