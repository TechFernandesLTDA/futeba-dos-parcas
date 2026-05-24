#!/usr/bin/env node

import { chromium } from 'playwright';

console.log('=== Teste Focado no Erro MUI ===\n');

async function testMUIError() {
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
  
  console.log('1. Navegando para /...');
  try {
    await page.goto('https://futebadosparcas.web.app', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('   ✓ DOM carregado');
  } catch (err) {
    console.log(`   ✗ Erro: ${err.message}`);
  }
  
  await page.waitForTimeout(3000);
  
  console.log('\n2. Verificando se há erros específicos do MUI...');
  const muiErrors = errors.filter(err => 
    err.includes('MUI') || 
    err.includes('Material-UI') ||
    err.includes('vendor-mui')
  );
  
  if (muiErrors.length > 0) {
    console.log(`   ✗ ${muiErrors.length} erros do MUI:`);
    muiErrors.forEach(err => console.log(`      - ${err}`));
  } else {
    console.log('   ✓ Nenhum erro específico do MUI');
  }
  
  console.log('\n3. Verificando console logs...');
  const errorLogs = consoleLogs.filter(log => log.type === 'error');
  if (errorLogs.length > 0) {
    console.log(`   ✗ ${errorLogs.length} erros no console:`);
    errorLogs.slice(0, 5).forEach(log => console.log(`      - ${log.text.substring(0, 200)}`));
  } else {
    console.log('   ✓ Nenhum erro no console');
  }
  
  console.log('\n4. Verificando conteúdo da página...');
  try {
    const rootContent = await page.locator('#root').innerHTML();
    console.log(`   ✓ Root content length: ${rootContent.length} chars`);
    
    if (rootContent.length > 0) {
      console.log('   ✓ Página renderizou conteúdo');
    } else {
      console.log('   ✗ Página não renderizou conteúdo');
    }
  } catch (err) {
    console.log(`   ✗ Erro: ${err.message}`);
  }
  
  console.log('\n5. Verificando se há Firebase AppCheck error...');
  const appCheckErrors = consoleLogs.filter(log => 
    log.text.includes('AppCheck') || 
    log.text.includes('403')
  );
  
  if (appCheckErrors.length > 0) {
    console.log(`   ✗ ${appCheckErrors.length} erros do AppCheck:`);
    appCheckErrors.forEach(log => console.log(`      - ${log.text}`));
  } else {
    console.log('   ✓ Nenhum erro do AppCheck');
  }
  
  await browser.close();
  
  console.log('\n=== Teste Concluído ===');
}

testMUIError().catch(err => {
  console.error('Erro no teste:', err);
  process.exit(1);
});
