/**
 * #4408: visão pública do jogo para compartilhar.
 *
 * O link de um jogo (`https://futebadosparcas.com.br/game/{id}`) chega no
 * WhatsApp e em outras redes. Os crawlers não executam JS, então a prévia
 * (og:title/og:description) precisa vir no HTML. Esta function HTTP atende
 * dois rewrites do Firebase Hosting:
 *
 * - `GET /game/{id}`: devolve o `app-shell.html` publicado no Hosting com
 *   SÓ as metas de título/descrição/Open Graph/Twitter trocadas. O React sobe
 *   normalmente: logado cai no GameDetailScreen, visitante na página pública.
 * - `GET /api/public-game/{id}`: JSON com os campos públicos sanitizados,
 *   consumido pela página pública do web (same-origin, cabe na CSP).
 *
 * Privacidade (spec feat-2026-11-01-web-public-game-4408):
 * - Só jogos com `visibility` PUBLIC_OPEN ou PUBLIC_CLOSED e sem
 *   `deleted_at` são públicos (mesma whitelist da regra de `get` em
 *   firestore.rules). Qualquer outra coisa falha fechado.
 * - Jogo privado, inexistente ou soft-deleted produz a MESMA resposta
 *   (HTML com metas genéricas / JSON 404), sem oráculo de existência.
 * - Nunca sai nome, foto, telefone ou id de jogador, nem nome do dono, Pix,
 *   coordenadas ou endereço completo. No máximo contagem de vagas.
 * - firestore.rules NÃO muda: a leitura é feita com Admin SDK aqui.
 */
import {onRequest} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {FUNCTION_REGION} from "../constants";
import {db} from "../_db";

export const PUBLIC_SITE_URL = "https://futebadosparcas.com.br";
// URL fixa: nunca derivar do Host da requisição.
export const APP_SHELL_URL = `${PUBLIC_SITE_URL}/app-shell.html`;
export const DEFAULT_OG_IMAGE = `${PUBLIC_SITE_URL}/og-futeba-dos-parcas.jpg`;
export const SITE_NAME = "Futeba dos Parças";

