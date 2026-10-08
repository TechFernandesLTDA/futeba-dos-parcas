/**
 * Helpers puros de autorização de rota consumidos pelos guardas do `App.tsx`.
 *
 * Extraídos de `App.tsx` (#4191) para dar cobertura unit + mutation às áreas de
 * auth/guards sem precisar montar a árvore inteira de rotas (que só é exercitada
 * no E2E). O comportamento deve permanecer idêntico ao que existia inline — são
 * a mesma decisão de acesso, agora isolada e testável.
 */
import type { UserRole } from '../types/user';

/** Mesma checagem de `AdminRoute`: apenas ADMIN tem privilégio total. */
export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role === 'ADMIN';
}

/** Mesma checagem de `FieldOwnerOrAdminRoute`: donos de quadra e admins. */
export function isFieldOwnerOrAdminRole(role: UserRole | null | undefined): boolean {
  return role === 'FIELD_OWNER' || role === 'ADMIN';
}

/**
 * Próximo passo do onboarding para usuário ainda não verificado.
 * FIX #1024: quem já completou o telefone vai direto ao CPF; caso contrário,
 * começa pelo telefone.
 */
export function onboardingStepFor(
  phoneNumber: string | null | undefined,
): '/onboarding/cpf' | '/onboarding/phone' {
  return phoneNumber ? '/onboarding/cpf' : '/onboarding/phone';
}

/**
 * Rotas `/onboarding/*` são o único destino permitido a usuários não
 * verificados (evita o loop ProtectedRoute → onboarding → ProtectedRoute).
 */
export function isOnboardingPath(pathname: string): boolean {
  return pathname.startsWith('/onboarding/');
}
