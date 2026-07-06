import { describe, expect, it } from 'vitest';
import { getActiveMembersToInvite } from './autoInviteMembers';

describe('getActiveMembersToInvite', () => {
  it('seleciona somente membros ACTIVE e exclui o organizador', () => {
    const members = [
      { id: 'owner', data: () => ({ status: 'ACTIVE' }) },
      { id: 'active-member', data: () => ({ status: 'ACTIVE' }) },
      { id: 'inactive-member', data: () => ({ status: 'INACTIVE' }) },
      { id: 'removed-member', data: () => ({ status: 'REMOVED' }) },
      { id: 'legacy-no-status', data: () => ({}) },
    ];

    expect(getActiveMembersToInvite(members, 'owner').map((member) => member.id)).toEqual([
      'active-member',
    ]);
  });
});
