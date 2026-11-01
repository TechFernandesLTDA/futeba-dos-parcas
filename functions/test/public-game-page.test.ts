/**
 * #4408: visão pública do jogo (prévia OG + JSON sanitizado).
 */
const mockGet = jest.fn();

jest.mock("../src/_db", () => ({
  db: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({get: mockGet})),
    })),
  })),
}));

jest.mock("firebase-functions/v2/https", () => ({
  onRequest: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {error: jest.fn(), warn: jest.fn(), info: jest.fn()},
}));

import {
  APP_SHELL_URL,
  HTML_CACHE_CONTROL,
  JSON_CACHE_CONTROL,
  NO_STORE,
  buildFallbackHtml,
  buildGameMeta,
  buildGenericMeta,
  escapeHtml,
  formatWhen,
  handlePublicGameRequest,
  injectMeta,
  isValidGameId,
  loadAppShell,
  loadPublicGame,
  resetShellCacheForTests,
  sanitizeText,
  toPublicGameView,
  type MinimalResponse,
  type PublicGameDeps,
  type PublicGameView,
} from "../src/games/public-game-page";

const GUARD_SCRIPT =
  "<script>(function(){var d=document.documentElement;})();</script>";

const SHELL = [
  "<!doctype html>",
  "<html lang=\"pt-BR\">",
  "  <head>",
  "    <meta charset=\"UTF-8\" />",
  "    <meta name=\"description\" content=\"Organize peladas.\" />",
  "    <meta name=\"robots\" content=\"noindex, nofollow\" />",
  "    <meta property=\"og:title\" content=\"Futeba dos Parças | Home\" />",
  "    <meta property=\"og:description\" content=\"Organize peladas.\" />",
  "    <meta property=\"og:url\" content=\"https://futebadosparcas.com.br/\" />",
  "    <meta property=\"og:image\" content=\"https://futebadosparcas.com.br/og.jpg\" />",
  "    <meta property=\"og:image:alt\" content=\"Home\" />",
  "    <meta name=\"twitter:title\" content=\"Home\" />",
  "    <meta name=\"twitter:description\" content=\"Organize peladas.\" />",
  "    <meta name=\"twitter:image\" content=\"https://futebadosparcas.com.br/og.jpg\" />",
  "    <meta name=\"twitter:image:alt\" content=\"Home\" />",
  "    <meta name=\"twitter:url\" content=\"https://futebadosparcas.com.br/\" />",
  "    <title>Futeba dos Parças | Organize sua pelada</title>",
  `    ${GUARD_SCRIPT}`,
  "  </head>",
  "  <body><div id=\"root\"></div></body>",
  "</html>",
].join("\n");

/**
 * Documento de jogo público com todos os campos sensíveis presentes, para
 * provar que a projeção os descarta.
 *
 * @param {Record<string, unknown>} overrides campos a sobrescrever
 * @return {Record<string, unknown>} documento cru
 */
function rawGame(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    visibility: "PUBLIC_OPEN",
    status: "SCHEDULED",
    date: "2026-11-07",
    time: "19:00",
    end_time: "20:30",
    location_name: "Arena Parças",
    location_address: "Rua Secreta, 123 - apto 45",
    location_lat: -23.55052,
    location_lng: -46.633308,
    location_lat_approx: -23.551,
    location_lng_approx: -46.633,
    group_id: "group-1",
    group_name: "Pelada de Sábado",
    owner_id: "owner-uid-1",
    owner_name: "João da Silva",
    co_organizers: ["uid-co-1"],
    players: ["uid-a", "uid-b"],
    pix_key: "11999999999",
    pix_beneficiary_name: "João da Silva",
    max_players: 14,
    players_count: 9,
    checkin_qr_token: "segredo",
    ...overrides,
  };
}

