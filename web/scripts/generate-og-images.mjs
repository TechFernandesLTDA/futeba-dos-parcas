import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, '../public/og');
mkdirSync(outputDir, { recursive: true });

const cards = [
  {
    filename: 'og-organizar-pelada.png',
    badge: 'GUIA PRÁTICO DE PELADA',
    title: 'Como Organizar Pelada Sem Confusão no Grupo',
    subtitle: 'Checklist completo: confirmações, sorteio de times equilibrados, vagas e lista de espera.',
    tag: 'ORGANIZAÇÃO & ESCALAÇÃO',
  },
  {
    filename: 'og-ranking-futebol-amador.png',
    badge: 'ESTATÍSTICAS & RANKING',
    title: 'Ranking de Futebol Amador: Estatísticas, Artilharia e MVP',
    subtitle: 'XP por presença, gols, assistências e defesas, e votação de MVP, melhor goleiro e bola murcha.',
    tag: 'XP, NÍVEIS & BADGES',
  },
  {
    filename: 'og-gestao-de-pelada.png',
    badge: 'FINANÇAS & CAIXA',
    title: 'Gestão de Pelada: Mensalistas, Caixa Financeiro e Despesas',
    subtitle: 'Organize mensalistas, diaristas, rateio da quadra e o caixa do racha.',
    tag: 'CAIXA & MENSALISTAS',
  },
  {
    filename: 'og-como-funciona.png',
    badge: 'CONHEÇA O PRODUTO',
    title: 'Como Funciona o Futeba dos Parças',
    subtitle: 'Fluxos para quem organiza, quem joga e quem administra quadras de futebol.',
    tag: 'PARA ORGANIZADORES, JOGADORES E QUADRAS',
  },
  {
    filename: 'og-parcerias.png',
    badge: 'PARA ARENAS & QUADRAS',
    title: 'Parcerias para Quadras e Arenas Society',
    subtitle: 'Divulgue sua arena para quem organiza peladas no Futeba dos Parças.',
    tag: 'ARENAS & QUADRAS',
  },
];

function generateHtml(card) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1200px;
      height: 630px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: linear-gradient(135deg, #061a0c 0%, #0c2b16 50%, #06150b 100%);
      color: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 56px 64px;
      position: relative;
      overflow: hidden;
    }
    .grid-pattern {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background-image: 
        radial-gradient(circle at 20% 30%, rgba(0, 133, 42, 0.28) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(74, 222, 128, 0.18) 0%, transparent 45%);
      pointer-events: none;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      z-index: 2;
    }
    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .brand-logo {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #00852A 0%, #4ADE80 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 900;
      box-shadow: 0 8px 24px rgba(0, 133, 42, 0.4);
    }
    .brand-name {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #FFFFFF;
    }
    .brand-sub {
      font-size: 13px;
      font-weight: 600;
      color: #86EFAC;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 8px 18px;
      border-radius: 999px;
      background: rgba(0, 133, 42, 0.35);
      border: 1px solid rgba(74, 222, 128, 0.4);
      color: #86EFAC;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .main {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      gap: 18px;
      max-width: 1040px;
    }
    .title {
      font-size: 52px;
      line-height: 1.15;
      font-weight: 900;
      letter-spacing: -1.2px;
      color: #FFFFFF;
      text-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    .subtitle {
      font-size: 23px;
      line-height: 1.4;
      font-weight: 400;
      color: #CBD5E1;
      max-width: 960px;
    }
    .footer {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
    }
    .url {
      font-size: 20px;
      font-weight: 800;
      color: #4ADE80;
      letter-spacing: -0.2px;
    }
    .product-tag {
      font-size: 16px;
      font-weight: 600;
      color: #94A3B8;
    }
    .product-tag strong {
      color: #E2E8F0;
    }
  </style>
</head>
<body>
  <div class="grid-pattern"></div>
  <div class="header">
    <div class="brand-wrap">
      <div class="brand-logo">⚽</div>
      <div>
        <div class="brand-name">Futeba dos Parças</div>
        <div class="brand-sub">${card.tag}</div>
      </div>
    </div>
    <div class="badge">${card.badge}</div>
  </div>
  <div class="main">
    <h1 class="title">${card.title}</h1>
    <p class="subtitle">${card.subtitle}</p>
  </div>
  <div class="footer">
    <div class="url">futebadosparcas.com.br</div>
    <div class="product-tag">Um produto da <strong>Tech Fernandes LTDA</strong></div>
  </div>
</body>
</html>`;
}

async function run() {
  console.log('Generating OG cards...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

  for (const card of cards) {
    const html = generateHtml(card);
    await page.setContent(html, { waitUntil: 'load' });
    const outPath = resolve(outputDir, card.filename);
    await page.screenshot({ path: outPath, type: 'png' });
    console.log(`Generated: ${card.filename}`);
  }

  await browser.close();
  console.log('All OG cards generated successfully.');
}

run().catch((err) => {
  console.error('Failed to generate OG images:', err);
  process.exit(1);
});
