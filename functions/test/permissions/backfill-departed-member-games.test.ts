/**
 * #4629: backfill de quem saiu do grupo antes de onMemberDepartedCleanupGames,
 * com o Firestore falso. A limpeza é a mesma função do trigger.
 */

jest.mock("firebase-functions/v2", () => require("./_fake-runtime").functionsV2Module);
jest.mock("firebase-functions", () => require("./_fake-runtime").functionsV2Module);
jest.mock("firebase-functions/v2/firestore", () => require("./_fake-runtime").triggersModule);
jest.mock("firebase-admin/firestore", () => require("./_fake-firestore"));
jest.mock("../../src/_db", () => ({db: () => require("./_fake-firestore").db()}));
jest.mock("../../src/notifications/game-notifications", () => ({
  promoteWaitlistOnVacancy: jest.fn(async () => undefined),
}));

import {resetFakeDb, seed, read, pathsWithPrefix, tsOf} from "./_fake-firestore";

const {
  parseArgs,
  runBackfill,
  scanDepartedMembers,
} = require("../../src/scripts/backfill-departed-member-games");
const {promoteWaitlistOnVacancy} = require("../../src/notifications/game-notifications");

const GROUP = "g1";
const SAIU = "saiu-1";
const DIA = 24 * 60 * 60 * 1000;
const SAIDA = Date.UTC(2026, 9, 10);

function snapshotAll(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const path of pathsWithPrefix("").sort()) out[path] = read(path);
  return out;
}

function seedBase() {
  seed(`groups/${GROUP}`, {name: "Pelada Sul", owner_id: "owner-1"});
  seed("games/futuro", {group_id: GROUP, status: "SCHEDULED", visibility: "GROUP_ONLY"});
  seed("games/fechado", {group_id: GROUP, status: "CONFIRMED"});
  seed("games/passado", {group_id: GROUP, status: "FINISHED"});
  seed("games/publico", {group_id: GROUP, status: "SCHEDULED", visibility: "PUBLIC_OPEN"});
  seed(`groups/${GROUP}/members/${SAIU}`, {
    user_id: SAIU,
    status: "REMOVED",
    updated_at: tsOf(SAIDA),
  });
  seed(`groups/${GROUP}/members/ativo-1`, {user_id: "ativo-1", status: "ACTIVE"});
}

function silentRun(apply: boolean) {
  const lines: string[] = [];
  return runBackfill({apply, log: (line: string) => lines.push(line)})
    .then((result: unknown) => ({result, lines}));
}

