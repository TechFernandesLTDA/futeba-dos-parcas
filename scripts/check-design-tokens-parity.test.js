'use strict';

/**
 * Testes do gate de paridade de MOTION (#4115).
 *
 * O gate antigo só conferia "a curva aparece em algum lugar do arquivo", então
 * um swap de valores entre dois easings — ou um alias órfão como `Emphasized`
 * — passava verde. Estes testes fixam o contrato NOME → VALOR usando fixtures
 * geradas a partir do próprio shared/design-tokens.json.
 *
 * Rodar: `node --test scripts/check-design-tokens-parity.test.js`
 *        (ou `npm run test:scripts`, que cobre scripts/*.test.js).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { checkMotionParity, MOTION_FILES } = require('./check-design-tokens-parity');

const repoRoot = path.resolve(__dirname, '..');
const tokens = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'shared', 'design-tokens.json'), 'utf8')
);

function pascalCase(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Gera um AppMotion.kt/Motion.kt mínimo a partir de mapas nome→valor. */
function kotlinFixture({ durations, easings }) {
  const durationLines = Object.entries(durations)
    .map(([name, value]) => `    const val ${pascalCase(name)} = ${value}`)
    .join('\n');
  const easingLines = Object.entries(easings)
    .map(([name, curve]) => `    val ${pascalCase(name)}: Easing = CubicBezierEasing(${curve.map((v) => `${v}f`).join(', ')})`)
    .join('\n');
  return `package fixture

object MotionDuration {
${durationLines}
}

object MotionEasing {
${easingLines}
}
`;
}

/** Gera um motion.ts mínimo a partir de mapas nome→valor. */
function tsFixture({ durations, easings }) {
  const durationLines = Object.entries(durations)
    .map(([name, value]) => `  ${name}: ${value},`)
    .join('\n');
  const easingLines = Object.entries(easings)
    .map(([name, curve]) => `  ${name}: 'cubic-bezier(${curve.join(', ')})',`)
    .join('\n');
  return `export const motionDuration = {
${durationLines}
} as const;

export const motionEasing = {
${easingLines}
} as const;
`;
}

