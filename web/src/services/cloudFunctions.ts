import { httpsCallable, HttpsCallable } from 'firebase/functions';
import { functions } from './firebaseFunctions';
import type { UserGender } from '../types/user';

export function getCallable<T = unknown, R = unknown>(name: string): HttpsCallable<T, R> {
  return httpsCallable<T, R>(functions, name);
}

export const setUserRole = httpsCallable<
  { uid: string; role: string },
  { success: boolean }
>(functions, 'setUserRole');

export interface InviteCodeValidationResponse {
  valid: boolean;
  inviteCode?: string;
  inviterName?: string;
  xpReward?: number;
}

export const validateInviteCode = httpsCallable<
  { inviteCode: string },
  InviteCodeValidationResponse
>(functions, 'validateInviteCode');

export const generateGroupInviteCode = httpsCallable<
  { groupId: string; groupName: string },
  { code: string }
>(functions, 'generateGroupInviteCode');

export const submitDirectMessage = httpsCallable<
  {
    chatId: string;
    text: string;
  },
  { messageId: string }
>(functions, 'submitDirectMessage');

export const submitContentReport = httpsCallable<
  {
    targetType: 'group_wall_post' | 'game_chat_message' | 'game_comment' | 'game_photo' | 'game_video';
    groupId?: string;
    postId?: string;
    gameId?: string;
    targetId?: string;
    reason: 'inappropriate_content' | 'abusive_language' | 'spam' | 'harassment' | 'other';
  },
  { reportId: string }
>(functions, 'submitContentReport');

export interface CreateCashboxEntryRequest {
  groupId: string;
  requestId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  receiptUrl?: string | null;
}

export interface CreateCashboxEntryResponse {
  entryId: string;
  balance: number;
  balanceCents: number;
}

export const createCashboxEntry = httpsCallable<
  CreateCashboxEntryRequest,
  CreateCashboxEntryResponse
>(functions, 'createCashboxEntry');

export const voidCashboxEntry = httpsCallable<
  { groupId: string; entryId: string },
  { entryId: string; balance: number; balanceCents: number; duplicate: boolean }
>(functions, 'voidCashboxEntry');

export const reconcileCashboxSummary = httpsCallable<
  { groupId: string },
  {
    balance: number;
    balanceCents: number;
    totalIncome: number;
    totalExpense: number;
    entryCount: number;
    ledgerVersion: number;
  }
>(functions, 'reconcileCashboxSummary');

export interface AdminOwnerSummary {
  totalLocations: number;
  publishedLocations: number;
  pendingLocations: number;
  overdueLocations: number;
  incompleteLocations: number;
  activeSubscriptionLocations: number;
  monthlyFeeTotalCents: number;
  managersTotal: number;
}

export interface AdminOwnerLocationSummary {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  publicationStatus: string;
  subscriptionStatus: string;
  monthlyFeeCents: number | null;
  billingDueDay: number | null;
  fieldCount: number;
  managersCount: number;
  managersPreview: string[];
  updatedAtIso: string | null;
}

export interface AdminOwnerOnboardingSummary {
  status: VenueOwnerOnboardingStatus;
  submittedAtIso: string | null;
  reviewedAtIso: string | null;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  businessName: string | null;
  notes: string | null;
  reviewReason: string | null;
}

export interface AdminVenueAccountSummary {
  id: string;
  status: 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED' | 'CANCELLED';
  billingScope: 'OWNER' | 'LOCATION' | 'FIELD_COUNT' | 'MANUAL_OVERRIDE';
  billingPlanCode: 'TRIAL' | 'BASIC' | 'PRO' | 'ENTERPRISE' | 'CUSTOM' | null;
  billingPlanLabel: string | null;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL' | 'CUSTOM' | null;
  billingDueDay: number | null;
  billingContactName: string | null;
  billingContactEmail: string | null;
  linkedLocationIds: string[];
  linkedLocationsCount: number;
  publishedLocationsCount: number;
  activeFieldCount: number;
  legacyMonthlyFeeTotalCents: number;
  computedMonthlyFeeCents: number;
  updatedAtIso: string | null;
}

