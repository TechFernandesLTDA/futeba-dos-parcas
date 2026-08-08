import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BLOCK_ELEMENTS = /<\s*(?:Stack|Box|Grid|Divider|List|Table|Card|Paper|Accordion|LinearProgress|Alert)\b/;

function productionTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionTsxFiles(path);
    if (!entry.name.endsWith('.tsx') || entry.name.includes('.test.')) return [];
    return [path];
  });
}

function withoutComments(source: string): string {
  return source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function findListItemTextBlocks(source: string): string[] {
  const blocks: string[] = [];
  const pattern = /<ListItemText\b/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    let braces = 0;
    let quote = '';
    for (let index = match.index; index < source.length - 1; index += 1) {
      const char = source[index];
      if (quote) {
        if (char === '\\') index += 1;
        else if (char === quote) quote = '';
        continue;
      }
      if (char === '"' || char === "'" || char === '`') {
        quote = char;
        continue;
      }
      if (char === '{') braces += 1;
      if (char === '}') braces -= 1;
      if (braces === 0 && source.slice(index, index + 2) === '/>') {
        blocks.push(source.slice(match.index, index + 2));
        pattern.lastIndex = index + 2;
        break;
      }
    }
  }
  return blocks;
}

function propExpression(block: string, prop: string): string | null {
  const match = new RegExp(`\\b${prop}\\s*=\\s*\\{`).exec(block);
  if (!match || match.index === undefined) return null;
  const openBrace = match.index + match[0].length - 1;
  let braces = 0;
  let quote = '';
  for (let index = openBrace; index < block.length; index += 1) {
    const char = block[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') braces += 1;
    if (char === '}') {
      braces -= 1;
      if (braces === 0) return block.slice(openBrace + 1, index);
    }
  }
  return null;
}

describe('ListItemText block secondary contract', () => {
  it('hardens every block-level secondary against invalid p nesting', () => {
    const sourceRoot = resolve(process.cwd(), 'src');
    const findings = productionTsxFiles(sourceRoot).flatMap((file) => {
      const source = withoutComments(readFileSync(file, 'utf8'));
      return findListItemTextBlocks(source).flatMap((block) => {
        const secondary = propExpression(block, 'secondary');
        if (!secondary || !BLOCK_ELEMENTS.test(secondary)) return [];
        const hardened =
          /secondaryTypographyProps\s*=\s*\{\{[\s\S]*\bcomponent\s*:\s*['"]div['"]/.test(block) ||
          /\bdisableTypography\s*=\s*\{?\s*true\b/.test(block);
        return [{ file, hardened }];
      });
    });

    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every(({ hardened }) => hardened)).toBe(true);
  });
});
