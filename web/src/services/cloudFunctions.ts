import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

// Admin
export const setUserRole = httpsCallable(functions, 'setUserRole');

// Soft Delete
export const softDeleteGame = httpsCallable(functions, 'softDeleteGame');
export const softDeleteGroup = httpsCallable(functions, 'softDeleteGroup');
export const restoreDeletedGame = httpsCallable(functions, 'restoreDeletedGame');
export const restoreDeletedGroup = httpsCallable(functions, 'restoreDeletedGroup');
