#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

console.log('=== Diagnóstico de Travamento Web ===\n');

// 1. Verificar se o bundle está carregando
console.log('1. Verificando bundle principal...');
try {
  const bundle = execSync('curl -s https://futebadosparcas.web.app/assets/index-C2CAM24o.js', { encoding: 'utf8' });
  console.log(`   ✓ Bundle carregado: ${(bundle.length / 1024).toFixed(2)} KB`);
  
  // Verificar se há erros de sintaxe
  try {
    new Function(bundle);
    console.log('   ✓ Bundle sem erros de sintaxe');
  } catch (err) {
    console.log(`   ✗ Erro de sintaxe no bundle: ${err.message}`);
  }
} catch (err) {
  console.log(`   ✗ Erro ao carregar bundle: ${err.message}`);
}

// 2. Verificar se há problemas com imports
console.log('\n2. Verificando imports no bundle...');
try {
  const bundle = execSync('curl -s https://futebadosparcas.web.app/assets/index-C2CAM24o.js', { encoding: 'utf8' });
  
  const importPattern = /from\s+["']([^"']+)["']/g;
  const imports = new Set();
  let match;
  
  while ((match = importPattern.exec(bundle)) !== null) {
    imports.add(match[1]);
  }
  
  console.log(`   Total de imports: ${imports.size}`);
  
  // Verificar imports suspeitos
  const suspicious = Array.from(imports).filter(imp => {
    return imp.includes('undefined') || imp.includes('null') || imp.includes('NaN');
  });
  
  if (suspicious.length > 0) {
    console.log(`   ⚠️  Imports suspeitos: ${suspicious.length}`);
    suspicious.forEach(imp => console.log(`      - ${imp}`));
  } else {
    console.log('   ✓ Nenhum import suspeito');
  }
} catch (err) {
  console.log(`   ✗ Erro: ${err.message}`);
}

// 3. Verificar se há problemas com ProfileGate
console.log('\n3. Verificando ProfileGate...');
try {
  const bundle = execSync('curl -s https://futebadosparcas.web.app/assets/index-C2CAM24o.js', { encoding: 'utf8' });
  
  const profileGateChecks = [
    { name: 'ProfileGate', pattern: /ProfileGate/g },
    { name: 'useProfileComplete', pattern: /useProfileComplete/g },
    { name: 'profileComplete', pattern: /profileComplete/g },
    { name: 'loading state', pattern: /loading:\s*profileComplete\s*===\s*null/g },
  ];
  
  profileGateChecks.forEach(check => {
    const matches = bundle.body.match(check.pattern);
    console.log(`   ${check.name}: ${matches ? matches.length + ' ocorrências' : 'Não encontrado'}`);
  });
} catch (err) {
  console.log(`   ✗ Erro: ${err.message}`);
}

// 4. Verificar se há problemas com AuthContext
console.log('\n4. Verificando AuthContext...');
try {
  const bundle = execSync('curl -s https://futebadosparcas.web.app/assets/index-C2CAM24o.js', { encoding: 'utf8' });
  
  const authChecks = [
    { name: 'AuthProvider', pattern: /AuthProvider/g },
    { name: 'onAuthStateChanged', pattern: /onAuthStateChanged/g },
    { name: 'fetchUserData', pattern: /fetchUserData/g },
    { name: 'setLoading(false)', pattern: /setLoading\(false\)/g },
  ];
  
  authChecks.forEach(check => {
    const matches = bundle.match(check.pattern);
    console.log(`   ${check.name}: ${matches ? matches.length + ' ocorrências' : 'Não encontrado'}`);
  });
} catch (err) {
  console.log(`   ✗ Erro: ${err.message}`);
}

// 5. Verificar se há problemas com Firebase
console.log('\n5. Verificando Firebase...');
try {
  const bundle = execSync('curl -s https://futebadosparcas.web.app/assets/index-C2CAM24o.js', { encoding: 'utf8' });
  
  const firebaseChecks = [
    { name: 'initializeApp', pattern: /initializeApp/g },
    { name: 'getAuth', pattern: /getAuth/g },
    { name: 'getFirestore', pattern: /getFirestore/g },
  ];
  
  firebaseChecks.forEach(check => {
    const matches = bundle.match(check.pattern);
    console.log(`   ${check.name}: ${matches ? matches.length + ' ocorrências' : 'Não encontrado'}`);
  });
} catch (err) {
  console.log(`   ✗ Erro: ${err.message}`);
}

// 6. Verificar se há problemas com rotas
console.log('\n6. Verificando rotas...');
try {
  const bundle = execSync('curl -s https://futebadosparcas.web.app/assets/index-C2CAM24o.js', { encoding: 'utf8' });
  
  const routeChecks = [
    { name: 'BrowserRouter', pattern: /BrowserRouter/g },
    { name: 'Routes', pattern: /Routes/g },
    { name: 'Route', pattern: /Route/g },
  ];
  
  routeChecks.forEach(check => {
    const matches = bundle.match(check.pattern);
    console.log(`   ${check.name}: ${matches ? matches.length + ' ocorrências' : 'Não encontrado'}`);
  });
} catch (err) {
  console.log(`   ✗ Erro: ${err.message}`);
}

// 7. Verificar se há problemas com loading states
console.log('\n7. Verificando loading states...');
try {
  const bundle = execSync('curl -s https://futebadosparcas.web.app/assets/index-C2CAM24o.js', { encoding: 'utf8' });
  
  const loadingChecks = [
    { name: 'CircularProgress', pattern: /CircularProgress/g },
    { name: 'LoadingScreen', pattern: /LoadingScreen/g },
    { name: 'Skeleton', pattern: /Skeleton/g },
  ];
  
  loadingChecks.forEach(check => {
    const matches = bundle.match(check.pattern);
    console.log(`   ${check.name}: ${matches ? matches.length + ' ocorrências' : 'Não encontrado'}`);
  });
} catch (err) {
  console.log(`   ✗ Erro: ${err.message}`);
}

// 8. Verificar se há problemas com errors
console.log('\n8. Verificando erros...');
try {
  const bundle = execSync('curl -s https://futebadosparcas.web.app/assets/index-C2CAM24o.js', { encoding: 'utf8' });
  
  const errorChecks = [
    { name: 'ErrorBoundary', pattern: /ErrorBoundary/g },
    { name: 'try-catch', pattern: /try\s*\{/g },
    { name: 'catch', pattern: /catch\s*\(/g },
  ];
  
  errorChecks.forEach(check => {
    const matches = bundle.match(check.pattern);
    console.log(`   ${check.name}: ${matches ? matches.length + ' ocorrências' : 'Não encontrado'}`);
  });
} catch (err) {
  console.log(`   ✗ Erro: ${err.message}`);
}

console.log('\n=== Diagnóstico Concluído ===');
console.log('\nPróximos passos:');
console.log('1. Abra o DevTools do navegador (F12)');
console.log('2. Vá para a aba Console');
console.log('3. Verifique se há erros JavaScript');
console.log('4. Verifique a aba Network para requisições falhando');
console.log('5. Se houver erros, copie e me envie');
