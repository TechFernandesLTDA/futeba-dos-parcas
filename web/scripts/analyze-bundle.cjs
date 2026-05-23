#!/usr/bin/env node

/**
 * Script para analisar o bundle e identificar oportunidades de otimização
 */

const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '../dist/assets');

if (!fs.existsSync(distPath)) {
  console.error('❌ Pasta dist não encontrada. Rode "npm run build" primeiro.');
  process.exit(1);
}

const files = fs.readdirSync(distPath)
  .filter(f => f.endsWith('.js'))
  .map(f => {
    const stats = fs.statSync(path.join(distPath, f));
    return {
      name: f,
      size: stats.size,
      sizeKB: (stats.size / 1024).toFixed(2)
    };
  })
  .sort((a, b) => b.size - a.size);

console.log('📊 Análise de Bundle\n');
console.log('='.repeat(70));

const totalSize = files.reduce((sum, f) => sum + f.size, 0);
const totalSizeKB = (totalSize / 1024).toFixed(2);

console.log(`\n📦 Total: ${files.length} arquivos, ${totalSizeKB}KB\n`);

console.log('🔝 Top 15 maiores arquivos:\n');
files.slice(0, 15).forEach((f, i) => {
  const percentage = ((f.size / totalSize) * 100).toFixed(1);
  console.log(`  ${(i + 1).toString().padStart(2)}. ${f.name.padEnd(50)} ${f.sizeKB.padStart(8)}KB (${percentage}%)`);
});

console.log('\n📈 Por categoria:\n');

const categories = {
  'Vendor (libs externas)': files.filter(f => f.name.startsWith('vendor-')),
  'Screens (lazy loaded)': files.filter(f => f.name.includes('Screen')),
  'Hooks': files.filter(f => f.name.startsWith('use')),
  'Outros': files.filter(f => !f.name.startsWith('vendor-') && !f.name.includes('Screen') && !f.name.startsWith('use'))
};

for (const [name, catFiles] of Object.entries(categories)) {
  const size = catFiles.reduce((sum, f) => sum + f.size, 0);
  const percentage = ((size / totalSize) * 100).toFixed(1);
  console.log(`  ${name.padEnd(30)} ${(size / 1024).toFixed(2).padStart(8)}KB (${percentage}%) - ${catFiles.length} arquivos`);
}

console.log('\n⚠️  Oportunidades de otimização:\n');

// Identificar MUI icons
const muiIcons = files.find(f => f.name.includes('vendor-mui-icons'));
if (muiIcons) {
  console.log(`  🎯 MUI Icons: ${muiIcons.sizeKB}KB`);
  console.log(`     → Considerar importar apenas ícones usados (tree shaking)`);
}

// Identificar Firebase
const firebase = files.find(f => f.name.includes('vendor-firebase'));
if (firebase) {
  console.log(`  🎯 Firebase SDK: ${firebase.sizeKB}KB`);
  console.log(`     → Verificar se está importando apenas módulos necessários`);
}

// Identificar chunks grandes
const largeChunks = files.filter(f => f.size > 100 * 1024);
if (largeChunks.length > 0) {
  console.log(`  🎯 Chunks grandes (>${100}KB): ${largeChunks.length}`);
  largeChunks.forEach(f => {
    console.log(`     - ${f.name}: ${f.sizeKB}KB`);
  });
  console.log(`     → Considerar code splitting mais agressivo`);
}

console.log('\n' + '='.repeat(70) + '\n');
