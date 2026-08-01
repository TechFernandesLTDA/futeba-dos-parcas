import {onSchedule} from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {FUNCTION_REGION} from "../constants";
import {getMonthName} from "./season-naming";

const db = () => admin.firestore();

const BRT_TIMEZONE = "America/Sao_Paulo";

// FIX #3908: doc de estado (cursor persistido) por cron. Mesma coleção que
// gamification-nudges.ts usa para o seu próprio cursor (`system_state`).
const SEASON_CURSOR_COLLECTION = "system_state";
const START_SEASON_CURSOR_DOC = "season_cycle_start_cursor";
const ARCHIVE_SEASON_CURSOR_DOC = "season_cycle_archive_cursor";

// FIX #3908: orçamento de tempo por execução, com folga para o
// `timeoutSeconds: 540` declarado nas duas funções. Ao atingir, persistimos
// o cursor e encerramos; a execução seguinte retoma de onde parou.
const SEASON_CYCLE_TIME_BUDGET_MS = 450_000;
// FIX #3908: concorrência controlada no laço por grupo. Mais conservadora
// que os 10 de gamification-nudges.ts porque cada grupo aqui custa até 6
// round trips (archiveSeason), não 1.
const SEASON_CYCLE_CONCURRENCY = 5;

/**
 * FIX #3896: os crons varriam o catalogo `official-groups` (11 entradas
 * curadas por seedOfficialGroups), e nao os grupos reais. Grupo criado por
 * usuario nunca recebia documento de temporada, entao a aba Liga ficava
 * permanentemente no estado vazio "liga nao comecou".
 *
 * Passamos a cobrir tambem todo grupo que ja tem temporada ativa — inclusive
 * as provisionadas sob demanda por onGameFinishedGroupLeague.
 *
 * FIX #3908: o comentario anterior afirmava que grupo dormente (sem
 * temporada ativa) ficava de fora "de proposito" — falso. Nao existe
 * criterio de dormencia: uma vez que um grupo entra aqui (basta um jogo
 * finalizado), `startNewSeason` recria a temporada dele TODO mes, para
 * sempre. O conjunto gerenciado eh `official-groups` (sempre incluido,
 * independente de atividade) uniao todo grupo com `league_seasons` ativa
 * — e esse segundo termo so cresce, por decisao (ver D2.4 da spec
 * BUGFIX_3908), nao por bug de implementacao incompleta. Podar grupo
 * dormente do conjunto fica fora de escopo: uma vez que o laco por grupo
 * tem cursor persistido e orcamento de tempo (abaixo), o tamanho do
 * conjunto deixa de ser um problema de corretude (nenhuma invocacao morre
 * sem deixar estado de retomada) e vira so um problema de custo.
 *
 * A consulta usa apenas o campo `is_active`, entao o indice de campo unico
 * automatico do Firestore ja atende o escopo de collection group. E uma
 * unica query (nao um round trip por grupo) — o custo que de fato limitava
 * o teto de tempo era o laco sequencial por grupo, tratado abaixo.
 *
 * @return {Promise<string[]>} Ids de grupo a gerenciar.
 */
async function listManagedGroupIds(): Promise<string[]> {
  const groupIds = new Set<string>();

  const officialSnap = await db().collection("official-groups").get();
  for (const doc of officialSnap.docs) groupIds.add(doc.id);

  const activeSeasonsSnap = await db()
    .collectionGroup("league_seasons")
    .where("is_active", "==", true)
    .get();
  for (const doc of activeSeasonsSnap.docs) {
    const groupId = doc.ref.parent.parent?.id;
    if (groupId) groupIds.add(groupId);
  }

  return Array.from(groupIds);
}

type SeasonStanding = admin.firestore.DocumentData;

/**
 * FIX #3882: calcula a chave YYYY-MM do mês seguinte.
 * Usada para criar/ativar a próxima temporada NO MESMO batch que
 * desativa a atual, eliminando a janela de ~61min sem temporada ativa
 * entre o archiveSeason (23:59 do último dia) e o startNewSeason
 * (01:00 do dia 1º).
 *
 * @param {string} monthKey - Chave YYYY-MM do mês atual.
 * @return {string} Chave YYYY-MM do mês seguinte.
 */
