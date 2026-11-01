import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockExportMyData = vi.hoisted(() => vi.fn());
const mockShowSuccess = vi.hoisted(() => vi.fn());
const mockShowWarning = vi.hoisted(() => vi.fn());
const mockShowError = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock('../services/cloudFunctions', () => ({
  exportMyData: mockExportMyData,
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showWarning: mockShowWarning,
    showError: mockShowError,
    showInfo: vi.fn(),
  }),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
  }),
}));

vi.mock('../utils/firebaseErrors', () => ({
  getFunctionErrorMessage: (_err: unknown, _fn: string, fallback?: string) => fallback ?? '',
}));

import {
  classifyExportMyDataError,
  exportFileName,
  useExportMyData,
} from './useExportMyData';

function payload(complete: boolean) {
  return {
    schema_version: 1,
    format: 'futeba-dos-parcas/export-my-data',
    generated_at: '2026-11-01T12:00:00.000Z',
    user_id: 'uid-1',
    complete,
    incomplete_sources: complete ? [] : [{ source: 'group_memberships', reason: 'missing-index' }],
    truncated_sources: [],
    counts: { profile: 1 },
    data: { profile: [{ document_id: 'uid-1', name: 'Fulano' }] },
  };
}

describe('useExportMyData (#4482)', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    createObjectURL = vi.fn(() => 'blob:export');
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('começa em idle', () => {
    const { result } = renderHook(() => useExportMyData());
    expect(result.current.status).toBe('idle');
    expect(result.current.errorMessage).toBeNull();
  });

  it('baixa o JSON com nome datado, revoga a URL e mostra sucesso', async () => {
    mockExportMyData.mockResolvedValue({ data: payload(true) });
    const { result } = renderHook(() => useExportMyData());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('success');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json');
    const parsed = JSON.parse(await blob.text());
    expect(parsed.user_id).toBe('uid-1');
    expect(parsed.data.profile[0].name).toBe('Fulano');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toMatch(/^futeba-dos-parcas-meus-dados-\d{4}-\d{2}-\d{2}\.json$/);
    expect(anchor.isConnected).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export');

    expect(mockShowSuccess).toHaveBeenCalledWith('Arquivo com seus dados baixado.');
    expect(mockShowWarning).not.toHaveBeenCalled();
  });

  it('exportação parcial baixa o arquivo e avisa', async () => {
    mockExportMyData.mockResolvedValue({ data: payload(false) });
    const { result } = renderHook(() => useExportMyData());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('success');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(mockShowWarning).toHaveBeenCalledWith(
      expect.stringContaining('algumas partes não puderam ser incluídas'),
    );
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });

  it('limite diário vira mensagem própria, sem download', async () => {
    mockExportMyData.mockRejectedValue({ code: 'functions/resource-exhausted' });
    const { result } = renderHook(() => useExportMyData());

    await act(async () => {
      await result.current.start();
    });

    const expected = 'Você atingiu o limite de 3 exportações por dia. Tente de novo amanhã.';
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe(expected);
    expect(mockShowError).toHaveBeenCalledWith(expected);
    expect(mockLoggerError).toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('arquivo grande demais vira mensagem própria', async () => {
    mockExportMyData.mockRejectedValue({
      code: 'functions/resource-exhausted',
      details: { reason: 'export-too-large' },
    });
    const { result } = renderHook(() => useExportMyData());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toContain('tamanho máximo');
  });

  it('erro genérico usa a mensagem padrão e permite tentar de novo', async () => {
    mockExportMyData.mockRejectedValueOnce({ code: 'functions/internal' });
    const { result } = renderHook(() => useExportMyData());

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe(
      'Não foi possível gerar o arquivo com seus dados. Tente de novo em instantes.',
    );

    mockExportMyData.mockResolvedValueOnce({ data: payload(true) });
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('success');
    expect(result.current.errorMessage).toBeNull();
  });

  it('falha ao montar o arquivo vira erro com feedback', async () => {
    mockExportMyData.mockResolvedValue({ data: payload(true) });
    createObjectURL.mockImplementation(() => {
      throw new Error('sem blob');
    });
    const { result } = renderHook(() => useExportMyData());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('error');
    expect(mockShowError).toHaveBeenCalled();
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });
});

describe('classifyExportMyDataError', () => {
  it('separa limite diário, tamanho e outros', () => {
    expect(classifyExportMyDataError({ code: 'resource-exhausted' })).toBe('rate-limited');
    expect(
      classifyExportMyDataError({
        code: 'functions/resource-exhausted',
        details: { reason: 'export-too-large' },
      }),
    ).toBe('too-large');
    expect(classifyExportMyDataError({ code: 'functions/unauthenticated' })).toBe('other');
    expect(classifyExportMyDataError(new Error('x'))).toBe('other');
    expect(classifyExportMyDataError(null)).toBe('other');
  });
});

describe('exportFileName', () => {
  it('usa a data local no formato AAAA-MM-DD', () => {
    expect(exportFileName(new Date(2026, 0, 5, 23, 59))).toBe(
      'futeba-dos-parcas-meus-dados-2026-01-05.json',
    );
  });
});
