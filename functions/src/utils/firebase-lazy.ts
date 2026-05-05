import * as admin from "firebase-admin";

/**
 * Lazy accessor para Firestore.
 * @return {admin.firestore.Firestore} Instancia do Firestore.
 */
export function getDb(): admin.firestore.Firestore {
  return admin.firestore();
}

/**
 * Lazy accessor para Firebase Auth.
 * @return {admin.auth.Auth} Instancia do Auth.
 */
export function getAuth(): admin.auth.Auth {
  return admin.auth();
}

/**
 * Lazy accessor para Cloud Storage.
 * @return {admin.storage.Storage} Instancia do Storage.
 */
export function getStorage(): admin.storage.Storage {
  return admin.storage();
}
