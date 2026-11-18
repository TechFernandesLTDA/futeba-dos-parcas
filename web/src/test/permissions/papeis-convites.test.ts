/**
 * Permissões de convite, formação de times e disparo de convites automáticos.
 *
 * Papéis cobertos: dono do grupo, ADMIN do grupo, OWNER/ADMIN/MEMBER com status,
 * ADMIN global (role do usuário), membro comum, visitante (sem vínculo) e usuário
 * de outro grupo (sem vínculo com o grupo consultado).
 */
import { describe, expect, it } from 'vitest';
import { canInviteGroupMembers } from '../../pages/group/groupInvitePermissions';
import { canUserFormTeams, type RawGameOwner } from '../../utils/teamFormationPermissions';
import { getActiveMembersToInvite, type AutoInviteMemberCandidate } from '../../utils/autoInviteMembers';

const DONO = 'user-owner';
const ADMIN = 'user-admin';
const MEMBRO = 'user-member';
const VISITANTE = 'user-visitor';
const OUTRO_GRUPO = 'user-other-group';

describe('canInviteGroupMembers: quem pode convidar para o grupo', () => {
  it('dono do grupo convida, mesmo sem vínculo de membro registrado', () => {
    expect(canInviteGroupMembers({ isGroupOwner: true })).toBe(true);
  });

  it('ADMIN ativo do grupo convida', () => {
    expect(canInviteGroupMembers({
      isGroupOwner: false,
      memberRole: 'ADMIN',
      memberStatus: 'ACTIVE',
    })).toBe(true);
  });

  it('OWNER ativo (dono registrado como membro) convida', () => {
    expect(canInviteGroupMembers({
      isGroupOwner: false,
      memberRole: 'OWNER',
      memberStatus: 'ACTIVE',
    })).toBe(true);
  });

  it('membro comum ativo NÃO convida', () => {
    expect(canInviteGroupMembers({
      isGroupOwner: false,
      memberRole: 'MEMBER',
      memberStatus: 'ACTIVE',
    })).toBe(false);
  });

  it('ADMIN com status BANNED NÃO convida (vínculo revogado)', () => {
    expect(canInviteGroupMembers({
      isGroupOwner: false,
      memberRole: 'ADMIN',
      memberStatus: 'BANNED',
    })).toBe(false);
  });

  it('ADMIN com status REMOVED NÃO convida', () => {
    expect(canInviteGroupMembers({
      isGroupOwner: false,
      memberRole: 'ADMIN',
      memberStatus: 'REMOVED',
    })).toBe(false);
  });

  it('visitante sem vínculo NÃO convida', () => {
    expect(canInviteGroupMembers({ isGroupOwner: false })).toBe(false);
  });
});

describe('canUserFormTeams: quem pode montar os times da partida', () => {
  const jogo: RawGameOwner = {
    ownerId: DONO,
    coOrganizers: [ADMIN],
    team1Players: [],
    team2Players: [],
  };

  it('dono do jogo forma times', () => {
    expect(canUserFormTeams({ id: DONO }, jogo)).toBe(true);
  });

  it('co-organizador do jogo forma times', () => {
    expect(canUserFormTeams({ id: ADMIN }, jogo)).toBe(true);
  });

  it('ADMIN global forma times mesmo sem ser dono nem co-organizador', () => {
    expect(canUserFormTeams({ id: OUTRO_GRUPO, role: 'ADMIN' }, jogo)).toBe(true);
  });

  it('membro comum NÃO forma times', () => {
    expect(canUserFormTeams({ id: MEMBRO, role: 'PLAYER' }, jogo)).toBe(false);
  });

  it('visitante sem vínculo com o jogo NÃO forma times', () => {
    expect(canUserFormTeams({ id: VISITANTE, role: 'PLAYER' }, jogo)).toBe(false);
  });

  it('usuário de outro grupo NÃO forma times', () => {
    expect(canUserFormTeams({ id: OUTRO_GRUPO, role: 'PLAYER' }, jogo)).toBe(false);
  });

  it('usuário nulo NÃO forma times', () => {
    expect(canUserFormTeams(null, jogo)).toBe(false);
  });

  it('jogo nulo NÃO permite formar times', () => {
    expect(canUserFormTeams({ id: DONO }, null)).toBe(false);
  });

  it('aceita campos snake_case (owner_id / co_organizers) vindos do Firestore', () => {
    const raw: RawGameOwner = { owner_id: DONO, co_organizers: [ADMIN] };
    expect(canUserFormTeams({ id: DONO }, raw)).toBe(true);
    expect(canUserFormTeams({ id: ADMIN }, raw)).toBe(true);
    expect(canUserFormTeams({ id: MEMBRO }, raw)).toBe(false);
  });

  it('usa uid quando o id não está presente', () => {
    expect(canUserFormTeams({ uid: DONO }, jogo)).toBe(true);
  });
});

describe('getActiveMembersToInvite: convite automático só para membros ativos', () => {
  const candidato = (id: string, status: unknown): AutoInviteMemberCandidate => ({
    id,
    data: () => ({ status }),
  });

  it('nunca inclui o próprio usuário que está convidando', () => {
    const resultado = getActiveMembersToInvite(
      [candidato(DONO, 'ACTIVE'), candidato(MEMBRO, 'ACTIVE')],
      DONO,
    );
    expect(resultado.map((m) => m.id)).toEqual([MEMBRO]);
  });

  it('exclui membros com status INACTIVE', () => {
    const resultado = getActiveMembersToInvite(
      [candidato(MEMBRO, 'INACTIVE'), candidato(ADMIN, 'ACTIVE')],
      DONO,
    );
    expect(resultado.map((m) => m.id)).toEqual([ADMIN]);
  });

  it('mantém todos os membros ativos de outros usuários', () => {
    const resultado = getActiveMembersToInvite(
      [candidato(MEMBRO, 'ACTIVE'), candidato(ADMIN, 'ACTIVE')],
      DONO,
    );
    expect(resultado).toHaveLength(2);
  });
});
