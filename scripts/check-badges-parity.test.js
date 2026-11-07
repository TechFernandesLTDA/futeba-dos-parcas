'use strict';

/**
 * Testes do gate de paridade de Badges (Onda C4 / D3).
 *
 * Rodar: `node --test scripts/check-badges-parity.test.js`
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const { runCheck } = require('./check-badges-parity');

test('runCheck valida com sucesso o catalogo de badges atual', () => {
  const result = runCheck();
  assert.equal(result.ok, true, `Erros encontrados: ${result.errors.join(', ')}`);
  assert.equal(result.errors.length, 0);
  assert.ok(result.count >= 40, `Esperado pelo menos 40 badges no catalogo, encontrado ${result.count}`);
});

test('shared/badges-catalog.json possui schema valido e campos obrigatorios', () => {
  const catalogPath = path.resolve(__dirname, '..', 'shared', 'badges-catalog.json');
  assert.ok(fs.existsSync(catalogPath), 'badges-catalog.json deve existir');

  const content = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  assert.ok(Array.isArray(content.badges), 'content.badges deve ser array');
  assert.ok(content.badges.length > 0, 'content.badges nao pode ser vazio');

  for (const badge of content.badges) {
    assert.ok(badge.id, `Badge sem id: ${JSON.stringify(badge)}`);
    assert.ok(badge.name, `Badge sem name: ${badge.id}`);
    assert.ok(badge.description, `Badge sem description: ${badge.id}`);
    assert.ok(badge.icon, `Badge sem icon: ${badge.id}`);
    assert.ok(badge.category, `Badge sem category: ${badge.id}`);
    assert.ok(badge.rarity, `Badge sem rarity: ${badge.id}`);
    assert.ok(typeof badge.xpReward === 'number', `Badge sem xpReward numerico: ${badge.id}`);
  }
});
