import { getLeaguePlayers } from '../services/cloudFunctions';

export type BatchedUserData = Record<string, unknown> & {
  id: string;
};

const PUBLIC_PROJECTION_BATCH_LIMIT = 500;

export async function getUsersByIds(userIds: string[]): Promise<Map<string, BatchedUserData>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const users = new Map<string, BatchedUserData>();
  if (uniqueIds.length === 0) return users;

  const batches = Array.from(
    { length: Math.ceil(uniqueIds.length / PUBLIC_PROJECTION_BATCH_LIMIT) },
    (_, index) => uniqueIds.slice(
      index * PUBLIC_PROJECTION_BATCH_LIMIT,
      (index + 1) * PUBLIC_PROJECTION_BATCH_LIMIT,
    ),
  );
  const responses = await Promise.all(batches.map((userIdsBatch) => getLeaguePlayers({
    userIds: userIdsBatch,
    limit: userIdsBatch.length,
  })));

  responses.flatMap((response) => response.data.players).forEach((player) => {
    users.set(player.userId, {
      id: player.userId,
      name: player.userName,
      photoUrl: player.userPhoto,
      favoriteTeam: player.favoriteTeam,
      level: player.level,
      experiencePoints: player.experiencePoints,
      preferredPosition: player.preferredPosition,
      strikerRating: player.strikerRating ?? 0,
      midRating: player.midRating ?? 0,
      defenderRating: player.defenderRating ?? 0,
      gkRating: player.gkRating ?? 0,
      autoStrikerRating: player.autoStrikerRating ?? 0,
      autoMidRating: player.autoMidRating ?? 0,
      autoDefenderRating: player.autoDefenderRating ?? 0,
      autoGkRating: player.autoGkRating ?? 0,
      autoRatingSamples: player.autoRatingSamples ?? 0,
      isSearchable: true,
    });
  });

  return users;
}
