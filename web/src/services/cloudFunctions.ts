import { httpsCallable, HttpsCallable } from 'firebase/functions';
import { functions } from './firebase';

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
export const verifyCpf = httpsCallable<
  { cpf: string },
  { success: boolean; cpfMasked: string }
>(functions, 'verifyCpf');

export const setUserVerified = httpsCallable<
  { uid?: string },
  { success: boolean; uid: string }
>(functions, 'setUserVerified');

// Recomputa custom claim profileComplete (defense-in-depth: gates #1483/1484/1485)
export const recomputeMyProfileClaim = httpsCallable<void, { success: boolean; profileComplete: boolean }>(functions, 'recomputeMyProfileClaim');

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
