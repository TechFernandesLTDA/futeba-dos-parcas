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
import {FieldValue} from "firebase-admin/firestore";
import {db} from "../_db";
import {FUNCTION_REGION} from "../constants";

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
    // FIX #752: region deve coincidir com database southamerica-east1
    // (era us-central1 — trigger nunca disparava em prod)
    region: FUNCTION_REGION,
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

    // FIX #1593: game_date_time não existe em confirmations — filtro temporal
    // removido. Overlap real é checado via game doc abaixo.
    // Limit 50 pra evitar leitura excessiva em users com muito histórico.
    const userConfsSnap = await db()
      .collection("confirmations")
      .where("user_id", "==", userId)
      .where("status", "in", ["CONFIRMED", "PENDING"])
      .orderBy("created_at", "desc")
      .limit(50)
      .get();

    // FIX #2198: filtra as confirmações candidatas e carrega os games em
    // paralelo (Promise.all) em vez de uma leitura sequencial por confirmação.
    const candidates = userConfsSnap.docs.filter((doc) => {
      if (doc.id === event.params.confId) return false;
      const other = doc.data();
      const otherGameId = other.game_id as string;
      if (!otherGameId || otherGameId === gameId) return false;
      const otherStatus = other.status as string;
      if (otherStatus === "CANCELLED") return false;
      return true;
    });

    const candidateGameSnaps = await Promise.all(
      candidates.map((doc) =>
        db().doc(`games/${doc.data().game_id as string}`).get()
      )
    );

    const overlaps: string[] = [];
    candidateGameSnaps.forEach((otherGameSnap, index) => {
      const doc = candidates[index];
      if (!otherGameSnap.exists) return;
      const otherWindow = getGameWindow(
        otherGameSnap.data() as Record<string, unknown>,
      );
      if (!otherWindow) return;

      if (
        window.start <= otherWindow.end &&
        otherWindow.start <= window.end
      ) {
        overlaps.push(doc.id);
      }
    });

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

    // Marca confirmation suspeita + audit log (atómicas via batch)
    const confRef = event.data?.ref;
    if (!confRef) return;

    const batch = db().batch();
    batch.set(confRef, {suspicious_overlap: true}, {merge: true});
    batch.set(
      db().doc(`audit_logs/overlap_${event.params.confId}`),
      {
        type: "CONFIRMATION_OVERLAP",
        target_user_id: userId,
        target_game_id: gameId,
        conflict_conf_ids: overlaps,
        timestamp: FieldValue.serverTimestamp(),
      },
    );
    await batch.commit();
  },
);
