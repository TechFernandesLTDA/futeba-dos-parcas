import type { PreferredPosition } from '../../types/user';

interface EditablePublicProfile {
  nickname: string;
  preferredPosition?: PreferredPosition;
  bio: string;
  favoriteTeam?: string | null;
  strikerRating: number;
  midRating: number;
  defenderRating: number;
  gkRating: number;
}

/**
 * Monta somente os campos públicos editáveis em users/{uid}.
 * PII usa updateUserPii e timestamps protegidos são server-only nas Rules.
 */
export function buildPublicProfileUpdate(
  profile: EditablePublicProfile,
  trimmedName: string,
) {
  return {
    name: trimmedName,
    nickname: profile.nickname,
    // Firestore rejeita `undefined`; ausência de preferência usa null.
    preferred_position: profile.preferredPosition || null,
    bio: profile.bio,
    favorite_team: profile.favoriteTeam ?? null,
    striker_rating: profile.strikerRating,
    mid_rating: profile.midRating,
    defender_rating: profile.defenderRating,
    gk_rating: profile.gkRating,
    striker_rating_set: true,
    mid_rating_set: true,
    defender_rating_set: true,
    gk_rating_set: true,
  };
}
