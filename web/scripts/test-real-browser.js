#!/usr/bin/env node

import { chromium } from 'playwright';

console.log('=== Teste em Navegador Real ===\n');

async function testRealBrowser() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
  });
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
  
  console.log('1. Navegando para /...');
  try {
    await page.goto('https://futebadosparcas.com.br', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('   ✓ Página carregada');
  } catch (err) {
    console.log(`   ✗ Erro: ${err.message}`);
  }
  
  await page.waitForTimeout(5000);
  
  console.log('\n2. Verificando console logs...');
  const errorLogs = consoleLogs.filter(log => log.type === 'error');
  if (errorLogs.length > 0) {
    console.log(`   ✗ ${errorLogs.length} erros no console:`);
    errorLogs.slice(0, 10).forEach(log => console.log(`      - ${log.text.substring(0, 300)}`));
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
      
      // Verificar se há error screen
      const hasError = await page.locator('text=/erro|error|oops/i').count();
      console.log(`   Error screen: ${hasError > 0 ? 'Sim' : 'Não'}`);
    } else {
      console.log('   ✗ Página não renderizou conteúdo');
    }
  } catch (err) {
    console.log(`   ✗ Erro: ${err.message}`);
  }
  
  console.log('\n4. Tirando screenshot...');
  await page.screenshot({ path: 'screenshot.png', fullPage: true });
  console.log('   ✓ Screenshot salvo em screenshot.png');
  
  await browser.close();
  
  console.log('\n=== Teste Concluído ===');
}

testRealBrowser().catch(err => {
  console.error('Erro no teste:', err);
  process.exit(1);
});