/** Roda checkMotionParity contra fixtures escritas em um diretório temporário. */
function runAgainstFixtures({ kotlin, ts }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-parity-'));
  try {
    const motionFiles = [];
    if (kotlin) {
      const file = path.join(dir, 'AppMotion.kt');
      fs.writeFileSync(file, kotlin);
      motionFiles.push({ name: 'fixture kotlin', kind: 'kotlin', file });
    }
    if (ts) {
      const file = path.join(dir, 'motion.ts');
      fs.writeFileSync(file, ts);
      motionFiles.push({ name: 'fixture ts', kind: 'ts', file });
    }
    const errors = [];
    checkMotionParity(tokens, errors, motionFiles);
    return errors;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const canonical = {
  durations: {
    short: tokens.motion.duration.short,
    medium: tokens.motion.duration.medium,
    long: tokens.motion.duration.long,
  },
  easings: tokens.motion.easing,
};

test('tokens canônicos: cada easing tem uma curva distinta (sem alias byte a byte igual)', () => {
  const curves = Object.values(tokens.motion.easing).map((curve) => JSON.stringify(curve));
  assert.equal(
    new Set(curves).size,
    curves.length,
    'dois easings com a mesma curva é um alias morto — #4115 removeu `emphasized` por isso'
  );
  assert.ok(!('emphasized' in tokens.motion.easing), '`emphasized` não deve voltar como alias de `standard`');
});

test('arquivos reais das 3 plataformas passam no gate de motion', () => {
  const errors = [];
  checkMotionParity(tokens, errors, MOTION_FILES);
  assert.deepEqual(errors, []);
});

test('fixtures fiéis aos tokens passam (kotlin e ts)', () => {
  const errors = runAgainstFixtures({
    kotlin: kotlinFixture(canonical),
    ts: tsFixture(canonical),
  });
  assert.deepEqual(errors, []);
});

test('swap de Standard <-> Decelerate no Kotlin deixa o gate vermelho', () => {
  const swapped = {
    ...canonical,
    easings: {
      ...canonical.easings,
      standard: canonical.easings.decelerate,
      decelerate: canonical.easings.standard,
    },
  };
  const errors = runAgainstFixtures({ kotlin: kotlinFixture(swapped) });
  assert.ok(errors.some((e) => /MotionEasing\.Standard deve ser/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /MotionEasing\.Decelerate deve ser/.test(e)), errors.join('\n'));
  assert.ok(!errors.some((e) => /MotionEasing\.Accelerate/.test(e)), 'Accelerate não foi tocado');
});

test('swap de standard <-> decelerate no TS deixa o gate vermelho', () => {
  const swapped = {
    ...canonical,
    easings: {
      ...canonical.easings,
      standard: canonical.easings.decelerate,
      decelerate: canonical.easings.standard,
    },
  };
  const errors = runAgainstFixtures({ ts: tsFixture(swapped) });
  assert.ok(errors.some((e) => /motionEasing\.standard deve ser/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /motionEasing\.decelerate deve ser/.test(e)), errors.join('\n'));
});

test('símbolo órfão `Emphasized` (sem token canônico) deixa o gate vermelho', () => {
  const stale = {
    ...canonical,
    easings: { ...canonical.easings, emphasized: canonical.easings.standard },
  };
  const kotlinErrors = runAgainstFixtures({ kotlin: kotlinFixture(stale) });
  assert.ok(
    kotlinErrors.some((e) => /easing sem token canônico: MotionEasing\.Emphasized/.test(e)),
    kotlinErrors.join('\n')
  );

  const tsErrors = runAgainstFixtures({ ts: tsFixture(stale) });
  assert.ok(
    tsErrors.some((e) => /easing sem token canônico: motionEasing\.emphasized/.test(e)),
    tsErrors.join('\n')
  );
});

test('easing canônico ausente na plataforma deixa o gate vermelho', () => {
  const { accelerate: _omit, ...withoutAccelerate } = canonical.easings;
  const errors = runAgainstFixtures({
    kotlin: kotlinFixture({ ...canonical, easings: withoutAccelerate }),
  });
  assert.ok(errors.some((e) => /MotionEasing\.Accelerate deve ser/.test(e)), errors.join('\n'));
});

test('swap de Short <-> Medium nas durations deixa o gate vermelho', () => {
  const swapped = {
    ...canonical,
    durations: {
      ...canonical.durations,
      short: canonical.durations.medium,
      medium: canonical.durations.short,
    },
  };
  const kotlinErrors = runAgainstFixtures({ kotlin: kotlinFixture(swapped) });
  assert.ok(kotlinErrors.some((e) => /MotionDuration\.Short deve ser/.test(e)), kotlinErrors.join('\n'));
  assert.ok(kotlinErrors.some((e) => /MotionDuration\.Medium deve ser/.test(e)), kotlinErrors.join('\n'));

  const tsErrors = runAgainstFixtures({ ts: tsFixture(swapped) });
  assert.ok(tsErrors.some((e) => /motionDuration\.short deve ser/.test(e)), tsErrors.join('\n'));
});

test('duration órfã (sem token canônico) deixa o gate vermelho', () => {
  const stale = {
    ...canonical,
    durations: { ...canonical.durations, extraLong: 900 },
  };
  const errors = runAgainstFixtures({ kotlin: kotlinFixture(stale), ts: tsFixture(stale) });
  assert.ok(errors.some((e) => /MotionDuration\.ExtraLong não existe/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /motionDuration\.extraLong não existe/.test(e)), errors.join('\n'));
});

test('bloco MotionEasing ausente é reportado, não ignorado', () => {
  const errors = runAgainstFixtures({ kotlin: 'package fixture\n\nobject MotionDuration {\n    const val Short = 150\n    const val Medium = 300\n    const val Long = 500\n}\n' });
  assert.ok(errors.some((e) => /bloco MotionEasing ausente/.test(e)), errors.join('\n'));
});
