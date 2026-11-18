/**
 * XP e temporada tocados pelas ações de votação e pelo fechamento do jogo (UC8).
 * - validateGameSecurityAndShouldProcess: XP só é processado na transição para FINISHED
 *   (ou na liberação de revisão aprovada), com dono válido e não trocado.
 * - applyVotingXpDelta: crédito de MVP/Bola Murcha com idempotência, dedup contra o
 *   gatilho principal, piso de -100 no total e reflexo em season_participation.
 */

jest.mock("firebase-functions", () => require("./_fake-runtime").functionsV2Module);
jest.mock("firebase-functions/v2", () => require("./_fake-runtime").functionsV2Module);
jest.mock("firebase-functions/v2/https", () => require("./_fake-runtime").httpsModule);
jest.mock("firebase-admin/firestore", () => require("./_fake-firestore"));
jest.mock("firebase-admin", () => require("./_fake-runtime").adminModule(() => require("./_fake-firestore").db()));
jest.mock("../../src/_db", () => ({db: () => require("./_fake-firestore").db()}));
jest.mock("../../src/middleware/rate-limiter");

import {resetFakeDb, seed, read, pathsWithPrefix, tsOf, db} from "./_fake-firestore";

const {applyVotingXpDelta} = require("../../src/voting/mvp-voting");
const {validateGameSecurityAndShouldProcess} = require("../../src/xp/game-validation-gate");

const GAME = "game-1";
const DAY_MS = 24 * 60 * 60 * 1000;

function seedGame(overrides: Record<string, unknown> = {}) {
  seed(`games/${GAME}`, {
    status: "FINISHED",
    owner_id: "owner-1",
    dateTime: tsOf(Date.now() - DAY_MS),
    season_id: "s-2026-10",
    ...overrides,
  });
}

beforeEach(() => {
  resetFakeDb();
  jest.clearAllMocks();
  seed("users/p1", {name: "Jogador", experience_points: 100});
  seed("users/owner-1", {name: "Dono"});
  seedGame();
});

describe("applyVotingXpDelta - crédito de votação (UC8)", () => {
  it("MVP credita +30 no total do jogador e grava o log de auditoria", async () => {
    await applyVotingXpDelta(db() as never, GAME, "p1", "MVP", 30, {});

    expect(read("users/p1")).toMatchObject({experience_points: 130});
    expect(read(`xp_logs/mvp_${GAME}_p1`)).toBeDefined();
  });

  it("aplicar o mesmo MVP duas vezes não credita em dobro", async () => {
    await applyVotingXpDelta(db() as never, GAME, "p1", "MVP", 30, {});
    await applyVotingXpDelta(db() as never, GAME, "p1", "MVP", 30, {});

    expect(read("users/p1")).toMatchObject({experience_points: 130});
  });

  it("MVP já pago pelo gatilho principal do jogo não é creditado de novo", async () => {
    seed(`xp_logs/game_${GAME}_user_p1`, {xp_mvp: 30});
    await applyVotingXpDelta(db() as never, GAME, "p1", "MVP", 30, {});

    expect(read("users/p1")).toMatchObject({experience_points: 100});
  });

  it("Bola Murcha respeita o piso de MIN_XP_PER_GAME (-100) no total de XP", async () => {
    seed("users/p1", {name: "Jogador", experience_points: -95});
    await applyVotingXpDelta(db() as never, GAME, "p1", "BOLA_MURCHA", -10, {});

    expect(read("users/p1")).toMatchObject({experience_points: -100});
  });

  it("Bola Murcha já penalizado pelo gatilho principal não é cobrado de novo (#2992)", async () => {
    seed(`xp_logs/game_${GAME}_user_p1`, {xp_penalty: -10, was_worst_player: true});
    await applyVotingXpDelta(db() as never, GAME, "p1", "BOLA_MURCHA", -10, {});

    expect(read("users/p1")).toMatchObject({experience_points: 100});
  });
});

describe("validateGameSecurityAndShouldProcess - quando o XP do jogo é processado (UC8)", () => {
  const game = (overrides: Record<string, unknown> = {}) => ({
    owner_id: "owner-1",
    status: "FINISHED",
    ...overrides,
  });

  it("transição de jogo agendado para FINISHED com dono válido processa o XP", async () => {
    const ok = await validateGameSecurityAndShouldProcess(
      GAME,
      game({status: "CONFIRMED"}),
      game({status: "FINISHED"})
    );
    expect(ok).toBe(true);
  });

  it("jogo que já estava FINISHED não reprocessa o XP sem liberação de revisão", async () => {
    const ok = await validateGameSecurityAndShouldProcess(GAME, game(), game());
    expect(ok).toBe(false);
  });

  it("troca de dono durante o jogo aborta o processamento de XP (anti-fraude)", async () => {
    const ok = await validateGameSecurityAndShouldProcess(
      GAME,
      game({status: "CONFIRMED", owner_id: "owner-1"}),
      game({owner_id: "owner-2"})
    );
    expect(ok).toBe(false);
  });

  it("dono que não existe em users bloqueia o processamento", async () => {
    const ok = await validateGameSecurityAndShouldProcess(
      GAME,
      game({status: "CONFIRMED", owner_id: "owner-fantasma"}),
      game({owner_id: "owner-fantasma"})
    );
    expect(ok).toBe(false);
  });
});
