#!/usr/bin/env node
/**
 * Gerador das artes da pelada (spec FEAT_2026-11-21_ARTES_DA_PELADA).
 *
 * Lê as fontes SVG em shared/artes/ e os papéis de cor em shared/design-tokens.json#arte e grava:
 *   - shared/src/commonMain/kotlin/com/futebadosparcas/domain/artes/ArtesGeradas.kt (Android e iOS)
 *   - web/src/components/artes/artes.generated.ts (web)
 *
 * Uso:
 *   node scripts/artes/gerar.mjs              grava as saídas
 *   node scripts/artes/gerar.mjs --verificar  falha se as saídas versionadas estiverem desatualizadas
 *
 * Regras que o gerador impõe (e o teste confere):
 *   - toda cor é `none` ou `var(--a-<papel>)`, com papel existente nos tokens; preenchimento
 *     implícito (preto do SVG) é erro;
 *   - formas viram caminhos; transformações viram uma matriz por grupo;
 *   - grupo com animação que gira ou escala precisa de `transform` (conteúdo centrado na origem).
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ = resolve(AQUI, '..', '..');
const DIR_FONTES = join(RAIZ, 'shared/artes/fontes');
const DIR_PICTOS = join(RAIZ, 'shared/artes/pictogramas');
const ARQ_TOKENS = join(RAIZ, 'shared/design-tokens.json');
export const SAIDA_KT = join(RAIZ, 'shared/src/commonMain/kotlin/com/futebadosparcas/domain/artes/ArtesGeradas.kt');
export const SAIDA_TS = join(RAIZ, 'web/src/components/artes/artes.generated.ts');

/**
 * Animações da pelada. Fonte única: o Kotlin e o CSS do web saem daqui.
 * Repouso (reduzir movimento) é sempre o estado neutro: sem deslocamento, giro 0, escala 1, opaco.
 */
export const ANIMACOES = {
  rolar: {
    duracaoMs: 2400, alternar: true, curva: [0.42, 0, 0.58, 1],
    quadros: [[0, {}], [1, { dx: -38, graus: -240 }]],
  },
  cair: {
    duracaoMs: 1600, alternar: false, curva: [0.42, 0, 1, 1],
    quadros: [[0, { dy: -14, alfa: 0 }], [0.6, { dy: 0.4, alfa: 1 }], [1, { dy: 10, alfa: 0 }]],
  },
  piscar: {
    duracaoMs: 1800, alternar: false, curva: [0.42, 0, 0.58, 1],
    quadros: [[0, { escala: 0.7, alfa: 0.25 }], [0.5, {}], [1, { escala: 0.7, alfa: 0.25 }]],
  },
  quicar: {
    duracaoMs: 1200, alternar: false, curva: [0.42, 0, 0.58, 1],
    quadros: [[0, {}], [0.5, { dx: 6, dy: -8 }], [1, {}]],
  },
};
const ANIM_GIRA_OU_ESCALA = new Set(['rolar', 'piscar']);

const ATRIBUTOS_ACEITOS = new Set([
  'xmlns', 'viewBox', 'id', 'class', 'style', 'href', 'transform', 'opacity', 'data-descricao',
  'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height',
  'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
]);

// ─── XML mínimo ──────────────────────────────────────────────────────────────

/** Lê o SVG das fontes (formato controlado: aspas duplas, sem CDATA). */
export function lerXml(texto, origem = 'svg') {
  const raiz = { nome: '#raiz', atributos: {}, filhos: [] };
  const pilha = [raiz];
  const limpo = texto.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?xml[\s\S]*?\?>/g, '');
  const reTag = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g;
  let m;
  let fim = 0;
  while ((m = reTag.exec(limpo))) {
    const entre = limpo.slice(fim, m.index).trim();
    if (entre) throw new Error(`${origem}: texto solto não permitido na arte: "${entre.slice(0, 40)}"`);
    fim = reTag.lastIndex;
    const [, fecha, nome, attrs, auto] = m;
    if (fecha) {
      const topo = pilha.pop();
      if (!topo || topo.nome !== nome) throw new Error(`${origem}: </${nome}> sem abertura`);
      continue;
    }
    const atributos = {};
    for (const a of attrs.matchAll(/([\w:-]+)="([^"]*)"/g)) {
      if (!ATRIBUTOS_ACEITOS.has(a[1])) throw new Error(`${origem}: atributo não suportado ${a[1]} em <${nome}>`);
      atributos[a[1]] = a[2];
    }
    const no = { nome, atributos, filhos: [] };
    pilha[pilha.length - 1].filhos.push(no);
    if (!auto) pilha.push(no);
  }
  if (limpo.slice(fim).trim()) throw new Error(`${origem}: conteúdo depois da última tag`);
  if (pilha.length !== 1) throw new Error(`${origem}: tag sem fechamento <${pilha[pilha.length - 1].nome}>`);
  const svg = raiz.filhos[0];
  if (!svg || svg.nome !== 'svg') throw new Error(`${origem}: a raiz precisa ser <svg>`);
  return svg;
}

