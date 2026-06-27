import type { FavoriteSquad, FavoriteSquadInput, FavoriteSquadType } from '../types/favoriteSquad';

export const FAVORITE_SQUAD_MIN_PLAYERS = 2;
export const FAVORITE_SQUAD_MAX_PLAYERS = 8;
export const FAVORITE_SQUAD_MAX_NAME_LENGTH = 60;

export interface SquadPlayer {
  id: string;
  name: string;
}

export function getFavoriteSquadType(playerCount: number): FavoriteSquadType {
  return playerCount === 2 ? 'PAIR' : 'TEAM';
}

export function normalizeFavoriteSquadInput(input: FavoriteSquadInput): FavoriteSquadInput {
  const players = input.playerIds
    .map((id, index) => ({ id: id.trim(), name: input.playerNames[index]?.trim() || 'Jogador' }))
    .filter((player) => player.id.length > 0);
  const playersById = new Map<string, SquadPlayer>();
  for (const player of players) {
    if (!playersById.has(player.id)) {
      playersById.set(player.id, player);
    }
  }
  const uniquePlayers = Array.from(playersById.values());

  return {
    name: input.name.trim().slice(0, FAVORITE_SQUAD_MAX_NAME_LENGTH),
    playerIds: uniquePlayers.map((player) => player.id),
    playerNames: uniquePlayers.map((player) => player.name),
  };
}

export function validateFavoriteSquadInput(input: FavoriteSquadInput): string | null {
  const normalized = normalizeFavoriteSquadInput(input);
  if (!normalized.name) return 'name';
  if (normalized.playerIds.length < FAVORITE_SQUAD_MIN_PLAYERS) return 'minPlayers';
  if (normalized.playerIds.length > FAVORITE_SQUAD_MAX_PLAYERS) return 'maxPlayers';
  if (normalized.playerIds.length !== normalized.playerNames.length) return 'playerNames';
  return null;
}

export function getApplicableFavoriteSquads<T extends SquadPlayer>(
  squads: FavoriteSquad[],
  players: T[],
): FavoriteSquad[] {
  const playerIds = new Set(players.map((player) => player.id));
  return squads.filter((squad) => squad.playerIds.every((playerId) => playerIds.has(playerId)));
}

export function applyFavoriteSquadToTeams<T extends SquadPlayer>(
  squad: FavoriteSquad,
  teamA: T[],
  teamB: T[],
): { teamA: T[]; teamB: T[]; targetTeam: 'A' | 'B' } {
  const squadIds = new Set(squad.playerIds);
  const squadPlayers = [...teamA, ...teamB].filter((player) => squadIds.has(player.id));
  const teamAMatches = teamA.filter((player) => squadIds.has(player.id)).length;
  const teamBMatches = teamB.filter((player) => squadIds.has(player.id)).length;
  const targetTeam = teamBMatches > teamAMatches ? 'B' : 'A';

  if (targetTeam === 'A') {
    return {
      targetTeam,
      teamA: [...teamA.filter((player) => !squadIds.has(player.id)), ...squadPlayers],
      teamB: teamB.filter((player) => !squadIds.has(player.id)),
    };
  }

  return {
    targetTeam,
    teamA: teamA.filter((player) => !squadIds.has(player.id)),
    teamB: [...teamB.filter((player) => !squadIds.has(player.id)), ...squadPlayers],
  };
}
