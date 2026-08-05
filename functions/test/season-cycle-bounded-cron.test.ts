/**
 * FIX #3908 — regressão do fix do #3896 (`ab7e969d`): os crons de
 * temporada passaram a cobrir todo grupo com temporada ativa (conjunto
 * ilimitado), mas o laço por grupo continuava sequencial, sem cursor
 * persistido e sem `timeoutSeconds` explícito. Ao estourar o teto, o
 * rollover mensal truncava sempre na mesma cauda (ordem determinística),
 * e um grupo truncado ficava com a temporada do mês anterior presa em
 * `is_active:true` para sempre — corrompendo standings.
 *
 * Este arquivo cobre o que `growth-season-cycle-scheduler.test.ts` e
 * `season-turnover-race.test.ts` não cobrem: o TAMANHO do laço e a
 * truncagem por tempo (ver observações da issue #3908).
 */
const store = new Map<string, Record<string, unknown>>();
const loggerInfo = jest.fn();
const loggerWarn = jest.fn();
const loggerError = jest.fn();

const scheduledHandlers: Array<() => Promise<void>> = [];

function snap(path: string) {
  const data = store.get(path);
  return {
    id: path.split("/").pop(),
    path,
    exists: data !== undefined,
    ref: docRef(path),
    data: () => data,
  };
}

function collectionDocs(pathPrefix: string) {
  const prefix = `${pathPrefix}/`;
  return Array.from(store.entries())
    .filter(([path]) =>
      path.startsWith(prefix) &&
      path.slice(prefix.length).split("/").length === 1)
    .map(([path]) => snap(path));
}

function isDeleteSentinel(value: unknown): boolean {
  return Boolean(value) &&
    typeof value === "object" &&
    (value as {__fieldValueDelete?: boolean}).__fieldValueDelete === true;
}

function applySet(path: string, data: Record<string, unknown>, merge = false) {
  const current = store.get(path) || {};
  if (!merge) {
    store.set(path, data);
    return;
  }
  const merged = {...current};
  for (const [key, value] of Object.entries(data)) {
    if (isDeleteSentinel(value)) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  store.set(path, merged);
}

function applyUpdate(path: string, data: Record<string, unknown>) {
  const current = store.get(path) || {};
  store.set(path, {...current, ...data});
}

function docRef(path: string) {
  return {
    id: path.split("/").pop(),
    path,
    get: jest.fn(async () => snap(path)),
    set: jest.fn(async (data: Record<string, unknown>, options?: {merge?: boolean}) =>
      applySet(path, data, options?.merge)),
    update: jest.fn(async (data: Record<string, unknown>) =>
      applyUpdate(path, data)),
    delete: jest.fn(async () => {
      store.delete(path);
    }),
    collection: (name: string) => collectionRef(`${path}/${name}`),
  };
}

function queryRef(
  pathPrefix: string,
  filters: Array<{field: string; value: unknown}> = []
) {
  return {
    get: jest.fn(async () => {
      const docs = collectionDocs(pathPrefix).filter((doc) => {
        const data = doc.data() ?? {};
        return filters.every((filter) => data[filter.field] === filter.value);
      });
      return {docs, empty: docs.length === 0, size: docs.length};
    }),
    where: (field: string, _op: string, value: unknown) =>
      queryRef(pathPrefix, [...filters, {field, value}]),
    orderBy: () => queryRef(pathPrefix, filters),
    limit: () => queryRef(pathPrefix, filters),
  };
}

function collectionRef(pathPrefix: string) {
  return {
    doc: (id: string) => docRef(`${pathPrefix}/${id}`),
    get: jest.fn(async () => {
      const docs = collectionDocs(pathPrefix);
      return {docs, empty: docs.length === 0, size: docs.length};
    }),
    where: (field: string, _op: string, value: unknown) =>
      queryRef(pathPrefix, [{field, value}]),
    limit: () => queryRef(pathPrefix),
  };
}

// Conta quantas vezes o collectionGroup foi consultado — usado para provar
// que o portão barato (dia não-1º/não-último sem cursor pendente) retorna
// ANTES de listManagedGroupIds() chamar isso.
let collectionGroupCalls = 0;

function collectionGroupRef(
  name: string,
  filters: Array<{field: string; value: unknown}> = []
) {
  return {
    where: (field: string, _op: string, value: unknown) =>
      collectionGroupRef(name, [...filters, {field, value}]),
    limit: () => collectionGroupRef(name, filters),
    get: jest.fn(async () => {
      collectionGroupCalls += 1;
      const docs = Array.from(store.keys())
        .filter((path) => {
          const parts = path.split("/");
          return parts.length >= 3 && parts[parts.length - 2] === name;
        })
        .filter((path) => {
          const data = (store.get(path) ?? {}) as Record<string, unknown>;
          return filters.every((f) => data[f.field] === f.value);
        })
        .map((path) => {
          const parts = path.split("/");
          return {
            id: parts[parts.length - 1],
            data: () => store.get(path),
            ref: {path, parent: {parent: {id: parts[parts.length - 3]}}},
          };
        });
      return {docs, empty: docs.length === 0, size: docs.length};
    }),
  };
}

const firestore = {
  collection: jest.fn((name: string) => collectionRef(name)),
  collectionGroup: jest.fn((name: string) => collectionGroupRef(name)),
  batch: jest.fn(() => {
    const ops: Array<() => void> = [];
    return {
      set: (ref: {path: string}, data: Record<string, unknown>, options?: {merge?: boolean}) => {
        ops.push(() => applySet(ref.path, data, options?.merge));
      },
      update: (ref: {path: string}, data: Record<string, unknown>) => {
        ops.push(() => applyUpdate(ref.path, data));
      },
      commit: jest.fn(async () => {
        ops.forEach((op) => op());
      }),
    };
  }),
};

jest.mock("firebase-admin", () => ({
  firestore: jest.fn(() => firestore),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({__serverTimestamp: true})),
    delete: jest.fn(() => ({__fieldValueDelete: true})),
  },
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({__timestamp: date.toISOString()})),
  },
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_config: unknown, handler: () => Promise<void>) => {
    scheduledHandlers.push(handler);
    return handler;
  }),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: loggerInfo,
    warn: loggerWarn,
    error: loggerError,
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
let seasonCycle: typeof import("../src/growth/season-cycle");

