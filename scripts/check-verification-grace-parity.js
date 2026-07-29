#!/usr/bin/env node
/**
 * check-verification-grace-parity.js (issue #3922)
 *
 * Valida que a data de fim do grace period de verificação é consistente entre
 * firestore.rules e functions/src/auth/verification-grace.ts (fonte única).
 * Antes deste script, a data era hard-coded em 3 arquivos independentes sem
 * validação cruzada — cada extensão anterior (#1018, #1571, #2122) mudou a
 * data em um arquivo e esquecia outro.
 *
 * Também avisa quando a grace period está prestes a expirar (<= 14 dias),
 * para que a decisão apply-vs-extend não pegue ninguém de surpresa.
 *
 * Saída: exit(1) se houver drift; exit(0) se consistente.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RULES_PATH = path.join(ROOT, 'firestore.rules');
const GRACE_TS_PATH = path.join(ROOT, 'functions', 'src', 'auth', 'verification-grace.ts');
const GRACE_JSON_PATH = path.join(ROOT, 'shared', 'verification-grace.json');

function relative(p) { return path.relative(ROOT, p); }

function read(p, label, errors) {
  if (!fs.existsSync(p)) {
    errors.push(`[${label}] arquivo ausente: ${relative(p)}`);
    return null;
  }
  return fs.readFileSync(p, 'utf8');
}

/** Extrai timestamp.date(Y, M, D) de firestore.rules. */
function extractRulesDate(rulesContent) {
  const m = rulesContent.match(/timestamp\.date\(\s*(\d{4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*\)/);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]), // 1-indexed in rules
    day: Number(m[3]),
    literal: `${m[1]}, ${m[2]}, ${m[3]}`,
  };
}

/** Extrai Date.UTC(Y, M, D) e VERIFICATION_GRACE_END_RULES_LITERAL de verification-grace.ts. */
function extractTsDate(tsContent) {
  const utcMatch = tsContent.match(/Date\.UTC\(\s*(\d{4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*\)/);
  if (!utcMatch) return null;
  const literalMatch = tsContent.match(/VERIFICATION_GRACE_END_RULES_LITERAL\s*=\s*"([^"]+)"/);
  return {
    year: Number(utcMatch[1]),
    month: Number(utcMatch[2]), // 0-indexed in TS
    day: Number(utcMatch[3]),
    literal: literalMatch ? literalMatch[1] : null,
  };
}

function main() {
  const errors = [];
  const warnings = [];

  const rulesContent = read(RULES_PATH, 'firestore.rules', errors);
  const tsContent = read(GRACE_TS_PATH, 'verification-grace.ts', errors);
  const jsonContent = read(GRACE_JSON_PATH, 'verification-grace.json', errors);
  if (!rulesContent || !tsContent || !jsonContent) {
    process.exit(1);
  }

  // Valida JSON canônico (source of truth para web banner).
  let graceJson;
  try {
    graceJson = JSON.parse(jsonContent);
  } catch (err) {
    errors.push(`[verification-grace.json] JSON inválido: ${err.message}`);
    graceJson = null;
  }

  const rulesDate = extractRulesDate(rulesContent);
  const tsDate = extractTsDate(tsContent);

  if (!rulesDate) {
    errors.push('[firestore.rules] timestamp.date(Y, M, D) não encontrado — verifique isVerifiedOrGrace()');
  }
  if (!tsDate) {
    errors.push('[verification-grace.ts] Date.UTC(Y, M, D) não encontrado');
  }

  if (rulesDate && tsDate) {
    // Regras: mês 1-indexed. TS: mês 0-indexed. Normaliza para comparar.
    const rulesNorm = `${rulesDate.year}-${rulesDate.month}-${rulesDate.day}`;
    const tsNorm = `${tsDate.year}-${tsDate.month + 1}-${tsDate.day}`;

    if (rulesNorm !== tsNorm) {
      errors.push(
        `[drift] grace end diverge:\n` +
        `  firestore.rules: ${rulesDate.literal} (mês 1-indexed → ${rulesNorm})\n` +
        `  verification-grace.ts: Date.UTC(${tsDate.year}, ${tsDate.month}, ${tsDate.day}) (mês 0-indexed → ${tsNorm})\n` +
        `  Atualize AMBOS para o mesmo dia.`
      );
    }

    // Verifica consistência do literal de regras exportado no TS.
    if (tsDate.literal && tsDate.literal !== rulesDate.literal) {
      errors.push(
        `[drift] VERIFICATION_GRACE_END_RULES_LITERAL="${tsDate.literal}" difere de firestore.rules "${rulesDate.literal}"`
      );
    }

    // Valida JSON canônico contra rules e TS.
    if (graceJson) {
      if (graceJson.rulesDateLiteral && graceJson.rulesDateLiteral !== rulesDate.literal) {
        errors.push(
          `[drift] verification-grace.json rulesDateLiteral="${graceJson.rulesDateLiteral}" difere de firestore.rules "${rulesDate.literal}"`
        );
      }
      if (graceJson.graceEndIso) {
        const jsonDate = new Date(graceJson.graceEndIso);
        const jsonNorm = `${jsonDate.getUTCFullYear()}-${jsonDate.getUTCMonth() + 1}-${jsonDate.getUTCDate()}`;
        const tsNorm = `${tsDate.year}-${tsDate.month + 1}-${tsDate.day}`;
        if (jsonNorm !== tsNorm) {
          errors.push(
            `[drift] verification-grace.json graceEndIso (${jsonNorm}) difere de verification-grace.ts (${tsNorm})`
          );
        }
      }
    }

    // Aviso de proximidade de expiração.
    const graceEnd = new Date(Date.UTC(tsDate.year, tsDate.month, tsDate.day));
    const daysUntilExpiry = Math.ceil((graceEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (daysUntilExpiry <= 0) {
      errors.push(
        `[expirado] grace period venceu em ${graceEnd.toISOString().slice(0, 10)}. ` +
        `Usuários não verificados são negados. Decida apply vs extend AGORA.`
      );
    } else if (daysUntilExpiry <= 14) {
      warnings.push(
        `[expira em ${daysUntilExpiry}d] grace period vence em ${graceEnd.toISOString().slice(0, 10)} UTC. ` +
        `Decida apply vs extend antes do corte.`
      );
    }
  }

  for (const w of warnings) console.warn('⚠ ' + w);

  if (errors.length > 0) {
    console.error('✗ grace period com problema:');
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }

  if (warnings.length === 0) {
    console.log('✓ grace period consistente entre firestore.rules e verification-grace.ts');
  }
  process.exit(0);
}

main();
