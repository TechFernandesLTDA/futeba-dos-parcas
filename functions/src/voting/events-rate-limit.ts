/**
 * SECFIX #425: rate-limit de game_events por user por jogo.
 *
 * Trigger onDocumentCreated em game_events que detecta abuso
 * (jogador confirmado spammando 1000 eventos pra inflar stats).
 *
 * Strategy:
 * - Conta eventos do user no game
 * - Se > MAX_EVENTS_PER_USER_GAME, deleta o evento + audit log
 * - Owner/admin tem limite mais alto (gerenciam)
 */
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {db} from "../_db";

const MAX_EVENTS_PER_USER_GAME = 50;
const MAX_EVENTS_PER_OWNER_GAME = 200;

export const onGameEventCreated = onDocumentCreated(
  {
    document: "game_events/{eventId}",
    region: "us-central1",
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const gameId = data.game_id as string | undefined;
    const createdBy = data.created_by as string | undefined;
    if (!gameId || !createdBy) return;

    // Verifica se eh game owner (limite maior)
    const gameSnap = await db().doc(`games/${gameId}`).get();
    const ownerId = gameSnap.data()?.owner_id;
    const isOwner = createdBy === ownerId;
    const limit = isOwner ?
      MAX_EVENTS_PER_OWNER_GAME :
      MAX_EVENTS_PER_USER_GAME;

    // Conta eventos existentes do user nesse game
    const countSnap = await db()
      .collection("game_events")
      .where("game_id", "==", gameId)
      .where("created_by", "==", createdBy)
      .count()
      .get();

    const count = countSnap.data().count;
    if (count <= limit) return;

    logger.warn(
      "[EVENTS_ABUSE] User excedeu limite de eventos",
      {gameId, createdBy, count, limit},
    );

    // Deleta o evento criador do limite + audit
    await Promise.all([
      event.data?.ref.delete(),
      db().collection("audit_logs").add({
        type: "GAME_EVENTS_RATE_LIMIT_EXCEEDED",
        target_user_id: createdBy,
        target_game_id: gameId,
        event_count: count,
        limit,
        deleted_event_id: event.params.eventId,
        timestamp: admin.firestore
          .FieldValue.serverTimestamp(),
      }),
    ]);
  },
);