export interface AdminUserCrmRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  role: string;
  createdAtIso: string | null;
  updatedAtIso: string | null;
  lastLoginAtIso: string | null;
  gamesPlayed: number;
  level: number;
  isMock?: boolean;
  demoData?: boolean;
  dataOrigin?: string | null;
  seedId?: string | null;
  demoDataReason?: string | null;
  cpfVerified?: boolean;
  phoneVerified?: boolean;
  realDataProtected?: boolean;
  ownerSummary: AdminOwnerSummary;
  ownerLocations: AdminOwnerLocationSummary[];
  ownerOnboarding: AdminOwnerOnboardingSummary | null;
  venueAccount: AdminVenueAccountSummary | null;
}

export interface AdminUserSearchResponse {
  users: AdminUserCrmRow[];
  nextPageToken: string | null;
  totalMatched: number;
  scannedUsers: number;
  scannedLocations: number;
  scanComplete: boolean;
}

export const searchAdminUsers = httpsCallable<
  {
    search?: string | null;
    role?: 'ALL' | 'ADMIN' | 'FIELD_OWNER' | 'PLAYER' | null;
    ownerFilter?: 'ALL' | 'FIELD_OWNER' | 'HAS_LOCATIONS' | 'PUBLISHED' | 'OVERDUE' | 'INCOMPLETE' | null;
    pageSize?: number | null;
    pageToken?: string | null;
  },
  AdminUserSearchResponse
>(functions, 'searchAdminUsers');

export type VenueOwnerOnboardingStatus =
  | 'LEAD'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'CANCELLED';

export interface VenueOwnerOnboardingResponse {
  success: boolean;
  ownerUid: string;
  status: VenueOwnerOnboardingStatus;
  role?: string;
}

export const requestVenueOwnerOnboarding = httpsCallable<
  {
    contactName?: string | null;
    contactEmail?: string | null;
    phone?: string | null;
    businessName?: string | null;
    commercialDocument?: string | null;
    /** CNPJ estruturado (apenas dígitos) — opcional, #3188 */
    cnpj?: string | null;
    notes?: string | null;
    locationIds?: string[];
    termsAccepted?: boolean | null;
  },
  VenueOwnerOnboardingResponse
>(functions, 'requestVenueOwnerOnboarding');

export const reviewVenueOwnerOnboarding = httpsCallable<
  {
    ownerUid: string;
    decision: 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'CANCELLED';
    reason?: string | null;
    checklist?: {
      contactReviewed?: boolean;
      locationsReviewed?: boolean;
      termsReviewed?: boolean;
      billingReviewed?: boolean;
    } | null;
  },
  VenueOwnerOnboardingResponse
>(functions, 'reviewVenueOwnerOnboarding');

export interface VenueAccountResponse {
  success: boolean;
  accountId: string;
  ownerUid: string;
  linkedLocationIds: string[];
  linkedLocationsCount: number;
  publishedLocationsCount: number;
  activeFieldCount: number;
  computedMonthlyFeeCents: number;
  status: 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED' | 'CANCELLED';
  billingScope: 'OWNER' | 'LOCATION' | 'FIELD_COUNT' | 'MANUAL_OVERRIDE';
}

export const upsertVenueAccount = httpsCallable<
  {
    ownerUid: string;
    billingContactName?: string | null;
    billingContactEmail?: string | null;
    billingContactPhone?: string | null;
    billingContactDocument?: string | null;
    status?: 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED' | 'CANCELLED' | null;
    billingScope?: 'OWNER' | 'LOCATION' | 'FIELD_COUNT' | 'MANUAL_OVERRIDE' | null;
    billingPlanCode?: 'TRIAL' | 'BASIC' | 'PRO' | 'ENTERPRISE' | 'CUSTOM' | null;
    billingPlanLabel?: string | null;
    billingCycle?: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL' | 'CUSTOM' | null;
    billingBaseFeeCents?: number | null;
    defaultLocationFeeCents?: number | null;
    pricePerActiveFieldCents?: number | null;
    monthlyFeeOverrideCents?: number | null;
    billingDueDay?: number | null;
    billingStartsAtIso?: string | null;
    billingExpiresAtIso?: string | null;
    notes?: string | null;
    adminNotes?: string | null;
    linkedLocationIds?: string[] | null;
  },
  VenueAccountResponse
