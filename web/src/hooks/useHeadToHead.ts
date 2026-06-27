import { useQuery } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  documentId,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';
import { isGameWithinHeadToHeadPeriod, type HeadToHeadPeriod } from '../utils/headToHeadPeriod';

const logger = createLogger('useHeadToHead');

interface GameDoc {
  id: string;
  date: string;
  time: string;
  status: string;
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  groupId?: string;
  groupName?: string;
  dateTime?: { toDate?: () => Date };
}

interface TeamDoc {
  id: string;
  gameId: string;
  name: string;
  color: string;
  playerIds: string[];
  score: number;
}

interface ConfirmationDoc {
  id: string;
  gameId: string;
  userId: string;
  goals: number;
  assists: number;
  saves: number;
  isMvp: boolean;
  isBestGk: boolean;
  position: string;
  status: string;
}

export interface HeadToHeadMatch {
  gameId: string;
  date: string;
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  p1TeamName: string;
  p2TeamName: string;
  p1Goals: number;
  p1Assists: number;
  p2Goals: number;
  p2Assists: number;
  p1Won: boolean;
  p2Won: boolean;
  draw: boolean;
  sameTeam: boolean;
  p1Mvp: boolean;
  p2Mvp: boolean;
  groupName?: string;
}

export interface HeadToHeadStats {
  totalGames: number;
  gamesAgainst: number;
  gamesTogether: number;
  p1WinsAgainst: number;
  p2WinsAgainst: number;
  drawsAgainst: number;
  p1WinsTogether: number;
  p2WinsTogether: number;
  drawsTogether: number;
  p1TotalGoals: number;
  p2TotalGoals: number;
  p1TotalAssists: number;
  p2TotalAssists: number;
  p1MvpCount: number;
  p2MvpCount: number;
  p1WinRate: number;
  p2WinRate: number;
  matches: HeadToHeadMatch[];
}

