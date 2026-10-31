import { describe, it, expect } from 'vitest';
import { classifyDeleteAccountError } from './deleteAccountErrors';

const err = (code: string, details?: unknown) => Object.assign(new Error(code), { code, details });

describe('classifyDeleteAccountError', () => {
  it('reconhece requires-recent-login (com e sem prefixo functions/)', () => {
    const details = { reason: 'requires-recent-login' };
    expect(classifyDeleteAccountError(err('functions/failed-precondition', details))).toEqual({ kind: 'requires-recent-login' });
    expect(classifyDeleteAccountError(err('failed-precondition', details))).toEqual({ kind: 'requires-recent-login' });
  });

  it('reconhece sole-owner-groups e descarta entradas inválidas', () => {
    const result = classifyDeleteAccountError(
      err('functions/failed-precondition', {
        reason: 'sole-owner-groups',
        groups: [{ id: 'g1', name: 'A' }, { id: 'g2', name: '' }, { name: 'sem id' }, null],
      }),
    );
    expect(result).toEqual({
      kind: 'sole-owner-groups',
      groups: [{ id: 'g1', name: 'A' }, { id: 'g2', name: 'g2' }],
    });
  });

  it('reconhece resource-exhausted', () => {
    expect(classifyDeleteAccountError(err('functions/resource-exhausted'))).toEqual({ kind: 'rate-limited' });
  });

  it('classifica o resto como other, inclusive failed-precondition sem reason', () => {
    expect(classifyDeleteAccountError(err('functions/failed-precondition'))).toEqual({ kind: 'other', code: 'failed-precondition' });
    expect(classifyDeleteAccountError(new Error('x'))).toEqual({ kind: 'other', code: '' });
    expect(classifyDeleteAccountError(undefined)).toEqual({ kind: 'other', code: '' });
  });
});
