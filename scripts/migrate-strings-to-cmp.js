#!/usr/bin/env node

/**
 * migrate-strings-to-cmp.js
 *
 * Migra strings de Android Resources (R.string) para CMP Resources (Res.string)
 *
 * Uso:
 *   node scripts/migrate-strings-to-cmp.js [--dry-run] [--batch=1]
 *
 * Batches:
 *   1: Components básicos (ui/components/)
 *   2: Screens (ui/*Screen.kt)
 *   3: ViewModels e utils
 *   4: Remaining files
 */

const fs = require('fs');
const path = require('path');

// Parse CLI args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const batchArg = args.find(arg => arg.startsWith('--batch='));
const batchNum = batchArg ? parseInt(batchArg.split('=')[1]) : null;

// Recursive file finder
const findFiles = (dir, pattern, results = []) => {
  if (!fs.existsSync(dir)) return results;

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findFiles(filePath, pattern, results);
    } else if (filePath.endsWith('.kt') && pattern(filePath)) {
      results.push(filePath);
    }
  }

  return results;
};

// Batch patterns (fixed to use forward slashes)
const batchPatterns = {
  1: (p) => p.replace(/\\/g, '/').includes('ui/components/'),
  2: (p) => p.replace(/\\/g, '/').includes('ui/') && p.endsWith('Screen.kt'),
  3: (p) => p.replace(/\\/g, '/').includes('ui/') && p.endsWith('ViewModel.kt'),
  4: (p) => true // All files
};

// Get files to process
const getFiles = () => {
  const baseDir = path.resolve(__dirname, '..', 'app', 'src', 'main', 'java', 'com', 'futebadosparcas');
  const pattern = batchNum ? batchPatterns[batchNum] : batchPatterns[4];

  const allFiles = findFiles(baseDir, pattern);

  // Filter files that actually use R.string
  return allFiles.filter(file => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      return content.includes('R.string.');
    } catch (e) {
      return false;
    }
  });
};

// Migration patterns
const migrateFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const changes = [];

  // Pattern 1: Replace R.string. with Res.string.
  if (content.includes('R.string.')) {
    const count = (content.match(/\bR\.string\./g) || []).length;
    content = content.replace(/\bR\.string\./g, 'Res.string.');
    modified = true;
    changes.push(`Replaced ${count} R.string → Res.string`);
  }

  // Pattern 2: Update import
  if (content.includes('import com.futebadosparcas.R')) {
    // Remove old import
    content = content.replace(/import com\.futebadosparcas\.R\s*\n/g, '');

    // Add new imports (check if not already present)
    const imports = [
      'import com.futebadosparcas.compose.resources.Res',
      'import org.jetbrains.compose.resources.stringResource'
    ];

    let importsAdded = 0;
    imports.forEach(imp => {
      if (!content.includes(imp)) {
        // Insert after package declaration
        const packageMatch = content.match(/^package .+\n/m);
        if (packageMatch) {
          const insertPos = packageMatch.index + packageMatch[0].length;
          content = content.slice(0, insertPos) + `${imp}\n` + content.slice(insertPos);
          importsAdded++;
        }
      }
    });

    modified = true;
    changes.push(`Updated imports (removed R, added ${importsAdded} new)`);
  }

  // Pattern 3: Handle stringResource imports (androidx → compose.resources)
  if (content.includes('import androidx.compose.ui.res.stringResource')) {
    content = content.replace(
      /import androidx\.compose\.ui\.res\.stringResource/g,
      'import org.jetbrains.compose.resources.stringResource'
    );
    modified = true;
    changes.push('Updated stringResource import');
  }

  return { content, modified, changes };
};

// Main execution
const main = () => {
  const files = getFiles();

  console.log(`\n🔍 Encontrados ${files.length} arquivos com R.string${batchNum ? ` (batch ${batchNum})` : ''}\n`);

  if (isDryRun) {
    console.log('🧪 DRY RUN - Nenhum arquivo será modificado\n');
  }

  let successCount = 0;
  let errorCount = 0;

  files.forEach((file, index) => {
    const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');

    try {
      const { content, modified, changes } = migrateFile(file);

      if (modified) {
        if (!isDryRun) {
          fs.writeFileSync(file, content, 'utf8');
        }
        console.log(`✅ [${index + 1}/${files.length}] ${relPath}`);
        if (changes.length > 0) {
          changes.forEach(change => console.log(`   - ${change}`));
        }
        successCount++;
      } else {
        console.log(`⏭️  [${index + 1}/${files.length}] ${relPath} (sem mudanças)`);
      }
    } catch (error) {
      console.error(`❌ [${index + 1}/${files.length}] ${relPath} - ${error.message}`);
      errorCount++;
    }
  });

  console.log(`\n📊 Resumo:`);
  console.log(`   Sucesso: ${successCount}`);
  console.log(`   Erros: ${errorCount}`);
  console.log(`   Total: ${files.length}`);

  if (isDryRun) {
    console.log(`\n💡 Execute sem --dry-run para aplicar as mudanças`);
  } else {
    console.log(`\n✨ Migração completa! Rode './gradlew :app:compileDebugKotlin' para validar`);
  }
};

// Run
try {
  main();
} catch (error) {
  console.error(`\n❌ Erro fatal: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
}
