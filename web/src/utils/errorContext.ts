/**
 * Gerenciador de breadcrumbs para rastreamento de ações do usuário antes de erros.
 * Buffer circular em memória — não persiste entre recarregamentos.
 */

export interface Breadcrumb {
  category: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

const MAX_BREADCRUMBS = 20;
const breadcrumbs: Breadcrumb[] = [];

/**
 * Registra uma ação do usuário no buffer circular de breadcrumbs.
 * Descarta PII: nunca passar email, senha, CPF, telefone no data.
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
): void {
  const entry: Breadcrumb = {
    category,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
  breadcrumbs.push(entry);
  // Mantém apenas os últimos MAX_BREADCRUMBS
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
}

/**
 * Retorna cópia dos breadcrumbs atuais (mais antigo → mais recente).
 */
export function getBreadcrumbs(): Breadcrumb[] {
  return [...breadcrumbs];
}

/**
 * Limpa todos os breadcrumbs (ex: após logout).
 */
export function clearBreadcrumbs(): void {
  breadcrumbs.length = 0;
}