// ─── Números, formas e matrizes ──────────────────────────────────────────────

export function fmt(n) {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}
const num = (v, padrao = 0) => (v === undefined ? padrao : Number(v));

function caminhoCirculo(cx, cy, rx, ry) {
  // Começa em (cx+rx, cy) e segue no sentido horário, como o SVG desenha o círculo.
  return `M${fmt(cx + rx)} ${fmt(cy)}A${fmt(rx)} ${fmt(ry)} 0 1 1 ${fmt(cx - rx)} ${fmt(cy)}`
    + `A${fmt(rx)} ${fmt(ry)} 0 1 1 ${fmt(cx + rx)} ${fmt(cy)}Z`;
}

function caminhoRetangulo(x, y, w, h, rxAttr, ryAttr) {
  let rx = rxAttr ?? ryAttr ?? 0;
  let ry = ryAttr ?? rxAttr ?? 0;
  rx = Math.min(rx, w / 2);
  ry = Math.min(ry, h / 2);
  if (rx <= 0 || ry <= 0) return `M${fmt(x)} ${fmt(y)}H${fmt(x + w)}V${fmt(y + h)}H${fmt(x)}Z`;
  const arco = (px, py) => `A${fmt(rx)} ${fmt(ry)} 0 0 1 ${fmt(px)} ${fmt(py)}`;
  return `M${fmt(x + rx)} ${fmt(y)}H${fmt(x + w - rx)}${arco(x + w, y + ry)}V${fmt(y + h - ry)}`
    + `${arco(x + w - rx, y + h)}H${fmt(x + rx)}${arco(x, y + h - ry)}V${fmt(y + ry)}${arco(x + rx, y)}Z`;
}

export function caminhoDaForma(no) {
  const a = no.atributos;
  switch (no.nome) {
    case 'path': return a.d.replace(/\s+/g, ' ').trim();
    case 'circle': return caminhoCirculo(num(a.cx), num(a.cy), num(a.r), num(a.r));
    case 'ellipse': return caminhoCirculo(num(a.cx), num(a.cy), num(a.rx), num(a.ry));
    case 'rect': return caminhoRetangulo(num(a.x), num(a.y), num(a.width), num(a.height),
      a.rx === undefined ? undefined : num(a.rx), a.ry === undefined ? undefined : num(a.ry));
    default: return null;
  }
}

const IDENTIDADE = [1, 0, 0, 1, 0, 0];
function multiplicar(m, n) {
  const [a, b, c, d, e, f] = m;
  const [a2, b2, c2, d2, e2, f2] = n;
  return [a * a2 + c * b2, b * a2 + d * b2, a * c2 + c * d2, b * c2 + d * d2, a * e2 + c * f2 + e, b * e2 + d * f2 + f];
}

