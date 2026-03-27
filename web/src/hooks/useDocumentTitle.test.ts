import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDocumentTitle } from './useDocumentTitle';

describe('useDocumentTitle', () => {
  const originalTitle = document.title;

  afterEach(() => {
    document.title = originalTitle;
  });

  it('define título com sufixo do app', () => {
    renderHook(() => useDocumentTitle('Jogos'));
    expect(document.title).toBe('Jogos | Futeba dos Parças');
  });

  it('usa apenas nome do app quando sem título', () => {
    renderHook(() => useDocumentTitle());
    expect(document.title).toBe('Futeba dos Parças');
  });

  it('restaura título anterior ao desmontar', () => {
    document.title = 'Original';
    const { unmount } = renderHook(() => useDocumentTitle('Teste'));
    expect(document.title).toBe('Teste | Futeba dos Parças');

    unmount();
    expect(document.title).toBe('Original');
  });

  it('atualiza quando título muda', () => {
    const { rerender } = renderHook(
      ({ title }) => useDocumentTitle(title),
      { initialProps: { title: 'Primeiro' } }
    );
    expect(document.title).toBe('Primeiro | Futeba dos Parças');

    rerender({ title: 'Segundo' });
    expect(document.title).toBe('Segundo | Futeba dos Parças');
  });
});
