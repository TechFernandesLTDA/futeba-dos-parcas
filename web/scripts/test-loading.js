#!/usr/bin/env node

import { chromium } from 'playwright';

console.log('=== Teste de Carregamento com Playwright ===\n');

async function testWebApp() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const consoleLogs = [];
  const errors = [];
  const requests = [];
  
  // Capturar logs do console
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });
  
  // Capturar erros
  page.on('pageerror', err => {
    errors.push(err.message);
  });
  
  // Capturar requests
  page.on('requestfailed', request => {
    requests.push({ url: request.url(), failure: request.failure()?.errorText });
  });
  
  console.log('1. Navegando para https://futebadosparcas.com.br...');
  try {
    const startTime = Date.now();
    await page.goto('https://futebadosparcas.com.br', { waitUntil: 'networkidle', timeout: 30000 });
    const loadTime = Date.now() - startTime;
    console.log(`   ✓ Página carregada em ${loadTime}ms`);
  } catch (err) {
    console.log(`   ✗ Erro ao carregar: ${err.message}`);
  }
  
  // Aguardar um pouco para capturar logs assíncronos
  await page.waitForTimeout(3000);
  
  console.log('\n2. Verificando console logs...');
  if (consoleLogs.length === 0) {
    console.log('   ℹ️  Nenhum log capturado');
  } else {
    consoleLogs.forEach(log => {
      const icon = log.type === 'error' ? '✗' : log.type === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`   ${icon} [${log.type}] ${log.text}`);
    });
  }
  
  console.log('\n3. Verificando erros de página...');
  if (errors.length === 0) {
    console.log('   ✓ Nenhum erro de página');
  } else {
    errors.forEach(err => {
      console.log(`   ✗ ${err}`);
    });
  }
  
  console.log('\n4. Verificando requests falhando...');
  if (requests.length === 0) {
    console.log('   ✓ Todos os requests bem-sucedidos');
  } else {
    requests.forEach(req => {
      console.log(`   ✗ ${req.url}: ${req.failure}`);
    });
  }
  
  console.log('\n5. Verificando conteúdo da página...');
  try {
    const title = await page.title();
    console.log(`   ✓ Título: ${title}`);
    
    const rootContent = await page.locator('#root').innerHTML();
    console.log(`   ✓ Root content length: ${rootContent.length} chars`);
    
    if (rootContent.length < 100) {
      console.log(`   ℹ️  Root content: ${rootContent.substring(0, 100)}`);
    }
    
    // Verificar se há loading spinner
    const hasLoading = await page.locator('[aria-label*="loading"], [aria-label*="carregando"]').count();
    console.log(`   Loading spinners: ${hasLoading}`);
    
    // Verificar se há error messages
    const hasErrors = await page.locator('[role="alert"], .error, .alert').count();
    console.log(`   Error messages: ${hasErrors}`);
    
  } catch (err) {
    console.log(`   ✗ Erro: ${err.message}`);
  }
  
  console.log('\n6. Verificando autenticação...');
  try {
    // Verificar se há login screen
    const hasLogin = await page.locator('text=/login|entrar|sign in/i').count();
    console.log(`   Login screen detectada: ${hasLogin > 0 ? 'Sim' : 'Não'}`);
    
    // Verificar se há home screen
    const hasHome = await page.locator('text=/home|início/i').count();
    console.log(`   Home screen detectada: ${hasHome > 0 ? 'Sim' : 'Não'}`);
    
  } catch (err) {
    console.log(`   ✗ Erro: ${err.message}`);
  }
  
  await browser.close();
  
  console.log('\n=== Teste Concluído ===');
  
  if (errors.length > 0) {
    console.log('\n⚠️  Erros detectados:');
    errors.forEach(err => console.log(`   - ${err}`));
  }
  
  if (consoleLogs.filter(l => l.type === 'error').length > 0) {
    console.log('\n⚠️  Erros no console:');
    consoleLogs.filter(l => l.type === 'error').forEach(log => {
      console.log(`   - ${log.text}`);
    });
  }
}

testWebApp().catch(err => {
  console.error('Erro no teste:', err);
  process.exit(1);
});
