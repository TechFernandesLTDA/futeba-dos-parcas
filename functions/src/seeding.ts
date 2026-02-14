import * as admin from "firebase-admin";
import {onRequest} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {
  checkRateLimitByIp,
} from "./middleware/rate-limiter";
import {sanitizeText} from "./validation/index";

// 2. Constants
const START_DATE = new Date(
  "2025-10-01T10:00:00"
);
const END_DATE = new Date(
  "2026-01-04T12:00:00"
);
const GAME_LOCATION = "Arena Fernandes";
const GAME_NAME = "Pelada dos Parcas";

/** Dados de detalhe de um jogo seed. */
interface GameDetail {
  score1: number;
  score2: number;
  mvpId: string;
}

/** Dados basicos de um usuario seed. */
interface SeedUser {
  id: string;
  name: string;
}

/**
 * Gera datas de jogos entre duas datas.
 *
 * @param {Date} start - Data inicial.
 * @param {Date} end - Data final.
 * @return {Date[]} Lista de datas de jogos.
 */
function getGameDates(
  start: Date,
  end: Date
): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    // Criar jogos todo Domingo (0)
    // e Quinta (4)
    const day = current.getDay();
    if (day === 0 || day === 4) {
      const gameDate = new Date(current);
      gameDate.setHours(21, 0, 0, 0);
      dates.push(gameDate);
    }
    current.setDate(current.getDate() + 1);
  }
  // Garantir que END_DATE esteja incluida
  // se for Domingo
  const last = dates[dates.length - 1];
  if (
    end.toDateString() !== last.toDateString()
  ) {
    if (end.getDay() === 0) {
      const d = new Date(end);
      d.setHours(10, 0, 0, 0);
      dates.push(d);
    }
  }
  return dates;
}

/**
 * HTTP endpoint para popular o banco de dados
 * com dados de teste.
 *
 * SEGURANCA:
 * - Apenas disponivel em ambiente de
 *   desenvolvimento (ENVIRONMENT=development)
 * - Requer query param secret com valor correto
 * - Bloqueado em producao para prevenir ataques
 *   DoS
 *
 * Cria jogos simulados para 4 usuarios em datas
 * variadas, incluindo cenarios para Clean Sheets
 * (PAREDAO) e Hat Tricks.
 */
export const seedDatabase = onRequest(
  async (request, response) => {
    // Rate limit por IP (3/min)
    const clientIp =
      request.ip || request.headers["x-forwarded-for"] as string || "unknown"; // eslint-disable-line max-len
    const ipRlResult = await checkRateLimitByIp(
      clientIp,
      {
        maxRequests: 3,
        windowMs: 60 * 1000,
        keyPrefix: "seed_db",
      }
    );
    if (!ipRlResult.allowed) {
      response.status(429).send(
        "Rate limit excedido." +
        " Tente novamente em breve."
      );
      return;
    }

    // SECURITY FIX (CVE-4): Disable seeding
    // in production to prevent DoS attacks
    const environment =
      process.env.ENVIRONMENT || "production";
    if (environment !== "development") {
      logger.error(
        "[SEEDING][SECURITY] Seeding blocked" +
        ": Not in development environment" +
        ` (${environment})`
      );
      response.status(403).send(
        "Seeding is disabled in this environment"
      );
      return;
    }

    // Development-only: Basic secret protection
    // Sanitizar param (defense-in-depth)
    const rawSecret =
      request.query.secret as string || "";
    const secret = sanitizeText(rawSecret);
    if (secret !== "antigravity_seed") {
      logger.warn(
        "[SEEDING][SECURITY] Seeding " +
        "blocked: Invalid secret"
      );
      response.status(403).send("Unauthorized");
      return;
    }

    try {
      const result = await seedLogic();
      // Verificar se o resultado indica erro
      const isErr =
        result.startsWith(
          "Not enough users found."
        );
      if (isErr) {
        response.status(500).send(result);
      } else {
        response.send(result);
      }
    } catch (e) {
      logger.error(
        "[SEEDING] Fatal error during seeding:",
        e
      );
      const msg = e instanceof Error ?
        e.message :
        String(e);
      response.status(500).send(
        `Error: ${msg}`
      );
    }
  }
);