>(functions, 'upsertVenueAccount');

export const linkLocationToVenueAccount = httpsCallable<
  { ownerUid: string; locationId: string },
  VenueAccountResponse
>(functions, 'linkLocationToVenueAccount');

export const unlinkLocationFromVenueAccount = httpsCallable<
  { ownerUid: string; locationId: string },
  VenueAccountResponse
>(functions, 'unlinkLocationFromVenueAccount');

export const deleteLocation = httpsCallable<
  { locationId: string },
  { success: boolean; deletedCount: number }
>(functions, 'deleteLocation');

export const createDirectChat = httpsCallable<
  { targetUid: string },
  { chatId: string }
>(functions, 'createDirectChat');

export type NearbyDistanceBand = 'under_1km' | 'under_5km' | 'under_10km' | 'under_25km';

export interface NearbyPlayer {
  id: string;
  displayName: string;
  photoUrl: string | null;
  nickname: string | null;
  preferredPosition: string | null;
  followersCount: number;
  isFollowing: boolean;
  distanceKmApprox: number;
  distanceBand: NearbyDistanceBand;
  socialContext: 'following' | 'none';
}

export interface DiscoverNearbyPlayersResponse {
  players: NearbyPlayer[];
}

export const discoverNearbyPlayers = httpsCallable<
  { lat: number; lng: number; radiusKm: 1 | 5 | 10 | 25; socialFilter?: 'all' | 'following' },
  DiscoverNearbyPlayersResponse
>(functions, 'discoverNearbyPlayers');

export interface LeaguePlayerSummary {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  favoriteTeam?: string;
  level: number;
  points: number;
  gamesPlayed: number;
  wins: number;
  goals: number;
  assists: number;
  mvpCount: number;
  division: string;
  leagueRating?: number;
  experiencePoints: number;
  canReceiveInvites: boolean;
  isMock?: boolean;
  demoData?: boolean;
  dataOrigin?: string;
  seedId?: string;
  demoDataReason?: string;
  preferredPosition?: 'GOLEIRO' | 'ZAGUEIRO' | 'LATERAL' | 'VOLANTE' | 'MEIA' | 'ATACANTE';
  strikerRating?: number;
  midRating?: number;
  defenderRating?: number;
  gkRating?: number;
  autoStrikerRating?: number;
  autoMidRating?: number;
  autoDefenderRating?: number;
  autoGkRating?: number;
  autoRatingSamples?: number;
  strikerRatingSet?: boolean;
  midRatingSet?: boolean;
  defenderRatingSet?: boolean;
  gkRatingSet?: boolean;
  lookingForGameToday?: boolean;
  hasRecentPresence?: boolean;
}

export interface GetLeaguePlayersResponse {
  success: boolean;
  players: LeaguePlayerSummary[];
  count: number;
  totalCount: number;
  hasMore: boolean;
  nextPageToken: string | null;
}

export const getLeaguePlayers = httpsCallable<
  {
    seasonId?: string | null;
    groupId?: string | null;
    limit?: number;
    gender?: string | null;
    search?: string | null;
    sortField?: string | null;
    sortDirection?: 'asc' | 'desc' | null;
    pageToken?: string | null;
    userIds?: string[] | null;
  },
  GetLeaguePlayersResponse
>(functions, 'getLeaguePlayers');

export const setLocationPublicationStatus = httpsCallable<
  {
    locationId: string;
    publicationStatus: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'SUSPENDED' | 'REJECTED';
    reason?: string;
  },
  { success: boolean; locationId: string; publicationStatus: string }
