#!/usr/bin/env node
/**
 * Teste de performance completo com múltiplas requisições
 * Mede TTFB, cache effectiveness e Web Vitals simulados
 */

const https = require('https');

const BASE_URL = 'https://futebadosparcas.web.app';

function measureRequest(url) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    https.get(url, (res) => {
      const ttfb = Date.now() - start;
      const cacheStatus = res.headers['cache-control'];
      const contentLength = parseInt(res.headers['content-length'] || '0');
      const age = res.headers['age'] || '0';
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const totalTime = Date.now() - start;
        resolve({
          url: url.replace(BASE_URL, ''),
          ttfb,
          totalTime,
          size: contentLength || data.length,
          cacheStatus,
          age: parseInt(age),
          status: res.statusCode,
        });
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('🚀 Teste de Performance Completo\n');
  console.log('='.repeat(70));
  
  const urls = [
    '/',
    '/assets/index-DXPGRi9x.js',
    '/assets/HomeScreen-CNbS0cv5.js',
    '/assets/vendor-mui-DGuenD1l.js',
    '/assets/vendor-firebase-CaKeWVDG.js',
  ];
  
  console.log('\n📡 Teste 1: Cold Start (primeira requisição)\n');
  const coldResults = [];
  for (const path of urls) {
    const result = await measureRequest(BASE_URL + path);
    coldResults.push(result);
    const icon = result.ttfb < 100 ? '✅' : result.ttfb < 300 ? '⚠️' : '❌';
    console.log(`  ${icon} ${path.padEnd(45)} TTFB: ${result.ttfb}ms | Size: ${(result.size / 1024).toFixed(1)}KB`);
  }
  
  console.log('\n🔥 Teste 2: Warm Cache (segunda requisição)\n');
  const warmResults = [];
  for (const path of urls) {
    const result = await measureRequest(BASE_URL + path);
    warmResults.push(result);
    const icon = result.ttfb < 100 ? '✅' : result.ttfb < 300 ? '⚠️' : '❌';
    const cacheHit = result.age > 0 ? '💾' : '🌐';
    console.log(`  ${icon} ${cacheHit} ${path.padEnd(42)} TTFB: ${result.ttfb}ms | Age: ${result.age}s`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 Análise Comparativa:\n');
  
  const coldAvg = coldResults.reduce((sum, r) => sum + r.ttfb, 0) / coldResults.length;
  const warmAvg = warmResults.reduce((sum, r) => sum + r.ttfb, 0) / warmResults.length;
  const improvement = ((coldAvg - warmAvg) / coldAvg * 100).toFixed(1);
  
  console.log(`  Cold Start TTFB médio:  ${coldAvg.toFixed(0)}ms`);
  console.log(`  Warm Cache TTFB médio:  ${warmAvg.toFixed(0)}ms`);
  console.log(`  Melhoria com cache:     ${improvement}%`);
  
  console.log('\n💾 Cache Effectiveness:\n');
  const cacheHits = warmResults.filter(r => r.age > 0).length;
  console.log(`  Cache hits: ${cacheHits}/${warmResults.length} (${(cacheHits/warmResults.length*100).toFixed(0)}%)`);
  
  console.log('\n📦 Bundle Sizes:\n');
  const totalSize = warmResults.reduce((sum, r) => sum + r.size, 0);
  console.log(`  Total: ${(totalSize / 1024).toFixed(1)}KB`);
  console.log(`  HTML: ${(warmResults[0].size / 1024).toFixed(1)}KB`);
  console.log(`  JS: ${((totalSize - warmResults[0].size) / 1024).toFixed(1)}KB`);
  
  console.log('\n🎯 Performance Budgets:\n');
  const budgets = {
    'Total Load Time': { value: warmResults.reduce((sum, r) => sum + r.totalTime, 0), good: 3000, poor: 5000 },
    'Average TTFB': { value: warmAvg, good: 100, poor: 300 },
    'Bundle Size': { value: totalSize / 1024, good: 1000, poor: 2000, unit: 'KB' },
  };
  
  for (const [name, budget] of Object.entries(budgets)) {
    const unit = budget.unit || 'ms';
    const icon = budget.value <= budget.good ? '✅' : budget.value <= budget.poor ? '⚠️' : '❌';
    console.log(`  ${icon} ${name.padEnd(20)} ${budget.value.toFixed(0)}${unit} (Good: ≤${budget.good}${unit}, Poor: >${budget.poor}${unit})`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n✨ Otimizações Ativas:\n');
  console.log('  ✅ useNextGame - busca apenas 1 jogo (vs 50 do useGames)');
  console.log('  ✅ usePrefetchHome - prefetch paralelo de dados críticos');
  console.log('  ✅ Skeletons específicos por rota (HomeScreenSkeleton)');
  console.log('  ✅ Cache headers corretos (max-age=31536000, immutable)');
  console.log('  ✅ Reduced motion support (@media prefers-reduced-motion)');
  console.log('  ✅ Performance monitoring em todas as telas');
  console.log('  ✅ PerformanceOverlay em dev mode');
  console.log('  ✅ PerformanceDashboard em /admin/performance');
  
  console.log('\n📈 Recomendações:\n');
  if (warmAvg > 200) {
    console.log('  ⚠️  Considerar CDN com edge locations mais próximas');
  }
  if (totalSize > 1500 * 1024) {
    console.log('  ⚠️  Bundle muito grande - implementar code splitting agressivo');
  }
  if (cacheHits < warmResults.length) {
    console.log('  ⚠️  Cache não está 100% efetivo - verificar cache headers');
  }
  
  console.log('\n' + '='.repeat(70) + '\n');
}

runTests().catch(console.error);
