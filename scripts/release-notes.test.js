'use strict';

/**
 * Testes unitarios do pipeline de release notes (scripts/release-notes.js).
 *
 * Usa o test runner nativo do Node 20 (`node:test`) — sem dependencias extras.
 *   node --test scripts/release-notes.test.js
 *
 * Cobre os dois pontos exigidos pela spec 5.1 ("Unit Node"):
 *   - validate rejeita frontmatter invalido;
 *   - changelog (buildAutogen) e deterministico para uma entrada fixa.
 *
 * Spec: specs/feat-2026-05-22-version-control-release-notes.md
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseScalar,
  parseFrontmatter,
  parseBody,
  parseHighlight,
  validateNote,
  buildAutogen,
  toClientNote,
  compareVersionsDesc,
} = require('./release-notes');

// ==========================================================================
// Fixtures
// ==========================================================================

/** Frontmatter valido para a plataforma android (buildNumber obrigatorio). */
function validFm() {
  return {
    platform: 'android',
    version: '1.22.0',
    type: 'minor',
    showPopup: true,
    date: '2026-05-11',
    buildNumber: 46,
    milestone: 'v1.22.0',
    issues: [123, 456],
    prs: [789],
  };
}

/** Corpo valido (Para o usuario + Tecnico). */
function validBody() {
  return {
    'Para o usuário': {
      Headline: ['Uma grande atualizacao chegou!'],
      Destaques: ['icon=star | Novo ranking | Veja sua posicao na liga'],
      Novidades: ['Tela de novidades'],
      Melhorias: ['App mais rapido'],
      Correções: ['Corrigido crash no login'],
    },
    'Técnico': {
      Added: ['ReleaseNotesRepository'],
      Fixed: ['Race condition no XP'],
    },
  };
}

// ==========================================================================
// validate — rejeita frontmatter invalido
// ==========================================================================

test('validateNote: nota valida nao gera erros', () => {
  const errors = [];
  const meta = { platform: 'android', version: '1.22.0', file: 'fixture.md' };
  validateNote(meta, { fm: validFm(), body: validBody() }, errors);
  assert.deepEqual(errors, [], `esperava zero erros, veio: ${errors.join('; ')}`);
});

test('validateNote: showPopup nao-booleano e rejeitado', () => {
  const errors = [];
  const fm = { ...validFm(), showPopup: 'sim' };
  validateNote({ platform: 'android', version: '1.22.0', file: 'f.md' }, { fm, body: validBody() }, errors);
  assert.ok(
    errors.some((e) => e.includes('showPopup')),
    `esperava erro sobre showPopup, veio: ${errors.join('; ')}`
  );
});

test('validateNote: version fora do padrao semver e rejeitada', () => {
  const errors = [];
  const fm = { ...validFm(), version: '1.22' };
  validateNote({ platform: 'android', version: '1.22', file: 'f.md' }, { fm, body: validBody() }, errors);
  assert.ok(
    errors.some((e) => e.includes('semver')),
    `esperava erro de semver, veio: ${errors.join('; ')}`
  );
});

test('validateNote: milestone ausente e rejeitada', () => {
  const errors = [];
  const fm = { ...validFm() };
  delete fm.milestone;
  validateNote({ platform: 'android', version: '1.22.0', file: 'f.md' }, { fm, body: validBody() }, errors);
  assert.ok(
    errors.some((e) => e.includes('milestone')),
    `esperava erro de milestone, veio: ${errors.join('; ')}`
  );
});

test('validateNote: buildNumber obrigatorio em plataforma nativa', () => {
  const errors = [];
  const fm = { ...validFm() };
  delete fm.buildNumber;
  validateNote({ platform: 'android', version: '1.22.0', file: 'f.md' }, { fm, body: validBody() }, errors);
  assert.ok(
    errors.some((e) => e.includes('buildNumber')),
    `esperava erro de buildNumber, veio: ${errors.join('; ')}`
  );
});

test('validateNote: type invalido e rejeitado', () => {
  const errors = [];
  const fm = { ...validFm(), type: 'hotfix' };
  validateNote({ platform: 'android', version: '1.22.0', file: 'f.md' }, { fm, body: validBody() }, errors);
  assert.ok(
    errors.some((e) => e.includes('type invalido')),
    `esperava erro de type, veio: ${errors.join('; ')}`
  );
});

test('validateNote: date fora de YYYY-MM-DD e rejeitada', () => {
  const errors = [];
  const fm = { ...validFm(), date: '11/05/2026' };
  validateNote({ platform: 'android', version: '1.22.0', file: 'f.md' }, { fm, body: validBody() }, errors);
  assert.ok(
    errors.some((e) => e.includes('date')),
    `esperava erro de date, veio: ${errors.join('; ')}`
  );
});

test('validateNote: mais de 3 destaques e rejeitado', () => {
  const errors = [];
  const body = validBody();
  body['Para o usuário'].Destaques = [
    'icon=a | T1 | D1',
    'icon=b | T2 | D2',
    'icon=c | T3 | D3',
    'icon=d | T4 | D4',
  ];
  validateNote({ platform: 'android', version: '1.22.0', file: 'f.md' }, { fm: validFm(), body }, errors);
  assert.ok(
    errors.some((e) => e.includes('Destaques')),
    `esperava erro de Destaques, veio: ${errors.join('; ')}`
  );
});

