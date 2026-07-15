import type { LeaguePlayerSummary } from '../services/cloudFunctions';
import type { User } from '../types/user';
import type { ReinforcementCandidateSignals } from './positionReinforcements';

export interface PublicPlayerSearchResult {
  id: string;
  name: string;
  photoUrl?: string;
}

export function toPublicPlayerSearchResult(
  player: LeaguePlayerSummary,
): PublicPlayerSearchResult {
  return {
    id: player.userId,
    name: player.userName || 'Jogador',
    photoUrl: player.userPhoto,
  };
}

export function toReinforcementUser(player: LeaguePlayerSummary): User {
  return {
    id: player.userId,
    email: '',
    name: player.userName || 'Jogador',
    photoUrl: player.userPhoto,
    role: 'PLAYER',
    level: player.level ?? 0,
    experiencePoints: player.experiencePoints ?? 0,
    strikerRating: player.strikerRating ?? 0,
    midRating: player.midRating ?? 0,
    defenderRating: player.defenderRating ?? 0,
    gkRating: player.gkRating ?? 0,
    strikerRatingSet: player.strikerRatingSet ?? false,
    midRatingSet: player.midRatingSet ?? false,
    defenderRatingSet: player.defenderRatingSet ?? false,
    gkRatingSet: player.gkRatingSet ?? false,
    autoStrikerRating: player.autoStrikerRating ?? 0,
    autoMidRating: player.autoMidRating ?? 0,
    autoDefenderRating: player.autoDefenderRating ?? 0,
    autoGkRating: player.autoGkRating ?? 0,
    autoRatingSamples: player.autoRatingSamples ?? 0,
    preferredPosition: player.preferredPosition,
    preferredFieldTypes: [],
    favoriteTeam: player.favoriteTeam,
    totalGames: player.gamesPlayed ?? 0,
    totalGoals: player.goals ?? 0,
    totalAssists: player.assists ?? 0,
    totalWins: player.wins ?? 0,
    totalDraws: 0,
    totalLosses: 0,
    totalSaves: 0,
    mvpCount: player.mvpCount ?? 0,
    yellowCards: 0,
    redCards: 0,
    isSearchable: true,
    isVerified: false,
    isMock: player.isMock,
    demoData: player.demoData,
    dataOrigin: player.dataOrigin as User['dataOrigin'],
    seedId: player.seedId,
    demoDataReason: player.demoDataReason,
    inviteCount: 0,
    currentStreak: 0,
    bestStreak: 0,
  };
}

export function toReinforcementSignals(
  player: LeaguePlayerSummary,
): ReinforcementCandidateSignals {
  return {
    isLookingToday: player.lookingForGameToday === true,
    hasRecentPresence: player.hasRecentPresence === true,
  };
}
