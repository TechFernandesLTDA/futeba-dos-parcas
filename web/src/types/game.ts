export type GameStatus = 'SCHEDULED' | 'CONFIRMED' | 'LIVE' | 'FINISHED' | 'CANCELLED';

export type FieldType = 'SOCIETY' | 'FUTSAL' | 'CAMPO' | 'AREIA';

export type ConfirmationStatus = 'CONFIRMED' | 'PENDING' | 'DECLINED';

export type PaymentStatus = 'PAID' | 'PENDING' | 'EXEMPT';

export type GameEventType = 'GOAL' | 'ASSIST' | 'SAVE' | 'YELLOW_CARD' | 'RED_CARD' | 'SUBSTITUTION';

export interface Confirmation {
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  position?: string;
  status: ConfirmationStatus;
  paymentStatus: PaymentStatus;
  team?: number;
  confirmedAt?: Date;
}

export interface GameEvent {
  id: string;
  type: GameEventType;
  playerId: string;
  playerName: string;
  team: number;
  minute: number;
  relatedPlayerId?: string;
  relatedPlayerName?: string;
  createdAt: Date;
}

export interface Game {
  id: string;
  title: string;
  description?: string;
  
  // Date & Time
  date: Date;
  time: string;
  endTime?: string;
  
  // Location
  locationId?: string;
  locationName: string;
  locationAddress?: string;
  latitude?: number;
  longitude?: number;
  
  // Status
  status: GameStatus;
  
  // Type
  fieldType: FieldType;
  gameType: string;
  
  // Players
  maxPlayers: number;
  playersCount: number;
  confirmations: Confirmation[];
  
  // Teams (if sorted)
  team1Name?: string;
  team2Name?: string;
  team1Score?: number;
  team2Score?: number;
  team1Players?: string[];
  team2Players?: string[];
  
  // Events (during game)
  events?: GameEvent[];
  
  // Price
  dailyPrice: number;
  pixKey?: string;
  
  // Group
  groupId: string;
  groupName: string;
  
  // Owner
  ownerId: string;
  ownerName: string;
  
  // Visibility
  isPublic: boolean;
  
  // MVP (after game)
  mvpId?: string;
  mvpName?: string;
  bolaMurchaId?: string;
  bolaMurchaName?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export const STATUS_CONFIG: Record<GameStatus, { label: string; color: string }> = {
  SCHEDULED: { label: 'Aberto', color: '#4CAF50' },
  CONFIRMED: { label: 'Fechado', color: '#2196F3' },
  LIVE: { label: 'Ao Vivo', color: '#F44336' },
  FINISHED: { label: 'Finalizado', color: '#9E9E9E' },
  CANCELLED: { label: 'Cancelado', color: '#9E9E9E' },
};

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  SOCIETY: 'Society',
  FUTSAL: 'Futsal',
  CAMPO: 'Campo',
  AREIA: 'Areia',
};