interface Captured {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Resposta fake que captura status, cabeçalhos e corpo.
 *
 * @return {{res: MinimalResponse, out: Captured}} resposta e captura
 */
function fakeRes(): {res: MinimalResponse; out: Captured} {
  const out: Captured = {statusCode: 0, headers: {}, body: ""};
  const res: MinimalResponse = {
    status(code: number) {
      out.statusCode = code;
      return res;
    },
    set(field: string, value: string) {
      out.headers[field.toLowerCase()] = value;
      return res;
    },
    send(body: string) {
      out.body = body;
      return res;
    },
  };
  return {res, out};
}

/**
 * Dependências fake do handler.
 *
 * @param {PublicGameView | null | Error} game resultado do loadGame
 * @param {string | null} shell resultado do loadShell
 * @return {PublicGameDeps & {loadGame: jest.Mock}} deps
 */
function deps(
  game: PublicGameView | null | Error,
  shell: string | null = SHELL
): PublicGameDeps & {loadGame: jest.Mock} {
  return {
    loadGame: jest.fn(async () => {
      if (game instanceof Error) throw game;
      return game;
    }),
    loadShell: jest.fn(async () => shell),
  };
}

const PUBLIC_VIEW = toPublicGameView("game-123", rawGame()) as PublicGameView;

describe("toPublicGameView: whitelist e sanitização", () => {
  test("projeta só os campos públicos de um jogo PUBLIC_OPEN", () => {
    expect(PUBLIC_VIEW).toEqual({
      id: "game-123",
      status: "SCHEDULED",
      joinMode: "OPEN",
      date: "2026-11-07",
      time: "19:00",
      endTime: "20:30",
      locationName: "Arena Parças",
      groupName: "Pelada de Sábado",
      maxPlayers: 14,
      playersCount: 9,
      spotsLeft: 5,
    });
  });

  test("nunca expõe nomes, ids, Pix, endereço ou coordenadas", () => {
    const serialized = JSON.stringify(PUBLIC_VIEW);
    for (const secret of [
      "João da Silva",
      "owner-uid-1",
      "uid-co-1",
      "uid-a",
      "11999999999",
      "Rua Secreta",
      "-23.55",
      "-46.63",
      "segredo",
      "group-1",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  test("PUBLIC_CLOSED é público com joinMode CLOSED", () => {
    const view = toPublicGameView("g", rawGame({visibility: "PUBLIC_CLOSED"}));
    expect(view?.joinMode).toBe("CLOSED");
  });

  test.each([
    ["GROUP_ONLY", {visibility: "GROUP_ONLY"}],
    ["sem visibility (legado is_public)", {visibility: undefined, is_public: true}],
    ["visibility desconhecida", {visibility: "PUBLIC"}],
    ["soft-deleted (deleted_at)", {deleted_at: {seconds: 1}}],
    ["soft-deleted (deletedAt)", {deletedAt: new Date()}],
    ["status desconhecido", {status: "DELETED"}],
  ])("jogo %s não é público", (_label, overrides) => {
    expect(toPublicGameView("g", rawGame(overrides))).toBeNull();
  });

  test("documento inexistente não é público", () => {
    expect(toPublicGameView("g", undefined)).toBeNull();
  });

  test("usa dateTime em America/Sao_Paulo quando date/time faltam", () => {
    const view = toPublicGameView("g", rawGame({
      date: undefined,
      time: undefined,
      // 2026-11-07T22:00Z = 19:00 em São Paulo (UTC-3)
      dateTime: {toDate: () => new Date("2026-11-07T22:00:00Z")},
    }));
    expect(view?.date).toBe("2026-11-07");
    expect(view?.time).toBe("19:00");
  });

  test("aceita date_time legado", () => {
    const view = toPublicGameView("g", rawGame({
      date: "lixo",
      time: "25:99",
      date_time: {toDate: () => new Date("2026-11-08T01:30:00Z")},
    }));
    expect(view?.date).toBe("2026-11-07");
    expect(view?.time).toBe("22:30");
  });

  test("lista cheia, contagem negativa e max ausente", () => {
    expect(toPublicGameView("g", rawGame({players_count: 20}))?.spotsLeft).toBe(0);
    expect(toPublicGameView("g", rawGame({players_count: -3}))?.playersCount).toBe(0);
    const noMax = toPublicGameView("g", rawGame({max_players: undefined}));
    expect(noMax?.maxPlayers).toBeNull();
    expect(noMax?.spotsLeft).toBeNull();
  });

  test("sanitizeText remove controles/bidi, colapsa e trunca", () => {
    const rlo = String.fromCharCode(0x202e);
    const zwsp = String.fromCharCode(0x200b);
    expect(sanitizeText(`  Arena\n\u0000${rlo}${zwsp} Norte  `)).toBe("Arena Norte");
    expect(sanitizeText(42)).toBeNull();
    expect(sanitizeText("   ")).toBeNull();
    const long = sanitizeText("a".repeat(200)) as string;
    expect(Array.from(long).length).toBe(80);
    expect(long.endsWith("…")).toBe(true);
  });

  test("isValidGameId rejeita caminhos e caracteres especiais", () => {
    expect(isValidGameId("abcDEF_123-x")).toBe(true);
    for (const bad of ["", "a/b", "..", "a b", "<x>", "a".repeat(129), 7]) {
      expect(isValidGameId(bad)).toBe(false);
    }
  });
});

describe("metas e escape de HTML", () => {
  test("formatWhen em pt-BR", () => {
    expect(formatWhen("2026-11-07", "19:00")).toBe("Sáb, 07/11 às 19:00");
    expect(formatWhen("2026-11-09", null)).toBe("Seg, 09/11");
    expect(formatWhen(null, "19:00")).toBeNull();
  });

  test("buildGameMeta traz data, horário, local, grupo e vagas", () => {
    const meta = buildGameMeta(PUBLIC_VIEW);
    expect(meta.title).toBe(
      "Pelada de Sábado · Sáb, 07/11 às 19:00 | Futeba dos Parças"
    );
    expect(meta.description).toContain("Local: Arena Parças.");
    expect(meta.description).toContain("9 de 14 confirmados, 5 vagas.");
    expect(meta.description).toContain("confirmar presença");
    expect(meta.url).toBe("https://futebadosparcas.com.br/game/game-123");
  });

  test("jogo cancelado não convida a confirmar presença", () => {
    const meta = buildGameMeta({...PUBLIC_VIEW, status: "CANCELLED"});
    expect(meta.description).toContain("Jogo cancelado.");
    expect(meta.description).not.toContain("confirmar presença");
    expect(meta.description).not.toContain("vagas");
  });

  test("escapeHtml cobre & < > \" '", () => {
    expect(escapeHtml("a&b<c>\"d'e")).toBe("a&amp;b&lt;c&gt;&quot;d&#39;e");
  });

  test("XSS no nome do local/grupo sai escapado nas metas", () => {
    const view = toPublicGameView("g", rawGame({
      location_name: "\"><script>alert(1)</script>",
      group_name: "</title><img src=x onerror=alert(1)>",
    })) as PublicGameView;
    const html = injectMeta(SHELL, buildGameMeta(view));
    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;/title&gt;&lt;img src=x onerror=alert(1)&gt;");
  });

  test("padrões de replacement ($&, $1, $') não são interpretados", () => {
    const view = toPublicGameView("g", rawGame({
      location_name: "Campo $& $1 $' $`",
    })) as PublicGameView;
    const html = injectMeta(SHELL, buildGameMeta(view));
    expect(html).toContain("Local: Campo $&amp; $1 $&#39; $`.");
  });

  test("injectMeta troca título/metas e preserva script inline byte a byte", () => {
    const html = injectMeta(SHELL, buildGameMeta(PUBLIC_VIEW));
    expect(html).toContain(GUARD_SCRIPT);
    expect(html).toContain(
      "<title>Pelada de Sábado · Sáb, 07/11 às 19:00 | Futeba dos Parças</title>"
    );
    expect(html).toContain(
      "<meta property=\"og:url\" content=\"https://futebadosparcas.com.br/game/game-123\" />"
    );
    expect(html).toContain(
      "<meta name=\"robots\" content=\"noindex, nofollow\" />"
    );
    expect(html).toContain(
      "<meta property=\"og:image\" content=\"https://futebadosparcas.com.br/og-futeba-dos-parcas.jpg\" />"
    );
    expect(html).not.toContain("Organize peladas.");
    // Uma ocorrência de cada meta: substituição, não duplicação.
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html.match(/<title>/g)).toHaveLength(1);
  });

  test("injectMeta insere meta ausente antes de </head>", () => {
    const shell = SHELL.replace(
      /\s*<meta name="twitter:url"[^>]*>/, ""
    );
    const html = injectMeta(shell, buildGameMeta(PUBLIC_VIEW));
    const tag =
      "<meta name=\"twitter:url\" content=\"https://futebadosparcas.com.br/game/game-123\" />";
    const idx = html.indexOf(tag);
    expect(idx).toBeGreaterThan(-1);
    expect(idx).toBeLessThan(html.indexOf("</head>"));
  });

  test("fallback mínimo tem metas e é noindex", () => {
    const html = buildFallbackHtml(buildGameMeta(PUBLIC_VIEW));
    expect(html).toContain("og:title");
    expect(html).toContain("noindex, nofollow");
    expect(html).toContain("href=\"/login\"");
    expect(html).not.toContain("<title>x</title>");
  });
});

describe("handlePublicGameRequest", () => {
  test("HTML de jogo público: shell com metas do jogo e cache de CDN", async () => {
    const {res, out} = fakeRes();
    await handlePublicGameRequest(
      {method: "GET", path: "/game/game-123"}, res, deps(PUBLIC_VIEW)
    );
    expect(out.statusCode).toBe(200);
    expect(out.headers["content-type"]).toContain("text/html");
    expect(out.headers["cache-control"]).toBe(HTML_CACHE_CONTROL);
    expect(out.body).toContain("Pelada de Sábado");
    expect(out.body).toContain("<div id=\"root\"></div>");
  });

  test("privado, inexistente e id inválido dão HTML idêntico (sem oráculo)", async () => {
    const a = fakeRes();
    await handlePublicGameRequest(
      {method: "GET", path: "/game/privado"}, a.res, deps(null)
    );
    const b = fakeRes();
    await handlePublicGameRequest(
      {method: "GET", path: "/game/nao-existe"}, b.res, deps(null)
    );
    const c = fakeRes();
    const invalidDeps = deps(PUBLIC_VIEW);
    await handlePublicGameRequest(
      {method: "GET", path: "/game/%3Cx%3E"}, c.res, invalidDeps
    );
    expect(invalidDeps.loadGame).not.toHaveBeenCalled();
    expect(a.out.statusCode).toBe(200);
    expect(a.out.body).toBe(b.out.body);
    expect(a.out.body).toBe(c.out.body);
    expect(a.out.body).toContain(buildGenericMeta().title);
    expect(a.out.body).not.toContain("privado");
  });

  test("erro de leitura no HTML serve metas genéricas sem cache", async () => {
    const {res, out} = fakeRes();
    await handlePublicGameRequest(
      {method: "GET", path: "/game/game-123"}, res, deps(new Error("boom"))
    );
    expect(out.statusCode).toBe(200);
    expect(out.headers["cache-control"]).toBe(NO_STORE);
    expect(out.body).toContain(buildGenericMeta().title);
  });

  test("sem shell disponível usa fallback mínimo sem cache", async () => {
    const {res, out} = fakeRes();
    await handlePublicGameRequest(
      {method: "GET", path: "/game/game-123"}, res, deps(PUBLIC_VIEW, null)
    );
    expect(out.statusCode).toBe(200);
    expect(out.headers["cache-control"]).toBe(NO_STORE);
    expect(out.body).toContain("<!doctype html>");
    expect(out.body).toContain("Pelada de Sábado");
  });

  test("JSON de jogo público devolve só a visão pública", async () => {
    const {res, out} = fakeRes();
    await handlePublicGameRequest(
      {method: "GET", path: "/api/public-game/game-123"}, res, deps(PUBLIC_VIEW)
    );
    expect(out.statusCode).toBe(200);
    expect(out.headers["content-type"]).toContain("application/json");
    expect(out.headers["cache-control"]).toBe(JSON_CACHE_CONTROL);
    expect(JSON.parse(out.body)).toEqual({game: PUBLIC_VIEW});
  });

  test("JSON: privado/inexistente/inválido dão o mesmo 404", async () => {
    const a = fakeRes();
    await handlePublicGameRequest(
      {method: "GET", path: "/api/public-game/privado"}, a.res, deps(null)
    );
    const b = fakeRes();
    await handlePublicGameRequest(
      {method: "GET", path: "/api/public-game/a.b"}, b.res, deps(PUBLIC_VIEW)
    );
    expect(a.out.statusCode).toBe(404);
    expect(b.out.statusCode).toBe(404);
    expect(a.out.body).toBe(b.out.body);
    expect(JSON.parse(a.out.body)).toEqual({error: "not_found"});
  });

  test("JSON: erro de leitura vira 503 sem cache", async () => {
    const {res, out} = fakeRes();
    await handlePublicGameRequest(
      {method: "GET", path: "/api/public-game/g1"}, res, deps(new Error("x"))
    );
    expect(out.statusCode).toBe(503);
    expect(out.headers["cache-control"]).toBe(NO_STORE);
  });

  test("método diferente de GET/HEAD é 405", async () => {
    const {res, out} = fakeRes();
    await handlePublicGameRequest(
      {method: "POST", path: "/game/g1"}, res, deps(PUBLIC_VIEW)
    );
    expect(out.statusCode).toBe(405);
  });

  test("rota desconhecida é 404 e não lê o Firestore", async () => {
    const {res, out} = fakeRes();
    const d = deps(PUBLIC_VIEW);
    await handlePublicGameRequest(
      {method: "GET", path: "/game/g1/live"}, res, d
    );
    expect(out.statusCode).toBe(404);
    expect(d.loadGame).not.toHaveBeenCalled();
  });
});

describe("loadPublicGame (Admin SDK)", () => {
  beforeEach(() => mockGet.mockReset());

  test("inexistente vira null", async () => {
    mockGet.mockResolvedValue({exists: false, data: () => undefined});
    await expect(loadPublicGame("g")).resolves.toBeNull();
  });

  test("GROUP_ONLY vira null", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => rawGame({visibility: "GROUP_ONLY"}),
    });
    await expect(loadPublicGame("g")).resolves.toBeNull();
  });

  test("soft-deleted vira null", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => rawGame({deleted_at: {seconds: 10}}),
    });
    await expect(loadPublicGame("g")).resolves.toBeNull();
  });

  test("público vira visão sanitizada", async () => {
    mockGet.mockResolvedValue({exists: true, data: () => rawGame()});
    await expect(loadPublicGame("game-123")).resolves.toEqual(PUBLIC_VIEW);
  });
});

