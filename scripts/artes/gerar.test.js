/**
 * Testes do gerador das artes da pelada (spec FEAT_2026-11-21_ARTES_DA_PELADA, CA1 a CA3).
 * Rodar: node --test scripts/artes/gerar.test.js  (também entra em npm run test:scripts)
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..', '..');
const carregar = () => import('./gerar.mjs');

test('saídas versionadas estão em dia com as fontes SVG e os tokens', async () => {
  const g = await carregar();
  for (const [arq, esperado] of Object.entries(g.gerarTudo())) {
    const atual = fs.readFileSync(arq, 'utf8');
    assert.equal(atual, esperado, `${path.relative(RAIZ, arq)} desatualizado: rode node scripts/artes/gerar.mjs`);
  }
});

test('toda arte e todo pictograma existem nas duas saídas', async () => {
  const g = await carregar();
  const fontes = fs.readdirSync(path.join(RAIZ, 'shared/artes/fontes')).filter((f) => !f.startsWith('_')).map((f) => f.replace('.svg', ''));
  const pictos = fs.readdirSync(path.join(RAIZ, 'shared/artes/pictogramas')).map((f) => f.replace('.svg', ''));
  const kt = fs.readFileSync(g.SAIDA_KT, 'utf8');
  const ts = fs.readFileSync(g.SAIDA_TS, 'utf8');
  assert.ok(fontes.length >= 16, 'catálogo com ao menos 16 artes');
  for (const id of fontes) {
    assert.match(kt, new RegExp(`ArteId\\.${id.toUpperCase()} -> `), `${id} ausente no Kotlin`);
    assert.match(ts, new RegExp(`^  ${id}: \\{"largura"`, 'm'), `${id} ausente no TypeScript`);
  }
  for (const id of pictos) {
    assert.match(kt, new RegExp(`PictogramaId\\.${id.toUpperCase()} -> `), `pictograma ${id} ausente no Kotlin`);
    assert.match(ts, new RegExp(`^  ${id}: \\[`, 'm'), `pictograma ${id} ausente no TypeScript`);
  }
});

test('papéis de cor só usam cores que já existem nos tokens (sem cor nova)', () => {
  const tokens = JSON.parse(fs.readFileSync(path.join(RAIZ, 'shared/design-tokens.json'), 'utf8'));
  const { arte, ...resto } = tokens;
  // Fundos do web (web/src/theme) e cores do app (Color.kt, ex.: CardYellow) também são tokens vivos.
  const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const outros = JSON.stringify(resto) + ler('web/src/theme/index.ts')
    + ler('app/src/main/java/com/futebadosparcas/ui/theme/Color.kt')
    + ler('composeApp/src/commonMain/kotlin/com/futebadosparcas/ui/theme/Color.kt');
  const conhecidas = new Set([
    ...(outros.match(/#[0-9A-Fa-f]{6}\b/g) || []).map((c) => c.toUpperCase()),
    ...[...outros.matchAll(/0xFF([0-9A-Fa-f]{6})\b/g)].map((m) => `#${m[1].toUpperCase()}`),
  ]);
  for (const tema of ['claro', 'escuro']) {
    for (const [papel, valor] of Object.entries(arte[tema])) {
      const rgb = valor.slice(0, 7).toUpperCase();
      assert.ok(conhecidas.has(rgb), `arte.${tema}.${papel} usa ${rgb}, que não é token existente`);
    }
  }
  assert.deepEqual(Object.keys(arte.claro), Object.keys(arte.escuro), 'claro e escuro com os mesmos papéis');
});

test('rejeita cor literal, papel inexistente e preenchimento implícito', async () => {
  const g = await carregar();
  const svg = (corpo) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${corpo}</svg>`;
  assert.throws(() => g.resolverTexto(svg('<circle r="2" fill="#000000"/>')), /cor fora dos papéis/);
  assert.throws(() => g.resolverTexto(svg('<circle r="2" fill="var(--a-roxo)"/>')), /papel de cor inexistente/);
  assert.throws(() => g.resolverTexto(svg('<circle r="2"/>')), /sem fill/);
  assert.throws(() => g.resolverTexto(svg('<path d="M0 0" fill="currentColor"/>')), /currentColor/);
  assert.throws(() => g.resolverTexto(svg('<text>Oi</text>')), /texto solto|não suportado/);
  assert.throws(() => g.resolverTexto(svg('<g class="m-piscar"><circle r="2" fill="var(--a-ouro)"/></g>')), /centre o conteúdo/);
});

test('herança de estilo: peça com currentColor e brilho sem fill pegam a cor do grupo', async () => {
  const g = await carregar();
  const nos = g.resolverTexto('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g fill="var(--a-ouro)" transform="translate(5 5)"><use href="#brilho4"/></g><use href="#colete" style="color:var(--a-azul)"/></svg>');
  const grupo = nos[0];
  assert.equal(grupo.tipo, 'grupo');
  assert.equal(grupo.filhos[0].fill, 'ouro');
  const colete = nos.slice(1);
  assert.equal(colete[0].fill, 'azul');
});

test('formas viram caminhos e transformações viram matriz', async () => {
  const g = await carregar();
  assert.equal(g.caminhoDaForma({ nome: 'circle', atributos: { cx: '5', cy: '5', r: '2' } }), 'M7 5A2 2 0 1 1 3 5A2 2 0 1 1 7 5Z');
  assert.equal(g.caminhoDaForma({ nome: 'rect', atributos: { x: '0', y: '0', width: '4', height: '2' } }), 'M0 0H4V2H0Z');
  const m = g.matrizDe('translate(10 20) scale(2)', 't');
  assert.deepEqual(m, [2, 0, 0, 2, 10, 20]);
  const r = g.matrizDe('rotate(90)', 't').map((v) => Number(g.fmt(v)));
  assert.deepEqual(r, [0, 1, -1, 0, 0, 0]);
});

test('renderizadores Compose do Android e do iOS são gêmeos (só pacote e imports mudam)', () => {
  const corpo = (arq) => fs.readFileSync(arq, 'utf8').split('\n').filter((l) => !/^(package|import) /.test(l)).join('\n').trim();
  for (const nome of ['ArteCanvas.kt', 'ArtesDosEstados.kt']) {
    const app = path.join(RAIZ, 'app/src/main/java/com/futebadosparcas/ui/components/artes', nome);
    const cmp = path.join(RAIZ, 'composeApp/src/commonMain/kotlin/com/futebadosparcas/ui/artes', nome);
    assert.equal(corpo(app), corpo(cmp), `${nome} divergiu entre :app e composeApp`);
  }
});