describe("backfill de quem saiu do grupo antes do trigger", () => {
  beforeEach(() => {
    resetFakeDb();
    jest.clearAllMocks();
    seedBase();
  });

  it("parseArgs: dry-run por padrão, --apply explícito, projeto e ajuda", () => {
    const previous = process.env.GCLOUD_PROJECT;
    delete process.env.GCLOUD_PROJECT;
    try {
      expect(parseArgs([])).toEqual({help: false, apply: false, projectId: "futebadosparcas"});
      expect(parseArgs(["--apply", "--project=demo-futeba"]))
        .toEqual({help: false, apply: true, projectId: "demo-futeba"});
      expect(parseArgs(["--help"]).help).toBe(true);
      process.env.GCLOUD_PROJECT = "demo-x";
      expect(parseArgs([]).projectId).toBe("demo-x");
    } finally {
      if (previous === undefined) delete process.env.GCLOUD_PROJECT;
      else process.env.GCLOUD_PROJECT = previous;
    }
  });

  it("scan pega só vínculos que deixaram de ser ativos, fora do merge de contas", async () => {
    seed(`groups/${GROUP}/members/saiu-2`, {status: "INACTIVE"});
    seed(`groups/${GROUP}/members/bloqueado`, {status: "BLOCKED", updated_at: tsOf(SAIDA)});
    seed(`groups/${GROUP}/members/banido`, {status: "BANNED"});
    seed(`groups/${GROUP}/members/sem-status`, {user_id: "sem-status"});
    seed(`groups/${GROUP}/members/alias`, {status: "INACTIVE", merged_to_uid: "canonica"});
    seed("outra/x/members/y", {status: "INACTIVE"});

    const scan = await scanDepartedMembers();

    expect(scan.departed.map((m: {userId: string}) => m.userId).sort())
      .toEqual(["banido", "bloqueado", SAIU, "saiu-2"]);
    expect(scan.mergedSkipped).toBe(1);
    expect(scan.scanned).toBe(7);
    expect(scan.byStatus).toEqual({REMOVED: 1, INACTIVE: 1, BLOCKED: 1, BANNED: 1});
    const semData = scan.departed.find((m: {userId: string}) => m.userId === "saiu-2");
    expect(semData.departedAt).toBeNull();
  });

  it("dry-run conta o que faria e não escreve nada, nem a claim da fila", async () => {
    seed(`confirmations/futuro_${SAIU}`, {game_id: "futuro", user_id: SAIU, status: "PENDING"});
    seed(`confirmations/fechado_${SAIU}`, {game_id: "fechado", user_id: SAIU, status: "CONFIRMED"});
    seed(`games/fechado/waitlist/${SAIU}`, {user_id: SAIU, status: "NOTIFIED"});
    const before = snapshotAll();

    const {result, lines} = await silentRun(false);

    expect(snapshotAll()).toEqual(before);
    expect(pathsWithPrefix("notif_dedup/")).toEqual([]);
    expect(promoteWaitlistOnVacancy).not.toHaveBeenCalled();
    expect((result as {before: Record<string, number>}).before).toMatchObject({
      pessoasComAlgo: 1,
      confirmationsCancelled: 2,
      waitlistRemoved: 1,
      promotions: 1,
      publicSkipped: 0,
    });
    expect(lines.some((l) => l.startsWith("DRY-RUN"))).toBe(true);
    expect(lines.some((l) => l.startsWith("APLICAÇÃO"))).toBe(false);
  });

  it("--apply limpa como o trigger e repassa a vaga de quem estava NOTIFIED", async () => {
    seed(`confirmations/futuro_${SAIU}`, {game_id: "futuro", user_id: SAIU, status: "PENDING"});
    seed(`confirmations/fechado_${SAIU}`, {game_id: "fechado", user_id: SAIU, status: "WAITLIST"});
    seed(`confirmations/passado_${SAIU}`, {game_id: "passado", user_id: SAIU, status: "CONFIRMED"});
    seed(`confirmations/futuro_ativo-1`, {game_id: "futuro", user_id: "ativo-1", status: "CONFIRMED"});
    seed(`games/futuro/waitlist/${SAIU}`, {user_id: SAIU, status: "WAITING"});
    seed(`games/fechado/waitlist/${SAIU}`, {user_id: SAIU, status: "NOTIFIED"});

    const {result, lines} = await silentRun(true);

    expect(read(`confirmations/futuro_${SAIU}`)?.status).toBe("CANCELLED");
    expect(read(`confirmations/fechado_${SAIU}`)?.status).toBe("CANCELLED");
    expect(read(`confirmations/passado_${SAIU}`)?.status).toBe("CONFIRMED");
    expect(read("confirmations/futuro_ativo-1")?.status).toBe("CONFIRMED");
    expect(read(`games/futuro/waitlist/${SAIU}`)).toBeUndefined();
    expect(read(`games/fechado/waitlist/${SAIU}`)).toBeUndefined();
    expect(promoteWaitlistOnVacancy).toHaveBeenCalledTimes(1);
    expect(promoteWaitlistOnVacancy).toHaveBeenCalledWith("fechado");
    expect(read(`notif_dedup/member_departed:backfill:${GROUP}:${SAIU}:fechado`)?.status)
      .toBe("completed");
    const {after} = result as {after: Record<string, number>};
    expect(after).toMatchObject({confirmationsCancelled: 0, waitlistRemoved: 0});
    expect(lines.some((l) => l.startsWith("DEPOIS"))).toBe(true);
  });

  it("rodar --apply de novo não escreve nem chama outra pessoa para a vaga", async () => {
    seed(`confirmations/futuro_${SAIU}`, {game_id: "futuro", user_id: SAIU, status: "PENDING"});
    seed(`games/fechado/waitlist/${SAIU}`, {user_id: SAIU, status: "NOTIFIED"});
    await silentRun(true);
    const afterFirst = snapshotAll();
    jest.clearAllMocks();

    const {result} = await silentRun(true);

    expect(snapshotAll()).toEqual(afterFirst);
    expect(promoteWaitlistOnVacancy).not.toHaveBeenCalled();
    expect((result as {applied: Record<string, number>}).applied).toMatchObject({
      confirmationsCancelled: 0,
      waitlistRemoved: 0,
      promotions: 0,
    });
  });

  it("queda entre repassar a vaga e apagar a fila: a nova rodada não repassa de novo", async () => {
    seed(`games/fechado/waitlist/${SAIU}`, {user_id: SAIU, status: "NOTIFIED"});
    // Rodada anterior repassou a vaga e caiu antes de apagar a entrada.
    seed(`notif_dedup/member_departed:backfill:${GROUP}:${SAIU}:fechado`, {
      status: "completed",
      expires_at: new Date(Date.now() + 7 * DIA),
    });

    await silentRun(true);

    expect(promoteWaitlistOnVacancy).not.toHaveBeenCalled();
    expect(read(`games/fechado/waitlist/${SAIU}`)).toBeUndefined();
  });

  it("jogo público: desfaz só o que é anterior à saída", async () => {
    seed(`confirmations/publico_${SAIU}`, {
      game_id: "publico", user_id: SAIU, status: "CONFIRMED", created_at: tsOf(SAIDA - DIA),
    });
    seed(`games/publico/waitlist/${SAIU}`, {
      user_id: SAIU, status: "WAITING", added_at: tsOf(SAIDA - DIA),
    });
    seed(`groups/${GROUP}/members/voltou`, {status: "INACTIVE", updated_at: tsOf(SAIDA)});
    seed("confirmations/publico_voltou", {
      game_id: "publico", user_id: "voltou", status: "CONFIRMED", created_at: tsOf(SAIDA + DIA),
    });
    seed("games/publico/waitlist/voltou", {
      user_id: "voltou", status: "WAITING", added_at: tsOf(SAIDA + DIA),
    });

    const {result} = await silentRun(true);

    expect(read(`confirmations/publico_${SAIU}`)?.status).toBe("CANCELLED");
    expect(read(`games/publico/waitlist/${SAIU}`)).toBeUndefined();
    expect(read("confirmations/publico_voltou")?.status).toBe("CONFIRMED");
    expect(read("games/publico/waitlist/voltou")?.status).toBe("WAITING");
    expect((result as {before: Record<string, number>}).before.publicSkipped).toBe(2);
  });

  it("jogo público sem data de saída fica como está; jogo do grupo é limpo", async () => {
    seed(`groups/${GROUP}/members/android`, {status: "INACTIVE"});
    seed("confirmations/publico_android", {
      game_id: "publico", user_id: "android", status: "PENDING", created_at: tsOf(SAIDA - DIA),
    });
    seed("confirmations/futuro_android", {
      game_id: "futuro", user_id: "android", status: "PENDING", created_at: tsOf(SAIDA - DIA),
    });

    await silentRun(true);

    expect(read("confirmations/publico_android")?.status).toBe("PENDING");
    expect(read("confirmations/futuro_android")?.status).toBe("CANCELLED");
  });

  it("merge de contas não é tocado", async () => {
    seed(`groups/${GROUP}/members/alias`, {status: "INACTIVE", merged_to_uid: "canonica"});
    seed("confirmations/futuro_alias", {game_id: "futuro", user_id: "alias", status: "CONFIRMED"});

    await silentRun(true);

    expect(read("confirmations/futuro_alias")?.status).toBe("CONFIRMED");
  });
});
