export type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type GroupType = 'PRIVATE' | 'PUBLIC';

export interface GroupMember {
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  favoriteTeam?: string;
  role: GroupRole;
  joinedAt: Date;
  totalGames: number;
  level: number;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  photoUrl?: string;
  
  // Type
  type: GroupType;
  isPublic: boolean;
  isPrivate?: boolean;
  
  // Owner
  ownerId: string;
  ownerName: string;
  
  // Members
  members: GroupMember[];
  memberCount: number;
  
  // Role do usuário atual (da subcoleção users/{uid}/groups)
  role?: GroupRole;
  
  // Config
  defaultFieldType?: string;
  defaultMaxPlayers?: number;
  defaultPrice?: number;
  
  // Stats
  totalGamesPlayed: number;
  nextGameDate?: Date;
  nextGameTitle?: string;
  
  // Invite
  inviteCode?: string;
  
  // Cashbox
  totalBalance?: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface GroupInvite {
  id: string;
  code: string;
  groupId: string;
  groupName: string;
  inviterId: string;
  inviterName: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
  usedBy?: string;
}

export interface CashboxTransaction {
  id: string;
  groupId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  category: string;
  userId: string;
  userName: string;
  date: Date;
  createdAt: Date;
}

export type OfficialGroupCategory = 'REGIAO' | 'DIA_SEMANA' | 'TIPO_CAMPO' | 'FAIXA_ETARIA';

export const OFFICIAL_GROUP_CATEGORY_LABELS: Record<OfficialGroupCategory, string> = {
  REGIAO: 'Região',
  DIA_SEMANA: 'Dia da Semana',
  TIPO_CAMPO: 'Tipo de Campo',
  FAIXA_ETARIA: 'Faixa Etária',
};

export interface OfficialGroup {
  id: string;
  name: string;
  description: string;
  category: OfficialGroupCategory;
  icon: string;
  memberCount: number;
  createdAt: Date;
}

export interface AmbassadorBadge {
  level: 'BRONZE' | 'PRATA' | 'OURO' | 'LENDA';
  inviteCount: number;
  earnedAt: Date;
}
