/**
 * SECFIX #430: Detector de overlap temporal de confirmacoes.
 *
 * Trigger onDocumentCreated em confirmations/{confId} que valida
 * se o usuario tem confirmacao em outro jogo no mesmo horario.
 *
 * Strategy:
 * - Detecta overlap (game start/end +/- 30min buffer)
 * - Marca confirmation como suspicious_overlap=true
 * - Loga audit_logs OVERLAP_DETECTED
 * - NAO deleta automaticamente (evita break de edge cases)
 * - Cloud Function de XP processing checa flag e nega XP
 */
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {db} from "../_db";

interface GameTimeWindow {
  start: number;
  end: number;
}

/**
 * Computa janela [start, end] em ms epoch para um jogo.
 * Considera duration default 90min, buffer 30min cada lado.
 *
 * @param {Record<string, unknown>} gameData Dados do jogo do Firestore.
 * @return {GameTimeWindow | null} Janela em ms epoch, null se data invalida.
 */
function getGameWindow(
  gameData: Record<string, unknown>,
): GameTimeWindow | null {
  const dateRaw = gameData.date_time ??
    gameData.dateTime ??
    gameData.date;
  if (!dateRaw) return null;

  let startMs: number;
  if (
    typeof dateRaw === "object" &&
    dateRaw !== null &&
    "toDate" in dateRaw
  ) {
    startMs = (dateRaw as {toDate: () => Date})
      .toDate()
      .getTime();
  } else if (typeof dateRaw === "string") {
    startMs = new Date(dateRaw).getTime();
  } else {
    return null;
  }

  if (isNaN(startMs)) return null;

  const durationMin = (gameData.duration_minutes as number) ?? 90;
  const bufferMs = 30 * 60 * 1000;
  return {
    start: startMs - bufferMs,
    end: startMs + durationMin * 60 * 1000 + bufferMs,
  };
}

export const onConfirmationCreated = onDocumentCreated(
  {
    document: "confirmations/{confId}",
    region: "us-central1",
  },
  async (event) => {
    const conf = event.data?.data();
    if (!conf) return;

    const userId = conf.user_id as string | undefined;
    const gameId = conf.game_id as string | undefined;
    if (!userId || !gameId) return;

    const status = conf.status as string | undefined;
    if (status !== "CONFIRMED" && status !== "PENDING") return;

    // Carrega game pra obter time window
    const gameSnap = await db().doc(`games/${gameId}`).get();
    if (!gameSnap.exists) return;
    const gameData = gameSnap.data() as Record<string, unknown>;
    const window = getGameWindow(gameData);
    if (!window) {
      logger.warn(
        "[OVERLAP_CHECK] Game sem date valida",
        {gameId, userId},
      );
      return;
    }

    // Query confirmacoes do mesmo user em outros jogos
    const userConfsSnap = await db()
      .collection("confirmations")
      .where("user_id", "==", userId)
      .get();

    const overlaps: string[] = [];
    for (const doc of userConfsSnap.docs) {
      if (doc.id === event.params.confId) continue;
      const other = doc.data();
      const otherGameId = other.game_id as string;
      if (!otherGameId || otherGameId === gameId) continue;
      const otherStatus = other.status as string;
      if (otherStatus === "CANCELLED") continue;

      // Carrega outro game e checa overlap
      const otherGameSnap = await db()
        .doc(`games/${otherGameId}`)
        .get();
      if (!otherGameSnap.exists) continue;
      const otherWindow = getGameWindow(
        otherGameSnap.data() as Record<string, unknown>,
      );
      if (!otherWindow) continue;

      if (
        window.start <= otherWindow.end &&
        otherWindow.start <= window.end
      ) {
        overlaps.push(doc.id);
      }
    }

    if (overlaps.length === 0) return;

    logger.warn(
      "[OVERLAP_DETECTED] Confirmacao com overlap temporal",
      {
        confId: event.params.confId,
        userId,
        gameId,
        overlaps,
      },
    );

    // Marca confirmation suspeita + audit log
    await Promise.all([
      event.data?.ref.set(
        {suspicious_overlap: true},
        {merge: true},
      ),
      db().collection("audit_logs").add({
        type: "CONFIRMATION_OVERLAP",
        target_user_id: userId,
        target_game_id: gameId,
        conflict_conf_ids: overlaps,
        timestamp: admin.firestore
          .FieldValue.serverTimestamp(),
      }),
    ]);
  },
);
