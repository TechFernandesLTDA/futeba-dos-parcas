#!/usr/bin/env node
/**
 * #4629: backfill de quem saiu ou foi removido de um grupo antes do deploy
 * de onMemberDepartedCleanupGames. Essas pessoas continuam nos jogos
 * futuros do grupo (confirmações PENDING, WAITLIST, às vezes CONFIRMED, e a
 * fila de espera); o trigger só age em saídas novas.
 *
 * Seguro por padrão (somente leitura):
 *   cd functions && npm run build
 *   node lib/scripts/backfill-departed-member-games.js
 *
 * Aplicação explícita:
 *   node lib/scripts/backfill-departed-member-games.js --apply --project=futebadosparcas
 *
 * A limpeza é a do trigger (cleanupDepartedMemberGames), não uma cópia:
 * mesmos jogos (SCHEDULED e CONFIRMED, sem soft delete), mesmos status
 * cancelados e a mesma passagem da vaga quando a pessoa estava NOTIFIED na
 * fila (cada passagem manda o push de vaga ao próximo da fila).
 *
 * Quem entra: vínculo em groups/{grupo}/members/{pessoa} que não está ativo
 * (INACTIVE, REMOVED, BLOCKED, BANNED), fora do merge de contas
 * (merged_to_uid). Vínculo apagado não é encontrado e fica de fora.
 *
 * Jogo aberto ao público: quem saiu pode entrar de novo como avulso. Só é
 * desfeito o que foi criado até a data da saída (updated_at do vínculo);
 * sem essa data (a saída pelo Android não grava), o item fica e é contado.
 *
 * Idempotente: cada escrita relê o documento, e a passagem da vaga usa a
 * claim member_departed:backfill:{grupo}:{pessoa}:{jogo}, então rodar de
 * novo não chama outra pessoa para a mesma vaga.
 */

import * as admin from "firebase-admin";
import {db} from "../_db";
import {isActiveMember} from "../groups/member-counter";
import {
  cleanupDepartedMemberGames,
  DepartureCleanupResult,
} from "../groups/member-departure-cleanup";

const DEFAULT_PROJECT_ID = "futebadosparcas";

export interface BackfillOptions {
  help: boolean;
  apply: boolean;
  projectId: string;
}

export interface DepartedMember {
  groupId: string;
  userId: string;
  status: string;
  departedAt: Date | null;
}

type Totals = Omit<DepartureCleanupResult, "games"> & {
  pessoasComAlgo: number;
};

/**
 * @param {string[]} argv argumentos da linha de comando
 * @return {BackfillOptions} opções do backfill
 */
export function parseArgs(argv: string[]): BackfillOptions {
  const args = new Set(argv);
  const projectArg = argv.find((arg) => arg.startsWith("--project="));
  return {
    help: args.has("--help") || args.has("-h"),
    apply: args.has("--apply"),
    projectId: projectArg ?
      projectArg.slice("--project=".length) :
      process.env.GCLOUD_PROJECT || DEFAULT_PROJECT_ID,
  };
}

/**
 * @param {unknown} value updated_at do vínculo
 * @return {Date | null} data, ou null se não houver
 */
function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Date) return value;
  const maybe = value as {toDate?: () => Date} | null | undefined;
  return typeof maybe?.toDate === "function" ? maybe.toDate() : null;
}

/**
 * Lista os vínculos que deixaram de ser ativos. Sem where() no collection
 * group, para não depender de índice COLLECTION_GROUP.
 *
 * @param {FirebaseFirestore.Firestore} firestore cliente
 * @return {Promise<object>} pessoas que saíram e contagens do scan
 */
export async function scanDepartedMembers(
  firestore: FirebaseFirestore.Firestore = db(),
): Promise<{
  departed: DepartedMember[];
  scanned: number;
  mergedSkipped: number;
  byStatus: Record<string, number>;
}> {
  const snap = await firestore
    .collectionGroup("members")
    .select("status", "merged_to_uid", "updated_at")
    .get();
  const departed: DepartedMember[] = [];
  const byStatus: Record<string, number> = {};
  let scanned = 0;
  let mergedSkipped = 0;

  for (const memberDoc of snap.docs) {
    const parts = memberDoc.ref.path.split("/");
    if (parts.length !== 4 || parts[0] !== "groups" || parts[2] !== "members") {
      continue;
    }
    scanned += 1;
    const data = memberDoc.data() as Record<string, unknown>;
    if (isActiveMember(data)) continue;
    if (typeof data.merged_to_uid === "string" && data.merged_to_uid) {
      mergedSkipped += 1;
      continue;
    }
    const status = String(data.status);
    byStatus[status] = (byStatus[status] || 0) + 1;
    departed.push({
      groupId: parts[1],
      userId: parts[3],
      status,
      departedAt: toDateOrNull(data.updated_at),
    });
  }

  return {departed, scanned, mergedSkipped, byStatus};
}

