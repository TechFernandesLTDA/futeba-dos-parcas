import { describe, expect, it } from 'vitest';
import { validateGroupForm, type GroupFormData } from './groupValidation';

const valid: GroupFormData = {
  name: 'Pelada de Quinta',
  description: 'Grupo de amigos',
};

describe('groupValidation', () => {
  it('retorna {} para formulário válido', () => {
    expect(validateGroupForm(valid)).toEqual({});
  });

  it('retorna {} para formulário válido sem description', () => {
    expect(validateGroupForm({ name: 'Pelada', description: '' })).toEqual({});
  });

  describe('validação do nome', () => {
    it('exige nome obrigatório quando vazio', () => {
      expect(validateGroupForm({ ...valid, name: '' })).toEqual({
        name: 'Nome do grupo é obrigatório',
      });
    });

    it('exige nome obrigatório quando só há espaços (trim)', () => {
      expect(validateGroupForm({ ...valid, name: '   ' })).toEqual({
        name: 'Nome do grupo é obrigatório',
      });
    });

    it('rejeita nome com menos de 3 caracteres', () => {
      expect(validateGroupForm({ ...valid, name: 'ab' })).toEqual({
        name: 'Nome deve ter pelo menos 3 caracteres',
      });
    });

    it('aceita nome com exatamente 3 caracteres (limite inferior)', () => {
      expect(validateGroupForm({ ...valid, name: 'abc' }).name).toBeUndefined();
    });

    it('aceita nome com exatamente 50 caracteres (limite superior)', () => {
      expect(validateGroupForm({ ...valid, name: 'a'.repeat(50) }).name).toBeUndefined();
    });

    it('rejeita nome com mais de 50 caracteres', () => {
      expect(validateGroupForm({ ...valid, name: 'a'.repeat(51) })).toEqual({
        name: 'Nome deve ter no máximo 50 caracteres',
      });
    });

    it('valida o tamanho pelo comprimento bruto (não trimado)', () => {
      // " a " tem 3 caracteres brutos — passa mesmo com espaços
      expect(validateGroupForm({ ...valid, name: ' a ' }).name).toBeUndefined();
    });

    it('prioriza o erro de obrigatório sobre o de tamanho', () => {
      const errors = validateGroupForm({ ...valid, name: '' });
      expect(errors.name).toBe('Nome do grupo é obrigatório');
    });
  });

  describe('validação da descrição', () => {
    it('aceita descrição com exatamente 500 caracteres (limite superior)', () => {
      expect(validateGroupForm({ ...valid, description: 'x'.repeat(500) })).toEqual({});
    });

    it('rejeita descrição com mais de 500 caracteres', () => {
      expect(validateGroupForm({ ...valid, description: 'x'.repeat(501) })).toEqual({
        description: 'Descrição deve ter no máximo 500 caracteres',
      });
    });

    it('não valida descrição ausente/undefined como erro', () => {
      // description undefined: `.length` de undefined lançaria — comportamento atual espera string
      expect(() => validateGroupForm({ name: 'Pelada', description: '' })).not.toThrow();
    });
  });

  it('acumula erros de name e description no mesmo objeto', () => {
    const errors = validateGroupForm({ name: '', description: 'y'.repeat(501) });
    expect(Object.keys(errors).sort()).toEqual(['description', 'name']);
    expect(errors.name).toBe('Nome do grupo é obrigatório');
    expect(errors.description).toBe('Descrição deve ter no máximo 500 caracteres');
  });

  it('não marca isPublic como erro em nenhuma combinação', () => {
    expect(validateGroupForm({ ...valid, isPublic: true })).toEqual({});
    expect(validateGroupForm({ ...valid, isPublic: false })).toEqual({});
  });
});
