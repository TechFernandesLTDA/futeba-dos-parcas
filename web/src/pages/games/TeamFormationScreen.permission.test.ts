import { describe, expect, it } from 'vitest';
import { canUserFormTeams } from '../../utils/teamFormationPermissions';

describe('canUserFormTeams (Onda C6 - Decisão D8)', () => {
  const game = {
    ownerId: 'owner-123',
    coOrganizers: ['co-org-1', 'co-org-2'],
  };

  it('permite que o owner do jogo forme times', () => {
    expect(canUserFormTeams({ id: 'owner-123' }, game)).toBe(true);
    expect(canUserFormTeams({ uid: 'owner-123' }, game)).toBe(true);
  });

  it('permite que co-organizadores formem times (camelCase)', () => {
    expect(canUserFormTeams({ id: 'co-org-1' }, game)).toBe(true);
    expect(canUserFormTeams({ uid: 'co-org-2' }, game)).toBe(true);
  });

  it('permite que co-organizadores formem times (snake_case)', () => {
    const snakeGame = {
      owner_id: 'owner-456',
      co_organizers: ['co-snake-1'],
    };
    expect(canUserFormTeams({ id: 'co-snake-1' }, snakeGame)).toBe(true);
  });

  it('permite que administrador global forme times', () => {
    expect(canUserFormTeams({ id: 'admin-999', role: 'ADMIN' }, game)).toBe(true);
  });

  it('bloqueia jogadores comuns que nao sao co-organizadores', () => {
    expect(canUserFormTeams({ id: 'stranger-999' }, game)).toBe(false);
  });

  it('bloqueia quando usuario ou jogo sao nulos/indefinidos', () => {
    expect(canUserFormTeams(null, game)).toBe(false);
    expect(canUserFormTeams(undefined, game)).toBe(false);
    expect(canUserFormTeams({ id: 'owner-123' }, null)).toBe(false);
    expect(canUserFormTeams({ id: 'owner-123' }, undefined)).toBe(false);
    expect(canUserFormTeams({}, game)).toBe(false);
  });
});
