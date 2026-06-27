import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock httpsCallable antes de importar o módulo
const mockCallable = vi.fn();

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  connectFunctionsEmulator: vi.fn(),
  httpsCallable: vi.fn((_functions: unknown, name: string) => {
    // Retorna uma função callable mockada que registra o nome
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callable = (...args: any[]) => mockCallable(name, ...args);
    callable._name = name;
    return callable;
  }),
}));

vi.mock('./firebase', () => ({
  app: {},
  functions: {},
}));

// Importar após os mocks
import {
  setUserRole,
  softDeleteGame,
  softDeleteGroup,
  restoreDeletedGame,
  restoreDeletedGroup,
  updateUserPii,
} from './cloudFunctions';

describe('cloudFunctions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('setUserRole chama httpsCallable com parâmetros corretos', async () => {
    mockCallable.mockResolvedValue({ data: { success: true } });

    await setUserRole({ uid: 'user-123', role: 'ADMIN' });

    expect(mockCallable).toHaveBeenCalledWith('setUserRole', { uid: 'user-123', role: 'ADMIN' });
  });

  it('softDeleteGame chama com gameId correto', async () => {
    mockCallable.mockResolvedValue({ data: { success: true } });

    await softDeleteGame({ gameId: 'game-456' });

    expect(mockCallable).toHaveBeenCalledWith('softDeleteGame', { gameId: 'game-456' });
  });

  it('softDeleteGroup chama com groupId correto', async () => {
    mockCallable.mockResolvedValue({ data: { success: true } });

    await softDeleteGroup({ groupId: 'group-789' });

    expect(mockCallable).toHaveBeenCalledWith('softDeleteGroup', { groupId: 'group-789' });
  });

  it('restoreDeletedGame chama com gameId correto', async () => {
    mockCallable.mockResolvedValue({ data: { success: true } });

    await restoreDeletedGame({ gameId: 'game-456' });

    expect(mockCallable).toHaveBeenCalledWith('restoreDeletedGame', { gameId: 'game-456' });
  });

  it('restoreDeletedGroup chama com groupId correto', async () => {
    mockCallable.mockResolvedValue({ data: { success: true } });

    await restoreDeletedGroup({ groupId: 'group-789' });

    expect(mockCallable).toHaveBeenCalledWith('restoreDeletedGroup', { groupId: 'group-789' });
  });

  it('updateUserPii salva gênero pelo callable seguro', async () => {
    mockCallable.mockResolvedValue({ data: { success: true, updated: ['gender'] } });

    await updateUserPii({ gender: 'NOT_INFORMED' });

    expect(mockCallable).toHaveBeenCalledWith('updateUserPii', { gender: 'NOT_INFORMED' });
  });

  it('updateUserPii permite limpar gênero com null', async () => {
    mockCallable.mockResolvedValue({ data: { success: true, updated: ['gender'] } });

    await updateUserPii({ gender: null });

    expect(mockCallable).toHaveBeenCalledWith('updateUserPii', { gender: null });
  });

  it('propaga erros de função', async () => {
    const error = new Error('Function not found');
    mockCallable.mockRejectedValue(error);

    await expect(setUserRole({ uid: 'user-123', role: 'ADMIN' })).rejects.toThrow('Function not found');
  });

  it('retorna dados do resultado', async () => {
    mockCallable.mockResolvedValue({ data: { success: true, message: 'Role updated' } });

    const result = await setUserRole({ uid: 'user-123', role: 'ADMIN' });

    expect(result).toEqual({ data: { success: true, message: 'Role updated' } });
  });

  it('trata erros de rede', async () => {
    const networkError = new Error('Network error');
    (networkError as Error & { code: string }).code = 'functions/unavailable';
    mockCallable.mockRejectedValue(networkError);

    await expect(softDeleteGame({ gameId: 'game-123' })).rejects.toThrow('Network error');
  });
});
