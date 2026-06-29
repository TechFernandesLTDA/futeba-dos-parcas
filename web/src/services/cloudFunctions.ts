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

export interface AdminUserCrmRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  role: string;
  createdAtIso: string | null;
  updatedAtIso: string | null;
  gamesPlayed: number;
  level: number;
  ownerSummary: AdminOwnerSummary;
  ownerLocations: AdminOwnerLocationSummary[];
  ownerOnboarding: AdminOwnerOnboardingSummary | null;
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

export const deleteLocation = httpsCallable<
  { locationId: string },
  { success: boolean; deletedCount: number }
>(functions, 'deleteLocation');

export const setLocationPublicationStatus = httpsCallable<
  {
    locationId: string;
    publicationStatus: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'SUSPENDED' | 'REJECTED';
    reason?: string;
  },
  { success: boolean; locationId: string; publicationStatus: string }
>(functions, 'setLocationPublicationStatus');

export const setLocationSubscription = httpsCallable<
  {
    locationId: string;
    subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED' | 'CANCELLED';
    monthlyFeeCents?: number | null;
    billingDueDay?: number | null;
    billingStartsAtIso?: string | null;
    billingExpiresAtIso?: string | null;
    adminNotes?: string | null;
  },
  { success: boolean; locationId: string; subscriptionStatus: string }
>(functions, 'setLocationSubscription');

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
  { success: boolean; requestId: string; status: 'pending_review' }
>(functions, 'requestAccountMerge', { timeout: 30000 });

export const joinPublicGame = httpsCallable<
  { gameId: string; position?: 'GOALKEEPER' | 'FIELD'; isCasualPlayer?: boolean },
  { success: boolean; alreadyConfirmed: boolean; confirmationId: string }
>(functions, 'joinPublicGame');

// Exclusão de conta — LGPD art. 18 (direito ao esquecimento)
export const deleteAccount = httpsCallable<void, { success: boolean }>(functions, 'deleteAccount');

// Soft Delete
export const softDeleteGame = httpsCallable(functions, 'softDeleteGame');
export const softDeleteGroup = httpsCallable(functions, 'softDeleteGroup');
export const restoreDeletedGame = httpsCallable(functions, 'restoreDeletedGame');
export const restoreDeletedGroup = httpsCallable(functions, 'restoreDeletedGroup');

// Check-in
export const checkInToGame = httpsCallable<
  { gameId: string; latitude?: number; longitude?: number; qr_token?: string },
  { success: boolean; distanceMeters?: number | null; method?: 'gps' | 'qr' }
>(functions, 'checkInToGame');

export const generateCheckinToken = httpsCallable<
  { gameId: string },
  { success: boolean; token: string }
>(functions, 'generateCheckinToken');

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
