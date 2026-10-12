'use strict';

/**
 * Guarda permanente dos requisitos do Google Play para o app Android.
 *
 * Falha no CI (Validate Patterns / Conventions) se alguém baixar o targetSdk
 * abaixo do mínimo exigido pela Play, deixar o compileSdk atrás do targetSdk ou
 * remover a verificação de 16 KB do workflow de deploy.
 *
 * Como atualizar: a Play sobe o mínimo todo ano (prazo normalmente em 31/08).
 * Quando o novo prazo for anunciado, aumente PLAY_MIN_TARGET_SDK, suba o
 * targetSdk em app/, baselineprofile/ e macrobenchmark/ no mesmo PR e revise as
 * mudanças de comportamento da nova API. Documentado em
 * docs/RELEASE_PROCESS.md (seção "Requisitos do Google Play").
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * targetSdk mínimo aceito pela Play para publicar/atualizar apps.
 * Política: https://support.google.com/googleplay/android-developer/answer/11926878
 * Hoje (out/2026): API 36, prazo 31/08/2026 (aviso do Play Console de 12/10/2026).
 */
const PLAY_MIN_TARGET_SDK = 36;

/** Módulos que declaram targetSdk (apps/instrumentação). */
const MODULES_WITH_TARGET_SDK = [
  'app/build.gradle.kts',
  'baselineprofile/build.gradle.kts',
  'macrobenchmark/build.gradle.kts',
];

/** Módulos que declaram compileSdk. */
const MODULES_WITH_COMPILE_SDK = [...MODULES_WITH_TARGET_SDK, 'shared/build.gradle.kts', 'composeApp/build.gradle.kts'];

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

/** Lê `targetSdk = N` ou `compileSdk = N` (ignora comentários de linha). */
function readSdk(source, key) {
  const code = source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const match = new RegExp(`\\b${key}\\s*=\\s*(\\d+)\\b`).exec(code);
  return match ? Number(match[1]) : null;
}

test('readSdk lê o valor e ignora comentários', () => {
  assert.equal(readSdk('targetSdk = 36', 'targetSdk'), 36);
  assert.equal(readSdk('// targetSdk = 30\ntargetSdk = 36 // ok', 'targetSdk'), 36);
  assert.equal(readSdk('compileSdk = 37', 'targetSdk'), null);
});

test(`targetSdk >= ${PLAY_MIN_TARGET_SDK} (mínimo da Play) em todos os módulos`, () => {
  for (const file of MODULES_WITH_TARGET_SDK) {
    const targetSdk = readSdk(read(file), 'targetSdk');
    assert.notEqual(targetSdk, null, `${file}: targetSdk não encontrado`);
    assert.ok(
      targetSdk >= PLAY_MIN_TARGET_SDK,
      `${file}: targetSdk=${targetSdk} abaixo do mínimo da Play (${PLAY_MIN_TARGET_SDK}). ` +
        'A Play recusa atualizações (https://support.google.com/googleplay/android-developer/answer/11926878).',
    );
  }
});

test('compileSdk >= targetSdk em todos os módulos', () => {
  const appTarget = readSdk(read('app/build.gradle.kts'), 'targetSdk');
  for (const file of MODULES_WITH_COMPILE_SDK) {
    const source = read(file);
    const compileSdk = readSdk(source, 'compileSdk');
    assert.notEqual(compileSdk, null, `${file}: compileSdk não encontrado`);
    const targetSdk = readSdk(source, 'targetSdk') ?? appTarget;
    assert.ok(compileSdk >= targetSdk, `${file}: compileSdk=${compileSdk} menor que targetSdk=${targetSdk}`);
  }
});

test('deploy-production.yml verifica 16 KB do AAB sempre (inclusive em dry_run)', () => {
  const workflow = read('.github/workflows/deploy-production.yml');
  const build = workflow.indexOf('./gradlew bundleRelease');
  const guard = workflow.indexOf('scripts/ci/check-16kb-alignment.js');
  const upload = workflow.indexOf('Upload AAB to Play Store');
  assert.ok(build >= 0, 'passo de build do AAB não encontrado');
  assert.ok(guard > build, 'a verificação de 16 KB deve rodar depois do bundleRelease');
  assert.ok(upload > guard, 'a verificação de 16 KB deve rodar antes do upload para a Play');

  // O passo da guarda não pode ser condicionado a dry_run nem a outro `if`.
  const stepStart = workflow.lastIndexOf('      - name:', guard);
  const stepEnd = workflow.indexOf('\n      - name:', guard);
  const step = workflow.slice(stepStart, stepEnd >= 0 ? stepEnd : undefined);
  assert.doesNotMatch(step, /\n\s+if:/, 'o passo de 16 KB não pode ter `if:` (deve rodar em dry_run e em deploy)');
  assert.match(step, /app\/build\/outputs\/bundle\/release\/app-release\.aab/);
});

test('app/build.gradle.kts mantém símbolos das .so prebuilt (strip do AGP não pode desalinhar 16 KB)', () => {
  const gradle = read('app/build.gradle.kts');
  assert.match(gradle, /keepDebugSymbols[\s\S]*?libdatastore_shared_counter\.so/);
});

test('o script da guarda de 16 KB existe e está coberto por teste', () => {
  assert.ok(fs.existsSync(path.join(root, 'scripts/ci/check-16kb-alignment.js')));
  assert.ok(fs.existsSync(path.join(root, 'scripts/ci/check-16kb-alignment.test.js')));
});
