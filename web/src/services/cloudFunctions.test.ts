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

vi.mock('./firebaseFunctions', () => ({
  functions: {},
}));

// Importar após os mocks
import {
  setUserRole,
  softDeleteGame,
  softDeleteGroup,
  restoreDeletedGame,
  restoreDeletedGroup,
  startGameLifecycle,
  finishGameLifecycle,
  submitLiveGameEvent,
  deleteLiveGameEvent,
  reviewHeldGameRewards,
  submitMvpVotes,
  submitDirectMessage,
  submitContentReport,
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

  it('submitMvpVotes chama callable batch com votos por categoria', async () => {
    mockCallable.mockResolvedValue({ data: { success: true, voteIds: ['game-1_u1_MVP'] } });

    await submitMvpVotes({
      gameId: 'game-1',
      votes: [
        { category: 'MVP', votedPlayerId: 'u2' },
        { category: 'WORST', votedPlayerId: 'u3' },
      ],
    });

    expect(mockCallable).toHaveBeenCalledWith('submitMvpVotes', {
      gameId: 'game-1',
      votes: [
        { category: 'MVP', votedPlayerId: 'u2' },
        { category: 'WORST', votedPlayerId: 'u3' },
      ],
    });
  });

  it('submitDirectMessage chama callable com payload de mensagem direta', async () => {
    mockCallable.mockResolvedValue({ data: { messageId: 'msg-1' } });

    await submitDirectMessage({
      chatId: 'chat-1',
      text: 'Bora jogar?',
    });

    expect(mockCallable).toHaveBeenCalledWith('submitDirectMessage', {
      chatId: 'chat-1',
      text: 'Bora jogar?',
    });
  });

  it('submitContentReport chama callable com payload de denuncia', async () => {
    mockCallable.mockResolvedValue({ data: { reportId: 'report-1' } });

    await submitContentReport({
      targetType: 'group_wall_post',
      groupId: 'group-1',
      postId: 'post-1',
      reason: 'inappropriate_content',
    });

    expect(mockCallable).toHaveBeenCalledWith('submitContentReport', {
      targetType: 'group_wall_post',
      groupId: 'group-1',
      postId: 'post-1',
      reason: 'inappropriate_content',
    });
  });

  it('startGameLifecycle chama callable com gameId', async () => {
    mockCallable.mockResolvedValue({ data: { success: true, status: 'LIVE' } });

    await startGameLifecycle({ gameId: 'game-1' });

    expect(mockCallable).toHaveBeenCalledWith('startGameLifecycle', { gameId: 'game-1' });
  });

  it('finishGameLifecycle chama callable com gameId', async () => {
    mockCallable.mockResolvedValue({ data: { success: true, status: 'FINISHED' } });

    await finishGameLifecycle({ gameId: 'game-1' });

    expect(mockCallable).toHaveBeenCalledWith('finishGameLifecycle', { gameId: 'game-1' });
  });

  it('submitLiveGameEvent chama callable com payload validado', async () => {
    mockCallable.mockResolvedValue({ data: { success: true, eventId: 'evt-1' } });

    await submitLiveGameEvent({
      gameId: 'game-1',
      eventType: 'GOAL',
      playerId: 'user-2',
      playerName: 'Renan',
      teamId: 'team-1',
      minute: 12,
    });

    expect(mockCallable).toHaveBeenCalledWith('submitLiveGameEvent', {
      gameId: 'game-1',
      eventType: 'GOAL',
      playerId: 'user-2',
      playerName: 'Renan',
      teamId: 'team-1',
      minute: 12,
    });
  });

  it('deleteLiveGameEvent chama callable com gameId e eventId', async () => {
    mockCallable.mockResolvedValue({ data: { success: true, reverted: true } });

    await deleteLiveGameEvent({
      gameId: 'game-1',
      eventId: 'evt-1',
    });

    expect(mockCallable).toHaveBeenCalledWith('deleteLiveGameEvent', {
      gameId: 'game-1',
      eventId: 'evt-1',
    });
  });

  it('reviewHeldGameRewards chama callable com ação e motivo', async () => {
    mockCallable.mockResolvedValue({ data: { success: true, newStatus: 'ELIGIBLE' } });

    await reviewHeldGameRewards({
      gameId: 'game-1',
      action: 'APPROVE',
      reason: 'Evidências complementares conferidas.',
    });

    expect(mockCallable).toHaveBeenCalledWith('reviewHeldGameRewards', {
      gameId: 'game-1',
      action: 'APPROVE',
      reason: 'Evidências complementares conferidas.',
    });
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
