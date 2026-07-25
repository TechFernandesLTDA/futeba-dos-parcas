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
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  parseScalar,
  parseFrontmatter,
  parseBody,
  parseHighlight,
  validateNote,
  buildAutogen,
  toClientNote,
  buildBundlePayload,
  validateBundleTargets,
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

function clientNotesFixture() {
  const body = validBody();
  return [
    {
      platform: 'android',
      version: '1.22.0',
      file: 'android.md',
      fm: validFm(),
      body,
    },
    {
      platform: 'web',
      version: '2.4.0',
      file: 'web.md',
      fm: {
        platform: 'web',
        version: '2.4.0',
        type: 'minor',
        showPopup: true,
        date: '2026-05-10',
        milestone: 'web-2.4.0',
        issues: [321],
        prs: [654],
      },
      body,
    },
    {
      platform: 'ios',
      version: '1.6.0',
      file: 'ios.md',
      fm: {
        platform: 'ios',
        version: '1.6.0',
        type: 'minor',
        showPopup: false,
        date: '2026-05-22',
        buildNumber: 17,
        milestone: 'ios-1.6.0',
        published: false,
      },
      body,
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
  const idxNew = out.indexOf('[1.22.0][android-1.22.0]');
  const idxOld = out.indexOf('[1.21.0][android-1.21.0]');
  assert.ok(idxNew !== -1 && idxOld !== -1, 'ambas as versoes devem aparecer');
  assert.ok(idxNew < idxOld, '1.22.0 deve vir antes de 1.21.0');
});

test('buildAutogen: inclui rotulos PT-BR e refs de issues/PRs', () => {
  const out = buildAutogen(fixedNotes());
  assert.ok(out.includes('#### Adicionado'), 'esperava rotulo PT-BR "Adicionado"');
  assert.ok(out.includes('#### Corrigido'), 'esperava rotulo PT-BR "Corrigido"');
  assert.ok(out.includes('Issues: #123, #456'), 'esperava refs de issues');
  assert.ok(out.includes('PRs: #789'), 'esperava refs de PRs');
  assert.ok(
    out.includes('[android-1.22.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.22.0.md'),
    'esperava ref platform-scoped apontando para o arquivo-fonte'
  );
});

test('buildAutogen: desambigua labels quando plataformas compartilham a mesma versao', () => {
  const out = buildAutogen([
    {
      platform: 'ios',
      version: '1.6.0',
      fm: { date: '2026-05-22', issues: [], prs: [] },
      body: { 'Técnico': { Added: ['Preview iOS'] } },
    },
    {
      platform: 'functions',
      version: '1.6.0',
      fm: { date: '2026-07-04', issues: [], prs: [] },
      body: { 'Técnico': { Fixed: ['Release publish'] } },
    },
  ]);
  assert.ok(out.includes('### [1.6.0][ios-1.6.0] - 2026-05-22'));
  assert.ok(out.includes('### [1.6.0][functions-1.6.0] - 2026-07-04'));
});

test('validateBundleTargets: aceita bundles gerados pelo mesmo payload', () => {
  const notes = clientNotesFixture();
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-notes-ok-'));
  const bundleTargets = {
    android: ['android.json'],
    web: ['web.json'],
    ios: ['ios-a.json', 'ios-b.json'],
  };

  try {
    for (const platform of Object.keys(bundleTargets)) {
      const payload = buildBundlePayload(platform, notes, '2026-07-05T00:00:00.000Z');
      const json = `${JSON.stringify(payload, null, 2)}\n`;
      for (const relativePath of bundleTargets[platform]) {
        const target = path.join(rootDir, relativePath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, json);
      }
    }

    const errors = [];
    validateBundleTargets(notes, errors, { rootDir, bundleTargets });
    assert.deepEqual(errors, []);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('validateBundleTargets: reporta bundle stale quando payload muta', () => {
  const notes = clientNotesFixture();
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-notes-stale-'));
  const bundleTargets = {
    android: ['android.json'],
    web: ['web.json'],
    ios: ['ios.json'],
  };

  try {
    for (const platform of Object.keys(bundleTargets)) {
      const payload = buildBundlePayload(platform, notes, '2026-07-05T00:00:00.000Z');
      const target = path.join(rootDir, bundleTargets[platform][0]);
      fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
    }

    const staleTarget = path.join(rootDir, 'web.json');
    const stalePayload = JSON.parse(fs.readFileSync(staleTarget, 'utf-8'));
    stalePayload.notes[0].headline = 'Bundle mutado fora do gerador';
    fs.writeFileSync(staleTarget, `${JSON.stringify(stalePayload, null, 2)}\n`);

    const errors = [];
    validateBundleTargets(notes, errors, { rootDir, bundleTargets });
    assert.ok(errors.some((error) => error.includes('web.json: bundle fora de sincronia')));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
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
  // #3912: "Race condition no XP" vem de "## Técnico" e nao pode chegar a UI.
  assert.deepEqual(client.fixed, ['Corrigido crash no login']);
});

test('toClientNote: published omitido vira true; published:false vira false', () => {
  const base = { version: '1.0.0', file: 'f.md', body: validBody() };
  assert.equal(toClientNote({ ...base, fm: validFm() }).published, true);
  assert.equal(toClientNote({ ...base, fm: { ...validFm(), published: false } }).published, false);
});

// #3912: antes deste fix o teste abaixo asseverava o oposto — que `fixed` caia
// para o Fixed tecnico quando Correções estivesse vazio. Isso vazava conteudo de
// desenvolvedor para a UI, contra a spec feat-2026-05-22 (L134, L257-258).
test('toClientNote: nunca usa Fixed tecnico, mesmo com Correções do usuario vazio', () => {
  const body = validBody();
  body['Para o usuário'].Correções = [];
  body['Técnico'].Fixed = ['Contrato do mural alinhado'];
  const client = toClientNote({
    version: '1.36.0',
    file: 'f.md',
    fm: validFm(),
    body,
  });
  assert.deepEqual(client.fixed, []);
});

test('toClientNote: fixed segue deduplicando e ignorando vazios em Correções', () => {
  const body = validBody();
  body['Para o usuário'].Correções = ['Mesmo item', 'Mesmo item', '   ', 'Outro item'];
  const client = toClientNote({ version: '1.36.0', file: 'f.md', fm: validFm(), body });
  assert.deepEqual(client.fixed, ['Mesmo item', 'Outro item']);
});

// ==========================================================================
// #3912 — portao de marcacao nas secoes de usuario
// ==========================================================================

/** Roda validateNote com um item injetado numa subsecao de usuario. */
function errorsForUserItem(sub, item, platform = 'android') {
  const errors = [];
  const body = validBody();
  body['Para o usuário'][sub] = [item];
  const fm = { ...validFm(), platform };
  validateNote({ platform, version: '1.22.0', file: 'f.md' }, { fm, body }, errors);
  return errors;
}

test('validateNote: crase em secao de usuario e rejeitada', () => {
  const errors = errorsForUserItem('Correções', 'Corrige o `LiveEventsScreen` no canManage.');
  assert.ok(
    errors.some((e) => e.includes('crase')),
    `esperava erro de crase, veio: ${errors.join('; ')}`
  );
});

test('validateNote: crase em "## Técnico" continua permitida', () => {
  const errors = [];
  const body = validBody();
  body['Técnico'].Fixed = ['`LiveEventsScreen` reconhece co-organizadores em `canManage`.'];
  validateNote({ platform: 'android', version: '1.22.0', file: 'f.md' }, { fm: validFm(), body }, errors);
  assert.deepEqual(errors, [], `Técnico nao deve ser gateado, veio: ${errors.join('; ')}`);
});

test('validateNote: **negrito** continua aceito nas secoes de usuario', () => {
  const errors = errorsForUserItem('Headline', '**Criar jogo funcionando novamente!** Tudo certo.');
  assert.deepEqual(errors, [], `negrito deve passar, veio: ${errors.join('; ')}`);
});

test('validateNote: link, cabecalho e tachado em secao de usuario sao rejeitados', () => {
  for (const [item, token] of [
    ['Veja o [guia completo](https://exemplo.com).', 'link'],
    ['# Titulo solto no meio do item.', 'cabecalho'],
    ['Recurso ~~removido~~ da tela.', 'tachado'],
  ]) {
    const errors = errorsForUserItem('Melhorias', item);
    assert.ok(
      errors.some((e) => e.includes(token)),
      `esperava erro de ${token} para "${item}", veio: ${errors.join('; ')}`
    );
  }
});

test('validateNote: portao nao vale para "functions" (sem renderizador)', () => {
  const errors = errorsForUserItem('Correções', 'Ajusta o callable `confirmPlayerAsManager`.', 'functions');
  assert.deepEqual(errors, [], `functions nao deve ser gateado, veio: ${errors.join('; ')}`);
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