describe("loadAppShell", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    resetShellCacheForTests();
  });

  /**
   * Resposta fake de fetch.
   *
   * @param {number} status status HTTP
   * @param {string} body corpo
   * @param {string | null} etag ETag
   * @return {object} resposta
   */
  function fetchResponse(status: number, body: string, etag: string | null = null) {
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: {get: (name: string) => (name.toLowerCase() === "etag" ? etag : null)},
      text: async () => body,
    };
  }

  test("busca da URL fixa e reaproveita sem rede dentro da janela de revalidação", async () => {
    const fetchMock = jest.fn(async () => fetchResponse(200, SHELL, "\"v1\""));
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(loadAppShell(1000)).resolves.toBe(SHELL);
    await expect(loadAppShell(2000)).resolves.toBe(SHELL);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe(APP_SHELL_URL);
  });

  test("revalida com If-None-Match: 304 reusa o cache, 200 troca o shell", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(fetchResponse(200, SHELL, "\"v1\""))
      .mockResolvedValueOnce(fetchResponse(304, "", "\"v1\""))
      .mockResolvedValueOnce(fetchResponse(200, SHELL.replace("Home", "Nova"), "\"v2\""));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(loadAppShell(0)).resolves.toBe(SHELL);
    await expect(loadAppShell(60_000)).resolves.toBe(SHELL);
    const secondInit = (fetchMock.mock.calls[1] as unknown[])[1] as {
      headers: Record<string, string>;
    };
    expect(secondInit.headers["If-None-Match"]).toBe("\"v1\"");

    const updated = await loadAppShell(120_000);
    expect(updated).toContain("Nova");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("shell inválido ou HTTP de erro: null sem cache, último válido se houver", async () => {
    global.fetch = jest.fn(async () =>
      fetchResponse(200, "<html>sem root</html>")) as unknown as typeof fetch;
    await expect(loadAppShell(1000)).resolves.toBeNull();

    global.fetch = jest.fn(async () =>
      fetchResponse(200, SHELL)) as unknown as typeof fetch;
    await expect(loadAppShell(1000)).resolves.toBe(SHELL);

    global.fetch = jest.fn(async () =>
      fetchResponse(500, "")) as unknown as typeof fetch;
    // Na revalidação a busca falha, mas o último shell válido continua.
    await expect(loadAppShell(1000 + 10 * 60 * 1000)).resolves.toBe(SHELL);
  });
});