test('parseFrontmatter: linha sem "chave: valor" e rejeitada', () => {
  const errors = [];
  parseFrontmatter('platform: android\nlinha solta sem dois pontos', 'f.md', errors);
  assert.ok(
    errors.some((e) => e.includes('invalida')),
    `esperava erro de linha invalida, veio: ${errors.join('; ')}`
  );
});

test('parseHighlight: destaque mal formado e rejeitado', () => {
  const errors = [];
  const result = parseHighlight('icon=star | so titulo', 'f.md', errors);
  assert.equal(result, null);
  assert.ok(errors.length > 0, 'esperava ao menos um erro');
});

// ==========================================================================
// changelog — buildAutogen deterministico
// ==========================================================================

function fixedNotes() {
  return [
    {
      platform: 'android',
      version: '1.21.0',
      fm: { date: '2026-04-01', issues: [10], prs: [] },
      body: { 'Técnico': { Added: ['Recurso antigo'] } },
    },
    {
      platform: 'android',
      version: '1.22.0',
      fm: { date: '2026-05-11', issues: [123, 456], prs: [789] },
      body: { 'Técnico': { Added: ['Tela de novidades'], Fixed: ['Crash no login'] } },
    },
    {
      platform: 'web',
      version: '2.4.0',
      fm: { date: '2026-05-10', issues: [], prs: [] },
      body: { 'Técnico': { Changed: ['Layout do dashboard'] } },
    },
  ];
}

test('buildAutogen: deterministico — duas chamadas com a mesma entrada sao identicas', () => {
  const first = buildAutogen(fixedNotes());
  const second = buildAutogen(fixedNotes());
  assert.equal(first, second);
});

test('buildAutogen: independente da ordem de entrada', () => {
  const notes = fixedNotes();
  const reversed = [...notes].reverse();
  assert.equal(buildAutogen(notes), buildAutogen(reversed));
});

test('buildAutogen: versoes ordenadas da mais nova para a mais antiga', () => {
  const out = buildAutogen(fixedNotes());
  const idxNew = out.indexOf('[1.22.0]');
  const idxOld = out.indexOf('[1.21.0]');
  assert.ok(idxNew !== -1 && idxOld !== -1, 'ambas as versoes devem aparecer');
  assert.ok(idxNew < idxOld, '1.22.0 deve vir antes de 1.21.0');
});

test('buildAutogen: inclui rotulos PT-BR e refs de issues/PRs', () => {
  const out = buildAutogen(fixedNotes());
  assert.ok(out.includes('#### Adicionado'), 'esperava rotulo PT-BR "Adicionado"');
  assert.ok(out.includes('#### Corrigido'), 'esperava rotulo PT-BR "Corrigido"');
  assert.ok(out.includes('Issues: #123, #456'), 'esperava refs de issues');
  assert.ok(out.includes('PRs: #789'), 'esperava refs de PRs');
});

// ==========================================================================
// Helpers — parseScalar / compareVersionsDesc / toClientNote
// ==========================================================================

test('parseScalar: converte tipos do subconjunto YAML', () => {
  assert.equal(parseScalar('true'), true);
  assert.equal(parseScalar('false'), false);
  assert.equal(parseScalar('46'), 46);
  assert.equal(parseScalar('1.22.0'), '1.22.0');
  assert.deepEqual(parseScalar('[1, 2, 3]'), [1, 2, 3]);
  assert.deepEqual(parseScalar('[]'), []);
});

test('compareVersionsDesc: ordena da mais nova para a mais antiga', () => {
  const versions = ['1.0.0', '1.22.0', '1.2.0', '1.21.5'];
  const sorted = [...versions].sort(compareVersionsDesc);
  assert.deepEqual(sorted, ['1.22.0', '1.21.5', '1.2.0', '1.0.0']);
});

test('toClientNote: extrai a nota de cliente do formato-fonte', () => {
  const note = {
    version: '1.22.0',
    file: 'f.md',
    fm: { ...validFm() },
    body: validBody(),
  };
  const client = toClientNote(note);
  assert.equal(client.version, '1.22.0');
  assert.equal(client.buildNumber, 46);
  assert.equal(client.showPopup, true);
  assert.equal(client.published, true);
  assert.equal(client.headline, 'Uma grande atualizacao chegou!');
  assert.equal(client.highlights.length, 1);
  assert.equal(client.highlights[0].icon, 'star');
  assert.deepEqual(client.issueRefs, [123, 456]);
});

test('toClientNote: published omitido vira true; published:false vira false', () => {
  const base = { version: '1.0.0', file: 'f.md', body: validBody() };
  assert.equal(toClientNote({ ...base, fm: validFm() }).published, true);
  assert.equal(toClientNote({ ...base, fm: { ...validFm(), published: false } }).published, false);
});

test('parseBody: estrutura H2/H3/itens corretamente', () => {
  const errors = [];
  const body = parseBody(
    '## Para o usuário\n### Headline\n- Texto headline\n## Técnico\n### Added\n- Algo novo',
    'f.md',
    errors
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(body['Para o usuário'].Headline, ['Texto headline']);
  assert.deepEqual(body['Técnico'].Added, ['Algo novo']);
});