/**
 * Logica principal de seeding. Separada do
 * handler HTTP para facilitar testes.
 *
 * Fluxo:
 * 1. Busca 4 usuarios existentes
 * 2. Remove jogos de seed anteriores (cleanup)
 * 3. Cria jogos como SCHEDULED com times,
 *    confirmacoes e live_scores
 * 4. Atualiza para FINISHED para disparar
 *    processamento de XP
 *
 * @return {Promise<string>} Mensagem de
 *   sucesso ou erro descritivo.
 */
export const seedLogic = async (): Promise<string> => {
  const db = admin.firestore();

  logger.info("[SEEDING] Fetching users...");
  const usersSnap = await db
    .collection("users")
    .limit(4)
    .get();
  if (usersSnap.empty || usersSnap.size < 4) {
    const count = usersSnap.size;
    logger.error(
      "[SEEDING] Not enough users found" +
      ` (need 4). Found: ${count}`
    );
    return (
      "Not enough users found. " +
      `Found ${count}, need 4.`
    );
  }

  const users: SeedUser[] = usersSnap.docs.map(
    (d) => ({
      id: d.id,
      name: d.data().name || "Unknown",
    })
  );
  const names = users.map((u) => u.name);
  logger.info(
    `[SEEDING] Found users: ${names.join(", ")}`
  );

  // 0. Cleanup old seeded games
  logger.info(
    "[SEEDING] Cleaning up old seeded games..."
  );
  const oldGamesSnap = await db
    .collection("games")
    .where("name", "==", GAME_NAME)
    .get();
  let cleanupErrors = 0;
  for (const doc of oldGamesSnap.docs) {
    try {
      const cleanupBatch = db.batch();
      const gid = doc.id;
      cleanupBatch.delete(doc.ref);
      cleanupBatch.delete(
        db.collection("live_scores").doc(gid)
      );
      // Delete teams and confirmations would
      // need queries, ignoring for now as they
      // are many, but let's at least delete the
      // game and live_score.
      await cleanupBatch.commit();
    } catch (cleanupErr) {
      cleanupErrors++;
      logger.warn(
        "[SEEDING] Error cleaning up " +
        `game ${doc.id}:`,
        cleanupErr
      );
      // Continuar com proximos jogos
      // - nao bloquear o seeding
    }
  }
  if (cleanupErrors > 0) {
    logger.warn(
      `[SEEDING] ${cleanupErrors} errors` +
      " during cleanup (non-fatal)"
    );
  }

  const gameDates = getGameDates(
    START_DATE,
    END_DATE
  );
  logger.info(
    "[SEEDING] Generating " +
    `${gameDates.length} games...`
  );

  const createdGameIds: string[] = [];
  const gameDetailsMap =
    new Map<string, GameDetail>();

  // 1. Create games as SCHEDULED
  let batch = db.batch();
  let opCount = 0;
  let index = 0;
  for (const date of gameDates) {
    const gameId = `seed_game_${index++}`;
    const gameRef = db
      .collection("games")
      .doc(gameId);
    createdGameIds.push(gameId);

    const team1Users = [users[0], users[1]];
    const team2Users = [users[2], users[3]];
    const team1Id = `team_${gameId}_1`;
    const team2Id = `team_${gameId}_2`;

    // Force some 0 scores for Clean Sheets
    // (PAREDAO)
    // Force some 3+ goals for HAT_TRICK
    let score1 =
      Math.floor(Math.random() * 5);
    let score2 =
      Math.floor(Math.random() * 5);
    // Clean sheet for Team 1 every 5 games
    if (index % 5 === 0) score2 = 0;
    // Clean sheet for Team 2 every 7 games
    if (index % 7 === 0) score1 = 0;

    const allUsers = [
      ...team1Users,
      ...team2Users,
    ].filter((u) => !!u);
    const mvpIdx = Math.floor(
      Math.random() * allUsers.length
    );
    const mvp = allUsers[mvpIdx];

    gameDetailsMap.set(gameId, {
      score1,
      score2,
      mvpId: mvp.id,
    });

    const dateIso =
      date.toISOString().split("T")[0];
    const gameTs =
      admin.firestore.Timestamp.fromDate(date);
    const nowTs =
      admin.firestore.Timestamp.now();

    batch.set(gameRef, {
      id: gameId,
      name: GAME_NAME,
      location: GAME_LOCATION,
      date: dateIso,
      dateTime: gameTs,
      status: "SCHEDULED",
      owner_id: users[0].id,
      team1Name: "A",
      team2Name: "B",
      team1Score: 0,
      team2Score: 0,
      team1Id,
      team2Id,
      xp_processed: false,
      created_at: nowTs,
    });

    const t1PlayerIds =
      team1Users.map((u) => u.id);
    batch.set(
      db.collection("teams").doc(team1Id),
      {
        id: team1Id,
        game_id: gameId,
        name: "A",
        score: score1,
        playerIds: t1PlayerIds,
      }
    );
    const t2PlayerIds =
      team2Users.map((u) => u.id);
    batch.set(
      db.collection("teams").doc(team2Id),
      {
        id: team2Id,
        game_id: gameId,
        name: "B",
        score: score2,
        playerIds: t2PlayerIds,
      }
    );

    for (let i = 0; i < allUsers.length; i++) {
      const u = allUsers[i];
      const confRef = db
        .collection("confirmations")
        .doc(`${gameId}_${u.id}`);
      // Force HAT_TRICK for user 0
      // every 10 games
      const isHatTrick =
        index % 10 === 0 && i === 0;
      const hasGoal = Math.random() > 0.7;
      const goals = isHatTrick ?
        4 :
        (hasGoal ? 1 : 0);
      // Force Goalkeeper for user 1 and 3
      const isGoalkeeper =
        i === 1 || i === 3;

      const confTs =
        admin.firestore.Timestamp.fromDate(
          date
        );
      batch.set(confRef, {
        game_id: gameId,
        user_id: u.id,
        status: "CONFIRMED",
        goals: goals,
        assists: 1,
        saves: isGoalkeeper ? 5 : 0,
        position: isGoalkeeper ?
          "GOALKEEPER" :
          "AHEAD",
        yellow_cards: 0,
        red_cards: 0,
        created_at: confTs,
      });
    }

    batch.set(
      db.collection("live_scores").doc(gameId),
      {
        gameId,
        team1Id,
        team2Id,
        team1Score: score1,
        team2Score: score2,
        events: [],
      }
    );

    opCount += 10;
    if (opCount >= 400) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }
  if (opCount > 0) await batch.commit();

  logger.info(
    "[SEEDING] Games created as SCHEDULED." +
    " Now updating to FINISHED to " +
    "trigger Cloud Function..."
  );
  // Aguardar propagacao no Firestore
  await new Promise(
    (r) => setTimeout(r, 2000)
  );

  // 2. Update to FINISHED
  let updateErrors = 0;
  batch = db.batch();
  opCount = 0;
  for (const gameId of createdGameIds) {
    const gameRef = db
      .collection("games")
      .doc(gameId);
    const details = gameDetailsMap.get(gameId);

    if (details) {
      batch.update(gameRef, {
        status: "FINISHED",
        team1Score: details.score1,
        team2Score: details.score2,
        mvp_id: details.mvpId,
        // Triggers Cloud Function logic
        xp_processed: false,
        updated_at:
          admin.firestore.Timestamp.now(),
      });
      opCount++;
    }

    if (opCount >= 450) {
      try {
        await batch.commit();
      } catch (batchErr) {
        updateErrors++;
        logger.error(
          "[SEEDING] Error committing " +
          "FINISHED batch:",
          batchErr
        );
      }
      batch = db.batch();
      opCount = 0;
      // Small delay between batches
      await new Promise(
        (r) => setTimeout(r, 500)
      );
    }
  }
  if (opCount > 0) {
    try {
      await batch.commit();
    } catch (batchErr) {
      updateErrors++;
      logger.error(
        "[SEEDING] Error committing " +
        "final FINISHED batch:",
        batchErr
      );
    }
  }

  const gameCount = createdGameIds.length;
  const resultMsg = updateErrors > 0 ?
    `Seeded ${gameCount} games with ` +
    `${updateErrors} batch errors ` +
    "during status update." :
    `Success! Seeded ${gameCount} games` +
    " and triggered processing.";

  logger.info(`[SEEDING] ${resultMsg}`);
  return resultMsg;
};
