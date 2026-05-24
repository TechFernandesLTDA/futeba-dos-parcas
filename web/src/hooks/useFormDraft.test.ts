import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormDraft } from './useFormDraft';

describe('useFormDraft', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna draft null quando não há dados salvos', () => {
    const { result } = renderHook(() => useFormDraft('test-form'));
    expect(result.current.draft).toBeNull();
    expect(result.current.hasDraft).toBe(false);
  });

  it('salva draft no localStorage', () => {
    const { result } = renderHook(() => useFormDraft('test-form'));
    act(() => {
      result.current.saveDraft({ name: 'João', age: 30 });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const raw = localStorage.getItem('draft:test-form');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.data.name).toBe('João');
    expect(result.current.hasDraft).toBe(true);
  });

  it('restaura draft salvo na inicialização', () => {
    const entry = { data: { name: 'Maria' }, savedAt: Date.now() };
    localStorage.setItem('draft:test-form', JSON.stringify(entry));
    const { result } = renderHook(() => useFormDraft('test-form'));
    expect(result.current.draft).toEqual({ name: 'Maria' });
    expect(result.current.hasDraft).toBe(true);
  });

  it('limpa draft com clearDraft', () => {
    const { result } = renderHook(() => useFormDraft('test-form'));
    act(() => {
      result.current.saveDraft({ name: 'João' });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.hasDraft).toBe(true);
    act(() => {
      result.current.clearDraft();
    });
    expect(result.current.hasDraft).toBe(false);
    expect(result.current.draft).toBeNull();
    expect(localStorage.getItem('draft:test-form')).toBeNull();
  });

  it('usa diferentes keys para diferentes formulários', () => {
    const { result: form1 } = renderHook(() => useFormDraft('form-a'));
    const { result: form2 } = renderHook(() => useFormDraft('form-b'));
    act(() => {
      form1.current.saveDraft({ value: 'A' });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(form1.current.hasDraft).toBe(true);
    expect(form2.current.hasDraft).toBe(false);
  });

  it('lida com JSON corrompido no localStorage', () => {
    localStorage.setItem('draft:broken', '{invalid json');
    const { result } = renderHook(() => useFormDraft('broken'));
    expect(result.current.draft).toBeNull();
  });

  it('remove draft expirado (mais de 7 dias)', () => {
    const oldDate = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const entry = { data: { name: 'Old' }, savedAt: oldDate };
    localStorage.setItem('draft:expired', JSON.stringify(entry));
    const { result } = renderHook(() => useFormDraft('expired'));
    expect(result.current.draft).toBeNull();
    expect(localStorage.getItem('draft:expired')).toBeNull();
  });

  it('sanitiza campos sensíveis', () => {
    const { result } = renderHook(() => useFormDraft('payment'));
    act(() => {
      result.current.saveDraft({ name: 'João', cpf: '123.456.789-00', card_number: '4111' });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const raw = localStorage.getItem('draft:payment');
    const parsed = JSON.parse(raw!);
    expect(parsed.data.name).toBe('João');
    expect(parsed.data.cpf).toBeUndefined();
    expect(parsed.data.card_number).toBeUndefined();
  });

  it('não salva sem timer expirado', () => {
    const { result } = renderHook(() => useFormDraft('test'));
    act(() => {
      result.current.saveDraft({ name: 'Temp' });
    });
    expect(localStorage.getItem('draft:test')).toBeNull();
  });
});