/** Converte `translate(..) rotate(..) scale(..)` numa matriz [a b c d e f]. */
export function matrizDe(transform, origem) {
  if (!transform) return IDENTIDADE;
  let m = IDENTIDADE;
  const re = /(translate|rotate|scale|matrix)\(([^)]*)\)/g;
  let lido = '';
  let t;
  while ((t = re.exec(transform))) {
    lido += t[0];
    const v = t[2].trim().split(/[\s,]+/).map(Number);
    let n;
    if (t[1] === 'translate') n = [1, 0, 0, 1, v[0], v[1] ?? 0];
    else if (t[1] === 'scale') n = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
    else if (t[1] === 'matrix') n = v;
    else {
      const r = (v[0] * Math.PI) / 180;
      n = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
      if (v.length === 3) n = multiplicar(multiplicar([1, 0, 0, 1, v[1], v[2]], n), [1, 0, 0, 1, -v[1], -v[2]]);
    }
    m = multiplicar(m, n);
  }
  if (lido.replace(/\s/g, '') !== transform.replace(/\s/g, '')) throw new Error(`${origem}: transform não suportado "${transform}"`);
  return m;
}
const ehIdentidade = (m) => m.every((v, i) => Math.abs(v - IDENTIDADE[i]) < 1e-9);

// ─── Resolução de estilo e árvore ────────────────────────────────────────────

function corDe(valor, ctx, papeis, origem, modoPicto) {
  if (valor === undefined) return undefined;
  if (valor === 'none') return null;
  if (valor === 'currentColor') {
    if (modoPicto) return 'currentColor';
    if (!ctx.cor) throw new Error(`${origem}: currentColor sem style="color:var(--a-…)" acima`);
    return ctx.cor;
  }
  const m = /^var\(--a-([a-z]+)\)$/.exec(valor);
  if (!m) throw new Error(`${origem}: cor fora dos papéis "${valor}" (use var(--a-<papel>))`);
  if (!papeis.has(m[1])) throw new Error(`${origem}: papel de cor inexistente "${m[1]}"`);
  return m[1];
}

function contextoFilho(no, ctx, papeis, origem, modoPicto) {
  const a = no.atributos;
  const novo = { ...ctx };
  if (a.style !== undefined) {
    const m = /^color:\s*var\(--a-([a-z]+)\)$/.exec(a.style.trim());
    if (!m || !papeis.has(m[1])) throw new Error(`${origem}: style não suportado "${a.style}"`);
    novo.cor = m[1];
  }
  const fill = corDe(a.fill, novo, papeis, origem, modoPicto);
  if (fill !== undefined) novo.fill = fill;
  const stroke = corDe(a.stroke, novo, papeis, origem, modoPicto);
  if (stroke !== undefined) novo.stroke = stroke;
  if (a['stroke-width'] !== undefined) novo.sw = Number(a['stroke-width']);
  if (a['stroke-linecap'] !== undefined) novo.cap = a['stroke-linecap'];
  if (a['stroke-linejoin'] !== undefined) novo.join = a['stroke-linejoin'];
  if (a['stroke-dasharray'] !== undefined) novo.dash = a['stroke-dasharray'].trim().split(/[\s,]+/).map(Number);
  return novo;
}

function animacaoDe(no, origem) {
  const cls = no.atributos.class;
  if (!cls) return null;
  const m = /^m-(rolar|cair|piscar|quicar)$/.exec(cls.trim());
  if (!m) throw new Error(`${origem}: classe não suportada "${cls}"`);
  if (ANIM_GIRA_OU_ESCALA.has(m[1]) && !no.atributos.transform) {
    throw new Error(`${origem}: m-${m[1]} gira ou escala em volta da origem: use transform e centre o conteúdo em 0,0`);
  }
  return m[1];
}

