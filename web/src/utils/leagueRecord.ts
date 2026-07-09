export interface LeagueRecordLike {
  gamesPlayed: number;
  wins: number;
  draws?: number;
  losses?: number;
}
export function getLeagueDrawCount(record: LeagueRecordLike): number {
  return Math.max(0, record.draws ?? 0);
}

export function getLeagueLossCount(record: LeagueRecordLike): number {
  if (typeof record.losses === 'number') {
    return Math.max(0, record.losses);
  }

  return Math.max(0, record.gamesPlayed - record.wins - getLeagueDrawCount(record));
}

export function getLeagueWinRate(record: LeagueRecordLike): number {
  if (record.gamesPlayed <= 0) {
    return 0;
  }

  return Math.round((record.wins / record.gamesPlayed) * 100);
}
