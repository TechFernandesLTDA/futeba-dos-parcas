export type FavoriteSquadType = 'PAIR' | 'TEAM';

export interface FavoriteSquad {
  id: string;
  ownerId: string;
  name: string;
  type: FavoriteSquadType;
  playerIds: string[];
  playerNames: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FavoriteSquadInput {
  name: string;
  playerIds: string[];
  playerNames: string[];
}
