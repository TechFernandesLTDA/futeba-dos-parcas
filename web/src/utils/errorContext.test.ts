import { beforeEach, describe, expect, it } from 'vitest';
import { addBreadcrumb, clearBreadcrumbs, getBreadcrumbs } from './errorContext';

describe('errorContext', () => {
  beforeEach(() => {
    clearBreadcrumbs();
  });

  it('começa vazio', () => {
    expect(getBreadcrumbs()).toEqual([]);
  });

  it('registra breadcrumb com timestamp ISO e ordem antigo → recente', () => {
    const before = new Date().toISOString();
    addBreadcrumb('navigation', 'abriu tela de grupos');
    const after = new Date().toISOString();

    const list = getBreadcrumbs();
    expect(list).toHaveLength(1);
    expect(list[0].category).toBe('navigation');
    expect(list[0].message).toBe('abriu tela de grupos');
    expect(list[0].timestamp >= before).toBe(true);
    expect(list[0].timestamp <= after).toBe(true);
  });

  it('preserva data opcional quando fornecida', () => {
    addBreadcrumb('ui', 'clique em salvar', { botao: 'salvar', tela: 'grupos' });
    const [entry] = getBreadcrumbs();
    expect(entry.data).toEqual({ botao: 'salvar', tela: 'grupos' });
  });

  it('não inclui data quando não fornecida', () => {
    addBreadcrumb('ui', 'clique sem dados');
    const [entry] = getBreadcrumbs();
    expect(entry.data).toBeUndefined();
  });

  it('mantém no máximo 20 breadcrumbs (buffer circular descarta os mais antigos)', () => {
    for (let i = 1; i <= 25; i += 1) {
      addBreadcrumb('ui', `acao-${i}`);
    }
    const list = getBreadcrumbs();
    expect(list).toHaveLength(20);
    expect(list[0].message).toBe('acao-6');
    expect(list[19].message).toBe('acao-25');
  });

  it('exatamente 20 entradas não descarta nenhuma', () => {
    for (let i = 1; i <= 20; i += 1) {
      addBreadcrumb('ui', `acao-${i}`);
    }
    const list = getBreadcrumbs();
    expect(list).toHaveLength(20);
    expect(list[0].message).toBe('acao-1');
  });

  it('clearBreadcrumbs limpa todo o buffer', () => {
    addBreadcrumb('ui', 'antes do logout');
    clearBreadcrumbs();
    expect(getBreadcrumbs()).toEqual([]);
  });

  it('getBreadcrumbs retorna cópia — mutar o resultado não afeta o buffer interno', () => {
    addBreadcrumb('ui', 'original');
    const copy = getBreadcrumbs();
    copy.push({ category: 'hack', message: 'injetado', timestamp: '' });
    copy.pop();

    expect(getBreadcrumbs()).toHaveLength(1);
    expect(getBreadcrumbs()[0].message).toBe('original');
  });
});
