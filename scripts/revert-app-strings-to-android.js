/**
 * Reverte strings do módulo :app de CMP Resources para Android R.string
 *
 * Mudanças:
 * - import com.futebadosparcas.compose.resources.Res → import com.futebadosparcas.R
 * - stringResource(Res.string.xxx) → stringResource(R.string.xxx)
 * - Remove: import org.jetbrains.compose.resources.stringResource
 */

const fs = require('fs');
const path = require('path');

// Função recursiva para encontrar arquivos .kt
function findKotlinFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(findKotlinFiles(filePath));
        } else if (file.endsWith('.kt')) {
            results.push(filePath);
        }
    });
    return results;
}

// Encontrar todos os arquivos .kt no módulo :app
const appDir = path.join(__dirname, '..', 'app', 'src', 'main', 'java');
const files = findKotlinFiles(appDir);

let modifiedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    // 1. Remove import CMP Resources
    if (content.includes('import com.futebadosparcas.compose.resources.Res')) {
        content = content.replace(/import com\.futebadosparcas\.compose\.resources\.Res\n?/g, '');
        modified = true;
    }

    // 2. Remove import stringResource do CMP
    if (content.includes('import org.jetbrains.compose.resources.stringResource')) {
        content = content.replace(/import org\.jetbrains\.compose\.resources\.stringResource\n?/g, '');
        modified = true;
    }

    // 3. Substituir Res.string. por R.string.
    if (content.includes('Res.string.')) {
        content = content.replace(/Res\.string\./g, 'R.string.');
        modified = true;
    }

    // 4. Adicionar import do R do Android se não existir e há R.string
    if (content.includes('R.string.') && !content.includes('import com.futebadosparcas.R')) {
        // Encontrar a última linha de import
        const lines = content.split('\n');
        let lastImportIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('import ')) {
                lastImportIndex = i;
            }
        }
        if (lastImportIndex !== -1) {
            lines.splice(lastImportIndex + 1, 0, 'import com.futebadosparcas.R');
            content = lines.join('\n');
            modified = true;
        }
    }

    // 5. Adicionar import androidx.compose.ui.res.stringResource se usa stringResource mas não tem import
    if (content.includes('stringResource(') &&
        !content.includes('import androidx.compose.ui.res.stringResource')) {
        // Encontrar a última linha de import
        const lines = content.split('\n');
        let lastImportIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('import ')) {
                lastImportIndex = i;
            }
        }
        if (lastImportIndex !== -1) {
            lines.splice(lastImportIndex + 1, 0, 'import androidx.compose.ui.res.stringResource');
            content = lines.join('\n');
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(file, content, 'utf8');
        modifiedCount++;
        console.log(`✓ ${path.relative(appDir, file)}`);
    }
});

console.log(`\n✅ Revertidos ${modifiedCount} arquivos de CMP Resources para Android R.string`);
