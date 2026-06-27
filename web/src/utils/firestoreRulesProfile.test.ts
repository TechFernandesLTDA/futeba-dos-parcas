import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Firestore profile update rules', () => {
  const rules = readFileSync(resolve(process.cwd(), '../firestore.rules'), 'utf8');
  const usersUpdateRule = rules.slice(
    rules.indexOf('      allow update: if\n          isAdmin() ||'),
    rules.indexOf('      allow delete: if false;', rules.indexOf('      allow update: if\n          isAdmin() ||'))
  );

  it('validam campos opcionais de perfil com fallback para documentos legados', () => {
    expect(usersUpdateRule).toContain("isValidEmail(request.resource.data.get('email', null))");
    expect(usersUpdateRule).toContain("isValidRating(request.resource.data.get('striker_rating', null))");
    expect(usersUpdateRule).toContain("isValidRating(request.resource.data.get('mid_rating', null))");
    expect(usersUpdateRule).toContain("isValidRating(request.resource.data.get('defender_rating', null))");
    expect(usersUpdateRule).toContain("isValidRating(request.resource.data.get('gk_rating', null))");
    expect(usersUpdateRule).not.toContain('isValidEmail(request.resource.data.email)');
  });
});