>(functions, 'setLocationPublicationStatus');

export const requestLocationCommercialReview = httpsCallable<
  {
    locationId: string;
    requestType: 'PUBLICATION' | 'COMMERCIAL_UPDATE';
    requestedSections?: string[] | null;
    notes?: string | null;
  },
  {
    success: boolean;
    locationId: string;
    requestId: string;
    requestStatus: 'PENDING_REVIEW';
    publicationStatus: string;
  }
>(functions, 'requestLocationCommercialReview');

export const reviewLocationCommercialRequest = httpsCallable<
  {
    locationId: string;
    requestId: string;
    decision: 'APPROVED' | 'NEEDS_CHANGES' | 'REJECTED';
    notes?: string | null;
  },
  {
    success: boolean;
    locationId: string;
    requestId: string;
    requestStatus: 'APPROVED' | 'NEEDS_CHANGES' | 'REJECTED';
    publicationStatus: string;
  }
>(functions, 'reviewLocationCommercialRequest');

export const setLocationSubscription = httpsCallable<
  {
    locationId: string;
    subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED' | 'CANCELLED';
    billingPlanCode?: 'TRIAL' | 'BASIC' | 'PRO' | 'ENTERPRISE' | 'CUSTOM' | null;
    billingPlanLabel?: string | null;
    billingCycle?: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL' | 'CUSTOM' | null;
    billingBaseFeeCents?: number | null;
    monthlyFeeCents?: number | null;
    billingDueDay?: number | null;
    billingStartsAtIso?: string | null;
    billingExpiresAtIso?: string | null;
    billingExceptionNote?: string | null;
    adminNotes?: string | null;
  },
  { success: boolean; locationId: string; subscriptionStatus: string }
>(functions, 'setLocationSubscription');

export interface AdminLocationBillingSummaryTotals {
  expectedMrrCents: number;
  receivedCents: number;
  overdueCents: number;
  trialCents: number;
  suspendedCents: number;
  activeLocations: number;
  trialLocations: number;
  overdueLocations: number;
  suspendedLocations: number;
  cancelledLocations: number;
  pendingReceiptLocations: number;
}

export interface AdminLocationBillingSummaryRow {
  id: string;
  name: string;
  ownerId: string | null;
  city: string | null;
  state: string | null;
  publicationStatus: string;
  subscriptionStatus: string;
  billingPlanCode?: string | null;
  billingPlanLabel?: string | null;
  billingCycle?: string | null;
  billingBaseFeeCents?: number | null;
  monthlyFeeCents: number;
  billingDueDay: number | null;
  billingStartsAtIso?: string | null;
  expectedCents: number;
  receivedCents: number;
  openBalanceCents: number;
  billingExceptionNote?: string | null;
  currentBillingCycleStatus: string | null;
  currentBillingPaidCents: number;
  currentBillingOpenBalanceCents: number;
  billingDueAtIso: string | null;
  billingGraceEndsAtIso: string | null;
  billingSuspendAtIso: string | null;
  pendingReceiptCount: number;
  lastPaymentAtIso: string | null;
  updatedAtIso: string | null;
  venueAccountId?: string | null;
  venueAccountStatus?: string | null;
  venueAccountChargeScope?: string | null;
  venueAccountPlanCode?: string | null;
  venueAccountPlanLabel?: string | null;
  venueAccountMonthlyTotalCents?: number | null;
  venueAccountLinkedLocationsCount?: number | null;
  venueAccountActiveFieldsCount?: number | null;
}

export interface AdminLocationBillingSummaryResponse {
  periodKey: string;
  generatedAtIso: string;
  scannedLocations: number;
  scanLimit: number;
  scanComplete: boolean;
  summary: AdminLocationBillingSummaryTotals;
  locations: AdminLocationBillingSummaryRow[];
}

export const getAdminLocationBillingSummary = httpsCallable<
  { periodKey?: string | null },
  AdminLocationBillingSummaryResponse
