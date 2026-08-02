#!/usr/bin/env node

import { chromium } from 'playwright';

console.log('=== Teste Focado no RatingEvolutionChart ===\n');

async function testChart() {
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
  
  console.log('1. Navegando para /profile...');
  try {
    await page.goto('https://futebadosparcas.com.br/profile', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('   ✓ Página carregada');
  } catch (err) {
    console.log(`   ✗ Erro: ${err.message}`);
  }
  
  await page.waitForTimeout(5000);
  
  console.log('\n2. Verificando se há erros específicos do Recharts...');
  const rechartsErrors = errors.filter(err => 
    err.includes('recharts') || 
    err.includes('ResponsiveContainer') || 
    err.includes('LineChart')
  );
  
  if (rechartsErrors.length > 0) {
    console.log(`   ✗ ${rechartsErrors.length} erros do Recharts:`);
    rechartsErrors.forEach(err => console.log(`      - ${err}`));
  } else {
    console.log('   ✓ Nenhum erro específico do Recharts');
  }
  
  console.log('\n3. Verificando console logs...');
  const errorLogs = consoleLogs.filter(log => log.type === 'error');
  if (errorLogs.length > 0) {
    console.log(`   ✗ ${errorLogs.length} erros no console:`);
    errorLogs.forEach(log => console.log(`      - ${log.text}`));
  } else {
    console.log('   ✓ Nenhum erro no console');
  }
  
  console.log('\n4. Verificando conteúdo da página...');
  try {
    const rootContent = await page.locator('#root').innerHTML();
    console.log(`   ✓ Root content length: ${rootContent.length} chars`);
    
    if (rootContent.length > 0) {
      console.log('   ✓ Página renderizou conteúdo');
      
      // Verificar se há login screen
      const hasLogin = await page.locator('text=/login|entrar/i').count();
      console.log(`   Login screen: ${hasLogin > 0 ? 'Sim' : 'Não'}`);
      
      // Verificar se há profile screen
      const hasProfile = await page.locator('text=/perfil|profile/i').count();
      console.log(`   Profile screen: ${hasProfile > 0 ? 'Sim' : 'Não'}`);
    } else {
      console.log('   ✗ Página não renderizou conteúdo');
    }
  } catch (err) {
    console.log(`   ✗ Erro: ${err.message}`);
  }
  
  await browser.close();
  
  console.log('\n=== Teste Concluído ===');
}

testChart().catch(err => {
  console.error('Erro no teste:', err);
  process.exit(1);
});
