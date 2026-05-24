#!/usr/bin/env node

import { chromium } from 'playwright';

console.log('=== Teste Sem AppCheck ===\n');

async function testWithoutAppCheck() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const errors = [];
  const consoleLogs = [];
  
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });
  
  page.on('pageerror', err => {
    errors.push(err.message);
  });
  
  // Bloquear requests do AppCheck
  await page.route('**/recaptcha/**', route => route.abort());
  await page.route('**/appcheck/**', route => route.abort());
  
  console.log('1. Navegando para /...');
  try {
    await page.goto('https://futebadosparcas.web.app', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('   ✓ DOM carregado');
  } catch (err) {
    console.log(`   ✗ Erro: ${err.message}`);
  }
  
  await page.waitForTimeout(5000);
  
  console.log('\n2. Verificando console logs...');
  const errorLogs = consoleLogs.filter(log => log.type === 'error');
  if (errorLogs.length > 0) {
    console.log(`   ✗ ${errorLogs.length} erros no console:`);
    errorLogs.slice(0, 5).forEach(log => console.log(`      - ${log.text.substring(0, 200)}`));
  } else {
    console.log('   ✓ Nenhum erro no console');
  }
  
  console.log('\n3. Verificando conteúdo da página...');
  try {
    const rootContent = await page.locator('#root').innerHTML();
    console.log(`   ✓ Root content length: ${rootContent.length} chars`);
    
    if (rootContent.length > 0) {
      console.log('   ✓ Página renderizou conteúdo');
      
      // Verificar se há login screen
      const hasLogin = await page.locator('text=/login|entrar/i').count();
      console.log(`   Login screen: ${hasLogin > 0 ? 'Sim' : 'Não'}`);
      
      // Verificar se há home screen
      const hasHome = await page.locator('text=/home|início/i').count();
      console.log(`   Home screen: ${hasHome > 0 ? 'Sim' : 'Não'}`);
    } else {
      console.log('   ✗ Página não renderizou conteúdo');
    }
  } catch (err) {
    console.log(`   ✗ Erro: ${err.message}`);
  }
  
  await browser.close();
  
  console.log('\n=== Teste Concluído ===');
}

testWithoutAppCheck().catch(err => {
  console.error('Erro no teste:', err);
  process.exit(1);
});
