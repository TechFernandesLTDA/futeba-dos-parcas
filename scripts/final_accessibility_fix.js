/**
 * FINAL Accessibility Fix - Ultra-robust version
 * Adds contentDescription to ALL Icons without it
 */

const fs = require('fs');
const path = require('path');

function hasContentDescriptionInIconCall(iconCallText) {
  return /contentDescription\s*=/.test(iconCallText);
}

function extractIconCallFromLines(lines, startIndex) {
  let openParens = 0;
  let iconCallLines = [];
  let foundIconStart = false;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    if (!foundIconStart && /\bIcon\s*\(/.test(line)) {
      foundIconStart = true;
    }

    if (foundIconStart) {
      iconCallLines.push({ index: i, text: line });
      openParens += (line.match(/\(/g) || []).length;
      openParens -= (line.match(/\)/g) || []).length;

      if (openParens === 0) {
        break;
      }
    }
  }

  return iconCallLines;
}

function processFile(filePath) {
  // Skip non-UI files
  if (filePath.includes('\\model\\') ||
      filePath.includes('\\data\\') ||
      filePath.includes('\\domain\\') ||
      filePath.includes('FcmService')) {
    return { modified: false };
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const newLines = [];
    let modified = false;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Check if this line contains Icon(
      if (/\bIcon\s*\(/.test(line)) {
        const iconCall = extractIconCallFromLines(lines, i);

        if (iconCall.length > 0) {
          const iconCallText = iconCall.map(l => l.text).join('\n');

          if (!hasContentDescriptionInIconCall(iconCallText)) {
            // Need to add contentDescription
            modified = true;

            // Find where to insert contentDescription
            let inserted = false;

            for (let j = 0; j < iconCall.length; j++) {
              const callLine = iconCall[j];

              // If this is the first line with Icons.xxx, insert contentDescription after it
              if (/Icons\.[A-Za-z.]+/.test(callLine.text)) {
                // Check if it has a comma
                if (callLine.text.includes(',')) {
                  // Insert after this line
                  const indent = callLine.text.match(/^(\s*)/)[1];
                  newLines.push(callLine.text);

                  if (!callLine.text.includes('contentDescription')) {
                    newLines.push(indent + '    contentDescription = null,');
                  }
                  inserted = true;
                } else {
                  // Add comma and contentDescription on next line
                  const indent = callLine.text.match(/^(\s*)/)[1];
                  // Remove closing paren if exists
                  let modifiedLine = callLine.text.replace(/\)\s*$/, '');
                  newLines.push(modifiedLine + ',');
                  newLines.push(indent + '    contentDescription = null');
                  inserted = true;
                }

                // Add remaining lines
                for (let k = j + 1; k < iconCall.length; k++) {
                  newLines.push(iconCall[k].text);
                }
                break;
              } else {
                newLines.push(callLine.text);
              }
            }

            if (!inserted) {
              // Fallback - just add all lines as is
              iconCall.forEach(l => newLines.push(l.text));
            }

            i += iconCall.length;
            continue;
          } else {
            // Already has contentDescription
            iconCall.forEach(l => newLines.push(l.text));
            i += iconCall.length;
            continue;
          }
        }
      }

      newLines.push(line);
      i++;
    }

    if (modified) {
      const newContent = newLines.join('\n');
      fs.writeFileSync(filePath, newContent, 'utf8');
      return { modified: true };
    }

    return { modified: false };

  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return { modified: false, error: error.message };
  }
}

function getAllKotlinFiles(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllKotlinFiles(fullPath));
    } else if (entry.name.endsWith('.kt')) {
      files.push(fullPath);
    }
  }

  return files;
}

console.log('>>> FINAL Accessibility Fix\n');

const appDir = path.join(__dirname, '..', 'app', 'src', 'main', 'java');
const files = getAllKotlinFiles(appDir);

let modifiedCount = 0;
let processedCount = 0;

for (const file of files) {
  processedCount++;
  const result = processFile(file);

  if (result.modified) {
    modifiedCount++;
    const relPath = path.relative(appDir, file);
    console.log(`[OK] ${relPath}`);
  }

  if (processedCount % 100 === 0) {
    console.log(`Progress: ${processedCount}/${files.length}...`);
  }
}

console.log(`\n>>> Modified ${modifiedCount}/${files.length} files`);
console.log(`>>> Run './gradlew compileDebugKotlin' to verify`);