/** Resolve a árvore de um SVG em nós de saída (caminhos e grupos). */
function resolver(no, ctx, defs, papeis, origem, modoPicto) {
  if (no.nome === 'defs') return [];
  if (no.nome === 'use') {
    const id = (no.atributos.href || '').replace(/^#/, '');
    const def = defs.get(id);
    if (!def) throw new Error(`${origem}: <use href="#${id}"> sem peça em _pecas.svg`);
    const embrulho = { nome: 'g', atributos: { ...no.atributos }, filhos: def.nome === 'g' ? def.filhos : [{ ...def, atributos: { ...def.atributos, id: undefined } }] };
    delete embrulho.atributos.href;
    return resolver(embrulho, ctx, defs, papeis, origem, modoPicto);
  }
  const novoCtx = contextoFilho(no, ctx, papeis, origem, modoPicto);
  const opacidade = num(no.atributos.opacity, 1);
  if (no.nome === 'g' || no.nome === 'svg') {
    const filhos = no.filhos.flatMap((f) => resolver(f, novoCtx, defs, papeis, origem, modoPicto));
    const matriz = no.nome === 'g' ? matrizDe(no.atributos.transform, origem) : IDENTIDADE;
    const animacao = no.nome === 'g' ? animacaoDe(no, origem) : null;
    if (ehIdentidade(matriz) && !animacao && opacidade === 1) return filhos;
    if (modoPicto) throw new Error(`${origem}: pictograma não aceita grupo com transform, classe ou opacidade`);
    return [{ tipo: 'grupo', matriz, opacidade, animacao, filhos }];
  }
  const d = caminhoDaForma(no);
  if (d === null) throw new Error(`${origem}: elemento não suportado <${no.nome}>`);
  if (no.atributos.transform || no.atributos.class) throw new Error(`${origem}: transform/classe só em <g> ou <use>`);
  if (novoCtx.fill === undefined) throw new Error(`${origem}: <${no.nome}> sem fill (o SVG pintaria de preto)`);
  return [{
    tipo: 'caminho', d,
    fill: novoCtx.fill, stroke: novoCtx.stroke ?? null,
    sw: novoCtx.sw ?? 1, cap: novoCtx.cap ?? 'butt', join: novoCtx.join ?? 'miter',
    dash: novoCtx.dash ?? null, opacidade,
  }];
}

// ─── Leitura das fontes ──────────────────────────────────────────────────────

export function lerTokens() {
  const arte = JSON.parse(readFileSync(ARQ_TOKENS, 'utf8')).arte;
  const papeis = Object.keys(arte.claro);
  const escuro = Object.keys(arte.escuro);
  if (papeis.join() !== escuro.join()) throw new Error('design-tokens.json#arte: claro e escuro com papéis diferentes');
  for (const tema of ['claro', 'escuro']) {
    for (const [p, v] of Object.entries(arte[tema])) {
      if (!/^#[0-9A-F]{6}([0-9A-F]{2})?$/.test(v)) throw new Error(`arte.${tema}.${p}: use #RRGGBB ou #RRGGBBAA maiúsculo`);
    }
  }
  return { papeis, claro: arte.claro, escuro: arte.escuro };
}

function lerDefs(papeis) {
  const svg = lerXml(readFileSync(join(DIR_FONTES, '_pecas.svg'), 'utf8'), '_pecas.svg');
  const defs = new Map();
  for (const bloco of svg.filhos.filter((f) => f.nome === 'defs')) {
    for (const def of bloco.filhos) {
      if (!def.atributos.id) throw new Error('_pecas.svg: peça sem id');
      defs.set(def.atributos.id, def);
    }
  }
  void papeis;
  return defs;
}

const listar = (dir) => readdirSync(dir).filter((f) => f.endsWith('.svg') && !f.startsWith('_')).sort();

export function lerFontes() {
  const tokens = lerTokens();
  const papeis = new Set(tokens.papeis);
  const defs = lerDefs(papeis);
  const artes = listar(DIR_FONTES).map((arq) => {
    const id = arq.replace(/\.svg$/, '');
    if (!/^[a-z][a-z_]*$/.test(id)) throw new Error(`${arq}: nome deve ser minúsculo com _`);
    const svg = lerXml(readFileSync(join(DIR_FONTES, arq), 'utf8'), arq);
    const vb = (svg.atributos.viewBox || '').split(/\s+/).map(Number);
    if (vb.length !== 4 || vb[0] !== 0 || vb[1] !== 0) throw new Error(`${arq}: viewBox deve ser "0 0 L A"`);
    const nos = resolver(svg, {}, defs, papeis, arq, false);
    return { id, largura: vb[2], altura: vb[3], nos };
  });
  const pictogramas = listar(DIR_PICTOS).map((arq) => {
    const id = arq.replace(/\.svg$/, '');
    const svg = lerXml(readFileSync(join(DIR_PICTOS, arq), 'utf8'), arq);
    if (svg.atributos.viewBox !== '0 0 24 24') throw new Error(`${arq}: pictograma usa viewBox 0 0 24 24`);
    const a = svg.atributos;
    if (a.fill !== 'none' || a.stroke !== 'currentColor' || a['stroke-width'] !== '1.8'
      || a['stroke-linecap'] !== 'round' || a['stroke-linejoin'] !== 'round') {
      throw new Error(`${arq}: pictograma precisa de fill="none" stroke="currentColor" stroke-width="1.8" e pontas redondas`);
    }
    const nos = resolver(svg, {}, defs, papeis, arq, true);
    for (const n of nos) {
      if (n.fill !== null || n.stroke !== 'currentColor' || n.sw !== 1.8 || n.dash) {
        throw new Error(`${arq}: traço de pictograma não pode mudar cor, largura ou tracejado`);
      }
    }
    return { id, tracos: nos.map((n) => ({ d: n.d, opacidade: n.opacidade })) };
  });
  return { tokens, artes, pictogramas };
}

/** Resolve um SVG avulso com as peças e papéis reais (usado pelos testes). */
export function resolverTexto(texto, { pictograma = false } = {}) {
  const papeis = new Set(lerTokens().papeis);
  return resolver(lerXml(texto, 'teste.svg'), {}, lerDefs(papeis), papeis, 'teste.svg', pictograma);
}

// ─── Saída Kotlin ────────────────────────────────────────────────────────────

const constante = (id) => id.toUpperCase();
const kf = (n) => `${fmt(n)}f`;
const kStr = (s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$')}"`;
const PONTA_KT = { butt: 'RETA', round: 'REDONDA', square: 'QUADRADA' };
const JUNCAO_KT = { miter: 'QUINA', round: 'REDONDA', bevel: 'CHANFRO' };
const corKt = (hex) => {
  const h = hex.slice(1);
  const rgb = h.slice(0, 6);
  const alfa = h.length === 8 ? h.slice(6) : 'FF';
  return `0x${alfa}${rgb}`;
};

function noKt(n, recuo) {
  const r = ' '.repeat(recuo);
  if (n.tipo === 'caminho') {
    const args = [kStr(n.d)];
    if (n.fill) args.push(`preenchimento = PapelCor.${constante(n.fill)}`);
    if (n.stroke) {
      args.push(`traco = PapelCor.${constante(n.stroke)}`);
      if (n.sw !== 1) args.push(`larguraTraco = ${kf(n.sw)}`);
      if (n.cap !== 'butt') args.push(`ponta = PontaTraco.${PONTA_KT[n.cap]}`);
      if (n.join !== 'miter') args.push(`juncao = JuncaoTraco.${JUNCAO_KT[n.join]}`);
      if (n.dash) args.push(`tracejado = listOf(${n.dash.map(kf).join(', ')})`);
    }
    if (n.opacidade !== 1) args.push(`opacidade = ${kf(n.opacidade)}`);
    return `${r}CaminhoArte(${args.join(', ')})`;
  }
  const args = [];
  if (!ehIdentidade(n.matriz)) args.push(`matriz = MatrizArte(${n.matriz.map(kf).join(', ')})`);
  if (n.opacidade !== 1) args.push(`opacidade = ${kf(n.opacidade)}`);
  if (n.animacao) args.push(`animacao = AnimacaoArte.${constante(n.animacao)}`);
  const filhos = n.filhos.map((f) => noKt(f, recuo + 8)).join(',\n');
  return `${r}GrupoArte(\n${r}    filhos = listOf(\n${filhos}\n${r}    )${args.length ? `,\n${r}    ${args.join(`,\n${r}    `)}` : ''}\n${r})`;
}

function estadoKt(e) {
  const args = [];
  if (e.dx) args.push(`dx = ${kf(e.dx)}`);
  if (e.dy) args.push(`dy = ${kf(e.dy)}`);
  if (e.graus) args.push(`graus = ${kf(e.graus)}`);
  if (e.escala !== undefined) args.push(`escala = ${kf(e.escala)}`);
  if (e.alfa !== undefined) args.push(`alfa = ${kf(e.alfa)}`);
  return `EstadoAnimacao(${args.join(', ')})`;
}

export function gerarKotlin({ tokens, artes, pictogramas }) {
  const L = [];
  L.push('// GERADO por scripts/artes/gerar.mjs a partir de shared/artes e shared/design-tokens.json#arte.');
  L.push('// Não edite à mão: mude a fonte SVG ou os tokens e rode `node scripts/artes/gerar.mjs`.');
  L.push('@file:Suppress("MagicNumber", "MaxLineLength", "LongMethod", "LargeClass", "TooManyFunctions", "CyclomaticComplexMethod")');
  L.push('');
  L.push('package com.futebadosparcas.domain.artes');
  L.push('');
  L.push('/** Papéis de cor das artes (shared/design-tokens.json#arte). */');
  L.push(`enum class PapelCor { ${tokens.papeis.map(constante).join(', ')} }`);
  L.push('');
  L.push('/** Artes da pelada disponíveis (uma por arquivo em shared/artes/fontes). */');
  L.push(`enum class ArteId { ${artes.map((a) => constante(a.id)).join(', ')} }`);
  L.push('');
  L.push('/** Pictogramas disponíveis (shared/artes/pictogramas). */');
  L.push(`enum class PictogramaId { ${pictogramas.map((p) => constante(p.id)).join(', ')} }`);
  L.push('');
  L.push('/** Animações curtas das artes; desligadas com "reduzir movimento". */');
  L.push(`enum class AnimacaoArte { ${Object.keys(ANIMACOES).map(constante).join(', ')} }`);
  L.push('');
  L.push('object ArtesDaPelada {');
  for (const tema of ['claro', 'escuro']) {
    L.push(`    /** Paleta ${tema === 'claro' ? 'clara' : 'escura'}, cores ARGB (0xAARRGGBB). */`);
    L.push(`    val paleta${tema === 'claro' ? 'Clara' : 'Escura'}: Map<PapelCor, Long> = mapOf(`);
    L.push(tokens.papeis.map((p) => `        PapelCor.${constante(p)} to ${corKt(tokens[tema][p])}`).join(',\n'));
    L.push('    )');
    L.push('');
  }
  L.push('    fun arte(id: ArteId): Arte = when (id) {');
  for (const a of artes) L.push(`        ArteId.${constante(a.id)} -> ${camel(a.id)}()`);
  L.push('    }');
  L.push('');
  L.push('    fun pictograma(id: PictogramaId): Pictograma = when (id) {');
  for (const p of pictogramas) {
    const tr = p.tracos.map((t) => `TracoPictograma(${kStr(t.d)}${t.opacidade !== 1 ? `, ${kf(t.opacidade)}` : ''})`).join(', ');
    L.push(`        PictogramaId.${constante(p.id)} -> Pictograma(id, listOf(${tr}))`);
  }
  L.push('    }');
  L.push('');
  L.push('    fun animacao(animacao: AnimacaoArte): EspecAnimacao = when (animacao) {');
  for (const [nome, e] of Object.entries(ANIMACOES)) {
    const quadros = e.quadros.map(([p, est]) => `QuadroAnimacao(${kf(p)}, ${estadoKt(est)})`).join(', ');
    L.push(`        AnimacaoArte.${constante(nome)} -> EspecAnimacao(${e.duracaoMs}, ${e.alternar}, CurvaTempo(${e.curva.map(kf).join(', ')}), listOf(${quadros}))`);
  }
  L.push('    }');
  for (const a of artes) {
    L.push('');
    L.push(`    private fun ${camel(a.id)}() = Arte(`);
    L.push(`        ArteId.${constante(a.id)}, ${kf(a.largura)}, ${kf(a.altura)},`);
    L.push('        listOf(');
    L.push(a.nos.map((n) => noKt(n, 12)).join(',\n'));
    L.push('        )');
    L.push('    )');
  }
  L.push('}');
  L.push('');
  return L.join('\n');
}
const camel = (id) => id.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

// ─── Saída TypeScript ────────────────────────────────────────────────────────

function noTs(n) {
  if (n.tipo === 'caminho') {
    const o = { d: n.d };
    if (n.fill) o.f = n.fill;
    if (n.stroke) {
      o.s = n.stroke;
      if (n.sw !== 1) o.w = n.sw;
      if (n.cap !== 'butt') o.lc = n.cap;
      if (n.join !== 'miter') o.lj = n.join;
      if (n.dash) o.da = n.dash;
    }
    if (n.opacidade !== 1) o.o = n.opacidade;
    return o;
  }
  const o = { g: n.filhos.map(noTs) };
  if (!ehIdentidade(n.matriz)) o.m = n.matriz.map((v) => Number(fmt(v)));
  if (n.opacidade !== 1) o.o = n.opacidade;
  if (n.animacao) o.a = n.animacao;
  return o;
}

export function gerarTs({ tokens, artes, pictogramas }) {
  const L = [];
  L.push('// GERADO por scripts/artes/gerar.mjs a partir de shared/artes e shared/design-tokens.json#arte.');
  L.push('// Não edite à mão: mude a fonte SVG ou os tokens e rode `node scripts/artes/gerar.mjs`.');
  L.push('');
  L.push(`export type PapelCor = ${tokens.papeis.map((p) => `'${p}'`).join(' | ')};`);
  L.push(`export type ArteId = ${artes.map((a) => `'${a.id}'`).join(' | ')};`);
  L.push(`export type PictogramaId = ${pictogramas.map((p) => `'${p.id}'`).join(' | ')};`);
  L.push(`export type AnimacaoArte = ${Object.keys(ANIMACOES).map((n) => `'${n}'`).join(' | ')};`);
  L.push('');
  L.push('/** Caminho: d, preenchimento (f), traço (s), largura (w), ponta (lc), junção (lj), tracejado (da), opacidade (o). */');
  L.push('export interface CaminhoArte { d: string; f?: PapelCor; s?: PapelCor; w?: number; lc?: \'round\' | \'square\'; lj?: \'round\' | \'bevel\'; da?: number[]; o?: number }');
  L.push('/** Grupo: filhos (g), matriz [a b c d e f] (m), opacidade (o), animação (a). */');
  L.push('export interface GrupoArte { g: NoArte[]; m?: number[]; o?: number; a?: AnimacaoArte }');
  L.push('export type NoArte = CaminhoArte | GrupoArte;');
  L.push('export interface Arte { largura: number; altura: number; nos: NoArte[] }');
  L.push('export interface EstadoAnimacao { dx?: number; dy?: number; graus?: number; escala?: number; alfa?: number }');
  L.push('export interface EspecAnimacao { duracaoMs: number; alternar: boolean; curva: [number, number, number, number]; quadros: [number, EstadoAnimacao][] }');
  L.push('');
  for (const tema of ['claro', 'escuro']) {
    L.push(`export const PALETA_${tema.toUpperCase()}: Record<PapelCor, string> = ${JSON.stringify(tokens[tema])};`);
  }
  L.push('');
  L.push(`export const ANIMACOES_ARTE: Record<AnimacaoArte, EspecAnimacao> = ${JSON.stringify(ANIMACOES)};`);
  L.push('');
  L.push('export const ARTES: Record<ArteId, Arte> = {');
  for (const a of artes) {
    L.push(`  ${a.id}: ${JSON.stringify({ largura: a.largura, altura: a.altura, nos: a.nos.map(noTs) })},`);
  }
  L.push('};');
  L.push('');
  L.push('export const PICTOGRAMAS: Record<PictogramaId, { d: string; o?: number }[]> = {');
  for (const p of pictogramas) {
    L.push(`  ${p.id}: ${JSON.stringify(p.tracos.map((t) => (t.opacidade !== 1 ? { d: t.d, o: t.opacidade } : { d: t.d })))},`);
  }
  L.push('};');
  L.push('');
  return L.join('\n');
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

export function gerarTudo() {
  const fontes = lerFontes();
  return { [SAIDA_KT]: gerarKotlin(fontes), [SAIDA_TS]: gerarTs(fontes) };
}

function principal() {
  const verificar = process.argv.includes('--verificar');
  const saidas = gerarTudo();
  let desatualizado = 0;
  for (const [arq, conteudo] of Object.entries(saidas)) {
    const rel = arq.slice(RAIZ.length + 1);
    if (verificar) {
      let atual = '';
      try { atual = readFileSync(arq, 'utf8'); } catch { /* ausente */ }
      if (atual !== conteudo) { console.error(`✗ ${rel} desatualizado: rode node scripts/artes/gerar.mjs`); desatualizado++; }
    } else {
      writeFileSync(arq, conteudo);
      console.log(`✓ ${rel}`);
    }
  }
  if (verificar) {
    if (desatualizado) process.exit(1);
    console.log('✓ artes da pelada em dia com as fontes');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal();