const GAME_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const PUBLIC_VISIBILITIES = new Set(["PUBLIC_OPEN", "PUBLIC_CLOSED"]);
const KNOWN_STATUSES = new Set([
  "SCHEDULED",
  "CONFIRMED",
  "LIVE",
  "FINISHED",
  "CANCELLED",
]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const TEXT_MAX = 80;
// Controles C0/C1, zero-width e marcas de direção bidi (U+200B..U+200F,
// U+202A..U+202E, U+2066..U+2069). Montado por código para manter o fonte
// em ASCII.
const UNSAFE_CHARS_RE = new RegExp(
  "[" +
  [[0x00, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x202a, 0x202e],
    [0x2066, 0x2069]]
    .map(([a, b]) =>
      `\\u${a.toString(16).padStart(4, "0")}-` +
      `\\u${b.toString(16).padStart(4, "0")}`)
    .join("") +
  "]",
  "g"
);
// O Hosting devolve ETag no app-shell.html: revalidação condicional barata.
const SHELL_REVALIDATE_MS = 15 * 1000;
const SHELL_FETCH_TIMEOUT_MS = 3000;
const MAX_PLAYERS_CAP = 1000;

// HTML: navegador sempre revalida (após deploy do hosting os hashes de
// /assets mudam); CDN do Hosting segura 1 min (purgada a cada deploy). Curto
// para limitar a janela em que um shell antigo, servido logo após o deploy,
// fica na CDN.
export const HTML_CACHE_CONTROL = "public, max-age=0, s-maxage=60";
// JSON: curto, porque a visibilidade do jogo pode mudar.
export const JSON_CACHE_CONTROL = "public, max-age=60, s-maxage=300";
export const NO_STORE = "no-store";

export type PublicGameStatus =
  "SCHEDULED" | "CONFIRMED" | "LIVE" | "FINISHED" | "CANCELLED";

/** Campos públicos de um jogo. Whitelist: nada além disto sai da function. */
export interface PublicGameView {
  id: string;
  status: PublicGameStatus;
  joinMode: "OPEN" | "CLOSED";
  date: string | null;
  time: string | null;
  endTime: string | null;
  locationName: string | null;
  groupName: string | null;
  maxPlayers: number | null;
  playersCount: number;
  spotsLeft: number | null;
}

export interface PageMeta {
  title: string;
  description: string;
  url: string;
  imageAlt: string;
}

/**
 * Valida o id vindo da URL.
 *
 * @param {unknown} value segmento cru
 * @return {boolean} true se é um id de documento aceitável
 */
export function isValidGameId(value: unknown): value is string {
  return typeof value === "string" && GAME_ID_RE.test(value);
}

/**
 * Escapa texto para uso em conteúdo e atributos HTML.
 *
 * @param {string} value texto
 * @return {string} texto escapado
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Normaliza texto livre vindo do Firestore: remove caracteres de controle e
 * de direção bidi, colapsa espaços e trunca.
 *
 * @param {unknown} value valor cru
 * @param {number} max tamanho máximo em code points
 * @return {string | null} texto limpo ou null se vazio/não-string
 */
export function sanitizeText(value: unknown, max = TEXT_MAX): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(UNSAFE_CHARS_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const chars = Array.from(cleaned);
  if (chars.length <= max) return cleaned;
  return `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

/**
 * Converte um inteiro não-negativo, ou null.
 *
 * @param {unknown} value valor cru
 * @return {number | null} inteiro >= 0 ou null
 */
function toCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  if (n < 0) return 0;
  return Math.min(n, MAX_PLAYERS_CAP);
}

/**
 * Extrai data e hora locais (America/Sao_Paulo) de um Timestamp.
 *
 * @param {unknown} value Timestamp do Firestore (ou objeto com toDate)
 * @return {{date: string, time: string} | null} data/hora locais
 */
function fromTimestamp(value: unknown): {date: string; time: string} | null {
  const maybe = value as {toDate?: () => Date} | null | undefined;
  if (!maybe || typeof maybe.toDate !== "function") return null;
  const d = maybe.toDate();
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/**
 * Decide se o jogo é público e projeta só os campos públicos.
 *
 * Falha fechado: visibilidade fora da whitelist, soft-delete, status
 * desconhecido ou documento inexistente retornam null.
 *
 * @param {string} id id do documento
 * @param {Record<string, unknown> | undefined} data dados do documento
 * @return {PublicGameView | null} visão pública ou null
 */
export function toPublicGameView(
  id: string,
  data: Record<string, unknown> | undefined
): PublicGameView | null {
  if (!data) return null;
  const visibility = data.visibility;
  if (typeof visibility !== "string" || !PUBLIC_VISIBILITIES.has(visibility)) {
    return null;
  }
  // Soft-delete: qualquer valor presente em deleted_at (ou flags legadas)
  // tira o jogo do ar.
  if (
    (data.deleted_at !== undefined && data.deleted_at !== null) ||
    (data.deletedAt !== undefined && data.deletedAt !== null) ||
    data.is_deleted === true ||
    data.deleted === true
  ) {
    return null;
  }
  const status = data.status;
  if (typeof status !== "string" || !KNOWN_STATUSES.has(status)) return null;

  // Preferir as strings date/time gravadas pelo escritor (hora local);
  // dateTime/date_time só como fallback, convertido para São Paulo.
  let date = typeof data.date === "string" && DATE_RE.test(data.date) ?
    data.date : null;
  let time = typeof data.time === "string" && TIME_RE.test(data.time) ?
    data.time : null;
  if (!date || !time) {
    const ts = fromTimestamp(data.dateTime) ?? fromTimestamp(data.date_time);
    if (ts) {
      date = date ?? ts.date;
      time = time ?? ts.time;
    }
  }
  const endTime = typeof data.end_time === "string" &&
    TIME_RE.test(data.end_time) ? data.end_time : null;

  const maxPlayers = toCount(data.max_players);
  const playersCount = toCount(data.players_count) ?? 0;
  const spotsLeft = maxPlayers && maxPlayers > 0 ?
    Math.max(0, maxPlayers - playersCount) : null;

  return {
    id,
    status: status as PublicGameStatus,
    joinMode: visibility === "PUBLIC_OPEN" ? "OPEN" : "CLOSED",
    date,
    time,
    endTime,
    locationName: sanitizeText(data.location_name),
    groupName: sanitizeText(data.group_name),
    maxPlayers: maxPlayers && maxPlayers > 0 ? maxPlayers : null,
    playersCount,
    spotsLeft,
  };
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Formata "Sáb, 08/11 às 19:00" a partir de date/time locais.
 *
 * @param {string | null} date YYYY-MM-DD
 * @param {string | null} time HH:mm
 * @return {string | null} rótulo legível ou null
 */
export function formatWhen(
  date: string | null,
  time: string | null
): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map((p) => parseInt(p, 10));
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const dayMonth = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  return time ? `${weekday}, ${dayMonth} às ${time}` : `${weekday}, ${dayMonth}`;
}

/**
 * Monta a frase de vagas.
 *
 * @param {PublicGameView} game visão pública
 * @return {string | null} frase ou null se não há limite de vagas
 */
function spotsSentence(game: PublicGameView): string | null {
  if (game.maxPlayers === null || game.spotsLeft === null) return null;
  const confirmed = `${game.playersCount} de ${game.maxPlayers} confirmados`;
  if (game.spotsLeft === 0) return `${confirmed}, lista cheia.`;
  const vagas = game.spotsLeft === 1 ? "1 vaga" : `${game.spotsLeft} vagas`;
  return `${confirmed}, ${vagas}.`;
}

/**
 * Metas de um jogo público.
 *
 * @param {PublicGameView} game visão pública
 * @return {PageMeta} metas prontas (texto puro, ainda não escapado)
 */
export function buildGameMeta(game: PublicGameView): PageMeta {
  const when = formatWhen(game.date, game.time);
  const head = game.groupName ?? "Pelada";
  const title = when ? `${head} · ${when}` : head;

  const parts: string[] = [];
  if (game.status === "CANCELLED") parts.push("Jogo cancelado.");
  else if (game.status === "FINISHED") parts.push("Jogo encerrado.");
  else if (game.status === "LIVE") parts.push("Jogo em andamento.");
  if (game.locationName) parts.push(`Local: ${game.locationName}.`);
  const spots = spotsSentence(game);
  if (spots && (game.status === "SCHEDULED" || game.status === "CONFIRMED")) {
    parts.push(spots);
  }
  parts.push(game.status === "SCHEDULED" || game.status === "CONFIRMED" ?
    `Entre no ${SITE_NAME} para confirmar presença.` :
    `Veja no ${SITE_NAME}.`);

  return {
    title: `${title} | ${SITE_NAME}`,
    description: parts.join(" "),
    url: `${PUBLIC_SITE_URL}/game/${game.id}`,
    imageAlt: `${title} no ${SITE_NAME}`,
  };
}

/**
 * Metas genéricas: idênticas para jogo privado, inexistente, soft-deleted
 * ou id inválido. Não citam o id para não virar oráculo.
 *
 * @return {PageMeta} metas genéricas
 */
export function buildGenericMeta(): PageMeta {
  return {
    title: `Jogo no ${SITE_NAME}`,
    description:
      `Entre no ${SITE_NAME} para ver os detalhes deste jogo e confirmar ` +
      "presença.",
    url: `${PUBLIC_SITE_URL}/`,
    imageAlt: `${SITE_NAME}: organize sua pelada`,
  };
}

/**
 * Escapa um texto para uso literal dentro de RegExp.
 *
 * @param {string} value texto
 * @return {string} texto escapado
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Troca o content de uma meta (name= ou property=). Se a meta não existir,
 * insere antes de </head>. Usa replacer em função: `$&`, `$1` etc. vindos do
 * Firestore nunca são interpretados.
 *
 * @param {string} html documento
 * @param {"name" | "property"} attr atributo identificador
 * @param {string} key valor do atributo identificador
 * @param {string} value conteúdo em texto puro
 * @return {string} documento atualizado
 */
function setMeta(
  html: string,
  attr: "name" | "property",
  key: string,
  value: string
): string {
  const escaped = escapeHtml(value);
  const re = new RegExp(
    `(<meta\\s+${attr}="${escapeRegExp(key)}"\\s+content=")[^"]*(")`,
    "i"
  );
  if (re.test(html)) {
    return html.replace(re, (_m, open: string, close: string) =>
      `${open}${escaped}${close}`);
  }
  const tag = `    <meta ${attr}="${key}" content="${escaped}" />\n`;
  return html.replace(/<\/head>/i, (m) => `${tag}${m}`);
}

/**
 * Injeta as metas no shell. Só toca `<title>` e `<meta>`; scripts inline
 * (com hash fixo na CSP) permanecem byte a byte iguais.
 *
 * @param {string} shell HTML do app-shell
 * @param {PageMeta} meta metas em texto puro
 * @return {string} HTML com as metas trocadas
 */
export function injectMeta(shell: string, meta: PageMeta): string {
  let html = shell.replace(/<title>[^<]*<\/title>/i, () =>
    `<title>${escapeHtml(meta.title)}</title>`);
  html = setMeta(html, "name", "robots", "noindex, nofollow");
  html = setMeta(html, "name", "description", meta.description);
  html = setMeta(html, "property", "og:title", meta.title);
  html = setMeta(html, "property", "og:description", meta.description);
  html = setMeta(html, "property", "og:url", meta.url);
  html = setMeta(html, "property", "og:image", DEFAULT_OG_IMAGE);
  html = setMeta(html, "property", "og:image:alt", meta.imageAlt);
  html = setMeta(html, "name", "twitter:title", meta.title);
  html = setMeta(html, "name", "twitter:description", meta.description);
  html = setMeta(html, "name", "twitter:url", meta.url);
  html = setMeta(html, "name", "twitter:image", DEFAULT_OG_IMAGE);
  html = setMeta(html, "name", "twitter:image:alt", meta.imageAlt);
  return html;
}

/**
 * Página mínima usada só quando o app-shell não pôde ser obtido. Mantém a
 * prévia correta para crawlers e oferece um link para o app.
 *
 * @param {PageMeta} meta metas em texto puro
 * @return {string} HTML completo
 */
export function buildFallbackHtml(meta: PageMeta): string {
  const base = [
    "<!doctype html>",
    "<html lang=\"pt-BR\">",
    "  <head>",
    "    <meta charset=\"UTF-8\" />",
    "    <meta name=\"viewport\" content=\"width=device-width, " +
      "initial-scale=1.0\" />",
    "    <title>x</title>",
    "  </head>",
    "  <body>",
    "    <main>",
    `      <h1>${escapeHtml(meta.title)}</h1>`,
    `      <p>${escapeHtml(meta.description)}</p>`,
    `      <p><a href="/login">Abrir no ${escapeHtml(SITE_NAME)}</a></p>`,
    "    </main>",
    "  </body>",
    "</html>",
  ].join("\n");
  return injectMeta(base, meta);
}

interface ShellCache {
  html: string;
  etag: string | null;
  checkedAt: number;
}
let shellCache: ShellCache | null = null;

/** Limpa o cache do shell (testes). */
export function resetShellCacheForTests(): void {
  shellCache = null;
}

/**
 * Busca o app-shell publicado no Hosting, com cache em memória revalidado
 * por ETag (GET condicional). Depois de um deploy do web os hashes de
 * /assets mudam; revalidar a cada SHELL_REVALIDATE_MS impede servir (e
 * repovoar a CDN recém-purgada com) um shell que aponta para assets que não
 * existem mais. Em falha, devolve o último shell válido ou null.
 *
 * @param {number} now relógio atual em ms
 * @return {Promise<string | null>} HTML do shell ou null
 */
export async function loadAppShell(now = Date.now()): Promise<string | null> {
  if (shellCache && now - shellCache.checkedAt < SHELL_REVALIDATE_MS) {
    return shellCache.html;
  }
  try {
    const headers: Record<string, string> = {};
    if (shellCache?.etag) headers["If-None-Match"] = shellCache.etag;
    const res = await fetch(APP_SHELL_URL, {
      headers,
      signal: AbortSignal.timeout(SHELL_FETCH_TIMEOUT_MS),
      redirect: "error",
    });
    if (res.status === 304 && shellCache) {
      shellCache = {...shellCache, checkedAt: now};
      return shellCache.html;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    if (!html.includes("<div id=\"root\"></div>") || !/<\/head>/i.test(html)) {
      throw new Error("app-shell sem #root ou </head>");
    }
    shellCache = {html, etag: res.headers.get("etag"), checkedAt: now};
    return html;
  } catch (error) {
    logger.warn("[publicGamePage] falha ao buscar app-shell", {
      error: error instanceof Error ? error.message : String(error),
      hasStaleCache: Boolean(shellCache),
    });
    return shellCache?.html ?? null;
  }
}

/**
 * Lê o jogo com Admin SDK e devolve só a visão pública.
 *
 * @param {string} gameId id validado
 * @return {Promise<PublicGameView | null>} visão pública ou null
 */
export async function loadPublicGame(
  gameId: string
): Promise<PublicGameView | null> {
  const snap = await db().collection("games").doc(gameId).get();
  if (!snap.exists) return null;
  return toPublicGameView(gameId, snap.data());
}

export interface PublicGameDeps {
  loadGame: (gameId: string) => Promise<PublicGameView | null>;
  loadShell: () => Promise<string | null>;
}

/** Subconjunto de Request usado pelo handler. */
export interface MinimalRequest {
  method: string;
  path: string;
}

/** Subconjunto de Response usado pelo handler. */
export interface MinimalResponse {
  status(code: number): MinimalResponse;
  set(field: string, value: string): MinimalResponse;
  send(body: string): unknown;
}

const HTML_ROUTE = /^\/game\/([^/]+)\/?$/;
const JSON_ROUTE = /^\/api\/public-game\/([^/]+)\/?$/;

/**
 * Envia JSON com cabeçalhos seguros.
 *
 * @param {MinimalResponse} res resposta
 * @param {number} code status HTTP
 * @param {unknown} body corpo
 * @param {string} cacheControl Cache-Control
 */
function sendJson(
  res: MinimalResponse,
  code: number,
  body: unknown,
  cacheControl: string
): void {
  res.status(code)
    .set("Content-Type", "application/json; charset=utf-8")
    .set("Cache-Control", cacheControl)
    .set("X-Content-Type-Options", "nosniff")
    .set("X-Robots-Tag", "noindex, nofollow")
    .send(JSON.stringify(body));
}

/**
 * Handler das duas rotas públicas. Dependências injetáveis para teste.
 *
 * @param {MinimalRequest} req requisição
 * @param {MinimalResponse} res resposta
 * @param {PublicGameDeps} deps leitura de jogo e de shell
 * @return {Promise<void>} conclusão
 */
export async function handlePublicGameRequest(
  req: MinimalRequest,
  res: MinimalResponse,
  deps: PublicGameDeps = {loadGame: loadPublicGame, loadShell: loadAppShell}
): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).set("Allow", "GET, HEAD").set("Cache-Control", NO_STORE)
      .send("");
    return;
  }

  const jsonMatch = JSON_ROUTE.exec(req.path);
  if (jsonMatch) {
    const gameId = jsonMatch[1];
    if (!isValidGameId(gameId)) {
      sendJson(res, 404, {error: "not_found"}, JSON_CACHE_CONTROL);
      return;
    }
    let game: PublicGameView | null;
    try {
      game = await deps.loadGame(gameId);
    } catch (error) {
      logger.error("[publicGamePage] falha ao ler jogo (json)", {
        gameId,
        error: error instanceof Error ? error.message : String(error),
      });
      sendJson(res, 503, {error: "unavailable"}, NO_STORE);
      return;
    }
    if (!game) {
      sendJson(res, 404, {error: "not_found"}, JSON_CACHE_CONTROL);
      return;
    }
    sendJson(res, 200, {game}, JSON_CACHE_CONTROL);
    return;
  }

  const htmlMatch = HTML_ROUTE.exec(req.path);
  if (!htmlMatch) {
    res.status(404).set("Cache-Control", NO_STORE)
      .set("Content-Type", "text/plain; charset=utf-8").send("Not found");
    return;
  }

  const gameId = htmlMatch[1];
  let meta = buildGenericMeta();
  let cacheControl = HTML_CACHE_CONTROL;
  if (isValidGameId(gameId)) {
    try {
      const game = await deps.loadGame(gameId);
      if (game) meta = buildGameMeta(game);
    } catch (error) {
      // Erro transitório: serve o shell com metas genéricas (o app ainda
      // abre para o usuário) e não deixa a CDN guardar essa resposta.
      cacheControl = NO_STORE;
      logger.error("[publicGamePage] falha ao ler jogo (html)", {
        gameId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const shell = await deps.loadShell();
  const html = shell ? injectMeta(shell, meta) : buildFallbackHtml(meta);
  res.status(200)
    .set("Content-Type", "text/html; charset=utf-8")
    .set("Cache-Control", shell ? cacheControl : NO_STORE)
    .set("X-Robots-Tag", "noindex, nofollow")
    // Redundantes com o bloco headers "**" do firebase.json, mas garantidos
    // mesmo que o Hosting não os aplique à resposta da function.
    .set("X-Frame-Options", "DENY")
    .set("X-Content-Type-Options", "nosniff")
    .set("Referrer-Policy", "strict-origin-when-cross-origin")
    .send(html);
}

export const publicGamePage = onRequest(
  {
    region: FUNCTION_REGION,
    // Endpoint anônimo atrás da CDN do Hosting: teto baixo de instâncias
    // limita custo em caso de varredura de ids aleatórios.
    maxInstances: 3,
    // Com 256MiB a CPU é fracionária e a concorrência fica em 1 por
    // instância: 3 aberturas simultâneas fora da CDN já dariam 429, inclusive
    // para usuários logados (todo /game/{id} passa por aqui). CPU inteira
    // libera 80 requisições por instância sem subir o teto de instâncias.
    cpu: 1,
    concurrency: 80,
    memory: "512MiB",
    timeoutSeconds: 15,
    invoker: "public",
  },
  async (req, res) => {
    await handlePublicGameRequest(req, res);
  }
);
