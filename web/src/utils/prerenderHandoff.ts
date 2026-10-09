// Handoff do HTML prerenderizado (#4196).
//
// As páginas públicas são servidas com o conteúdo semântico em `#prerender` e o `#root` do React
// escondido (`display:none`). O React monta no `#root` invisível; só quando ele tem conteúdo
// equivalente (um <h1> renderizado) o `#prerender` é removido e o `#root` aparece, no mesmo frame.
// Assim o primeiro paint (e o LCP) vem do HTML estático, sem tela em branco/skeleton entre o
// prerender e o app, e o bundle global deixa de estar no caminho crítico do LCP.

export const PRERENDER_ID = 'prerender';
export const HANDOFF_TIMEOUT_MS = 10_000;
/** Chave de localStorage lida pelo guard inline do shell (HOME_GUARD_SOURCE em scripts/prerender-routes.mjs). */
export const AUTH_HINT_KEY = 'fdp:auth-hint';

/** Grava (ou limpa) a dica de "sessão conhecida": evita mostrar o hero estático da home a quem já está logado. */
export function setAuthHint(signedIn: boolean): void {
  try {
    if (signedIn) localStorage.setItem(AUTH_HINT_KEY, '1');
    else localStorage.removeItem(AUTH_HINT_KEY);
  } catch {
    // localStorage indisponível (modo privado/quota): sem dica, apenas o hero estático aparece.
  }
}

/** Troca o prerender pelo app. Idempotente; devolve true se havia prerender a remover. */
export function revealApp(doc: Document = document): boolean {
  const root = doc.getElementById('root');
  const prerender = doc.getElementById(PRERENDER_ID);
  if (root) root.style.removeProperty('display');
  if (!prerender) return false;
  prerender.remove();
  return true;
}

/**
 * Programa o handoff. Sem `#prerender` (rotas autenticadas / SPA shell) não faz nada.
 * Retorna uma função de cancelamento.
 */
export function initPrerenderHandoff(doc: Document = document, timeoutMs = HANDOFF_TIMEOUT_MS): () => void {
  const root = doc.getElementById('root');
  if (!root || !doc.getElementById(PRERENDER_ID)) return () => undefined;
  // O guard do shell já desligou o estático (rota que não é "/" ou sessão conhecida): mostra o app direto.
  if (doc.documentElement.hasAttribute('data-no-prerender')) {
    revealApp(doc);
    return () => undefined;
  }

  let done = false;
  const observer = new MutationObserver(() => {
    if (!done && root.querySelector('h1')) finish();
  });
  // Rede de segurança: se o app não produzir um <h1> (rota inesperada, erro), não prende o usuário no estático.
  const timer = setTimeout(() => finish(), timeoutMs);

  function finish() {
    if (done) return;
    done = true;
    observer.disconnect();
    clearTimeout(timer);
    revealApp(doc);
  }

  observer.observe(root, { childList: true, subtree: true });
  return () => {
    done = true;
    observer.disconnect();
    clearTimeout(timer);
  };
}
