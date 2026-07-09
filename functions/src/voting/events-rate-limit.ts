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
import {FieldValue} from "firebase-admin/firestore";
import {db} from "../_db";
import {FUNCTION_REGION} from "../constants";

const MAX_EVENTS_PER_USER_GAME = 50;
const MAX_EVENTS_PER_OWNER_GAME = 200;

export const onGameEventCreated = onDocumentCreated(
  {
    document: "game_events/{eventId}",
    // FIX #584/H10: era "us-central1", mas Firestore é southamerica-east1.
    // Triggers Firestore precisam estar na MESMA region do Firestore →
    // antes nunca disparava, abuse-detection era dead code em prod.
    // FIX #2199: usa a constante FUNCTION_REGION em vez de string hardcoded.
    region: FUNCTION_REGION,
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

    // FIX #960: count() aggregate roda fora da transaction mesmo quando
    // declarado dentro de runTransaction — usa db() em vez de txn.get().
    // Trocamos por txn.get(query) que é genuinamente atomic: a transaction
    // re-executa se outro client modificou o conjunto durante a leitura.
    // Custo: trazemos até (limit+1) docs em vez do count agregado, mas
    // limit é pequeno (50/200) então é trade-off aceitável pela correção.
    await db().runTransaction(async (txn) => {
      const eventRef = event.data?.ref;
      if (!eventRef) return;

      const query = db()
        .collection("game_events")
        .where("game_id", "==", gameId)
        .where("created_by", "==", createdBy)
        .limit(limit + 1);

      const eventsSnap = await txn.get(query);
      const count = eventsSnap.size;
      if (count <= limit) return;

      logger.warn(
        "[EVENTS_ABUSE] User excedeu limite de eventos",
        {gameId, createdBy, count, limit},
      );

      // Delete o evento atual + audit log (atomic)
      txn.delete(eventRef);
      const auditLogRef = db()
        .collection("audit_logs")
        .doc(`game_event_rate_limit_${event.params.eventId}`);
      txn.set(
        auditLogRef,
        {
          type: "GAME_EVENTS_RATE_LIMIT_EXCEEDED",
          target_user_id: createdBy,
          target_game_id: gameId,
          event_count: count,
          limit,
          deleted_event_id: event.params.eventId,
          timestamp: FieldValue.serverTimestamp(),
        }
      );
    });
  },
);
