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
  favoriteTeam?: string;
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

/**
 * Status com keys do MUI palette para suporte light/dark mode.
 * Use getStatusChipColors(theme, status) para obter color/bgColor resolvidos.
 */
export type StatusPaletteKey = 'success' | 'info' | 'error' | 'default';

export const STATUS_CONFIG: Record<
  GameStatus,
  { label: string; paletteKey: StatusPaletteKey }
> = {
  SCHEDULED: { label: 'Aberto', paletteKey: 'success' },
  CONFIRMED: { label: 'Fechado', paletteKey: 'info' },
  LIVE: { label: 'Ao Vivo', paletteKey: 'error' },
  FINISHED: { label: 'Finalizado', paletteKey: 'default' },
  CANCELLED: { label: 'Cancelado', paletteKey: 'default' },
};

/**
 * Resolve paletteKey para cores reais do theme (suporta light/dark mode).
 * Aceita Theme do MUI; usa indexer dinâmico para acessar palette[paletteKey].
 */
export function getStatusChipColors(
  theme: { palette: { success: { main: string }; info: { main: string }; error: { main: string }; text: { disabled: string }; action: { hover: string } } },
  status: GameStatus,
): { label: string; color: string; bgColor: string } {
  const config = STATUS_CONFIG[status];
  if (config.paletteKey === 'default') {
    return {
      label: config.label,
      color: theme.palette.text.disabled,
      bgColor: theme.palette.action.hover,
    };
  }
  const palette = theme.palette[config.paletteKey];
  return {
    label: config.label,
    color: palette.main,
    // alpha 0.12 funciona bem em ambos light e dark mode
    bgColor: `${palette.main}1F`,
  };
}

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

/**
 * Paleta para status de confirmação/pagamento — usa keys do MUI para suportar light/dark mode.
 * Fix #761: substituídas hex hardcoded por paletteKey do tema.
 */
export type ConfirmationPaletteKey = 'success' | 'warning' | 'error' | 'default' | 'info';

export const CONFIRMATION_STATUS_CONFIG: Record<ConfirmationStatus, { label: string; paletteKey: ConfirmationPaletteKey }> = {
  CONFIRMED: { label: 'Confirmado', paletteKey: 'success' },
  PENDING: { label: 'Pendente', paletteKey: 'warning' },
  CANCELLED: { label: 'Cancelado', paletteKey: 'error' },
  WAITLIST: { label: 'Lista de Espera', paletteKey: 'default' },
  ON_THE_WAY: { label: 'A Caminho', paletteKey: 'info' },
  CHECKED_IN: { label: 'Check-in', paletteKey: 'success' },
};

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; paletteKey: ConfirmationPaletteKey }> = {
  PAID: { label: 'Pago', paletteKey: 'success' },
  PENDING: { label: 'Pendente', paletteKey: 'warning' },
  EXEMPT: { label: 'Isento', paletteKey: 'default' },
  PARTIAL: { label: 'Parcial', paletteKey: 'info' },
};

/**
 * Resolve paletteKey de confirmação/pagamento para cores reais do theme.
 * Suporta light/dark mode e WCAG AA (usa cores do tema WCAG-compliant).
 */
type PaletteTheme = {
  palette: {
    success: { main: string };
    warning: { main: string };
    error: { main: string };
    info: { main: string };
    text: { disabled: string };
    action: { hover: string };
  };
};

export function getConfirmationChipColors(
  theme: PaletteTheme,
  status: ConfirmationStatus,
): { label: string; color: string; bgColor: string } {
  const config = CONFIRMATION_STATUS_CONFIG[status];
  return resolvePaletteKeyColors(theme, config);
}

export function getPaymentChipColors(
  theme: PaletteTheme,
  status: PaymentStatus,
): { label: string; color: string; bgColor: string } {
  const config = PAYMENT_STATUS_CONFIG[status];
  return resolvePaletteKeyColors(theme, config);
}

function resolvePaletteKeyColors(
  theme: PaletteTheme,
  config: { label: string; paletteKey: ConfirmationPaletteKey },
): { label: string; color: string; bgColor: string } {
  if (config.paletteKey === 'default') {
    return {
      label: config.label,
      color: theme.palette.text.disabled,
      bgColor: theme.palette.action.hover,
    };
  }
  const paletteColor = theme.palette[config.paletteKey].main;
  return {
    label: config.label,
    color: paletteColor,
    bgColor: `${paletteColor}1F`,
  };
}

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
