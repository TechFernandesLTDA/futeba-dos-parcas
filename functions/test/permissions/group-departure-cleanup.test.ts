/**
 * #4629: quem sai ou é removido do grupo sai dos jogos futuros do grupo
 * (onMemberDepartedCleanupGames), com o Firestore falso.
 */

jest.mock("firebase-functions/v2", () => require("./_fake-runtime").functionsV2Module);
jest.mock("firebase-functions", () => require("./_fake-runtime").functionsV2Module);
jest.mock("firebase-functions/v2/firestore", () => require("./_fake-runtime").triggersModule);
jest.mock("firebase-admin/firestore", () => require("./_fake-firestore"));
jest.mock("../../src/_db", () => ({db: () => require("./_fake-firestore").db()}));
jest.mock("../../src/notifications/game-notifications", () => ({
  promoteWaitlistOnVacancy: jest.fn(async () => undefined),
}));

import {resetFakeDb, seed, read} from "./_fake-firestore";

const {onMemberDepartedCleanupGames} = require("../../src/groups/member-departure-cleanup");
const {promoteWaitlistOnVacancy} = require("../../src/notifications/game-notifications");

const GROUP = "g1";
const USER = "member-1";

function seedGames() {
  seed(`groups/${GROUP}`, {name: "Pelada Sul", owner_id: "owner-1", member_count: 3});
  seed("games/futuro", {group_id: GROUP, status: "SCHEDULED"});
  seed("games/fechado", {group_id: GROUP, status: "CONFIRMED"});
  seed("games/passado", {group_id: GROUP, status: "FINISHED"});
  seed("games/apagado", {group_id: GROUP, status: "SCHEDULED", deleted_at: 1});
  seed("games/outro-grupo", {group_id: "g2", status: "SCHEDULED"});
}

function memberEvent(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
  id = "evt-1",
) {
  return onMemberDepartedCleanupGames({
    id,
    params: {groupId: GROUP, memberId: USER},
    data: {
      before: {data: () => (before ? {...before} : undefined)},
      after: {data: () => (after ? {...after} : undefined)},
    },
  });
}

const active = {user_id: USER, role: "MEMBER", status: "ACTIVE"};

