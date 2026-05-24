#!/usr/bin/env node

import { chromium } from 'playwright';

console.log('=== Teste Manual (Navegador Visível) ===\n');

async function testManual() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100
  });
  const page = await browser.newPage();
  
  console.log('1. Navegando para /...');
  await page.goto('https://futebadosparcas.web.app', { waitUntil: 'domcontentloaded' });
  
  console.log('2. Aguardando 10 segundos para você ver o que está acontecendo...');
  await page.waitForTimeout(10000);
  
  console.log('3. Tirando screenshot...');
  await page.screenshot({ path: 'screenshot-manual.png', fullPage: true });
  console.log('   ✓ Screenshot salvo em screenshot-manual.png');
  
  console.log('\n4. Verificando console logs...');
  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  await page.waitForTimeout(2000);
  
  const errorLogs = logs.filter(log => log.type === 'error');
  if (errorLogs.length > 0) {
    console.log(`   ✗ ${errorLogs.length} erros no console:`);
    errorLogs.slice(0, 5).forEach(log => console.log(`      - ${log.text.substring(0, 200)}`));
  } else {
    console.log('   ✓ Nenhum erro no console');
  }
  
  console.log('\n5. Fechando navegador em 5 segundos...');
  await page.waitForTimeout(5000);
  await browser.close();
  
  console.log('\n=== Teste Concluído ===');
}

testManual().catch(err => {
  console.error('Erro no teste:', err);
  process.exit(1);
});
