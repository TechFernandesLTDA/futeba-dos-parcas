import { FirebaseError } from 'firebase/app';
import { createLogger } from './logger';

const logger = createLogger('authRetry');

/**
 * Timestamp do último refresh de claims do usuário.
 * Usado para decidir se vale tentar refresh automático após permission-denied.
 */
let lastClaimRefreshAt: number | null = null;

/** Registra que um refresh de claims acabou de ocorrer. */
export function markClaimRefresh(): void {
  lastClaimRefreshAt = Date.now();
}

/**
 * #4001: Reseta o estado de retry de claims. Deve ser chamado no logout para
 * evitar que `wasClaimRefreshedRecently()` retorne true na próxima sessão
 * caso o logout e login ocorram dentro da janela de 30s.
 */
export function resetClaimRefreshState(): void {
  lastClaimRefreshAt = null;
}

/**
 * Verifica se um refresh de claims ocorreu recentemente (< 30s).
 * Usado pelo retry para evitar loops infinitos.
 */
function wasClaimRefreshedRecently(): boolean {
  if (lastClaimRefreshAt === null) return false;
  return Date.now() - lastClaimRefreshAt < 30_000;
}

/**
 * Wrapper de retry para chamadas Firestore que podem falhar com `permission-denied`
 * logo após o cadastro, enquanto o custom claim setado por `onNewUserCreated`
 * ainda não propagou para o ID token local.
 *
 * NOTA: `getIdToken(true)` após `createUserWithEmailAndPassword` NÃO garante que
 * o claim já foi setado, pois o trigger Cloud Functions roda de forma assíncrona
 * no servidor. Este wrapper é a rede de segurança: se `permission-denied` ocorrer
 * E um refresh de claims aconteceu recentemente, tenta `refreshClaims()` + retry
 * uma única vez para pegar o token atualizado.
 *
 * Uso:
 * ```ts
 * const data = await withClaimRefreshRetry(
 *   () => getDoc(doc(db, 'users', uid)),
 *   refreshClaims
 * );
 * ```
 *
 * @param fn Função que executa a operação Firestore
 * @param refreshClaims Callback que força refresh do ID token (de AuthContext)
 */
export async function withClaimRefreshRetry<T>(
  fn: () => Promise<T>,
  refreshClaims: () => Promise<void>
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const isPermissionDenied =
      err instanceof FirebaseError && (err as FirebaseError).code === 'permission-denied';

    if (isPermissionDenied && wasClaimRefreshedRecently()) {
      logger.debug(
        'permission-denied após refresh recente de claims — tentando novamente após refreshClaims()'
      );
      await refreshClaims();
      // Retry único — se falhar de novo, propaga o erro normalmente
      return await fn();
    }

    throw err;
  }
}