>(functions, 'getAdminLocationBillingSummary');

export const registerLocationSubscriptionPayment = httpsCallable<
  {
    locationId: string;
    amountCents: number;
    periodKey: string;
    paidAtIso?: string | null;
    method?: string | null;
    receiptUrl?: string | null;
    notes?: string | null;
  },
  {
    success: boolean;
    locationId: string;
    paymentId: string;
    subscriptionStatus: string;
  }
>(functions, 'registerLocationSubscriptionPayment');

export const submitLocationSubscriptionReceipt = httpsCallable<
  {
    locationId: string;
    amountCents: number;
    periodKey: string;
    paidAtIso?: string | null;
    method?: string | null;
    receiptStoragePath: string;
    notes?: string | null;
  },
  {
    success: boolean;
    locationId: string;
    paymentId: string;
    reviewStatus: 'PENDING_REVIEW';
  }
>(functions, 'submitLocationSubscriptionReceipt');

export const reviewLocationSubscriptionReceipt = httpsCallable<
  {
    locationId: string;
    paymentId: string;
    decision: 'APPROVED' | 'REJECTED';
    notes?: string | null;
  },
  {
    success: boolean;
    locationId: string;
    paymentId: string;
    reviewStatus: 'APPROVED' | 'REJECTED';
    subscriptionStatus: string | null;
  }
>(functions, 'reviewLocationSubscriptionReceipt');

export const assignLocationOwner = httpsCallable<
  {
    locationId: string;
    newOwnerId: string;
    reason?: string | null;
  },
  { success: boolean; locationId: string; ownerId: string; changed: boolean }
>(functions, 'assignLocationOwner');

export const inviteLocationManager = httpsCallable<
  {
    locationId: string;
    managerUid?: string | null;
    managerEmail?: string | null;
    message?: string | null;
  },
  {
    success: boolean;
    locationId: string;
    inviteId: string | null;
    alreadyManager: boolean;
  }
>(functions, 'inviteLocationManager');

export const acceptLocationManagerInvite = httpsCallable<
  { locationId: string; inviteId: string },
  { success: boolean; locationId: string; managerUid: string }
>(functions, 'acceptLocationManagerInvite');

export const removeLocationManager = httpsCallable<
  {
    locationId: string;
    managerUid: string;
    reason?: string | null;
  },
  { success: boolean; locationId: string; managerUid: string }
>(functions, 'removeLocationManager');

export const calculateAutoRatings = httpsCallable<
  { userId: string },
  { success: boolean }
>(functions, 'calculateAutoRatings');

export const recalculateAllAutoRatings = httpsCallable<
  { batchSize?: number },
  { success: boolean; processedCount: number }
>(functions, 'recalculateAllAutoRatings');

// Phone + CPF Verification (Anti-Bot)
// Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md
export const canSendSmsOtp = httpsCallable<
  { phone: string },
  {
    allowed: boolean;
    reason?: 'caller_rate_limit' | 'phone_rate_limit' | 'ip_rate_limit' | 'duplicate_phone';
    retryAfterSec?: number;
    alreadyLinked?: boolean;
  }
>(functions, 'canSendSmsOtp');

// 2026-05-31: timeout explicito de 30s (default do SDK e 70s). Evita que um
// problema de App Check/rede deixe a verificacao de CPF "validando" por 70s.
export const verifyCpf = httpsCallable<
  { cpf: string },
  { success: boolean; cpfMasked: string }
>(functions, 'verifyCpf', { timeout: 30000 });

export const setUserVerified = httpsCallable<
  { uid?: string },
  { success: boolean; uid: string }
>(functions, 'setUserVerified');

export const updateUserPii = httpsCallable<
  { gender?: UserGender | null },
  { success: boolean; updated: string[] }
>(functions, 'updateUserPii', { timeout: 30000 });