describe("onMemberDepartedCleanupGames - saída do grupo limpa os jogos futuros", () => {
  beforeEach(() => {
    resetFakeDb();
    jest.clearAllMocks();
    seedGames();
  });

  it.each(["INACTIVE", "REMOVED", "BLOCKED", "BANNED"])(
    "vínculo %s cancela CONFIRMED, PENDING e WAITLIST nos jogos futuros",
    async (nextStatus) => {
      seed(`confirmations/futuro_${USER}`, {game_id: "futuro", user_id: USER, status: "PENDING"});
      seed(`confirmations/fechado_${USER}`, {game_id: "fechado", user_id: USER, status: "CONFIRMED"});
      seed(`confirmations/x_${USER}`, {game_id: "futuro", user_id: USER, status: "WAITLIST"});

      await memberEvent(active, {...active, status: nextStatus});

      expect(read(`confirmations/futuro_${USER}`)).toMatchObject({status: "CANCELLED"});
      expect(read(`confirmations/fechado_${USER}`)).toMatchObject({status: "CANCELLED"});
      expect(read(`confirmations/x_${USER}`)).toMatchObject({status: "CANCELLED"});
    }
  );

  it("vínculo apagado também limpa", async () => {
    seed(`confirmations/futuro_${USER}`, {game_id: "futuro", user_id: USER, status: "PENDING"});

    await memberEvent(active, undefined);

    expect(read(`confirmations/futuro_${USER}`)).toMatchObject({status: "CANCELLED"});
  });

  it("vínculo antigo sem status conta como ativo", async () => {
    seed(`confirmations/futuro_${USER}`, {game_id: "futuro", user_id: USER, status: "CONFIRMED"});

    await memberEvent({user_id: USER, role: "MEMBER"}, {user_id: USER, role: "MEMBER", status: "INACTIVE"});

    expect(read(`confirmations/futuro_${USER}`)).toMatchObject({status: "CANCELLED"});
  });

  it("não mexe em jogo encerrado, apagado, de outro grupo nem em outra pessoa", async () => {
    seed(`confirmations/passado_${USER}`, {game_id: "passado", user_id: USER, status: "CONFIRMED"});
    seed(`confirmations/apagado_${USER}`, {game_id: "apagado", user_id: USER, status: "CONFIRMED"});
    seed(`confirmations/outro-grupo_${USER}`, {game_id: "outro-grupo", user_id: USER, status: "CONFIRMED"});
    seed("confirmations/futuro_member-2", {game_id: "futuro", user_id: "member-2", status: "CONFIRMED"});

    await memberEvent(active, {...active, status: "REMOVED"});

    expect(read(`confirmations/passado_${USER}`)).toMatchObject({status: "CONFIRMED"});
    expect(read(`confirmations/apagado_${USER}`)).toMatchObject({status: "CONFIRMED"});
    expect(read(`confirmations/outro-grupo_${USER}`)).toMatchObject({status: "CONFIRMED"});
    expect(read("confirmations/futuro_member-2")).toMatchObject({status: "CONFIRMED"});
  });

  it("confirmação já cancelada fica como está", async () => {
    seed(`confirmations/futuro_${USER}`, {
      game_id: "futuro",
      user_id: USER,
      status: "CANCELLED",
      updated_at: "antes",
    });

    await memberEvent(active, {...active, status: "INACTIVE"});

    expect(read(`confirmations/futuro_${USER}`)).toEqual({
      game_id: "futuro",
      user_id: USER,
      status: "CANCELLED",
      updated_at: "antes",
    });
  });

  it("apaga a entrada da fila de espera WAITING sem promover ninguém", async () => {
    seed(`games/futuro/waitlist/${USER}`, {user_id: USER, status: "WAITING", queue_position: 1});

    await memberEvent(active, {...active, status: "INACTIVE"});

    expect(read(`games/futuro/waitlist/${USER}`)).toBeUndefined();
    expect(promoteWaitlistOnVacancy).not.toHaveBeenCalled();
  });

  it("quem tinha sido chamado (NOTIFIED) sai da fila e a vaga passa para o próximo, uma vez só", async () => {
    seed(`games/fechado/waitlist/${USER}`, {user_id: USER, status: "NOTIFIED", queue_position: 1});

    await memberEvent(active, {...active, status: "REMOVED"});
    await memberEvent(active, {...active, status: "REMOVED"});

    expect(read(`games/fechado/waitlist/${USER}`)).toBeUndefined();
    expect(promoteWaitlistOnVacancy).toHaveBeenCalledTimes(1);
    expect(promoteWaitlistOnVacancy).toHaveBeenCalledWith("fechado");
  });

  it("se a promoção falha, a entrada NOTIFIED fica e a nova entrega promove uma vez", async () => {
    seed(`games/fechado/waitlist/${USER}`, {user_id: USER, status: "NOTIFIED", queue_position: 1});
    promoteWaitlistOnVacancy.mockRejectedValueOnce(new Error("UNAVAILABLE"));

    await expect(memberEvent(active, {...active, status: "REMOVED"})).rejects.toThrow("UNAVAILABLE");
    expect(read(`games/fechado/waitlist/${USER}`)).toMatchObject({status: "NOTIFIED"});

    await memberEvent(active, {...active, status: "REMOVED"});
    await memberEvent(active, {...active, status: "REMOVED"});

    expect(read(`games/fechado/waitlist/${USER}`)).toBeUndefined();
    expect(promoteWaitlistOnVacancy).toHaveBeenCalledTimes(2);
    expect(await promoteWaitlistOnVacancy.mock.results[1].value).toBeUndefined();
  });

  it("promoção já feita numa entrega anterior não se repete", async () => {
    seed(`games/fechado/waitlist/${USER}`, {user_id: USER, status: "NOTIFIED", queue_position: 1});
    seed("notif_dedup/member_departed:evt-1:fechado", {status: "completed"});

    await memberEvent(active, {...active, status: "REMOVED"});

    expect(promoteWaitlistOnVacancy).not.toHaveBeenCalled();
    expect(read(`games/fechado/waitlist/${USER}`)).toBeUndefined();
  });

  it("entrada da fila já expirada fica como está", async () => {
    seed(`games/futuro/waitlist/${USER}`, {user_id: USER, status: "EXPIRED"});

    await memberEvent(active, {...active, status: "INACTIVE"});

    expect(read(`games/futuro/waitlist/${USER}`)).toMatchObject({status: "EXPIRED"});
  });

  it("segunda entrega do evento não muda nada", async () => {
    seed(`confirmations/futuro_${USER}`, {game_id: "futuro", user_id: USER, status: "PENDING"});

    await memberEvent(active, {...active, status: "INACTIVE"});
    const afterFirst = read(`confirmations/futuro_${USER}`);
    await memberEvent(active, {...active, status: "INACTIVE"});

    expect(read(`confirmations/futuro_${USER}`)).toEqual(afterFirst);
  });

  it("merge de contas não cancela: as confirmações vão para a conta canônica", async () => {
    seed(`confirmations/futuro_${USER}`, {game_id: "futuro", user_id: USER, status: "CONFIRMED"});
    seed(`games/futuro/waitlist/${USER}`, {user_id: USER, status: "WAITING"});

    await memberEvent(active, {...active, status: "INACTIVE", merged_to_uid: "canonico"});

    expect(read(`confirmations/futuro_${USER}`)).toMatchObject({status: "CONFIRMED"});
    expect(read(`games/futuro/waitlist/${USER}`)).toMatchObject({status: "WAITING"});
  });

  it.each([
    ["entrada no grupo", undefined, active],
    ["volta de quem saiu", {...active, status: "INACTIVE"}, active],
    ["edição de quem continua ativo", active, {...active, role: "ADMIN"}],
    ["mudança entre estados inativos", {...active, status: "INACTIVE"}, {...active, status: "REMOVED"}],
  ])("ignora %s", async (_label, before, after) => {
    seed(`confirmations/futuro_${USER}`, {game_id: "futuro", user_id: USER, status: "PENDING"});

    await memberEvent(before, after);

    expect(read(`confirmations/futuro_${USER}`)).toMatchObject({status: "PENDING"});
  });
});
