export interface AutoInviteMemberCandidate {
  id: string;
  data: () => {
    status?: unknown;
  };
}

export function getActiveMembersToInvite<T extends AutoInviteMemberCandidate>(
  memberDocs: T[],
  currentUserId: string,
): T[] {
  return memberDocs.filter((memberDoc) => {
    if (memberDoc.id === currentUserId) return false;
    return memberDoc.data().status === 'ACTIVE';
  });
}
