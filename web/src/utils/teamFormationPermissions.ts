export interface RawGameOwner {
  ownerId?: string;
  owner_id?: string;
  coOrganizers?: string[];
  co_organizers?: string[];
  team1Players?: string[];
  team1_players?: string[];
  team2Players?: string[];
  team2_players?: string[];
  teamFormationVersion?: number;
  team_formation_version?: number;
}

export function canUserFormTeams(
  currentUser: { id?: string; uid?: string; role?: string } | null | undefined,
  gameData: RawGameOwner | null | undefined,
): boolean {
  if (!currentUser || !gameData) return false;
  const currentUserId = currentUser.id || currentUser.uid;
  if (!currentUserId) return false;
  const ownerId = gameData.ownerId || gameData.owner_id;
  if (currentUserId === ownerId) return true;
  if (currentUser.role === 'ADMIN') return true;
  const coOrgs = gameData.coOrganizers || gameData.co_organizers || [];
  return coOrgs.includes(currentUserId);
}
