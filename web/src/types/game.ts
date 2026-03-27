export type GameStatus = 'SCHEDULED' | 'CONFIRMED' | 'LIVE' | 'FINISHED' | 'CANCELLED';

export type GameVisibility = 'GROUP_ONLY' | 'PUBLIC_CLOSED' | 'PUBLIC_OPEN';

export type FieldType = 'SOCIETY' | 'FUTSAL' | 'CAMPO' | 'AREIA';

export type ConfirmationStatus = 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'WAITLIST' | 'ON_THE_WAY' | 'CHECKED_IN';

export type PaymentStatus = 'PAID' | 'PENDING' | 'EXEMPT' | 'PARTIAL';

export type PlayerPosition = 'GOALKEEPER' | 'FIELD';

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';

export type GameEventType = 'GOAL' | 'ASSIST' | 'SAVE' | 'YELLOW_CARD' | 'RED_CARD' | 'SUBSTITUTION';

export interface GameConfirmation {
  id: string;
  gameId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  position: PlayerPosition;
  status: ConfirmationStatus;
  paymentStatus: PaymentStatus;
  isCasualPlayer: boolean;
  nickname?: string;
  
  // Live Stats
  goals: number;
  assists: number;
  saves: number;
  yellowCards: number;
  redCards: number;
  
  // Awards
  xpEarned: number;
  isMvp: boolean;
  isBestGk: boolean;
  isWorstPlayer: boolean;
  
  // Payment
  partialPayment: number;
  wasPresent: boolean;
  
  // Check-in
  isOnTheWay: boolean;
  etaMinutes?: number;
  checkedIn: boolean;
  checkedInAt?: Date;
  
  // Guest
  isGuest: boolean;
  inviteLinkId?: string;
  
  // Order
  confirmationOrder: number;
  playerAttendanceRate?: number;
  
  confirmedAt?: Date;
  createdAt?: Date;
}

export interface Team {
  id: string;
  gameId: string;
  name: string;
  color: string;
  playerIds: string[];
  score: number;
}

export interface GameEvent {
  id: string;
  gameId: string;
  eventType: GameEventType;
  playerId: string;
  playerName: string;
  teamId: string;
  assistedById?: string;
  assistedByName?: string;
  minute: number;
  createdBy: string;
  createdAt: Date;
}

export interface LiveGameScore {
  id: string;
  gameId: string;
  team1Id: string;
  team1Score: number;
  team2Id: string;
  team2Score: number;
  startedAt?: Date;
  finishedAt?: Date;
}

export interface LivePlayerStats {
  id: string;
  gameId: string;
  playerId: string;
  playerName: string;
  teamId: string;
  position: PlayerPosition;
  goals: number;
  assists: number;
  saves: number;
  yellowCards: number;
  redCards: number;
  isPlaying: boolean;
}

export interface Game {
  id: string;
  scheduleId?: string;
  
  // Date & Time
  date: string;
  time: string;
  endTime?: string;
  dateTime?: Date;
  
  // Status
  status: GameStatus;
  visibility: GameVisibility;
  isPublic: boolean;
  
  // Players
  maxPlayers: number;
  maxGoalkeepers: number;
  playersCount: number;
  goalkeepersCount: number;
  players: string[];
  
  // Type
  gameType: string;
  fieldType: FieldType;
  recurrence: 'none' | 'weekly' | 'biweekly' | 'monthly';
  
  // Location
  locationId: string;
  fieldId?: string;
  locationName: string;
  locationAddress: string;
  locationLat?: number;
  locationLng?: number;
  fieldName?: string;
  
  // Price
  dailyPrice: number;
  totalCost: number;
  pixKey: string;
  pixKeyType: PixKeyType;
  pixBeneficiaryName: string;
  pixPaymentEnabled: boolean;
  
  // Teams
  numberOfTeams: number;
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  
  // Group
  groupId?: string;
  groupName?: string;
  
  // Owner
  ownerId: string;
  ownerName: string;
  coOrganizers: string[];
  
  // Confirmation
  confirmationClosesAt?: string;
  confirmationDeadlineHours: number;
  autoCloseHours?: number;
  autoClosed: boolean;
  
  // Rules
  rules: string;
  
  // Check-in
  requireCheckin: boolean;
  checkinRadiusMeters: number;
  
  // Waitlist
  waitlistAutoPromoteMinutes: number;
  
  // MVP Voting
  mvpId?: string;
  bestGkId?: string;
  worstPlayerId?: string;
  votingDeadline?: Date;
  votingConcluded: boolean;
  
  // XP
  xpProcessed: boolean;
  xpProcessedAt?: Date;
  postGameReportGenerated: boolean;
  
  // Cancel
  cancelledBy?: string;
  cancelReason?: string;
  
  // Soft Delete
  deletedAt?: Date;
  deletedBy?: string;
  
  createdAt?: Date;
  updatedAt?: Date;
}

export const STATUS_CONFIG: Record<GameStatus, { label: string; color: string; bgColor: string }> = {
  SCHEDULED: { label: 'Aberto', color: '#4CAF50', bgColor: '#E8F5E9' },
  CONFIRMED: { label: 'Fechado', color: '#2196F3', bgColor: '#E3F2FD' },
  LIVE: { label: 'Ao Vivo', color: '#F44336', bgColor: '#FFEBEE' },
  FINISHED: { label: 'Finalizado', color: '#9E9E9E', bgColor: '#F5F5F5' },
  CANCELLED: { label: 'Cancelado', color: '#9E9E9E', bgColor: '#FAFAFA' },
};

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  SOCIETY: 'Society',
  FUTSAL: 'Futsal',
  CAMPO: 'Campo',
  AREIA: 'Areia',
};

export const PIX_KEY_TYPE_LABELS: Record<PixKeyType, string> = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  EMAIL: 'E-mail',
  PHONE: 'Telefone',
  RANDOM: 'Aleatória',
};

export const CONFIRMATION_STATUS_CONFIG: Record<ConfirmationStatus, { label: string; color: string }> = {
  CONFIRMED: { label: 'Confirmado', color: '#4CAF50' },
  PENDING: { label: 'Pendente', color: '#FF9800' },
  CANCELLED: { label: 'Cancelado', color: '#F44336' },
  WAITLIST: { label: 'Lista de Espera', color: '#9E9E9E' },
  ON_THE_WAY: { label: 'A Caminho', color: '#2196F3' },
  CHECKED_IN: { label: 'Check-in', color: '#00C853' },
};

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string }> = {
  PAID: { label: 'Pago', color: '#4CAF50' },
  PENDING: { label: 'Pendente', color: '#FF9800' },
  EXEMPT: { label: 'Isento', color: '#9E9E9E' },
  PARTIAL: { label: 'Parcial', color: '#2196F3' },
};

export function canManageGame(game: Game, userId: string): boolean {
  return game.ownerId === userId || game.coOrganizers.includes(userId);
}

export function isGameFull(game: Game): boolean {
  return game.playersCount >= game.maxPlayers;
}

export function isVotingOpen(game: Game): boolean {
  if (game.votingConcluded) return false;
  if (game.status !== 'FINISHED') return false;
  if (!game.votingDeadline) return true;
  return new Date() < game.votingDeadline;
}

export function getVotingTimeRemainingMs(game: Game): number {
  if (game.votingConcluded) return 0;
  if (!game.votingDeadline) return Number.MAX_SAFE_INTEGER;
  const remaining = game.votingDeadline.getTime() - Date.now();
  return Math.max(0, remaining);
}