/**
 * Passa a limpeza do trigger em cada pessoa que saiu.
 *
 * @param {DepartedMember[]} departed pessoas que saíram
 * @param {boolean} dryRun só contar
 * @param {Function} log saída
 * @return {Promise<Totals>} totais
 */
async function cleanAll(
  departed: DepartedMember[],
  dryRun: boolean,
  log: (line: string) => void,
): Promise<Totals> {
  const totals: Totals = {
    confirmationsCancelled: 0,
    waitlistRemoved: 0,
    promotions: 0,
    publicSkipped: 0,
    pessoasComAlgo: 0,
  };
  for (const member of departed) {
    const result = await cleanupDepartedMemberGames(
      member.groupId,
      member.userId,
      `backfill:${member.groupId}:${member.userId}`,
      {dryRun, backfill: {departedAt: member.departedAt}},
    );
    const touched = result.confirmationsCancelled + result.waitlistRemoved +
      result.publicSkipped;
    if (touched === 0) continue;
    totals.pessoasComAlgo += 1;
    totals.confirmationsCancelled += result.confirmationsCancelled;
    totals.waitlistRemoved += result.waitlistRemoved;
    totals.promotions += result.promotions;
    totals.publicSkipped += result.publicSkipped;
    // Só ids e contadores, sem nome nem contato.
    log(`  ${JSON.stringify({
      grupo: member.groupId,
      pessoa: member.userId,
      status: member.status,
      semDataDeSaida: member.departedAt === null,
      ...result,
    })}`);
  }
  return totals;
}

/**
 * @param {object} params modo e saída
 * @return {Promise<object>} totais antes e, no apply, depois
 */
export async function runBackfill(params: {
  apply: boolean;
  log?: (line: string) => void;
}): Promise<{before: Totals; applied?: Totals; after?: Totals}> {
  const log = params.log ?? console.log;
  const scan = await scanDepartedMembers();
  log(`SCAN ${JSON.stringify({
    vinculosAnalisados: scan.scanned,
    saidas: scan.departed.length,
    porStatus: scan.byStatus,
    mergeIgnorados: scan.mergedSkipped,
    semDataDeSaida: scan.departed.filter((m) => !m.departedAt).length,
  })}`);

  const before = await cleanAll(scan.departed, true, log);
  log(`PLANO ${JSON.stringify({
    pessoas: before.pessoasComAlgo,
    confirmacoesACancelar: before.confirmationsCancelled,
    filaARemover: before.waitlistRemoved,
    vagasRepassadas: before.promotions,
    jogoPublicoMantido: before.publicSkipped,
  })}`);

  if (!params.apply) {
    log("DRY-RUN: nenhuma escrita foi executada. Use --apply para confirmar.");
    return {before};
  }

  const applied = await cleanAll(scan.departed, false, () => undefined);
  log(`APLICAÇÃO ${JSON.stringify({
    confirmacoesCanceladas: applied.confirmationsCancelled,
    filaRemovida: applied.waitlistRemoved,
    vagasRepassadas: applied.promotions,
  })}`);

  const after = await cleanAll(scan.departed, true, () => undefined);
  log(`DEPOIS ${JSON.stringify({
    confirmacoesACancelar: after.confirmationsCancelled,
    filaARemover: after.waitlistRemoved,
    jogoPublicoMantido: after.publicSkipped,
  })}`);
  return {before, applied, after};
}

/** Linha de comando. */
async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Uso: node lib/scripts/backfill-departed-member-games.js " +
      "[--apply] [--project=ID]"
    );
    return;
  }
  if (admin.apps.length === 0) {
    admin.initializeApp({projectId: options.projectId});
  }
  console.log(`Projeto: ${options.projectId}`);
  console.log(
    `Emulador: ${process.env.FIRESTORE_EMULATOR_HOST || "não (banco real)"}`
  );
  console.log(`Modo: ${options.apply ? "APPLY" : "DRY-RUN"}`);
  await runBackfill({apply: options.apply});
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
