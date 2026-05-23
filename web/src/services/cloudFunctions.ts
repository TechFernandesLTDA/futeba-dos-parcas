import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

// Admin
// GAP-4: tipo explícito evita drift quando o callable for renomeado/refatorado.
export const setUserRole = httpsCallable<
  { uid: string; role: string },
  { success: boolean }
>(functions, 'setUserRole');

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
  { gameId: string; latitude: number; longitude: number },
  { success: boolean; distanceMeters?: number }
>(functions, 'checkInToGame');
