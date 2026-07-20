import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLeaguePlayersMock = vi.fn();

vi.mock('../services/cloudFunctions', () => ({
  getLeaguePlayers: (...args: unknown[]) => getLeaguePlayersMock(...args),
}));

import { getUsersByIds } from './userBatch';

describe('getUsersByIds', () => {
  beforeEach(() => {
    getLeaguePlayersMock.mockReset();
  });

  it('hidrata IDs pela projeção pública sem consultar Firestore diretamente', async () => {
    getLeaguePlayersMock.mockResolvedValue({
      data: {
        players: [{
          id: 'u1',
          userId: 'u1',
          userName: 'Jogador Público',
          userPhoto: 'https://img.test/u1.jpg',
          level: 2,
          experiencePoints: 300,
          points: 0,
          gamesPlayed: 0,
          wins: 0,
          goals: 0,
          assists: 0,
          mvpCount: 0,
          division: 'BRONZE',
          canReceiveInvites: true,
        }],
      },
    });

    const users = await getUsersByIds(['u1', 'u1']);

    expect(getLeaguePlayersMock).toHaveBeenCalledWith({
      userIds: ['u1'],
      limit: 1,
    });
    expect(users.get('u1')).toEqual(expect.objectContaining({
      id: 'u1',
      name: 'Jogador Público',
      photoUrl: 'https://img.test/u1.jpg',
    }));
    expect(users.get('u1')).not.toHaveProperty('email');
  });

  it('divide mais de 500 IDs sem descartar jogadores silenciosamente', async () => {
    getLeaguePlayersMock.mockResolvedValue({ data: { players: [] } });
    const userIds = Array.from({ length: 501 }, (_, index) => `u${index}`);

    await getUsersByIds(userIds);

    expect(getLeaguePlayersMock).toHaveBeenCalledTimes(2);
    expect(getLeaguePlayersMock.mock.calls[0][0].userIds).toHaveLength(500);
    expect(getLeaguePlayersMock.mock.calls[1][0]).toEqual({
      userIds: ['u500'],
      limit: 1,
    });
  });

  it('informa o grupo para incluir perfis dos membros autorizados', async () => {
    getLeaguePlayersMock.mockResolvedValue({ data: { players: [] } });

    await getUsersByIds(['u1'], 'group-1');

    expect(getLeaguePlayersMock).toHaveBeenCalledWith({
      userIds: ['u1'],
      limit: 1,
      groupId: 'group-1',
    });
  });
});