describe("FIX #3908 — crons de temporada com cursor persistido e orçamento de tempo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
    scheduledHandlers.length = 0;
    collectionGroupCalls = 0;

    jest.isolateModules(() => {
      seasonCycle = require("../src/growth/season-cycle");
    });
  });

  function seedActiveSeason(groupId: string, monthKey: string, extra: Record<string, unknown> = {}) {
    store.set(`groups/${groupId}/league_seasons/${monthKey}`, {
      is_active: true,
      name: `Temporada ${monthKey}`,
      ...extra,
    });
  }

  it(
    "startNewSeason: orçamento esgotado persiste cursor; execução seguinte cobre a cauda sem reprocessar a cabeça",
    async () => {
      // Três grupos ordenam alfabeticamente group-a < group-b < group-c.
      // Concurrency=1 + timeBudgetMs=0 força truncagem logo após a
      // primeira página (o relógio de parede real já avança >=1ms entre a
      // marcação de início e a checagem de orçamento).
      seedActiveSeason("group-a", "2026-06");
      seedActiveSeason("group-b", "2026-06");
      seedActiveSeason("group-c", "2026-06");

      // Dia 1º de julho às 04:00 UTC = 01:00 America/Sao_Paulo — mesmo
      // instante nas duas execuções, para isolar a variável em teste
      // (orçamento) da data.
      const dayOneNow = () => new Date("2026-07-01T04:00:00Z").getTime();

      await seasonCycle.runStartNewSeason({
        now: dayOneNow,
        concurrency: 1,
        timeBudgetMs: 0,
      });

      // 1ª execução: só group-a processado (orçamento zerado corta antes
      // da 2ª página).
      expect(store.get("groups/group-a/league_seasons/2026-07"))
        .toMatchObject({is_active: true});
      expect(store.get("groups/group-b/league_seasons/2026-07")).toBeUndefined();
      expect(store.get("groups/group-c/league_seasons/2026-07")).toBeUndefined();

      const cursorAfterFirstRun = store.get("system_state/season_cycle_start_cursor");
      expect(cursorAfterFirstRun).toEqual(expect.objectContaining({
        month_key: "2026-07",
        last_group_id: "group-a",
      }));

      // 2ª execução (mesmo dia, sem orçamento artificial): retoma de
      // group-b — NÃO reprocessa group-a.
      await seasonCycle.runStartNewSeason({now: dayOneNow});

      expect(store.get("groups/group-b/league_seasons/2026-07"))
        .toMatchObject({is_active: true});
      expect(store.get("groups/group-c/league_seasons/2026-07"))
        .toMatchObject({is_active: true});
      // Varredura concluída: cursor apagado.
      expect(store.has("system_state/season_cycle_start_cursor")).toBe(false);
      expect(loggerError).not.toHaveBeenCalled();
    },
  );

  it(
    "archiveSeason arquiva grupo cuja season já foi desativada por startNewSeason " +
    "(reparo do mês seguinte alcançou o grupo primeiro) — sem isso, mês fica sem archive para sempre",
    async () => {
      // Cenário: archiveSeason começou a arquivar julho, truncou por
      // orçamento antes de alcançar group-tail. Chegou o dia 1º de agosto,
      // e startNewSeason (que já cobre o mês novo) alcançou group-tail
      // primeiro — seu reparo desativa qualquer season ativa que não seja
      // 2026-08, incluindo a de julho, ANTES de archiveSeason processar
      // esse grupo.
      store.set("groups/group-tail/league_seasons/2026-07", {
        is_active: false, // já desativada pelo reparo de startNewSeason
        name: "Temporada Julho de 2026",
      });
      store.set("groups/group-tail/league_seasons/2026-08", {
        is_active: true,
        name: "Temporada Agosto de 2026",
      });
      store.set("groups/group-tail/league_standings/2026-07_u1", {
        season_id: "2026-07",
        user_id: "u1",
        user_name: "Jogador 1",
        points: 10,
      });
      // Cursor pendente deixado pela execução truncada de archiveSeason em
      // 31/07 — ainda arquivando julho.
      store.set("system_state/season_cycle_archive_cursor", {
        month_key: "2026-07",
        last_group_id: "group-s",
      });

      // Hoje é 2 de agosto — NÃO é o último dia do mês, mas há cursor
      // pendente para julho.
      await seasonCycle.runArchiveSeason({
        now: () => new Date("2026-08-02T03:00:00Z").getTime(),
      });

      // Sem o fix, o guard antigo (`if (!seasonDoc.data()?.is_active) continue`)
      // pularia este grupo para sempre — nenhum archive seria gravado.
      expect(store.get("season-archive/group-tail/seasons/2026-07"))
        .toMatchObject({month_key: "2026-07"});
      expect(loggerError).not.toHaveBeenCalled();
    },
  );

  it(
    "startNewSeason: cursor pendente já cobre todo o conjunto gerenciado " +
    "(retomada sem trabalho restante) apaga o cursor sem reprocessar ninguém",
    async () => {
      // Cursor deixado por uma execução anterior que processou TODOS os
      // grupos gerenciados até o fim (last_group_id >= qualquer id atual).
      // Pode acontecer se o conjunto encolheu entre execuções (grupo
      // deixou de ter temporada ativa) ou se a varredura terminou bem na
      // borda da última página sem a checagem de orçamento disparar.
      seedActiveSeason("group-a", "2026-06");
      store.set("groups/group-a/league_seasons/2026-07", {
        is_active: true,
        name: "Já processado",
      });
      store.set("system_state/season_cycle_start_cursor", {
        month_key: "2026-07",
        last_group_id: "group-z",
      });

      await seasonCycle.runStartNewSeason({
        now: () => new Date("2026-07-05T04:00:00Z").getTime(),
      });

      // group-a não foi reprocessado (nome customizado preservado).
      expect(store.get("groups/group-a/league_seasons/2026-07"))
        .toMatchObject({name: "Já processado"});
      expect(store.has("system_state/season_cycle_start_cursor")).toBe(false);
      expect(loggerInfo).toHaveBeenCalledWith(
        "New seasons started",
        expect.objectContaining({processedThisRun: 0}),
      );
    },
  );

  it("startNewSeason: dia não-1º sem cursor pendente retorna sem consultar listManagedGroupIds", async () => {
    seedActiveSeason("group-a", "2026-06");

    await seasonCycle.runStartNewSeason({
      now: () => new Date("2026-07-15T04:00:00Z").getTime(),
    });

    expect(collectionGroupCalls).toBe(0);
    expect(store.get("groups/group-a/league_seasons/2026-07")).toBeUndefined();
  });

  it("archiveSeason: dia não-último sem cursor pendente retorna sem consultar listManagedGroupIds", async () => {
    seedActiveSeason("group-a", "2026-07");

    await seasonCycle.runArchiveSeason({
      now: () => new Date("2026-07-15T03:00:00Z").getTime(),
    });

    expect(collectionGroupCalls).toBe(0);
    expect(store.get("groups/group-a/league_seasons/2026-07")).toMatchObject({
      is_active: true,
    });
  });

  it("startNewSeason: dia não-1º COM cursor pendente do mês corrente retoma (não reinicia)", async () => {
    seedActiveSeason("group-a", "2026-06");
    seedActiveSeason("group-b", "2026-06");
    store.set("system_state/season_cycle_start_cursor", {
      month_key: "2026-07",
      last_group_id: "group-a",
    });

    await seasonCycle.runStartNewSeason({
      now: () => new Date("2026-07-02T04:00:00Z").getTime(),
    });

    // group-a NÃO é reprocessado (segue sem doc de julho) — só group-b.
    expect(store.get("groups/group-a/league_seasons/2026-07")).toBeUndefined();
    expect(store.get("groups/group-b/league_seasons/2026-07"))
      .toMatchObject({is_active: true});
    expect(store.has("system_state/season_cycle_start_cursor")).toBe(false);
  });

  // FIX #3916: se a invocação das 23:59 do último dia escorrega para depois
  // da meia-noite (jitter, cold start, retry), hoje já é dia 1º. Sem cursor
  // pendente e sem catch-up, o mês anterior seria perdido para sempre.
  it(
    "archiveSeason: dia 1º sem cursor arquiva o mês anterior (catch-up pós-meia-noite)",
    async () => {
      // Season de julho ativa + standings para poder arquivar.
      seedActiveSeason("group-a", "2026-07");
      store.set("groups/group-a/league_standings/2026-07_u1", {
        season_id: "2026-07",
        user_id: "u1",
        user_name: "Jogador 1",
        points: 10,
      });

      // Hoje é 1º de agosto às 03:00 UTC = 00:00 BRT — exatamente o cenário
      // de jitter pós-meia-noite. Sem cursor pendente.
      await seasonCycle.runArchiveSeason({
        now: () => new Date("2026-08-01T03:00:00Z").getTime(),
      });

      // O mês anterior (julho) foi arquivado — não perdido.
      expect(store.get("season-archive/group-a/seasons/2026-07"))
        .toMatchObject({month_key: "2026-07"});
      expect(loggerError).not.toHaveBeenCalled();
    },
  );

  // FIX #3916: falha transitória em listManagedGroupIds() no último dia deve
  // deixar cursor persistido para que o retry (via retryCount) retome.
  it(
    "archiveSeason: falha de listManagedGroupIds no último dia persiste cursor para retry",
    async () => {
      seedActiveSeason("group-a", "2026-07");

      // Simula falha transitória na listagem de grupos.
      const originalCollectionGroup = firestore.collectionGroup;
      firestore.collectionGroup = jest.fn(() => {
        throw new Error("transient firestore error");
      });

      // 31 de julho (último dia) às 03:00 UTC = 00:00 BRT.
      await seasonCycle.runArchiveSeason({
        now: () => new Date("2026-07-31T03:00:00Z").getTime(),
      });

      // O cursor foi persistido com o month_key correto, pronto para retry.
      const cursor = store.get("system_state/season_cycle_archive_cursor");
      expect(cursor).toEqual(expect.objectContaining({month_key: "2026-07"}));

      // Nada foi arquivado (listagem falhou antes do processamento).
      expect(store.get("season-archive/group-a/seasons/2026-07")).toBeUndefined();

      // Restaura o mock para o retry simulado.
      firestore.collectionGroup = originalCollectionGroup;

      // Retry no mesmo dia: encontra o cursor pendente e arquiva normalmente.
      await seasonCycle.runArchiveSeason({
        now: () => new Date("2026-07-31T03:00:00Z").getTime(),
      });

      expect(store.get("season-archive/group-a/seasons/2026-07"))
        .toMatchObject({month_key: "2026-07"});
      expect(loggerError).toHaveBeenCalledWith(
        expect.stringContaining("falha ao listar grupos"),
        expect.anything(),
      );
    },
  );

  // FIX #3916: mês já arquivado não é reprocessado — idempotência por
  // existência do archive (catch-up no dia 1 não duplica).
  it(
    "archiveSeason: dia 1º não reprocessa mês já arquivado (idempotência)",
    async () => {
      // Julho já foi arquivado (no dia 31); hoje é 1º de agosto.
      store.set("groups/group-a/league_seasons/2026-07", {
        is_active: false,
        name: "Temporada Julho de 2026",
      });
      store.set("season-archive/group-a/seasons/2026-07", {
        month_key: "2026-07",
        name: "Temporada Julho de 2026",
        standings: [],
        archived_at: {__serverTimestamp: true},
      });

      await seasonCycle.runArchiveSeason({
        now: () => new Date("2026-08-01T03:00:00Z").getTime(),
      });

      // O archive existente foi preservado (não sobrescrito, não duplicado).
      const archive = store.get("season-archive/group-a/seasons/2026-07");
      expect(archive).toMatchObject({month_key: "2026-07"});
      // standings continua vazio — não foi reprocessado.
      expect(archive.standings).toEqual([]);
    });

  // FIX #3930: {merge: true} no pre-persist preservava last_group_id do mês
  // anterior quando a invocação caía no dia 1º do mês novo. Se
  // listManagedGroupIds() falhava, o cursor persistia com month_key novo mas
  // last_group_id velho; no dia seguinte, a retomada (findIndex > last_group_id)
  // pulava todos os grupos ≤ last_group_id para o mês novo inteiro.
  it(
    "startNewSeason: cursor last_group_id do mês anterior não vence no dia 1º " +
    "do mês novo quando listManagedGroupIds falha",
    async () => {
      // groupA/groupB < "groupM" < groupZ — sem o fix, só groupZ seria
      // processado (findIndex(id > "groupM")); com o fix, todos os três.
      seedActiveSeason("groupA", "2026-08");
      seedActiveSeason("groupB", "2026-08");
      seedActiveSeason("groupZ", "2026-08");

      // Cursor deixado pelo mês anterior (agosto): last_group_id="groupM".
      store.set("system_state/season_cycle_start_cursor", {
        month_key: "2026-08",
        last_group_id: "groupM",
      });

      // 1ª execução: 1º de setembro. Simula falha transitória em
      // listManagedGroupIds() — o cursor deve ser pré-persistido com
      // month_key="2026-09" e last_group_id REMOVIDO.
      const originalCollectionGroup = firestore.collectionGroup;
      firestore.collectionGroup = jest.fn(() => {
        throw new Error("transient firestore error");
      });

      await seasonCycle.runStartNewSeason({
        now: () => new Date("2026-09-01T04:00:00Z").getTime(),
      });

      firestore.collectionGroup = originalCollectionGroup;

      // O cursor pré-persistido NÃO pode reter last_group_id="groupM".
      const cursorAfterFailure =
        store.get("system_state/season_cycle_start_cursor");
      expect(cursorAfterFailure).toEqual(expect.objectContaining({month_key: "2026-09"}));
      expect(cursorAfterFailure).not.toHaveProperty("last_group_id");

      // 2ª execução: 2 de setembro. Retoma pelo cursor pendente — deve
      // processar TODOS os grupos, não só > "groupM".
      await seasonCycle.runStartNewSeason({
        now: () => new Date("2026-09-02T04:00:00Z").getTime(),
      });

      expect(store.get("groups/groupA/league_seasons/2026-09"))
        .toMatchObject({is_active: true});
      expect(store.get("groups/groupB/league_seasons/2026-09"))
        .toMatchObject({is_active: true});
      expect(store.get("groups/groupZ/league_seasons/2026-09"))
        .toMatchObject({is_active: true});
      expect(store.has("system_state/season_cycle_start_cursor")).toBe(false);
      expect(loggerError).toHaveBeenCalledWith(
        expect.stringContaining("falha ao listar grupos"),
        expect.anything(),
      );
    },
  );
});
