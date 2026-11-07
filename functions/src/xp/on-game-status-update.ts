import {FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import type {FirestoreEvent, Change, DocumentSnapshot} from "firebase-functions/v2/firestore";
import {db} from "../_db";
import {
  determineGameResults,
  getGameDate,
  getWeekKey,
  toGameConfirmation,
  toLiveScore,
  toTeam,
} from "../game/helpers";
import type {Game} from "../models";
import {isGameShape} from "../validation/guards";
import {
  buildDerivedEventStats,
  buildWaitlistMap,
  normalizeGamificationSettings,
} from "./bonus-rules";
import {
  acquireGameXpProcessingLock,
  filterAndClampConfirmations,
  validateFetchedGameAndSoftGate,
  validateGameSecurityAndShouldProcess,
} from "./game-validation-gate";
import {
  fetchXpIdempotencyState,
  processSinglePlayerXp,
} from "./player-xp-transaction";
import {
  buildPlayerPostGameNotificationTask,
  finalizeGameXpAndSideEffects,
} from "./post-game-effects";
import {brtDateKey} from "./streaks";

const GAME_CONFIRMATIONS_QUERY_LIMIT = 200;
const GAME_TEAMS_QUERY_LIMIT = 100;
const MIN_PLAYERS = 6;

/**
 * Handler principal do trigger `onGameStatusUpdate` (games/{gameId}).
 * Orquestra validação de segurança, lock transacional, gate anti-fraude,
 * cálculo/transação de XP por jogador e efeitos pós-jogo.
 *
 * @param {FirestoreEvent} event Evento de atualização do Firestore.
 * @return {Promise<void>} Conclusão do processamento.
 */
export async function handleGameStatusUpdate(
  event: FirestoreEvent<
    Change<DocumentSnapshot> | undefined,
    {gameId: string}
  >
): Promise<void> {
  if (!event.data) return;

  const gameId = event.params.gameId;

  const beforeRaw = event.data.before.data();
  const afterRaw = event.data.after.data();
  if (!isGameShape(beforeRaw) || !isGameShape(afterRaw)) {
    logger.error(
      `[GUARD] onGameStatusUpdate: Game ${gameId} malformado`,
      {hasBefore: !!beforeRaw, hasAfter: !!afterRaw}
    );
    return;
  }
  const before: Game = beforeRaw;
  const after: Game = afterRaw;

  const shouldProcess = await validateGameSecurityAndShouldProcess(
    gameId,
    before,
    after
  );
  if (!shouldProcess) return;

  const gameRef = event.data.after.ref;
  const locked = await acquireGameXpProcessingLock(gameId, gameRef);
  if (!locked) return;

  logger.info(`Processing Game ${gameId} for XP...`);

  try {
    const gameDocRef = db().collection("games")
      .doc(gameId) as FirebaseFirestore.DocumentReference & {
        collection?: (
          name: string
        ) => FirebaseFirestore.CollectionReference;
      };
    const waitlistPromise =
      typeof gameDocRef.collection === "function" ?
        gameDocRef.collection("waitlist")
          .limit(500)
          .get() :
        Promise.resolve({
          docs: [],
        } as unknown as FirebaseFirestore.QuerySnapshot);

    const [
      confirmationsSnap,
      teamsSnap,
      liveScoreDoc,
      settingsSnap,
      seasonSnap,
      gameSnap,
      gameEventsSnap,
      waitlistSnap,
    ] = await Promise.all([
      db().collection("confirmations")
        .where("game_id", "==", gameId)
        .where("status", "==", "CONFIRMED")
        .limit(GAME_CONFIRMATIONS_QUERY_LIMIT)
        .get(),
      db().collection("teams")
        .where("game_id", "==", gameId)
        .limit(GAME_TEAMS_QUERY_LIMIT)
        .get(),
      db().collection("live_scores")
        .doc(gameId)
        .get(),
      db().collection("app_settings")
        .doc("gamification")
        .get(),
      db().collection("seasons")
        .where("is_active", "==", true)
        .limit(1)
        .get(),
      db().collection("games")
        .doc(gameId)
        .get(),
      db().collection("game_events")
        .where("game_id", "==", gameId)
        .limit(500)
        .get(),
      waitlistPromise,
    ]);

    const confirmations = confirmationsSnap.docs
      .map((d) => toGameConfirmation(d.data()));

    const gameData = gameSnap.data() as Game | undefined;
    const gateCheck = await validateFetchedGameAndSoftGate({
      gameId,
      gameData,
      afterRef: event.data.after.ref,
      confirmationsDocs: confirmationsSnap.docs,
      liveScoreDoc,
      gameEventsSnap,
    });
    if (!gateCheck.ok || !gameData) return;

    const validConfirmations = filterAndClampConfirmations(
      gameId,
      confirmations
    );

    const teams = teamsSnap.docs.map(
      (d) => toTeam(d.id, d.data())
    );
    const liveScore = liveScoreDoc.exists ?
      toLiveScore(liveScoreDoc.data()) :
      null;
    const activeSeason = seasonSnap && !seasonSnap.empty ?
      seasonSnap.docs[0].id :
      null;
    const gameDoc = gameSnap.data() as Game | undefined;

    const settings = normalizeGamificationSettings(
      settingsSnap.exists ? settingsSnap.data() : undefined,
    );
    const eventStats = buildDerivedEventStats(
      gameEventsSnap?.docs ?? [],
      settings,
      validConfirmations,
    );
    const waitlistEntriesByUser = buildWaitlistMap(
      waitlistSnap?.docs ?? [],
    );

    if (validConfirmations.length < MIN_PLAYERS) {
      logger.info(
        "Not enough players " +
        `(${validConfirmations.length}` +
        `/${MIN_PLAYERS}). ` +
        "Marking processed."
      );
      await event.data.after.ref.update({
        xp_processed: true,
        xp_processing: false,
        xp_processed_at: FieldValue.serverTimestamp(),
      });
      return;
    }

    const teamResults = determineGameResults(teams, liveScore);

    const {
      alreadyProcessedUserIds,
      mvpVotingAlreadyPaid,
      worstVotingAlreadyPaid,
    } = await fetchXpIdempotencyState(
      gameId,
      after,
      validConfirmations
    );

    const now = FieldValue.serverTimestamp();
    const gameDate = getGameDate(gameDoc);
    const gameDateKey = brtDateKey(gameDate);
    const monthKey = gameDateKey.substring(0, 7);
    const weekKey = getWeekKey(gameDate);

    const streakNotificationPromises: Promise<void>[] = [];

    for (const conf of validConfirmations) {
      const uid = conf.userId;

      if (alreadyProcessedUserIds.has(uid)) {
        continue;
      }

      const transactionResult = await processSinglePlayerXp({
        gameId,
        conf,
        validConfirmations,
        teams,
        teamResults,
        liveScore,
        after,
        gameData,
        settings,
        eventStats,
        waitlistEntriesByUser,
        manualRewardApproval: gateCheck.manualRewardApproval,
        mvpVotingAlreadyPaid,
        worstVotingAlreadyPaid,
        activeSeason,
        gameDate,
        gameDateKey,
        monthKey,
        weekKey,
        now,
      });

      if (transactionResult.alreadyProcessed) {
        logger.info(
          "[XP_IDEMPOTENCY] Player " +
          `${uid} already processed for ` +
          `game ${gameId} inside transaction`
        );
      } else {
        streakNotificationPromises.push(
          buildPlayerPostGameNotificationTask(
            gameId,
            uid,
            transactionResult
          )
        );
      }
    }

    await finalizeGameXpAndSideEffects({
      gameId,
      after,
      afterRef: event.data.after.ref,
      activeSeason,
      now,
      streakNotificationPromises,
    });
  } catch (error) {
    logger.error(
      `Game ${gameId} processing failed.`,
      error
    );
    await event.data.after.ref.update({
      xp_processing: false,
      xp_processing_error:
        "Internal processing error. Reference: game_" + gameId,
    });
    throw error;
  }
}
