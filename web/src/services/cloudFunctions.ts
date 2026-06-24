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

export const deleteLocation = httpsCallable<
  { locationId: string },
  { success: boolean; deletedCount: number }
>(functions, 'deleteLocation');

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
  { allowed: boolean; reason?: string; retryAfterSec?: number }
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

// #2430: Sincroniza custom claim FIELD_OWNER/ADMIN do Firestore para o Auth
export const syncFieldOwnerClaim = httpsCallable<
  void,
  { success: boolean; synced: boolean; role: string; message: string }
>(functions, 'syncFieldOwnerClaim');
