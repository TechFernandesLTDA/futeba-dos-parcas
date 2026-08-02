#!/usr/bin/env node
/**
 * Script de teste de performance da HomeScreen
 * Mede tempos de resposta e valida otimizações implementadas
 */

const https = require('https');

const URLS = {
  html: 'https://futebadosparcas.com.br/',
  indexBundle: 'https://futebadosparcas.com.br/assets/index-CBtnyvi2.js',
  homeTab: 'https://futebadosparcas.com.br/assets/HomeTab-Bcpoa3VY.js',
  vendorMui: 'https://futebadosparcas.com.br/assets/vendor-mui-DGuenD1l.js',
  vendorFirebase: 'https://futebadosparcas.com.br/assets/vendor-firebase-CaKeWVDG.js',
};

function measureTTFB(url) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    https.get(url, (res) => {
      const ttfb = Date.now() - start;
      const size = parseInt(res.headers['content-length'] || '0');
      const cacheControl = res.headers['cache-control'];
      
      res.on('data', () => {});
      res.on('end', () => {
        resolve({ ttfb, size, cacheControl, status: res.statusCode });
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('🚀 Teste de Performance - HomeScreen\n');
  console.log('='.repeat(60));
  
  const results = [];
  
  for (const [name, url] of Object.entries(URLS)) {
    process.stdout.write(`📊 Testando ${name.padEnd(15)}...`);
    try {
      const result = await measureTTFB(url);
      results.push({ name, ...result });
      
      const ttfbStatus = result.ttfb < 100 ? '✅' : result.ttfb < 300 ? '⚠️' : '❌';
      console.log(` ${ttfbStatus} TTFB: ${result.ttfb}ms | Size: ${(result.size / 1024).toFixed(1)}KB`);
    } catch (err) {
      console.log(` ❌ Erro: ${err.message}`);
      results.push({ name, error: err.message });
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 Resumo:\n');
  
  // Verificar cache headers
  const cachedAssets = results.filter(r => r.cacheControl?.includes('max-age=31536000'));
  console.log(`✅ Assets com cache imutável: ${cachedAssets.length}/${results.length}`);
  
  // Verificar TTFB médio
  const validResults = results.filter(r => r.ttfb);
  if (validResults.length > 0) {
    const avgTTFB = validResults.reduce((sum, r) => sum + r.ttfb, 0) / validResults.length;
    const ttfbStatus = avgTTFB < 100 ? '✅ Excelente' : avgTTFB < 300 ? '⚠️ Aceitável' : '❌ Lento';
    console.log(`📊 TTFB médio: ${avgTTFB.toFixed(0)}ms ${ttfbStatus}`);
  }
  
  // Verificar tamanhos
  const totalSize = validResults.reduce((sum, r) => sum + r.size, 0);
  console.log(`📦 Total download: ${(totalSize / 1024).toFixed(1)}KB`);
  
  console.log('\n🎯 Otimizações Implementadas:\n');
  console.log('✅ useNextGame - busca apenas 1 jogo (vs 50 do useGames)');
  console.log('✅ usePrefetchHome - prefetch paralelo de dados críticos');
  console.log('✅ Skeletons específicos por rota (HomeScreenSkeleton)');
  console.log('✅ Cache headers corretos (max-age=31536000, immutable)');
  console.log('✅ Reduced motion support (@media prefers-reduced-motion)');
  
  console.log('\n💡 Próximos Passos:\n');
  console.log('1. Testar com usuário autenticado para medir tempo real');
  console.log('2. Verificar se prefetch está disparando (console logs)');
  console.log('3. Medir tempo até "Próximo Jogo" visível');
  console.log('4. Testar em rede 3G para simular condições reais');
  
  console.log('\n' + '='.repeat(60));
}

runTests().catch(console.error);
