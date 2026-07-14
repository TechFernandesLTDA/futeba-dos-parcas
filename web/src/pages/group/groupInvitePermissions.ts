import type { GroupMemberStatus, GroupRole } from '../../types/group';

interface GroupInviteAuthority {
  isGroupOwner: boolean;
  memberRole?: GroupRole;
  memberStatus?: GroupMemberStatus;
}

export function canInviteGroupMembers({
  isGroupOwner,
  memberRole,
  memberStatus,
}: GroupInviteAuthority): boolean {
  if (isGroupOwner) return true;

  return memberStatus === 'ACTIVE' && (memberRole === 'OWNER' || memberRole === 'ADMIN');
}
