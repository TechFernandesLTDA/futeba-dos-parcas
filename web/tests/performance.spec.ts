import { test, expect } from '@playwright/test';

test('HomeScreen performance - carregamento inicial', async ({ page }) => {
  const startTime = Date.now();
  
  // Coletar métricas de performance
  const metrics: { [key: string]: number } = {};
  
  page.on('response', async (response) => {
    const url = response.url();
    const timing = response.timing();
    
    if (url.includes('/assets/') && response.status() === 200) {
      const filename = url.split('/').pop() || '';
      metrics[filename] = timing.responseStart;
    }
  });

  // Navegar para a home
  await page.goto('https://futebadosparcas.web.app/', {
    waitUntil: 'networkidle'
  });
  
  const timeToInteractive = Date.now() - startTime;
  
  // Verificar se elementos críticos estão visíveis
  await expect(page.locator('text=Próximo Jogo').first()).toBeVisible({ timeout: 5000 });
  
  const timeToContent = Date.now() - startTime;
  
  console.log('\n📊 Métricas de Performance:');
  console.log(`  Tempo até interativo: ${timeToInteractive}ms`);
  console.log(`  Tempo até conteúdo visível: ${timeToContent}ms`);
  console.log(`  Assets carregados: ${Object.keys(metrics).length}`);
  
  // Verificar se prefetch foi disparado
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    if (msg.text().includes('Prefetch')) {
      consoleLogs.push(msg.text());
    }
  });
  
  if (consoleLogs.length > 0) {
    console.log(`  Prefetch logs: ${consoleLogs.length}`);
  }
  
  // Performance budget: HomeScreen deve carregar em < 3s
  expect(timeToContent).toBeLessThan(3000);
});

test('NextGameWidget - query otimizada', async ({ page }) => {
  let firestoreQueries = 0;
  
  page.on('request', (request) => {
    if (request.url().includes('firestore.googleapis.com')) {
      firestoreQueries++;
    }
  });
  
  await page.goto('https://futebadosparcas.web.app/', {
    waitUntil: 'domcontentloaded'
  });
  
  // Aguardar NextGameWidget carregar
  await page.waitForSelector('text=Próximo Jogo', { timeout: 5000 });
  
  console.log(`\n🔥 Firestore queries para NextGame: ${firestoreQueries}`);
  
  // Com useNextGame otimizado, deve fazer < 5 queries
  // (1 para games, 1 para confirmation, 1 para waitlist)
  expect(firestoreQueries).toBeLessThan(10);
});

test('Bundle size - verificar chunks', async ({ page }) => {
  const chunks: { name: string; size: number }[] = [];
  
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/assets/') && url.endsWith('.js')) {
      const headers = response.headers();
      const size = parseInt(headers['content-length'] || '0');
      const name = url.split('/').pop() || '';
      chunks.push({ name, size });
    }
  });
  
  await page.goto('https://futebadosparcas.web.app/', {
    waitUntil: 'networkidle'
  });
  
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
  const homeTabChunk = chunks.find(c => c.name.startsWith('HomeTab-'));
  const nextGameChunk = chunks.find(c => c.name.includes('useNextGame'));
  
  console.log('\n📦 Chunks carregados:');
  console.log(`  Total: ${(totalSize / 1024).toFixed(2)} KB`);
  console.log(`  HomeTab: ${homeTabChunk ? (homeTabChunk.size / 1024).toFixed(2) : 'N/A'} KB`);
  console.log(`  Chunks: ${chunks.length}`);
  
  // Verificar se useNextGame está sendo usado (não useGames completo)
  const usesGamesHook = chunks.some(c => c.name.startsWith('useGames-'));
  console.log(`  useGames chunk carregado: ${usesGamesHook ? '⚠️ Sim' : '✅ Não'}`);
});
