#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

console.log('=== Diagnóstico Completo da Aplicação Web ===\n');

async function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function diagnose() {
  // 1. Verificar HTML principal
  console.log('1. HTML Principal:');
  const html = await fetch('https://futebadosparcas.com.br');
  console.log(`   Status: ${html.status}`);
  console.log(`   Tamanho: ${html.body.length} bytes`);
  
  // Extrair assets
  const assetMatches = html.body.match(/assets\/[a-zA-Z0-9\-_]+\.js/g);
  console.log(`   Assets JS: ${assetMatches ? assetMatches.length : 0}`);
  
  // 2. Verificar bundle principal
  console.log('\n2. Bundle Principal (index.js):');
  const bundle = await fetch('https://futebadosparcas.com.br/assets/index-C2CAM24o.js');
  console.log(`   Status: ${bundle.status}`);
  console.log(`   Tamanho: ${(bundle.body.length / 1024).toFixed(2)} KB`);
  console.log(`   Cache: ${bundle.headers['cache-control']}`);
  
  // 3. Verificar se há erros de sintaxe básicos
  console.log('\n3. Verificação de Sintaxe:');
  const syntaxChecks = [
    { name: 'ES6 Imports', pattern: /import\s+/g },
    { name: 'ES6 Exports', pattern: /export\s+/g },
    { name: 'React', pattern: /React/g },
    { name: 'Firebase', pattern: /firebase/g },
    { name: 'Router', pattern: /Router|Route/g },
  ];
  
  syntaxChecks.forEach(check => {
    const matches = bundle.body.match(check.pattern);
    console.log(`   ${check.name}: ${matches ? matches.length + ' ocorrências' : 'Não encontrado'}`);
  });
  
  // 4. Verificar vendor chunks
  console.log('\n4. Vendor Chunks:');
  const vendors = [
    'vendor-react-DfxeJt65.js',
    'vendor-mui-BCY0P4ON.js',
    'vendor-firebase-DeSdga9K.js',
    'vendor-query-C-iyUiwl.js',
    'vendor-mui-icons-Y0DPQbeV.js'
  ];
  
  for (const vendor of vendors) {
    try {
      const v = await fetch(`https://futebadosparcas.com.br/assets/${vendor}`);
      console.log(`   ✓ ${vendor}: ${v.status} (${(v.body.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      console.log(`   ✗ ${vendor}: ${err.message}`);
    }
  }
  
  // 5. Verificar se há erros comuns
  console.log('\n5. Verificação de Erros Comuns:');
  const errorPatterns = [
    { name: 'Undefined', pattern: /undefined/gi },
    { name: 'null', pattern: /\bnull\b/g },
    { name: 'Error', pattern: /\bError\b/g },
    { name: 'Exception', pattern: /Exception/gi },
  ];
  
  errorPatterns.forEach(check => {
    const matches = bundle.body.match(check.pattern);
    if (matches && matches.length > 0) {
      console.log(`   ⚠️  ${check.name}: ${matches.length} ocorrências`);
    }
  });
  
  // 6. Verificar se há imports quebrados
  console.log('\n6. Verificação de Imports:');
  const importPattern = /from\s+["']([^"']+)["']/g;
  const imports = new Set();
  let match;
  
  while ((match = importPattern.exec(bundle.body)) !== null) {
    imports.add(match[1]);
  }
  
  console.log(`   Total de imports únicos: ${imports.size}`);
  
  const brokenImports = Array.from(imports).filter(imp => {
    return !imp.startsWith('./') && !imp.startsWith('/') && !imp.startsWith('https://') && !imp.startsWith('@') && !imp.includes('.');
  });
  
  if (brokenImports.length > 0) {
    console.log(`   ⚠️  Imports possivelmente quebrados: ${brokenImports.length}`);
    brokenImports.slice(0, 5).forEach(imp => console.log(`      - ${imp}`));
  } else {
    console.log('   ✓ Nenhum import quebrado detectado');
  }
  
  // 7. Verificar service worker
  console.log('\n7. Service Worker:');
  try {
    const sw = await fetch('https://futebadosparcas.com.br/service-worker.js');
    console.log(`   Status: ${sw.status}`);
    console.log(`   Tamanho: ${sw.body.length} bytes`);
  } catch (err) {
    console.log(`   ✗ Erro: ${err.message}`);
  }
  
  // 8. Verificar manifest
  console.log('\n8. PWA Manifest:');
  try {
    const manifest = await fetch('https://futebadosparcas.com.br/manifest.json');
    console.log(`   Status: ${manifest.status}`);
    const manifestData = JSON.parse(manifest.body);
    console.log(`   Nome: ${manifestData.name}`);
    console.log(`   Ícones: ${manifestData.icons ? manifestData.icons.length : 0}`);
  } catch (err) {
    console.log(`   ✗ Erro: ${err.message}`);
  }
  
  // 9. Salvar bundle para análise manual
  console.log('\n9. Salvando bundle para análise:');
  const outputPath = path.join(__dirname, '../dist-diagnose/index.js');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, bundle.body);
  console.log(`   ✓ Salvo em: ${outputPath}`);
  
  // 10. Verificar se há problemas com ProfileGate
  console.log('\n10. Verificação de ProfileGate:');
  const profileGateChecks = [
    { name: 'ProfileGate', pattern: /ProfileGate/g },
    { name: 'useProfileComplete', pattern: /useProfileComplete/g },
    { name: 'profileComplete', pattern: /profileComplete/g },
  ];
  
  profileGateChecks.forEach(check => {
    const matches = bundle.body.match(check.pattern);
    console.log(`   ${check.name}: ${matches ? matches.length + ' ocorrências' : 'Não encontrado'}`);
  });
  
  console.log('\n=== Diagnóstico Concluído ===');
  console.log('\nPróximos passos:');
  console.log('1. Abra o DevTools do navegador (F12)');
  console.log('2. Vá para a aba Console');
  console.log('3. Verifique se há erros JavaScript');
  console.log('4. Verifique a aba Network para requisições falhando');
  console.log('5. Se houver erros, copie e me envie');
}

diagnose().catch(err => {
  console.error('Erro no diagnóstico:', err);
  process.exit(1);
});
