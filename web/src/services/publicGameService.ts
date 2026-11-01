/**
 * #4408: leitura anônima da visão pública de um jogo.
 *
 * A rota `/api/public-game/{id}` é um rewrite do Firebase Hosting para a Cloud
 * Function `publicGamePage` (same-origin: cabe no `connect-src 'self'` da CSP).
 * A function só devolve jogos PUBLIC_OPEN/PUBLIC_CLOSED não excluídos e só com
 * campos públicos; privado, inexistente e excluído respondem o mesmo 404.
 * Nenhuma regra do Firestore foi afrouxada para isso.
 */

export type PublicGameStatus = 'SCHEDULED' | 'CONFIRMED' | 'LIVE' | 'FINISHED' | 'CANCELLED';

/** Espelha `PublicGameView` de functions/src/games/public-game-page.ts. */
export interface PublicGame {
  id: string;
  status: PublicGameStatus;
  joinMode: 'OPEN' | 'CLOSED';
  date: string | null;
  time: string | null;
  endTime: string | null;
  locationName: string | null;
  groupName: string | null;
  maxPlayers: number | null;
  playersCount: number;
  spotsLeft: number | null;
}

export class PublicGameRequestError extends Error {
  constructor(readonly status: number) {
    super(`Falha ao carregar o jogo (HTTP ${status})`);
    this.name = 'PublicGameRequestError';
  }
}

/** Formata YYYY-MM-DD como data longa no idioma atual (sem fuso: a data já é local). */
export function formatPublicGameDate(date: string | null, locale: string): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const formatted = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function publicGameEndpoint(gameId: string): string {
  return `/api/public-game/${encodeURIComponent(gameId)}`;
}

/**
 * Busca a visão pública do jogo.
 * @returns o jogo, ou `null` quando ele não é público (ou não existe).
 * @throws PublicGameRequestError em falha de rede/servidor (estado de erro com retry).
 */
export async function fetchPublicGame(gameId: string, signal?: AbortSignal): Promise<PublicGame | null> {
  const response = await fetch(publicGameEndpoint(gameId), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'omit',
    signal,
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new PublicGameRequestError(response.status);
  // Sem o rewrite (ex.: dev local) o Hosting/Vite devolve o HTML do SPA com 200.
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) {
    throw new PublicGameRequestError(response.status);
  }
  const body = (await response.json()) as { game?: PublicGame };
  return body.game ?? null;
}
