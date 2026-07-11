import {HttpsError} from "firebase-functions/v2/https";

export type IdentityIndexCollection = "cpf_index" | "phone_index";

/**
 * Reconcilia índice privado legado com users_private e rejeita corrupção.
 *
 * @param {unknown} privateHash Hash materializado em users_private.
 * @param {string[]} indexedHashes IDs encontrados no índice por UID.
 * @param {string} kind Nome seguro para diagnóstico.
 * @return {string|undefined} Hash canônico conhecido.
 */
export function resolveLegacyIdentityHash(
  privateHash: unknown,
  indexedHashes: string[],
  kind: "CPF" | "telefone",
): string | undefined {
  const normalizedPrivate = typeof privateHash === "string" && privateHash ?
    privateHash :
    undefined;
  const uniqueIndexes = [...new Set(indexedHashes.filter(Boolean))];

  if (uniqueIndexes.length > 1) {
    throw new HttpsError(
      "failed-precondition",
      `A identidade possui mais de um índice de ${kind}. Exige revisão manual.`,
    );
  }
  if (
    normalizedPrivate &&
    uniqueIndexes.length === 1 &&
    uniqueIndexes[0] !== normalizedPrivate
  ) {
    throw new HttpsError(
      "failed-precondition",
      `O índice de ${kind} está inconsistente. Exige revisão manual.`,
    );
  }
  return normalizedPrivate ?? uniqueIndexes[0];
}

/**
 * Consulta até dois índices por UID; dois já bastam para detectar corrupção.
 *
 * @param {FirebaseFirestore.Firestore} database Firestore.
 * @param {IdentityIndexCollection} collection Coleção privada.
 * @param {string} uid Identidade pesquisada.
 * @return {Promise<string[]>} IDs dos índices encontrados.
 */
export async function loadIdentityIndexHashes(
  database: FirebaseFirestore.Firestore,
  collection: IdentityIndexCollection,
  uid: string,
): Promise<string[]> {
  const snap = await database.collection(collection)
    .where("uid", "==", uid)
    .limit(2)
    .get();
  return snap.docs.map((doc) => doc.id);
}
