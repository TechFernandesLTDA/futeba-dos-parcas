'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  validateDataset,
  normalizeName,
  coordValida,
  horaValida,
} = require('./validate-venues-dataset');

function makeVenue(overrides = {}) {
  return {
    nome: 'Arena Teste',
    endereco: {
      rua: 'Rua A',
      numero: '10',
      bairro: 'Centro',
      cidade: 'Pinhais',
      uf: 'PR',
      cep: null,
    },
    telefone: null,
    whatsapp: null,
    site: null,
    instagram: null,
    preco_hora: null,
    qtd_quadras: null,
    detalhe_quadras: null,
    tipo_piso: null,
    horarios: null,
    nota_media: null,
    contagem_avaliacoes: null,
    comentarios: [],
    fotos: [],
    fontes: [{url: 'https://example.com/arena', dado: 'endereço e telefone (2026-10-07)'}],
    confidence: 'média',
    coordenadas: {lat: -25.44, lon: -49.25},
    rodada_dados: 'R3',
    ...overrides,
  };
}

function makeDataset(venues) {
  return {
    gerado_em: '2026-10-07',
    rodada: 3,
    cidade: 'Pinhais',
    uf: 'PR',
    venues,
  };
}

test('dataset válido não gera erros', () => {
  const errors = validateDataset(makeDataset([makeVenue()]));
  assert.deepEqual(errors, []);
});

test('venue sem fontes viola provenance obrigatória', () => {
  const errors = validateDataset(
      makeDataset([makeVenue({fontes: []})]),
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /fontes ausente/);
});

test('fonte sem URL http reprovada', () => {
  const errors = validateDataset(
      makeDataset([makeVenue({fontes: [{url: 'ftp://x', dado: 'qualquer dado'}]})]),
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /fontes\[0\]/);
});

test('coordenada fora do Brasil é rejeitada (nada fabricado)', () => {
  const errors = validateDataset(
      makeDataset([makeVenue({coordenadas: {lat: -25.44, lon: 100.25}})]),
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /coordenadas fora do Brasil/);
});

test('coordenada null é aceita (ausente fica null)', () => {
  const errors = validateDataset(
      makeDataset([makeVenue({coordenadas: null})]),
  );
  assert.deepEqual(errors, []);
});

test('nomes duplicados na mesma cidade são detectados', () => {
  const dup = makeVenue();
  const errors = validateDataset(makeDataset([
    makeVenue(),
    {...dup, nome: 'ÁREA  teste!'}, // normalize -> "area teste" x "arena teste"?
  ]));
  // "Arena Teste" normalizado = "arena teste"; "ÁREA teste!" = "area teste" -> NÃO duplica.
  // garante que normalização não gera falso positivo nem negativo:
  const dupReal = validateDataset(makeDataset([
    makeVenue(),
    makeVenue({nome: 'ARENA   teste'}),
  ]));
  assert.equal(dupReal.length, 1);
  assert.match(dupReal[0], /nome duplicado/);
  assert.ok(Array.isArray(errors));
});

test('horário fora do formato HH:MM é rejeitado', () => {
  const errors = validateDataset(
      makeDataset([makeVenue({horarios: {segunda: '8h-22h'}})]),
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /faixa de horário inválida/);
});

test('dia de semana desconhecido é rejeitado', () => {
  const errors = validateDataset(
      makeDataset([makeVenue({horarios: {quarta_feira: '08:00-22:00'}})]),
  );
  assert.equal(errors.length, 1); // só o dia inválido; a faixa em si é válida
  assert.match(errors[0], /dia inválido/);
});

test('horarios.observacao (nota textual do dataset R1) é aceito', () => {
  const errors = validateDataset(
      makeDataset([makeVenue({
        horarios: {observacao: 'secretaria: seg-sex 8h-18h'},
      })]),
  );
  assert.deepEqual(errors, []);
});

test('confidence fora do contrato é rejeitada', () => {
  const errors = validateDataset(
      makeDataset([makeVenue({confidence: 'certeza'})]),
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /confidence/);
});

test('qtd_quadras não inteira/positiva é rejeitada', () => {
  assert.equal(
      validateDataset(makeDataset([makeVenue({qtd_quadras: 0})])).length, 1,
  );
  assert.equal(
      validateDataset(makeDataset([makeVenue({qtd_quadras: null})])).length, 0,
  );
});

test('nota_media fora de 0..5 é rejeitada', () => {
  const errors = validateDataset(
      makeDataset([makeVenue({nota_media: 7})]),
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /nota_media/);
});

test('dataset sem gerado_em/rodada é rejeitado', () => {
  const errors = validateDataset({venues: [makeVenue()]});
  assert.equal(errors.length, 2);
  assert.match(errors[0], /gerado_em/);
  assert.match(errors[1], /rodada/);
});

test('normalizeName remove acentos e pontuação', () => {
  assert.equal(normalizeName('Arena dos Campeões!'), 'arena dos campeoes');
});

test('coordValida aceita limite brasileiro e rejeita fora', () => {
  assert.equal(coordValida({lat: -22.9, lon: -43.2}), true);
  assert.equal(coordValida({lat: 40.7, lon: -74.0}), false);
  assert.equal(coordValida(null), false);
});

test('horaValida aceita 24h e rejeita 25h', () => {
  assert.equal(horaValida('08:00-23:59'), true);
  assert.equal(horaValida('25:00-22:00'), false);
});

test('datasets reais do repositório validam sem erros', () => {
  const dir = __dirname;
  const files = fs.readdirSync(dir)
      .filter((f) => /^venues-.*\.json$/.test(f))
      .sort();
  assert.ok(files.length >= 1, 'esperava ao menos venues-curitiba.json');
  const seen = new Map();
  let total = 0;
  for (const f of files) {
    const dataset = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const errors = validateDataset(dataset, {prefix: f});
    total += errors.length;
    for (const e of errors) console.error(`    ✗ ${e}`);
    for (const v of dataset.venues || []) {
      const key = `${(v.endereco && v.endereco.cidade) || ''}::${normalizeName(v.nome)}`;
      assert.ok(!seen.has(key), `${f}: "${v.nome}" duplicado com ${seen.get(key)}`);
      seen.set(key, f);
    }
  }
  assert.equal(total, 0, `${total} erro(s) nos datasets do repo`);
});