export function getNextMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${nextMonth.toString().padStart(2, "0")}`;
}

/**
 * FIX #3916: calcula a chave YYYY-MM do mês anterior. Inversa de
 * {@link getNextMonthKey}. Usada pelo catch-up de archiveSeason quando a
 * invocação das 23:59 escorrega para depois da meia-noite (jitter, cold
 * start, retry) — nesse caso hoje já é dia 1º e o mês a arquivar é o
 * anterior, não o corrente.
 *
 * @param {string} monthKey Chave YYYY-MM do mês de referência.
 * @return {string} Chave YYYY-MM do mês anterior.
 */
export function getPreviousMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return `${prevYear}-${prevMonth.toString().padStart(2, "0")}`;
}

/**
 * Monta o payload arquivado sem campos undefined. Firestore rejeita undefined,
 * então temporadas sem standings precisam ser arquiváveis mesmo vazias.
 *
 * @param {string} monthKey - Chave YYYY-MM da temporada.
 * @param {SeasonStanding[]} standings - Ranking final da temporada.
 * @param {unknown} archivedAt - Timestamp ou sentinel de archive.
 * @return {Record<string, unknown>} Payload seguro para Firestore.
 */
export function buildSeasonArchivePayload(
  monthKey: string,
  standings: SeasonStanding[],
  archivedAt: unknown
): Record<string, unknown> {
  const mvp = standings[0] ?? null;
  const lanterninha = standings.length > 1 ?
    standings[standings.length - 1] :
    null;

  return {
    month_key: monthKey,
    name: `Temporada ${getMonthName(monthKey)}`,
    standings,
    mvp_user_id: mvp?.user_id ?? null,
    mvp_user_name: mvp?.user_name ?? null,
    mvp_points: mvp?.points ?? null,
    lanterninha_user_id: lanterninha?.user_id ?? null,
    lanterninha_user_name: lanterninha?.user_name ?? null,
    archived_at: archivedAt,
  };
}

type SeasonCycleCursorState = {
  month_key?: string;
  last_group_id?: string;
};

export type SeasonCycleRunOptions = {
  timeBudgetMs?: number;
  concurrency?: number;
  now?: () => number;
};

/**
 * FIX #3908: executa `worker` sobre `items` com concorrência limitada. Cada
 * tarefa resolve independentemente (Promise.allSettled): a rejeição de uma
 * não aborta o lote. Réplica local (não importada de gamification-nudges.ts
 * — ver D2.1 da spec BUGFIX_3908) do mesmo utilitário usado no #3875.
 *
 * @template T
 * @param {Array<T>} items Itens a processar.
 * @param {number} concurrency Tamanho máximo do lote concorrente.
 * @param {Function} worker Tarefa a executar por item.
 * @return {Promise<void>} Resolve quando todos os itens terminarem.
 */
async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  for (let start = 0; start < items.length; start += concurrency) {
    const batch = items.slice(start, start + concurrency);
    await Promise.allSettled(batch.map((item) => worker(item)));
  }
}

/**
 * FIX #3908: núcleo compartilhado dos dois crons — varre `managedGroupIds`
 * em páginas de tamanho `concurrency`, retomando de `cursorState` quando
 * presente e persistindo o cursor ao esgotar `timeBudgetMs`.
 *
 * A lista já está inteira em memória (uma única query, não N round trips),
 * então a retomada não precisa de paginação Firestore — só de um índice na
 * lista ordenada. `findIndex(id => id > lastGroupId)` retoma do primeiro id
 * estritamente maior que o cursor, robusto a grupo removido entre execuções
 * (mesmo raciocínio do #3901: não exigir existência do cursor, só posição).
 *
 * @param {object} params Configuração da varredura.
 * @param {FirebaseFirestore.DocumentReference} params.cursorRef Doc do cursor.
 * @param {object} params.cursorState Estado persistido, já filtrado por quem
 *   chama (só passar quando o month_key bate com o desta execução —
 *   caso contrário é execução nova).
 * @param {string} params.monthKey Mês sendo processado (para log e cursor).
 * @param {number} params.timeBudgetMs Orçamento de tempo desta execução.
 * @param {number} params.concurrency Tamanho da página/concorrência.
 * @param {Function} params.now Relógio injetável (testes).
 * @param {Function} params.processGroup Callback por grupo — já deve isolar
 *   seus próprios erros (try/catch interno).
 * @param {string} params.logLabel Prefixo dos logs desta varredura.
 * @return {Promise<void>} Resolve ao terminar a página atual ou a lista.
 */
async function runManagedGroupsCycle(params: {
  cursorRef: FirebaseFirestore.DocumentReference;
  cursorState: SeasonCycleCursorState | undefined;
  monthKey: string;
  timeBudgetMs: number;
  concurrency: number;
  now: () => number;
  processGroup: (groupId: string) => Promise<void>;
  logLabel: string;
}): Promise<void> {
  const {
    cursorRef, cursorState, monthKey, timeBudgetMs,
    concurrency, now, processGroup, logLabel,
  } = params;
  const startedAt = now();

  // FIX #3916: persiste o month_key ANTES de listar grupos, para que uma
  // falha transitória em listManagedGroupIds() deixe estado de retomada.
  // Sem isso, se a listagem falhar no último dia, a invocação morre sem
  // cursor — e sem retryCount/retry, o mês ficaria sem archive. Com o
  // cursor pré-setado, o retry (via retryCount: 3 nos onSchedule) encontra
  // o month_key pendente e retoma. {merge: true} preserva last_group_id
  // de uma corrida parcial anterior.
  await cursorRef.set({
    month_key: monthKey,
    updated_at: Timestamp.fromDate(new Date(now())),
    ...(cursorState?.month_key !== monthKey ?
      {last_group_id: FieldValue.delete()} : {}),
  }, {merge: true});

  let managedGroupIds: string[];
  try {
    managedGroupIds = (await listManagedGroupIds()).sort();
  } catch (err) {
    logger.error(`${logLabel}: falha ao listar grupos, cursor persistido para retry`, {
      monthKey, err,
    });
    return;
  }

  let startIndex = 0;
  const lastGroupId = cursorState?.last_group_id;
  if (typeof lastGroupId === "string" && lastGroupId.length > 0) {
    const resumeIndex = managedGroupIds.findIndex((id) => id > lastGroupId);
    startIndex = resumeIndex === -1 ? managedGroupIds.length : resumeIndex;
  }

  const pending = managedGroupIds.slice(startIndex);

  if (pending.length === 0) {
    await cursorRef.delete();
    logger.info(logLabel, {
      monthKey,
      groups: managedGroupIds.length,
      processedThisRun: 0,
    });
    return;
  }

  let truncated = false;
  let lastProcessedGroupId: string | null = null;

  for (let i = 0; i < pending.length; i += concurrency) {
    const page = pending.slice(i, i + concurrency);
    await runWithConcurrency(page, concurrency, processGroup);
    lastProcessedGroupId = page[page.length - 1];

    const isLastPage = i + concurrency >= pending.length;
    if (isLastPage) break;

    // Persiste o cursor ANTES da checagem de orçamento, para que uma parada
    // por tempo já deixe o ponto de retomada gravado (mesma ordem de
    // gamification-nudges.ts).
    await cursorRef.set({
      month_key: monthKey,
      last_group_id: lastProcessedGroupId,
      updated_at: Timestamp.fromDate(new Date(now())),
    });

    if (now() - startedAt >= timeBudgetMs) {
      truncated = true;
      logger.info(`${logLabel}: orçamento de tempo atingido, cursor persistido`, {
        monthKey,
        lastProcessedGroupId,
        totalGroups: managedGroupIds.length,
      });
      break;
    }
  }

  if (!truncated) {
    await cursorRef.delete();
    logger.info(logLabel, {
      monthKey,
      groups: managedGroupIds.length,
    });
  }
}

/**
 * Cria/reativa `groups/{groupId}/league_seasons/{monthKey}` e repara
 * qualquer outra temporada que tenha ficado ativa (mês diferente do atual)
 * — inclusive a deixada por uma corrida do provisionamento sob demanda em
 * group-league.ts.
 *
 * @param {string} groupId Id do grupo.
 * @param {string} monthKey Chave YYYY-MM do mês a criar/ativar.
 * @return {Promise<void>} Resolve ao terminar (erros são isolados e logados).
 */
async function processStartNewSeasonForGroup(
  groupId: string,
  monthKey: string,
): Promise<void> {
  try {
    const seasonsRef = db()
      .collection("groups")
      .doc(groupId)
      .collection("league_seasons");
    const seasonRef = seasonsRef.doc(monthKey);

    const [exists, activeSeasonsSnap] = await Promise.all([
      seasonRef.get(),
      seasonsRef.where("is_active", "==", true).get(),
    ]);

    const batch = db().batch();
    let repairedActiveSeasons = 0;

    for (const activeSeasonDoc of activeSeasonsSnap.docs) {
      if (activeSeasonDoc.id === monthKey) continue;
      batch.update(activeSeasonDoc.ref, {
        is_active: false,
        end_date: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
      repairedActiveSeasons += 1;
    }

    if (exists.exists) {
      const currentSeasonData = exists.data() || {};
      const shouldReactivate =
        currentSeasonData.is_active !== true;

      if (shouldReactivate) {
        batch.set(seasonRef, {
          is_active: true,
          updated_at: FieldValue.serverTimestamp(),
        }, {merge: true});
      }

      if (repairedActiveSeasons > 0 || shouldReactivate) {
        await batch.commit();
      }

      logger.info("Season already exists", {
        groupId,
        monthKey,
        repairedActiveSeasons,
        activatedExistingSeason: shouldReactivate,
      });
      return;
    }

    batch.set(seasonRef, {
      name: `Temporada ${getMonthName(monthKey)}`,
      is_active: true,
      start_date: FieldValue.serverTimestamp(),
      created_at: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    logger.info("Created season", {
      groupId,
      monthKey,
      repairedActiveSeasons,
    });
  } catch (err) {
    logger.error("Error creating season", {groupId, monthKey, err});
  }
}

/**
 * Arquiva `groups/{groupId}/league_seasons/{monthKey}` e vira atomicamente
 * para o mês seguinte (FIX #3882).
 *
 * FIX #3908: idempotência por EXISTÊNCIA DO ARQUIVO, não por `is_active`.
 * Como `archiveSeason` agora pode retomar em dias depois da virada de mês
 * (D2.2 da spec), `startNewSeason` — já rodando para o mês seguinte — pode
 * alcançar este grupo primeiro e desativar a season antiga como parte do
 * seu próprio reparo. Se o guard continuasse olhando `is_active`, o mês
 * ficaria sem `season-archive` para sempre (o mesmo tipo de perda
 * silenciosa que o #3908 denuncia). Checar a existência do doc de archive
 * torna a função idempotente por natureza — pré-requisito para poder
 * rodar em múltiplos dias sem duplicar arquivo.
 *
 * @param {string} groupId Id do grupo.
 * @param {string} monthKey Chave YYYY-MM do mês a arquivar.
 * @return {Promise<void>} Resolve ao terminar (erros são isolados e logados).
 */
async function processArchiveSeasonForGroup(
  groupId: string,
  monthKey: string,
): Promise<void> {
  try {
    const seasonRef = db()
      .collection("groups")
      .doc(groupId)
      .collection("league_seasons")
      .doc(monthKey);
    const archiveRef = db()
      .collection("season-archive")
      .doc(groupId)
      .collection("seasons")
      .doc(monthKey);

    const [seasonDoc, archiveDoc] = await Promise.all([
      seasonRef.get(),
      archiveRef.get(),
    ]);
    if (!seasonDoc.exists) return;
    if (archiveDoc.exists) return;

    // FIX #2770: filtrar por season_id antes de ordenar,
    // pois league_standings acumula histórico de todas as temporadas
    // (doc id = `${seasonId}_${userId}`, campo season_id).
    // Sem o filtro, MVP/lanterninha misturavam temporadas anteriores.
    const standingsSnap = await db()
      .collection("groups")
      .doc(groupId)
      .collection("league_standings")
      .where("season_id", "==", monthKey)
      .orderBy("points", "desc")
      .get();

    const standings = standingsSnap.docs.map((d) => d.data());
    const mvp = standings[0] ?? null;

    await archiveRef.set(buildSeasonArchivePayload(
      monthKey,
      standings,
      FieldValue.serverTimestamp()
    ));

    // FIX #3882: virada atômica — cria/ativa a próxima temporada NO
    // MESMO batch que desativa a atual. Antes, a desativação às 23:59
    // do último dia deixava ~61min sem nenhuma season is_active==true
    // até o startNewSeason (01:00 do dia 1º), e partidas de liga
    // finalizadas nessa janela eram descartadas permanentemente pelo
    // onGameFinishedGroupLeague. O startNewSeason vira um repair
    // idempotente (já trata "season already exists" + ativa).
    const nextMonthKey = getNextMonthKey(monthKey);
    const nextSeasonRef = db()
      .collection("groups")
      .doc(groupId)
      .collection("league_seasons")
      .doc(nextMonthKey);
    const nextSeasonDoc = await nextSeasonRef.get();

    const turnoverBatch = db().batch();
    turnoverBatch.update(seasonRef, {
      is_active: false,
      end_date: FieldValue.serverTimestamp(),
    });
    if (nextSeasonDoc.exists) {
      // Já existe (criada manualmente ou por run anterior): só ativa.
      turnoverBatch.set(nextSeasonRef, {
        is_active: true,
        updated_at: FieldValue.serverTimestamp(),
      }, {merge: true});
    } else {
      turnoverBatch.set(nextSeasonRef, {
        name: `Temporada ${getMonthName(nextMonthKey)}`,
        is_active: true,
        start_date: FieldValue.serverTimestamp(),
        created_at: FieldValue.serverTimestamp(),
      });
    }
    await turnoverBatch.commit();

    if (mvp?.user_id) {
      const badgesRef = db()
        .collection("users")
        .doc(mvp.user_id)
        .collection("badges");
      await badgesRef.doc(`mvp_liga_${monthKey}`).set({
        badge_id: `mvp_liga_${monthKey}`,
        name: `MVP da Liga - ${getMonthName(monthKey)}`,
        icon: "🏆",
        type: "MVP_LIGA",
        earned_at: FieldValue.serverTimestamp(),
        earned: true,
      });
    } else if (mvp) {
      logger.warn("Season archived without MVP badge due to missing user_id", {
        groupId,
        monthKey,
        mvp,
      });
    }

    logger.info("Archived season", {
      groupId,
      monthKey,
      mvp: mvp?.user_name,
      players: standings.length,
    });
  } catch (err) {
    logger.error("Error archiving season", {groupId, monthKey, err});
  }
}

/**
 * FIX #3908: exportada com options (mesmo espírito de runGamificationNudges
 * em gamification-nudges.ts) para que os testes dirijam retomada de cursor,
 * orçamento de tempo e portão de dia sem depender de fake timers globais.
 * O handler agendado (mais abaixo) usa os padrões de produção.
 *
 * @param {SeasonCycleRunOptions} options Overrides de teste (orçamento,
 *   concorrência, relógio injetável).
 * @return {Promise<void>} Resolve ao terminar a página atual ou a lista.
 */
export async function runStartNewSeason(
  options: SeasonCycleRunOptions = {},
): Promise<void> {
  const now = options.now ?? Date.now;
  const timeBudgetMs = options.timeBudgetMs ?? SEASON_CYCLE_TIME_BUDGET_MS;
  const concurrency = options.concurrency ?? SEASON_CYCLE_CONCURRENCY;

  const todayStr = new Date(now()).toLocaleDateString("en-CA", {
    timeZone: BRT_TIMEZONE,
  });
  const [yearStr, monthStr, dayStr] = todayStr.split("-");
  const monthKey = `${yearStr}-${monthStr}`;
  const isDayOne = dayStr === "01";

  // FIX #3908: schedule passou de mensal ("0 1 1 * *") para diário — sem
  // isso, uma execução truncada só teria chance de retomar no dia 1º do MÊS
  // SEGUINTE. O portão abaixo lê só o doc de cursor (1 leitura pequena)
  // antes de decidir se vale a pena chamar listManagedGroupIds() — nos
  // outros ~29 dias do mês, sem cursor pendente, o custo fica nesse único
  // get().
  const cursorRef = db()
    .collection(SEASON_CURSOR_COLLECTION)
    .doc(START_SEASON_CURSOR_DOC);
  const cursorSnap = await cursorRef.get();
  const cursorState = cursorSnap.data() as SeasonCycleCursorState | undefined;
  const hasPendingResume = cursorState?.month_key === monthKey;

  if (!isDayOne && !hasPendingResume) {
    return;
  }

  logger.info("Starting new season", {monthKey, resumed: hasPendingResume});

  await runManagedGroupsCycle({
    cursorRef,
    cursorState: hasPendingResume ? cursorState : undefined,
    monthKey,
    timeBudgetMs,
    concurrency,
    now,
    processGroup: (groupId) => processStartNewSeasonForGroup(groupId, monthKey),
    logLabel: "New seasons started",
  });
}

/**
 * FIX #3908: contraparte de {@link runStartNewSeason} para o arquivamento
 * mensal. Ver D2.2/D2.3 da spec BUGFIX_3908 — o portão prioriza cursor
 * pendente (retomar arquivamento de um mês anterior) sobre "é o último dia
 * do mês corrente?".
 *
 * @param {SeasonCycleRunOptions} options Overrides de teste (orçamento,
 *   concorrência, relógio injetável).
 * @return {Promise<void>} Resolve ao terminar a página atual ou a lista.
 */
export async function runArchiveSeason(
  options: SeasonCycleRunOptions = {},
): Promise<void> {
  const now = options.now ?? Date.now;
  const timeBudgetMs = options.timeBudgetMs ?? SEASON_CYCLE_TIME_BUDGET_MS;
  const concurrency = options.concurrency ?? SEASON_CYCLE_CONCURRENCY;

  const todayStr = new Date(now()).toLocaleDateString("en-CA", {
    timeZone: BRT_TIMEZONE,
  });
  const [yearStr, monthStr, dayStr] = todayStr.split("-");
  const lastDayOfMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();
  const isLastDay = Number(dayStr) === lastDayOfMonth;

  const cursorRef = db()
    .collection(SEASON_CURSOR_COLLECTION)
    .doc(ARCHIVE_SEASON_CURSOR_DOC);
  const cursorSnap = await cursorRef.get();
  const cursorState = cursorSnap.data() as SeasonCycleCursorState | undefined;
  const pendingMonthKey = cursorState?.month_key;

  // FIX #3908: o month_key do cursor de archive é o MÊS SENDO ARQUIVADO —
  // não o mês da invocação. Retomar em 2 de agosto pode significar terminar
  // de arquivar julho; por isso, ao contrário de startNewSeason, aqui a
  // presença de cursor pendente tem prioridade sobre o portão de dia.
  let monthKey: string;
  let resumed: boolean;
  if (typeof pendingMonthKey === "string" && pendingMonthKey.length > 0) {
    monthKey = pendingMonthKey;
    resumed = true;
  } else if (isLastDay) {
    monthKey = `${yearStr}-${monthStr}`;
    resumed = false;
  } else if (Number(dayStr) === 1) {
    // FIX #3916: catch-up para jitter/retry pós-meia-noite. Se a invocação
    // das 23:59 do ultimo dia escorregou para depois da meia-noite, hoje ja
    // e dia 1. Sem cursor pendente, o mes anterior seria perdido para sempre
    // (nenhum outro caminho o arquivaria). Tratar como retomada do mes
    // anterior cobre jitter, cold start e retry pos-virada. A idempotencia
    // por existencia do archive (processArchiveSeasonForGroup) garante que
    // nao duplica se o mes ja foi arquivado no dia anterior.
    monthKey = getPreviousMonthKey(`${yearStr}-${monthStr}`);
    resumed = false;
  } else {
    return;
  }

  logger.info("Archiving season", {monthKey, resumed});

  await runManagedGroupsCycle({
    cursorRef,
    cursorState: resumed ? cursorState : undefined,
    monthKey,
    timeBudgetMs,
    concurrency,
    now,
    processGroup: (groupId) => processArchiveSeasonForGroup(groupId, monthKey),
    logLabel: "Seasons archived",
  });
}

export const startNewSeason = onSchedule(
  {
    schedule: "0 1 * * *",
    timeZone: BRT_TIMEZONE,
    region: FUNCTION_REGION,
    timeoutSeconds: 540,
    memory: "512MiB",
    retryCount: 3,
  },
  async () => {
    await runStartNewSeason();
  }
);

export const archiveSeason = onSchedule(
  {
    schedule: "59 23 * * *",
    timeZone: BRT_TIMEZONE,
    region: FUNCTION_REGION,
    timeoutSeconds: 540,
    memory: "512MiB",
    retryCount: 3,
  },
  async () => {
    await runArchiveSeason();
  }
);
