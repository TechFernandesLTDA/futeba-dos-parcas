/**
 * LAZY ADMIN ACCESSOR
 *
 * Centraliza acesso a admin.firestore() de forma lazy.
 *
 * Por que lazy?
 * - firebase-admin v13 lança "app/no-app" se admin.firestore()
 *   for chamado ANTES de admin.initializeApp().
 * - Top-level `const db = admin.firestore();` em qualquer módulo
 *   importado por src/index.ts roda durante a resolução de imports,
 *   ANTES de `admin.initializeApp()` em src/index.ts:130.
 * - Solução: encapsular em função, executar apenas no primeiro
 *   uso (que sempre acontece DENTRO de um handler — depois do init).
 *
 * Uso:
 *   import {db} from "<path>/_db";
 *   await db().collection("users").doc(uid).get();
 *
 * O cache `_db` evita recriar a instância em cada chamada.
 */

import * as admin from "firebase-admin";

let _db: FirebaseFirestore.Firestore | undefined;

/**
 * Retorna a instância singleton de Firestore (lazy).
 * Chame apenas dentro de handlers/funções, não no top-level.
 *
 * @return {FirebaseFirestore.Firestore} Cliente Firestore inicializado.
 */
export const db = (): FirebaseFirestore.Firestore => {
  if (!_db) {
    _db = admin.firestore();
  }
  return _db;
};