// Recomputa custom claim profileComplete (defense-in-depth: gates #1483/1484/1485)
export const recomputeMyProfileClaim = httpsCallable<void, { success: boolean; profileComplete: boolean }>(functions, 'recomputeMyProfileClaim');

// Anti-abuse: audit verification failures
export const logVerificationFailure = httpsCallable<
  { reason: string; stage: string },
  { logged: boolean }
>(functions, 'logVerificationFailure');

export const requestAccountMerge = httpsCallable<
  { sourceIdToken: string },
  { success: boolean; requestId: string; status: 'pending_cpf' | 'ready' }
>(functions, 'requestAccountMerge', { timeout: 30000 });

export const completeAccountMerge = httpsCallable<
  { requestId: string },
  {
    success: boolean;
    status: 'completed';
    alreadyCompleted: boolean;
    providersToRelink: string[];
  }
>(functions, 'completeAccountMerge', { timeout: 120000 });

export const joinPublicGame = httpsCallable<
  { gameId: string; position: 'GOALKEEPER' | 'FIELD'; isCasualPlayer?: boolean },
  {
    success: boolean;
    alreadyConfirmed: boolean;
    confirmationId: string;
    position: 'GOALKEEPER' | 'FIELD';
    expectedPayment: number;
    expectedPaymentCents: number;
  }
>(functions, 'joinPublicGame');

export const confirmGamePresence = httpsCallable<
  { gameId: string; position: 'GOALKEEPER' | 'FIELD'; isCasualPlayer?: boolean },
  {
    success: boolean;
    alreadyConfirmed: boolean;
    confirmationId: string;
    position: 'GOALKEEPER' | 'FIELD';
    expectedPayment: number;
    expectedPaymentCents: number;
  }
>(functions, 'confirmGamePresence');

export const confirmPlayerAsManager = httpsCallable<
  { gameId: string; userId: string; position?: 'GOALKEEPER' | 'FIELD' },
  { success: boolean; alreadyConfirmed: boolean; confirmationId: string }
>(functions, 'confirmPlayerAsManager');

export interface FieldAvailabilitySlot {
  date: string;
  startMinutes: number;
  endMinutes: number;
}

export const getFieldAvailability = httpsCallable<
  { fieldId: string; startDate: string; endDate: string },
  { slots: FieldAvailabilitySlot[]; truncated?: boolean }
>(functions, 'getFieldAvailability');

export const createGameVideo = httpsCallable<
  { gameId: string; storagePath: string; caption: string },
  { success: true; videoId: string; alreadyExists: boolean }
>(functions, 'createGameVideo');

export interface CreateGamePhotoResponse {
  success: true;
  photoId: string;
  alreadyExists: boolean;
}

// FIX #4049: criação de game_photos migrada para callable — o doc autoritativo
// deixa de ser criado pelo cliente (firestore.rules bloqueia create) e as cotas
// MAX_PHOTOS_PER_GAME / MAX_PHOTOS_PER_USER_PER_GAME passam a valer server-side.
// Contrato espelha createGameVideo: upload no Storage PRIMEIRO no path canônico
// games/{gameId}/photos/{uid}/{fileName}, depois chama a callable.
export const createGamePhoto = httpsCallable<
  { gameId: string; storagePath: string; caption: string },
  CreateGamePhotoResponse
>(functions, 'createGamePhoto');

export const toggleFollowUser = httpsCallable<
  { targetUserId: string; follow: boolean },
  { success: boolean; following: boolean; changed: boolean }
>(functions, 'toggleFollowUser');

// Exclusão de conta — LGPD art. 18 (direito ao esquecimento)
export const deleteAccount = httpsCallable<void, { success: boolean }>(functions, 'deleteAccount');

// Soft Delete
export const softDeleteGame = httpsCallable(functions, 'softDeleteGame');
export const softDeleteGroup = httpsCallable(functions, 'softDeleteGroup');
export const restoreDeletedGame = httpsCallable(functions, 'restoreDeletedGame');
export const restoreDeletedGroup = httpsCallable(functions, 'restoreDeletedGroup');

