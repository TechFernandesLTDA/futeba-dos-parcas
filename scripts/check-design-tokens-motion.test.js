const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkMotionParity } = require('./check-design-tokens-parity');
const tokens = require('../shared/design-tokens.json');

const files = [
  'web/src/theme/motion.ts',
  'app/src/main/java/com/futebadosparcas/ui/theme/AppMotion.kt',
  'composeApp/src/commonMain/kotlin/com/futebadosparcas/ui/theme/Motion.kt',
];

const platformSyntax = (file) => file.endsWith('.ts') ? {
  duration: (name, value) => `${name}: ${value}`,
  easing: (name, curve) => `${name}: '${curve}'`,
} : {
  duration: (name, value) => `const val ${name[0].toUpperCase()}${name.slice(1)} = ${value}`,
  easing: (name, curve) => `val ${name[0].toUpperCase()}${name.slice(1)}: Easing = ${curve}`,
};

const writeFixture = (temporary, file, source) => {
  const fixture = path.join(temporary, path.basename(file));
  fs.writeFileSync(fixture, source);
  return fixture;
};

for (const file of files) {
  test(`${file}: named curves agree with the canonical tokens`, () => {
    const errors = [];
    checkMotionParity(tokens, errors, [{ name: file, file: path.resolve(__dirname, '..', file) }]);
    assert.deepEqual(errors, []);
  });

  test(`${file}: swapping standard and decelerate fails even when both curves remain`, () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-parity-'));
    try {
      const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
      const standard = file.endsWith('.ts') ? 'standard:' : 'val Standard:';
      const decelerate = file.endsWith('.ts') ? 'decelerate:' : 'val Decelerate:';
      const swapped = source.replace(standard, '__SWAP__').replace(decelerate, standard).replace('__SWAP__', decelerate);
      assert.notEqual(source, swapped);
      const fixture = writeFixture(temporary, file, swapped);
      const errors = [];
      checkMotionParity(tokens, errors, [{ name: file, file: fixture }]);
      assert.equal(errors.length, 2);
      assert.ok(errors.some((error) => error.includes('motion.easing.standard')));
      assert.ok(errors.some((error) => error.includes('motion.easing.decelerate')));
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  test(`${file}: swapping short and medium durations fails even when both values remain`, () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-parity-'));
    try {
      const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
      const short = file.endsWith('.ts') ? 'short:' : 'const val Short';
      const medium = file.endsWith('.ts') ? 'medium:' : 'const val Medium';
      const swapped = source.replace(short, '__SWAP__').replace(medium, short).replace('__SWAP__', medium);
      assert.notEqual(source, swapped);
      const errors = [];
      checkMotionParity(tokens, errors, [{ name: file, file: writeFixture(temporary, file, swapped) }]);
      assert.equal(errors.length, 2);
      assert.ok(errors.some((error) => error.includes('motion.duration.short')));
      assert.ok(errors.some((error) => error.includes('motion.duration.medium')));
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  test(`${file}: commented duration declaration does not satisfy the gate`, () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-parity-'));
    try {
      const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
      const syntax = platformSyntax(file);
      const canonical = syntax.duration('short', tokens.motion.duration.short);
      const invalid = syntax.duration('short', tokens.motion.duration.short + 1);
      const fixtureSource = `${source.replace(canonical, invalid)}\n// ${canonical}\n`;
      const errors = [];
      checkMotionParity(tokens, errors, [{ name: file, file: writeFixture(temporary, file, fixtureSource) }]);
      assert.equal(errors.length, 1);
      assert.ok(errors[0].includes('motion.duration.short'));
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  test(`${file}: commented easing declaration does not satisfy the gate`, () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-parity-'));
    try {
      const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
      const syntax = platformSyntax(file);
      const canonicalCurve = file.endsWith('.ts') ?
        'cubic-bezier(0.2, 0, 0, 1)' :
        'CubicBezierEasing(0.2f, 0f, 0f, 1f)';
      const canonical = syntax.easing('standard', canonicalCurve);
      const invalid = syntax.easing('standard', file.endsWith('.ts') ?
        'cubic-bezier(0, 0, 0, 1)' :
        'CubicBezierEasing(0f, 0f, 0f, 1f)');
      const fixtureSource = `${source.replace(canonical, invalid)}\n// ${canonical}\n`;
      const errors = [];
      checkMotionParity(tokens, errors, [{ name: file, file: writeFixture(temporary, file, fixtureSource) }]);
      assert.equal(errors.length, 1);
      assert.ok(errors[0].includes('motion.easing.standard'));
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });
}
