/**
 * Gerador de placeholders para brasões de nível 11-20.
 *
 * Cria medalhões circulares numerados com cor por tier usando sips (macOS nativo).
 * Não requer dependências npm extras.
 *
 * Uso: node web/scripts/gen-level-badges.mjs
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../public/images/levels');

const W = 1536;
const H = 1024;
const CX = W / 2;
const CY = H / 2;
const R = 400; // raio do medalhão

/**
 * Paleta por tier (nível → cor principal, cor de texto/borda)
 * Faixa 11-14: Platina  — cinza metálico
 * Faixa 15-17: Ouro     — dourado
 * Faixa 18-19: Diamante — azul-ciano
 * Faixa 20   : Lenda    — roxo/violeta
 */
function tierColors(level) {
  if (level >= 20) return { bg: '#6A0DAD', ring: '#C77DFF', text: '#FFFFFF', name: 'Lenda' };
  if (level >= 18) return { bg: '#00B4D8', ring: '#90E0EF', text: '#FFFFFF', name: 'Diamante' };
  if (level >= 15) return { bg: '#F4A100', ring: '#FFD60A', text: '#1a1a1a', name: 'Ouro' };
  return { bg: '#8E9AAF', ring: '#DEE2E6', text: '#1a1a1a', name: 'Platina' };
}

/** Gera um SVG de medalhão e retorna a string. */
function makeSvg(level) {
  const { bg, ring, text, name } = tierColors(level);
  const bgFill = '#0d1117';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="badgeGrad" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="${ring}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${bg}" stop-opacity="1"/>
    </radialGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="18" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Fundo -->
  <rect width="${W}" height="${H}" fill="${bgFill}"/>

  <!-- Halo exterior -->
  <circle cx="${CX}" cy="${CY}" r="${R + 32}" fill="none" stroke="${ring}" stroke-width="6" opacity="0.4"/>

  <!-- Medalhão principal -->
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#badgeGrad)" filter="url(#glow)"/>

  <!-- Anel interno -->
  <circle cx="${CX}" cy="${CY}" r="${R - 30}" fill="none" stroke="${ring}" stroke-width="8" opacity="0.6"/>

  <!-- Número do nível -->
  <text
    x="${CX}" y="${CY - 40}"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="'Arial Black', Arial, sans-serif"
    font-size="260"
    font-weight="900"
    fill="${text}"
    opacity="0.95"
  >${level}</text>

  <!-- Rótulo do tier -->
  <text
    x="${CX}" y="${CY + 200}"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="Arial, sans-serif"
    font-size="80"
    font-weight="700"
    letter-spacing="12"
    fill="${text}"
    opacity="0.75"
    text-transform="uppercase"
  >${name.toUpperCase()}</text>

  <!-- Estrelas decorativas -->
  ${[45, 135, 225, 315].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const sx = CX + (R + 60) * Math.cos(rad);
    const sy = CY + (R + 60) * Math.sin(rad);
    return `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="18" fill="${ring}" opacity="0.7"/>`;
  }).join('\n  ')}
</svg>`;
}

/** Converte SVG → PNG via sips (macOS nativo). */
function svgToPng(svgPath, pngPath) {
  execSync(`sips -s format png "${svgPath}" --out "${pngPath}"`, { stdio: 'pipe' });
}

for (let level = 11; level <= 20; level++) {
  const pngOut = path.join(OUT_DIR, `level_${level}.png`);

  if (existsSync(pngOut)) {
    console.log(`level_${level}.png already exists, skipping.`);
    continue;
  }

  const svgPath = path.join(OUT_DIR, `_tmp_level_${level}.svg`);
  const svg = makeSvg(level);

  writeFileSync(svgPath, svg, 'utf-8');

  try {
    svgToPng(svgPath, pngOut);
    console.log(`Generated level_${level}.png`);
  } catch (err) {
    console.error(`Failed to convert level_${level}:`, err.message);
  }

  // Limpar SVG temporário
  try { execSync(`rm -f "${svgPath}"`); } catch { /* ignore */ }
}

console.log('Done.');