// Check-in
export const checkInToGame = httpsCallable<
  {
    gameId: string;
    lat?: number;
    lng?: number;
    accuracy?: number;
    latitude?: number;
    longitude?: number;
    qrToken?: string;
    qr_token?: string;
  },
  {
    success: boolean;
    distance_m?: number | null;
    distanceMeters?: number | null;
    method?: 'gps' | 'qr';
  }
>(functions, 'checkInToGame');

export type MvpVoteCategory = 'MVP' | 'BEST_GOALKEEPER' | 'WORST';

export const submitMvpVote = httpsCallable<
  { gameId: string; votedPlayerId: string; category: MvpVoteCategory },
  { success: boolean; voteId: string; message: string }
>(functions, 'submitMvpVote');

export const submitMvpVotes = httpsCallable<
  { gameId: string; votes: Array<{ votedPlayerId: string; category: MvpVoteCategory }> },
  { success: boolean; voteIds: string[]; ballotComplete: boolean; message: string }
>(functions, 'submitMvpVotes');

export const concludeMvpVoting = httpsCallable<
  { gameId: string },
  {
    success: boolean;
    alreadyConcluded: boolean;
    results: {
      mvpId: string | null;
      bestGkId: string | null;
      worstPlayerId: string | null;
    };
    xpApplied: { mvp: boolean; worst: boolean; allOk: boolean };
    message: string;
  }
>(functions, 'concludeMvpVoting');

export const generateCheckinToken = httpsCallable<
  { gameId: string },
  { success: boolean; token: string }
>(functions, 'generateCheckinToken');

export const startGameLifecycle = httpsCallable<
  { gameId: string },
  { success: boolean; status: 'LIVE'; team1Id: string; team2Id: string }
>(functions, 'startGameLifecycle');

export const finishGameLifecycle = httpsCallable<
  { gameId: string },
  { success: boolean; status: 'FINISHED'; team1Score: number; team2Score: number; aggregatedPlayers: number }
>(functions, 'finishGameLifecycle');

export const submitLiveGameEvent = httpsCallable<
  {
    gameId: string;
    requestId?: string | null;
    eventType: 'GOAL' | 'SAVE' | 'YELLOW_CARD' | 'RED_CARD';
    playerId: string;
    playerName: string;
    teamId: string;
    minute?: number;
    assistedById?: string | null;
    assistedByName?: string | null;
  },
  {
    success: boolean;
    eventId: string;
    team1Score: number;
    team2Score: number;
    duplicate: boolean;
  }
>(functions, 'submitLiveGameEvent');

export const deleteLiveGameEvent = httpsCallable<
  {
    gameId: string;
    eventId: string;
  },
  {
    success: boolean;
    eventId: string;
    team1Score: number;
    team2Score: number;
  }
>(functions, 'deleteLiveGameEvent');

export const reviewHeldGameRewards = httpsCallable<
  {
    gameId: string;
    action: 'APPROVE' | 'REJECT';
    reason: string;
  },
  {
    success: boolean;
    gameId: string;
    action: 'APPROVE' | 'REJECT';
    previousStatus: 'HELD_FOR_REVIEW';
    newStatus: 'ELIGIBLE' | 'REJECTED_BY_ADMIN';
  }
>(functions, 'reviewHeldGameRewards');

// Reputacao pos-jogo
export const submitPostGameReputation = httpsCallable<
  {
    gameId: string;
    targetUserId: string;
    punctuality: number;
    respect: number;
    commitment: number;
    comment?: string;
  },
  {
    success: boolean;
    updated: boolean;
    reviewsCount: number;
    overallAvg: number;
  }
>(functions, 'submitPostGameReputation');

// #2430: Sincroniza custom claim FIELD_OWNER/ADMIN do Firestore para o Auth
export const syncFieldOwnerClaim = httpsCallable<
  void,
  { success: boolean; synced: boolean; role: string; message: string }
>(functions, 'syncFieldOwnerClaim');
