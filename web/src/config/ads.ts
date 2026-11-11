/**
 * Configuração e regras dos anúncios web (Google AdSense).
 *
 * Tudo aqui é desligado por padrão: sem `VITE_ADSENSE_PUBLISHER_ID` nenhum script do
 * AdSense é carregado e nenhum espaço é reservado na tela.
 *
 * CONSENTIMENTO (LGPD / EEE / Reino Unido):
 * - O público é do Brasil (LGPD). Para EEE e Reino Unido o Google exige uma mensagem de
 *   consentimento certificada (Funding Choices / CMP do Google). NÃO existe CMP próprio aqui.
 * - Na fase 2, ative a mensagem de consentimento no painel do AdSense (Privacidade e mensagens).
 *   O script do AdSense só é carregado depois da decisão sobre anúncios; ponto de configuração:
 *   `hasAdsConsent()` abaixo (hoje sempre true porque a mensagem é gerenciada pelo próprio Google).
 * - Padrão conservador: anúncios não personalizados (`requestNonPersonalizedAds = 1`).
 *   Para personalizar, defina `VITE_ADSENSE_NON_PERSONALIZED=0` (só depois de a CMP estar ativa).
 */

const PUBLISHER_ID_PATTERN = /^ca-pub-\d{10,20}$/;

export interface AdsConfig {
  publisherId: string;
  bannerSlot: string;
  nonPersonalized: boolean;
}

/** Lê e valida as variáveis de ambiente. Retorna null quando os anúncios estão desligados. */
export function getAdsConfig(env: Record<string, string | undefined> = import.meta.env): AdsConfig | null {
  const publisherId = (env.VITE_ADSENSE_PUBLISHER_ID ?? '').trim();
  const bannerSlot = (env.VITE_ADSENSE_SLOT_BANNER ?? '').trim();
  if (!publisherId || !bannerSlot || !PUBLISHER_ID_PATTERN.test(publisherId)) return null;
  const npa = (env.VITE_ADSENSE_NON_PERSONALIZED ?? '1').trim();
  return { publisherId, bannerSlot, nonPersonalized: npa !== '0' };
}

/** Ponto de extensão do consentimento. Ver comentário no topo do arquivo. */
export function hasAdsConsent(): boolean {
  return true;
}

/** Páginas públicas de conteúdo (SEO) com texto próprio suficiente para exibir anúncio. */
const PUBLIC_CONTENT_PATHS = new Set([
  '/organizar-pelada',
  '/ranking-futebol-amador',
  '/gestao-de-pelada',
  '/como-funciona',
]);

/** Abas da Home (?tab=) liberadas: 0 início, 1 jogos, 3 ranking. Fora: 2 grupos e 4 perfil. */
const HOME_ALLOWED_TABS = new Set(['0', '1', '3']);

function normalizePath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] || '/';
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/**
 * LISTA DE PERMISSÃO: só estas rotas podem mostrar anúncio. Qualquer rota nova fica sem
 * anúncio até ser incluída aqui de propósito (pagamento, caixa, admin, dono de quadra,
 * login, onboarding, erro, jogo ao vivo etc. nunca entram).
 */
export function isAdsAllowedPath(pathname: string, search = ''): boolean {
  const path = normalizePath(pathname);
  if (PUBLIC_CONTENT_PATHS.has(path)) return true;
  if (path === '/') {
    const tab = new URLSearchParams(search).get('tab');
    return tab === null || HOME_ALLOWED_TABS.has(tab);
  }
  return false;
}

/**
 * Ponto de extensão: assinante de "Sem anúncios".
 *
 * LIMITAÇÃO: a assinatura é comprada nos apps (Google Play / App Store) e o direito vale só
 * na loja; a web não tem como conferir isso. Enquanto não houver validação no servidor
 * (ex.: Cloud Function que consulta o recibo e expõe o resultado), quem assina no app AINDA
 * VÊ anúncio na web. Não grave flag `noAds` no Firestore pelo cliente.
 */
export function useAdsFree(): boolean {
  return false;
}
