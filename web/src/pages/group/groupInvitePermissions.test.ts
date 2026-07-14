import { describe, expect, it } from 'vitest';
import { canInviteGroupMembers } from './groupInvitePermissions';

describe('canInviteGroupMembers', () => {
  it('permite o owner canônico do grupo', () => {
    expect(canInviteGroupMembers({ isGroupOwner: true })).toBe(true);
  });

  it.each(['OWNER', 'ADMIN'] as const)('permite membro %s ativo', (memberRole) => {
    expect(canInviteGroupMembers({
      isGroupOwner: false,
      memberRole,
      memberStatus: 'ACTIVE',
    })).toBe(true);
  });

  it('nega membro comum ativo', () => {
    expect(canInviteGroupMembers({
      isGroupOwner: false,
      memberRole: 'MEMBER',
      memberStatus: 'ACTIVE',
    })).toBe(false);
  });

  it.each(['INACTIVE', 'REMOVED', 'BLOCKED', 'BANNED'] as const)(
    'nega ADMIN com status %s',
    (memberStatus) => {
      expect(canInviteGroupMembers({
        isGroupOwner: false,
        memberRole: 'ADMIN',
        memberStatus,
      })).toBe(false);
    },
  );

  it('nega papel gerencial legado sem status ativo', () => {
    expect(canInviteGroupMembers({
      isGroupOwner: false,
      memberRole: 'ADMIN',
    })).toBe(false);
  });
});