async function fetchHeadToHead(
  player1Id: string,
  player2Id: string,
  period: HeadToHeadPeriod
): Promise<HeadToHeadStats> {
  const emptyStats: HeadToHeadStats = {
    totalGames: 0,
    gamesAgainst: 0,
    gamesTogether: 0,
    p1WinsAgainst: 0,
    p2WinsAgainst: 0,
    drawsAgainst: 0,
    p1WinsTogether: 0,
    p2WinsTogether: 0,
    drawsTogether: 0,
    p1TotalGoals: 0,
    p2TotalGoals: 0,
    p1TotalAssists: 0,
    p2TotalAssists: 0,
    p1MvpCount: 0,
    p2MvpCount: 0,
    p1WinRate: 0,
    p2WinRate: 0,
    matches: [],
  };

  const [p1ConfSnap, p2ConfSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, 'confirmations'),
        where('user_id', '==', player1Id),
        where('status', '==', 'CONFIRMED'),
        orderBy('game_id'),
        limit(500)
      )
    ),
    getDocs(
      query(
        collection(db, 'confirmations'),
        where('user_id', '==', player2Id),
        where('status', '==', 'CONFIRMED'),
        orderBy('game_id'),
        limit(500)
      )
    ),
  ]);

  const p1GameIds = new Set(p1ConfSnap.docs.map((d) => d.data().game_id as string));
  const p2GameIds = new Set(p2ConfSnap.docs.map((d) => d.data().game_id as string));

  const sharedGameIds = [...p1GameIds].filter((id) => p2GameIds.has(id));

  if (sharedGameIds.length === 0) return emptyStats;

  const gameChunks: string[][] = [];
  for (let i = 0; i < sharedGameIds.length; i += 10) {
    gameChunks.push(sharedGameIds.slice(i, i + 10));
  }

  const gameDocsMap = new Map<string, GameDoc>();
  const gameResults = await Promise.allSettled(
    gameChunks.map((chunk) =>
      getDocs(query(collection(db, 'games'), where(documentId(), 'in', chunk)))
    )
  );

  for (const result of gameResults) {
    if (result.status === 'rejected') {
      logger.error('Failed to fetch game chunk:', result.reason);
      continue;
    }
    for (const doc of result.value.docs) {
      const raw = doc.data();
      const data = snakeToCamel(raw) as Record<string, unknown>;
      gameDocsMap.set(doc.id, {
        id: doc.id,
        date: (data.date as string) || (raw.date as string) || '',
        time: (data.time as string) || (raw.time as string) || '',
        status: (data.status as string) || 'FINISHED',
        team1Name: (data.team1Name as string) || (raw.team1_name as string) || 'Time 1',
        team2Name: (data.team2Name as string) || (raw.team2_name as string) || 'Time 2',
        team1Score: (data.team1Score as number) ?? (raw.team1_score as number) ?? 0,
        team2Score: (data.team2Score as number) ?? (raw.team2_score as number) ?? 0,
        groupId: (data.groupId as string) || (raw.group_id as string) || undefined,
        groupName: (data.groupName as string) || (raw.group_name as string) || undefined,
        dateTime: data.dateTime as GameDoc['dateTime'],
      });
    }
  }

  const finishedGameIds = [...gameDocsMap.entries()]
    .filter(([, g]) => g.status === 'FINISHED' && isGameWithinHeadToHeadPeriod(g, period))
    .map(([id]) => id);

  if (finishedGameIds.length === 0) return emptyStats;

  const teamChunks: string[][] = [];
  for (let i = 0; i < finishedGameIds.length; i += 10) {
    teamChunks.push(finishedGameIds.slice(i, i + 10));
  }

  const teamDocsMap = new Map<string, TeamDoc[]>();
  const teamResults = await Promise.allSettled(
    teamChunks.map((chunk) =>
      getDocs(query(collection(db, 'teams'), where('game_id', 'in', chunk)))
    )
  );

  for (const result of teamResults) {
    if (result.status === 'rejected') {
      logger.error('Failed to fetch teams chunk:', result.reason);
      continue;
    }
    for (const doc of result.value.docs) {
      const raw = doc.data();
      const gameId = (raw.game_id as string) || '';
      const playerIds = (raw.player_ids as string[]) || [];
      const team: TeamDoc = {
        id: doc.id,
        gameId,
        name: (raw.name as string) || 'Time',
        color: (raw.color as string) || '',
        playerIds,
        score: (raw.score as number) || 0,
      };
      const existing = teamDocsMap.get(gameId) || [];
      existing.push(team);
      teamDocsMap.set(gameId, existing);
    }
  }

  const p1ConfMap = new Map<string, ConfirmationDoc>();
  for (const doc of p1ConfSnap.docs) {
    const raw = doc.data();
    const gameId = (raw.game_id as string) || '';
    if (finishedGameIds.includes(gameId)) {
      p1ConfMap.set(gameId, {
        id: doc.id,
        gameId,
        userId: (raw.user_id as string) || '',
        goals: (raw.goals as number) || 0,
        assists: (raw.assists as number) || 0,
        saves: (raw.saves as number) || 0,
        isMvp: (raw.is_mvp as boolean) || false,
        isBestGk: (raw.is_best_gk as boolean) || false,
        position: (raw.position as string) || 'FIELD',
        status: (raw.status as string) || 'CONFIRMED',
      });
    }
  }

  const p2ConfMap = new Map<string, ConfirmationDoc>();
  for (const doc of p2ConfSnap.docs) {
    const raw = doc.data();
    const gameId = (raw.game_id as string) || '';
    if (finishedGameIds.includes(gameId)) {
      p2ConfMap.set(gameId, {
        id: doc.id,
        gameId,
        userId: (raw.user_id as string) || '',
        goals: (raw.goals as number) || 0,
        assists: (raw.assists as number) || 0,
        saves: (raw.saves as number) || 0,
        isMvp: (raw.is_mvp as boolean) || false,
        isBestGk: (raw.is_best_gk as boolean) || false,
        position: (raw.position as string) || 'FIELD',
        status: (raw.status as string) || 'CONFIRMED',
      });
    }
  }

  const stats = { ...emptyStats };
  const matches: HeadToHeadMatch[] = [];

  for (const gameId of finishedGameIds) {
    const game = gameDocsMap.get(gameId);
    if (!game) continue;

    const p1Conf = p1ConfMap.get(gameId);
    const p2Conf = p2ConfMap.get(gameId);
    if (!p1Conf || !p2Conf) continue;

    const teams = teamDocsMap.get(gameId) || [];
    const p1Team = teams.find((t) => t.playerIds.includes(player1Id));
    const p2Team = teams.find((t) => t.playerIds.includes(player2Id));
    if (!p1Team || !p2Team) continue;

    const sameTeam = p1Team.id === p2Team.id;

    let p1Result: 'WIN' | 'LOSS' | 'DRAW' = 'DRAW';
    let p2Result: 'WIN' | 'LOSS' | 'DRAW' = 'DRAW';

    if (teams.length >= 2) {
      const team1 = teams[0];
      const team1Won = game.team1Score > game.team2Score;
      const draw = game.team1Score === game.team2Score;

      const p1OnTeam1 = p1Team.id === team1.id;
      const p2OnTeam1 = p2Team.id === team1.id;

      if (draw) {
        p1Result = 'DRAW';
        p2Result = 'DRAW';
      } else if (team1Won) {
        p1Result = p1OnTeam1 ? 'WIN' : 'LOSS';
        p2Result = p2OnTeam1 ? 'WIN' : 'LOSS';
      } else {
        p1Result = p1OnTeam1 ? 'LOSS' : 'WIN';
        p2Result = p2OnTeam1 ? 'LOSS' : 'WIN';
      }
    }

    const match: HeadToHeadMatch = {
      gameId,
      date: game.date,
      team1Name: game.team1Name,
      team2Name: game.team2Name,
      team1Score: game.team1Score,
      team2Score: game.team2Score,
      p1TeamName: p1Team.name,
      p2TeamName: p2Team.name,
      p1Goals: p1Conf.goals,
      p1Assists: p1Conf.assists,
      p2Goals: p2Conf.goals,
      p2Assists: p2Conf.assists,
      p1Won: p1Result === 'WIN',
      p2Won: p2Result === 'WIN',
      draw: p1Result === 'DRAW',
      sameTeam,
      p1Mvp: p1Conf.isMvp,
      p2Mvp: p2Conf.isMvp,
      groupName: game.groupName,
    };

    matches.push(match);
    stats.totalGames++;
    stats.p1TotalGoals += p1Conf.goals;
    stats.p2TotalGoals += p2Conf.goals;
    stats.p1TotalAssists += p1Conf.assists;
    stats.p2TotalAssists += p2Conf.assists;
    if (p1Conf.isMvp) stats.p1MvpCount++;
    if (p2Conf.isMvp) stats.p2MvpCount++;

    if (sameTeam) {
      stats.gamesTogether++;
      if (match.draw) {
        stats.drawsTogether++;
      } else if (p1Result === 'WIN') {
        stats.p1WinsTogether++;
        stats.p2WinsTogether++;
      }
    } else {
      stats.gamesAgainst++;
      if (match.draw) {
        stats.drawsAgainst++;
      } else if (p1Result === 'WIN') {
        stats.p1WinsAgainst++;
      } else if (p2Result === 'WIN') {
        stats.p2WinsAgainst++;
      }
    }
  }

  matches.sort((a, b) => b.date.localeCompare(a.date));
  stats.matches = matches;

  const gamesForRate = stats.gamesAgainst > 0 ? stats.gamesAgainst : stats.totalGames;
  if (gamesForRate > 0) {
    stats.p1WinRate = Math.round((stats.p1WinsAgainst / gamesForRate) * 100);
    stats.p2WinRate = Math.round((stats.p2WinsAgainst / gamesForRate) * 100);
  }

  return stats;
}

export function useHeadToHead(player1Id?: string, player2Id?: string, period: HeadToHeadPeriod = 'all') {
  const enabled = !!player1Id && !!player2Id && player1Id !== player2Id;

  const { data, isLoading, error, refetch } = useQuery<HeadToHeadStats, Error>({
    queryKey: ['headToHead', player1Id, player2Id, period],
    queryFn: () => fetchHeadToHead(player1Id!, player2Id!, period),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  return {
    stats: data || null,
    loading: isLoading,
    error: error ? error.message : null,
    refetch,
  };
}
