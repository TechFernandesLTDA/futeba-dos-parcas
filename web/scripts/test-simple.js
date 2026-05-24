#!/usr/bin/env node

import { chromium } from 'playwright';

console.log('=== Teste Simples ===\n');

async function testSimple() {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  console.log('1. Navegando para /...');
  const response = await page.goto('https://futebadosparcas.web.app', { waitUntil: 'networkidle' });
  console.log(`   Status: ${response.status()}`);
  
  await page.waitForTimeout(3000);
  
  console.log('\n2. Verificando título...');
  const title = await page.title();
  console.log(`   Título: ${title}`);
  
  console.log('\n3. Verificando se há conteúdo...');
  const bodyText = await page.locator('body').innerText();
  console.log(`   Body text length: ${bodyText.length}`);
  if (bodyText.length > 0) {
    console.log(`   Primeiros 200 chars: ${bodyText.substring(0, 200)}`);
  }
  
  console.log('\n4. Verificando se há login button...');
  const loginButton = await page.locator('button:has-text("Entrar"), button:has-text("Login")').count();
  console.log(`   Login buttons: ${loginButton}`);
  
  console.log('\n5. Verificando se há error message...');
  const errorMessage = await page.locator('text=/erro|error|oops/i').count();
  console.log(`   Error messages: ${errorMessage}`);
  
  await browser.close();
  
  console.log('\n=== Teste Concluído ===');
}

testSimple().catch(err => {
  console.error('Erro no teste:', err);
  process.exit(1);
});
