/**
 * SISTEMA DE VOTAÇÃO MVP - P2 #39
 *
 * Implementa votação atômica usando Firestore
 * transactions para prevenir race conditions em
 * votações concorrentes.
 *
 * PROBLEMAS RESOLVIDOS:
 * - TOCTOU race condition em submissão de votos
 * - Contagem inconsistente de votos
 * - Proteção contra voto duplicado
 *   (mesmo usuário votando 2x)
 * - Tallying atômico
 *   (contagem + atualização de confirmações + game)
 *
 * GARANTIAS:
 * - Atomicidade: Leitura + escrita do voto
 *   dentro de transaction
 * - Idempotência: Document ID determinístico
 *   previne duplicatas
 * - Consistência: concludeVoting() lê e escreve
 *   atomicamente
 * - Retry automático: Firestore retenta
 *   transactions em conflito
 *
 * @see specs/P2_39_MVP_VOTING_RACE_CONDITION_FIX.md
 */

import {logger} from "firebase-functions";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {
  onCall,
  HttpsError,
} from "firebase-functions/v2/https";
// SECURITY: Rate limiter para prevenir abuso
import {
  checkRateLimit,
} from "../middleware/rate-limiter";
import {
  requireProfileComplete,
} from "../middleware/require-profile-complete";
import {
  MVP_VOTE_WINDOW_HOURS,
  XP_ACTIONS,
  MAX_XP_PER_GAME,
  MIN_XP_PER_GAME,
} from "../constants";
import {ERROR_MSGS} from "../error-messages";
import {getLevelForXp} from "../xp/pipeline";
import {
  getGameDate,
  getWeekKey,
  normalizeGameGender,
} from "../game/helpers";
import {Game} from "../models";
import {isGameShape} from "../validation/guards";

import {db as getFirestore} from "../_db";

// ==========================================
// CONSTANTES
// ==========================================

/** Janela de votação (importada de constants.ts) */
const VOTE_WINDOW_HOURS = MVP_VOTE_WINDOW_HOURS;

/** Categorias de votação permitidas */
const VALID_VOTE_CATEGORIES = [
  "MVP",
  "BEST_GOALKEEPER",
  "WORST",
] as const;
type VoteCategory =
  typeof VALID_VOTE_CATEGORIES[number];

// ==========================================
// INTERFACES
// ==========================================

/** Dados de entrada para submissão de voto */
interface SubmitVoteRequest {
  gameId: string;
  votedPlayerId: string;
  category: VoteCategory;
}

/** Dados de entrada para conclusão de votação */
interface ConcludeVotingRequest {
  gameId: string;
}

/** Resultado da contagem de votos */
interface VoteTally {
  playerId: string;
  count: number;
}

// ==========================================
// CLOUD FUNCTION: submitMvpVote
// ==========================================

/**
 * Submete um voto de MVP usando Firestore
 * transaction.
 *
 * Garante atomicidade entre:
 * 1. Verificação de status do jogo
 * 2. Verificação de prazo de votação
 * 3. Detecção de voto duplicado
 * 4. Escrita do voto
 *
 * Em caso de conflito (2 clientes votando ao
 * mesmo tempo), Firestore retenta
 * automaticamente até 5 vezes.
 *
 * @param {string} gameId - ID do jogo
 * @param {string} votedPlayerId - ID do votado
 * @param {VoteCategory} category - Categoria
 * @return {object} Resultado do voto registrado
 */
export const submitMvpVote =
  onCall<SubmitVoteRequest>(
    {
      region: "southamerica-east1",
      memory: "256MiB",
      // SECURITY: App Check - apenas apps
      // verificados podem votar
      enforceAppCheck:
        process.env.FUNCTIONS_EMULATOR !== "true",
      consumeAppCheckToken: true,
    },
    async (request) => {
      requireProfileComplete(request);

      if (!request.auth) {
        throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
      }
      const voterId = request.auth.uid;

      // ======================================
      // 1.5. RATE LIMITING (20 votos/min)
      // ======================================
      const {
        allowed,
        remaining,
        resetAt,
      } = await checkRateLimit(voterId, {
        maxRequests: 20,
        windowMs: 60 * 1000,
        keyPrefix: "mvp_vote",
      });

      if (!allowed) {
        const resetInSeconds = Math.ceil(
          (resetAt.getTime() - Date.now()) / 1000
        );
        throw new HttpsError(
          "resource-exhausted",
          // eslint-disable-next-line new-cap
          ERROR_MSGS.RATE_LIMIT_RETRY(resetInSeconds),
          {
            retryAfter: resetInSeconds,
            limit: 20,
            remaining,
          }
        );
      }

      const {
        gameId,
        votedPlayerId,
        category,
      } = request.data;

      if (
        !gameId ||
        typeof gameId !== "string" ||
        gameId.length > 128
      ) {
        throw new HttpsError(
          "invalid-argument",
          ERROR_MSGS.GAME_ID_REQUIRED
        );
      }
      if (
        !votedPlayerId ||
        typeof votedPlayerId !== "string" ||
        votedPlayerId.length > 128
      ) {
        throw new HttpsError(
          "invalid-argument",
          // eslint-disable-next-line new-cap
          ERROR_MSGS.FIELD_REQUIRED("votedPlayerId")
        );
      }
      if (
        !category ||
        !VALID_VOTE_CATEGORIES.includes(category)
      ) {
        throw new HttpsError(
          "invalid-argument",
          // eslint-disable-next-line new-cap
          ERROR_MSGS.ALLOWED_VALUES(
            "Categoria",
            VALID_VOTE_CATEGORIES as readonly string[]
          )
        );
      }

      if (voterId === votedPlayerId) {
        throw new HttpsError(
          "invalid-argument",
          ERROR_MSGS.CANNOT_VOTE_SELF
        );
      }

      if (
        gameId.includes("/") ||
        votedPlayerId.includes("/")
      ) {
        throw new HttpsError(
          "invalid-argument",
          ERROR_MSGS.ID_INVALID_CHARS
        );
      }

      const db = getFirestore();

      // ======================================
      // 3. TRANSACTION: Verificar + Escrever
      // ======================================
      try {
        const result = await db.runTransaction(
          async (transaction) => {
            const gameRef = db
              .collection("games")
              .doc(gameId);
            const gameSnap =
              await transaction.get(gameRef);

            if (!gameSnap.exists) {
              throw new HttpsError(
                "not-found",
                ERROR_MSGS.GAME_NOT_FOUND
              );
            }

            const gameData = gameSnap.data();
            if (!gameData) {
              throw new HttpsError(
                "not-found",
                "Dados do jogo indisponíveis"
              );
            }

            if (gameData.status !== "FINISHED") {
              throw new HttpsError(
                "failed-precondition",
                ERROR_MSGS.VOTING_NOT_STARTED
              );
            }

            if (
              gameData.voting_status ===
              "CONCLUDED"
            ) {
              throw new HttpsError(
                "failed-precondition",
                ERROR_MSGS.VOTING_CLOSED
              );
            }

            // 3.4: Validar janela de votação
            // (24h após fim do jogo)
            // FIX #648/B1: deadline = gameEndTime + 24h,
            // não gameStartTime + 24h. Usa duration_minutes
            // (default 90min) para calcular fim do jogo.
            const gameDateTime =
              gameData.dateTime;
            let deadline: Date;
            if (
              gameDateTime &&
              typeof gameDateTime.toDate ===
              "function"
            ) {
              const gameStartDate =
                gameDateTime.toDate();
              const durationMin =
                (gameData.duration_minutes as number) ?? 90;
              const gameEndMs =
                gameStartDate.getTime() +
                durationMin * 60 * 1000;
              deadline = new Date(
                gameEndMs +
                VOTE_WINDOW_HOURS *
                60 * 60 * 1000
              );
            } else {
              throw new HttpsError(
                "internal",
                "Dados do jogo incompletos: " +
                "sem data de realização"
              );
            }
            const now = new Date();
            if (now > deadline) {
              throw new HttpsError(
                "failed-precondition",
                ERROR_MSGS.VOTING_EXPIRED
              );
            }

            const voterConfId =
              `${gameId}_${voterId}`;
            const voterConfRef = db
              .collection("confirmations")
              .doc(voterConfId);
            const voterConfSnap =
              await transaction.get(
                voterConfRef
              );

            if (!voterConfSnap.exists) {
              throw new HttpsError(
                "permission-denied",
                ERROR_MSGS.CONFIRMED_PLAYERS_ONLY
              );
            }

            const voterConfData =
              voterConfSnap.data();
            if (
              voterConfData?.status !==
              "CONFIRMED"
            ) {
              throw new HttpsError(
                "permission-denied",
                ERROR_MSGS.CONFIRMED_PLAYERS_ONLY
              );
            }

            const votedConfId =
              `${gameId}_${votedPlayerId}`;
            const votedConfRef = db
              .collection("confirmations")
              .doc(votedConfId);
            const votedConfSnap =
              await transaction.get(
                votedConfRef
              );

            if (
              !votedConfSnap.exists ||
              votedConfSnap.data()?.status !==
              "CONFIRMED"
            ) {
              throw new HttpsError(
                "invalid-argument",
                ERROR_MSGS.PLAYER_NOT_IN_GAME
              );
            }

            const voteId =
              `${gameId}_${voterId}` +
              `_${category}`;
            const voteRef = db
              .collection("mvp_votes")
              .doc(voteId);
            const existingVote =
              await transaction.get(voteRef);

            if (existingVote.exists) {
              throw new HttpsError(
                "already-exists",
                // eslint-disable-next-line new-cap
                ERROR_MSGS.ALREADY_VOTED(category)
              );
            }

            // 3.8: Escrever voto
            // (DENTRO da transaction)
            transaction.set(voteRef, {
              id: voteId,
              game_id: gameId,
              voter_id: voterId,
              voted_player_id: votedPlayerId,
              category: category,
              voted_at:
                FieldValue
                  .serverTimestamp(),
              // Campo de rastreabilidade
              attempt_timestamp: Date.now(),
            });

            return {
              voteId,
              category,
              votedPlayerId,
            };
          }
        );

        logger.info(
          "[MVP_VOTE] Voto registrado: " +
          `${voterId} -> ` +
          `${result.votedPlayerId} ` +
          `(${result.category}) ` +
          `no jogo ${gameId}`
        );

        return {
          success: true,
          voteId: result.voteId,
          message: ERROR_MSGS.VOTE_REGISTERED,
        };
      } catch (error: unknown) {
        if (error instanceof HttpsError) {
          throw error;
        }

        const errMsg =
          error instanceof Error ?
            error.message :
            String(error);
        logger.error(
          "[MVP_VOTE] Erro ao registrar " +
          `voto: ${errMsg}`
        );
        throw new HttpsError(
          "internal",
          ERROR_MSGS.INTERNAL_ERROR
        );
      }
    }
  );

// ==========================================
// CLOUD FUNCTION: concludeMvpVoting
// ==========================================

/**
 * Conclui a votação de MVP de um jogo usando
 * Firestore transaction.
 *
 * Garante atomicidade entre:
 * 1. Leitura de todos os votos
 *    (snapshot consistente)
 * 2. Contagem de votos por categoria
 * 3. Resolução de empates (determinístico)
 * 4. Atualização de confirmações
 *    (is_mvp, is_best_gk, is_worst_player)
 * 5. Atualização do jogo
 *    (mvp_id, voting_status)
 *
 * @param {string} gameId - ID do jogo
 * @return {object} Resultado da votação
 */
export const concludeMvpVoting =
  onCall<ConcludeVotingRequest>(
    {
      region: "southamerica-east1",
      memory: "512MiB",
      // SECURITY: App Check - apenas apps
      // verificados podem concluir votacao
      enforceAppCheck:
        process.env.FUNCTIONS_EMULATOR !== "true",
      consumeAppCheckToken: true,
    },
    async (request) => {
      requireProfileComplete(request);

      if (!request.auth) {
        throw new HttpsError("unauthenticated", ERROR_MSGS.UNAUTHENTICATED);
      }
      const userId = request.auth.uid;

      // ======================================
      // 1.5. RATE LIMITING (5 conclusões/min)
      // ======================================
      const {
        allowed: rlAllowed,
        resetAt: rlResetAt,
      } = await checkRateLimit(userId, {
        maxRequests: 5,
        windowMs: 60 * 1000,
        keyPrefix: "mvp_conclude",
      });

      if (!rlAllowed) {
        const resetInSec = Math.ceil(
          (rlResetAt.getTime() - Date.now()) /
          1000
        );
        throw new HttpsError(
          "resource-exhausted",
          // eslint-disable-next-line new-cap
          ERROR_MSGS.RATE_LIMIT_RETRY(resetInSec),
          {retryAfter: resetInSec, limit: 5}
        );
      }

      const {gameId} = request.data;

      if (
        !gameId ||
        typeof gameId !== "string" ||
        gameId.length > 128
      ) {
        throw new HttpsError(
          "invalid-argument",
          ERROR_MSGS.GAME_ID_REQUIRED
        );
      }

      if (gameId.includes("/")) {
        throw new HttpsError(
          "invalid-argument",
          ERROR_MSGS.ID_INVALID_CHARS
        );
      }

      const db = getFirestore();

      try {
        // ====================================
        // 2. TRANSACTION: Verificar + Escrever
        // ====================================
        const result =
          await db.runTransaction(
            async (transaction) => {
              // 2.1: Buscar votos (dentro
              // da transaction - evita TOCTOU)
              const votesSnap =
                await transaction.get(
                  db.collection("mvp_votes")
                    .where("game_id", "==", gameId)
                );
              const votes = votesSnap.docs.map(
                (doc) => doc.data()
              );

              // 2.2: Ler e validar o jogo
              const gameRef = db
                .collection("games")
                .doc(gameId);
              const gameSnap =
                await transaction.get(gameRef);

              if (!gameSnap.exists) {
                throw new HttpsError(
                  "not-found",
                  ERROR_MSGS.GAME_NOT_FOUND
                );
              }

              const gameData =
                gameSnap.data();
              if (!gameData) {
                throw new HttpsError(
                  "not-found",
                  "Dados do jogo " +
                  "indisponíveis"
                );
              }

              const coOrganizers =
                (gameData.co_organizers as string[]) ?? [];
              const isAdmin =
                request.auth?.token?.role ===
                "ADMIN";
              if (
                gameData.owner_id !== userId &&
                !coOrganizers.includes(userId) &&
                !isAdmin
              ) {
                throw new HttpsError(
                  "permission-denied",
                  "Apenas o dono do jogo, " +
                  "co-organizadores ou admin " +
                  "podem encerrar a votação"
                );
              }

              if (
                gameData.status !== "FINISHED"
              ) {
                throw new HttpsError(
                  "failed-precondition",
                  ERROR_MSGS.GAME_NOT_FINALIZED
                );
              }

              // 2.5: Idempotência - se já
              // concluída, retornar anterior
              if (
                gameData.voting_status ===
                "CONCLUDED"
              ) {
                logger.info(
                  "[MVP_CONCLUDE] Votação " +
                  `do jogo ${gameId} já ` +
                  "foi concluída"
                );
                return {
                  alreadyConcluded: true,
                  mvpId:
                    gameData.mvp_id || null,
                  bestGkId:
                    gameData.best_gk_id ||
                    null,
                  worstPlayerId:
                    gameData
                      .worst_player_id ||
                    null,
                };
              }

              // 2.6: Sem votos, encerrar
              // sem vencedor
              if (votes.length === 0) {
                transaction.update(
                  gameRef,
                  {
                    voting_status:
                      "CONCLUDED",
                    voting_concluded_at:
                      admin.firestore
                        .FieldValue
                        .serverTimestamp(),
                    voting_concluded_by:
                      userId,
                  }
                );

                return {
                  alreadyConcluded: false,
                  mvpId: null,
                  bestGkId: null,
                  worstPlayerId: null,
                  totalVotes: 0,
                };
              }

              // 2.7: Contar votos
              const mvpCounts =
                tallyVotes(votes, "MVP");
              const bestGkCounts =
                tallyVotes(
                  votes,
                  "BEST_GOALKEEPER"
                );
              const worstCounts =
                tallyVotes(votes, "WORST");

              // 2.8: Resolver vencedores
              // (determinístico em empate)
              const mvpId =
                resolveWinner(mvpCounts);
              const bestGkId =
                resolveWinner(bestGkCounts);
              const worstPlayerId =
                resolveWinner(worstCounts);

              // 2.9: Buscar confirmações
              // FIX #617: usar transaction.get() em vez de db.get()
              // para evitar janela TOCTOU — se uma confirmation mudar
              // entre a query e o commit, a transaction detecta conflito
              // e retenta automaticamente com dados frescos.
              const confirmationsRef = db
                .collection("confirmations")
                .where("game_id", "==", gameId)
                .where("status", "==", "CONFIRMED");
              const confirmationsSnap =
                await transaction.get(
                  confirmationsRef
                );

              // 2.10: Atualizar confirmações
              for (
                const confDoc of
                confirmationsSnap.docs
              ) {
                const confData =
                  confDoc.data();
                const confUserId =
                  confData.user_id ||
                  confData.userId;
                if (!confUserId) continue;

                const confRef = confDoc.ref;

                transaction.update(
                  confRef,
                  {
                    is_mvp:
                      mvpId === confUserId,
                    is_best_gk:
                      bestGkId ===
                      confUserId,
                    is_worst_player:
                      worstPlayerId ===
                      confUserId,
                    voting_concluded_at:
                      admin.firestore
                        .FieldValue
                        .serverTimestamp(),
                  }
                );
              }

              // 2.11: Atualizar jogo com
              // resultados da votação
              const gameUpdates:
                Record<string, unknown> = {
                  voting_status: "CONCLUDED",
                  voting_concluded_at:
                    admin.firestore
                      .FieldValue
                      .serverTimestamp(),
                  voting_concluded_by:
                    userId,
                  total_votes: votes.length,
                };

              if (mvpId) {
                gameUpdates.mvp_id = mvpId;
              }
              if (bestGkId) {
                gameUpdates.best_gk_id =
                  bestGkId;
              }
              if (worstPlayerId) {
                gameUpdates
                  .worst_player_id =
                  worstPlayerId;
              }

              transaction.update(
                gameRef,
                gameUpdates
              );

              return {
                alreadyConcluded: false,
                mvpId,
                bestGkId,
                worstPlayerId,
                totalVotes: votes.length,
                mvpVotes: mvpCounts.length,
                bestGkVotes:
                  bestGkCounts.length,
                worstVotes:
                  worstCounts.length,
              };
            }
          );

        logger.info(
          "[MVP_CONCLUDE] Votação " +
          "concluída para jogo " +
          `${gameId}: ` +
          `MVP=${result.mvpId}, ` +
          `BestGK=${result.bestGkId}, ` +
          `Worst=${result.worstPlayerId}`
        );

        // FIX #579: aplicar XP delta MVP +30 / Bola Murcha -10.
        // Antes: onGameStatusUpdate fira em FINISHED (24h antes do
        // voting concluir), `mvp_id` e `is_worst_player` ainda não
        // foram escritos → bonus/penalty NUNCA aplicados.
        // Agora: aplicado aqui no callable após o voting concluir,
        // idempotente via xp_logs com doc id determinístico.
        // Best-effort: erros aqui não falham o concludeMvpVoting.
        //
        // FIX #618: guard !alreadyConcluded removido intencionalmente.
        // applyVotingXpDelta é idempotente via doc id determinístico
        // (mvp_${gameId}_${userId} / bola_murcha_${gameId}_${userId}
        // em xp_logs). Segunda chamada vê logDoc.exists e retorna no-op.
        // Antes: guard bloqueava retry após qualquer erro transient
        // (timeout, network blip) → MVP perdia +30 XP permanentemente
        // sem recovery automático.
        // Separado em dois try/catch independentes para que falha no MVP
        // não impeça aplicação do XP do Bola Murcha e vice-versa.
        let mvpXpApplied = false;
        let worstXpApplied = false;
        if (result.mvpId) {
          try {
            await applyVotingXpDelta(
              db,
              gameId,
              result.mvpId as string,
              "MVP",
              XP_ACTIONS.MVP
            );
            mvpXpApplied = true;
          } catch (xpError) {
            logger.error(
              "[VOTING_XP] MVP application failed " +
              "(will be retried on next call):",
              xpError
            );
          }
        }
        if (result.worstPlayerId) {
          try {
            await applyVotingXpDelta(
              db,
              gameId,
              result.worstPlayerId as string,
              "BOLA_MURCHA",
              XP_ACTIONS.WORST_PLAYER
            );
            worstXpApplied = true;
          } catch (xpError) {
            logger.error(
              "[VOTING_XP] Bola Murcha application failed " +
              "(will be retried on next call):",
              xpError
            );
          }
        }

        const xpAllOk = (!result.mvpId || mvpXpApplied) &&
          (!result.worstPlayerId || worstXpApplied);

        return {
          success: true,
          alreadyConcluded:
            result.alreadyConcluded,
          results: {
            mvpId: result.mvpId,
            bestGkId: result.bestGkId,
            worstPlayerId:
              result.worstPlayerId,
          },
          xpApplied: {
            mvp: mvpXpApplied,
            worst: worstXpApplied,
            allOk: xpAllOk,
          },
          message:
            result.alreadyConcluded ?
              ERROR_MSGS.VOTE_ALREADY_CONCLUDED :
              "Votação encerrada " +
              "com sucesso",
        };
      } catch (error: unknown) {
        if (error instanceof HttpsError) {
          throw error;
        }

        const errMsg =
          error instanceof Error ?
            error.message :
            String(error);
        logger.error(
          "[MVP_CONCLUDE] Erro ao " +
          "concluir votação: " +
          errMsg
        );
        throw new HttpsError(
          "internal",
          ERROR_MSGS.INTERNAL_ERROR
        );
      }
    }
  );

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Conta votos por categoria, retornando
 * array ordenado por contagem.
 *
 * @param {admin.firestore.DocumentData[]} votes
 *   Array de votos
 * @param {string} category - Categoria
 * @return {VoteTally[]} Array de playerId
 *   e count ordenado por count DESC
 */
function tallyVotes(
  votes: admin.firestore.DocumentData[],
  category: string
): VoteTally[] {
  const categoryVotes = votes.filter(
    (v) => v.category === category
  );

  // Agrupar por jogador votado
  const countMap = new Map<string, number>();
  for (const vote of categoryVotes) {
    const playerId = vote.voted_player_id;
    if (playerId) {
      countMap.set(
        playerId,
        (countMap.get(playerId) || 0) + 1
      );
    }
  }

  // Converter para array e ordenar (DESC)
  const tallies: VoteTally[] = [];
  for (const [playerId, count] of countMap) {
    tallies.push({playerId, count});
  }

  tallies.sort((a, b) => b.count - a.count);
  return tallies;
}

/**
 * Resolve o vencedor a partir da contagem
 * de votos.
 *
 * Em caso de empate, usa ordenação
 * alfabética do playerId para garantir
 * resultado determinístico (mesmo resultado
 * independente da ordem de execução).
 *
 * @param {VoteTally[]} tallies - Array de
 *   playerId e count ordenado por count DESC
 * @return {string|null} playerId do
 *   vencedor, ou null se sem votos
 */
function resolveWinner(
  tallies: VoteTally[]
): string | null {
  if (tallies.length === 0) return null;

  const maxCount = tallies[0].count;

  // Filtrar todos os empatados no topo
  const tied = tallies.filter(
    (t) => t.count === maxCount
  );

  if (tied.length === 1) {
    return tied[0].playerId;
  }

  // Desempate determinístico: ordenação
  // alfabética do playerId. Garante que o
  // resultado é sempre o mesmo.
  tied.sort(
    (a, b) =>
      a.playerId.localeCompare(b.playerId)
  );

  logger.info(
    "[MVP_TIEBREAK] Empate com " +
    `${maxCount} votos entre ` +
    `${tied.length} jogadores. ` +
    `Vencedor: ${tied[0].playerId} ` +
    "(desempate alfabético)"
  );

  return tied[0].playerId;
}

/**
 * FIX #579: aplica XP delta de MVP (+30) ou Bola Murcha (-10) ao
 * usuário, em transaction idempotente.
 *
 * Idempotência via doc id determinístico em `xp_logs`:
 * - `mvp_${gameId}_${userId}` (MVP)
 * - `bola_murcha_${gameId}_${userId}` (Bola Murcha)
 *
 * Se o log já existe (chamada repetida ou retry), no-op.
 *
 * @param {admin.firestore.Firestore} db - instância do Firestore
 * @param {string} gameId - ID do jogo
 * @param {string} userId - ID do usuário (MVP ou worst player)
 * @param {"MVP" | "BOLA_MURCHA"} reason - tipo de delta
 * @param {number} xpDelta - +30 (MVP) ou -10 (Bola Murcha)
 * @return {Promise<void>}
 */
async function applyVotingXpDelta(
  db: admin.firestore.Firestore,
  gameId: string,
  userId: string,
  reason: "MVP" | "BOLA_MURCHA",
  xpDelta: number
): Promise<void> {
  const logId =
    reason === "MVP" ?
      `mvp_${gameId}_${userId}` :
      `bola_murcha_${gameId}_${userId}`;
  const logRef = db
    .collection("xp_logs")
    .doc(logId);
  const userRef = db
    .collection("users")
    .doc(userId);

  let activeSeasonId: string | null = null;

  try {
    const seasonSnap = await db
      .collection("seasons")
      .where("is_active", "==", true)
      .limit(1)
      .get();
    activeSeasonId = !seasonSnap.empty ?
      seasonSnap.docs[0].id :
      null;
  } catch (fetchError) {
    logger.error(
      `[VOTING_XP] Could not fetch active season: ${fetchError}. ` +
      "Aborting to prevent XP drift."
    );
    throw fetchError;
  }

  try {
    await db.runTransaction(async (txn) => {
      const logDoc = await txn.get(logRef);
      if (logDoc.exists) {
        logger.info(
          `[VOTING_XP] Skipping ${reason} XP ` +
          `for ${userId} in ${gameId} ` +
          "- log already exists (idempotent)"
        );
        return;
      }

      if (reason === "MVP") {
        const mainXpLogRef = db
          .collection("xp_logs")
          .doc(`game_${gameId}_user_${userId}`);
        const mainXpLog = await txn.get(mainXpLogRef);
        if (mainXpLog.exists && (mainXpLog.data()?.xp_mvp as number) > 0) {
          logger.info(
            `[VOTING_XP] Skipping MVP XP for ${userId} in ${gameId} ` +
            "- main trigger already paid MVP XP (dedup)"
          );
          return;
        }
      }

      let weekKey: string | null = null;
      let monthKey: string | null = null;

      const gameSnap = await txn.get(
        db.collection("games").doc(gameId)
      );
      const rawGame = gameSnap.data();
      const gameDoc: Game | undefined =
        isGameShape(rawGame) ? rawGame : undefined;
      const gameDate = getGameDate(gameDoc);
      monthKey = gameDate.toLocaleDateString("en-CA", {
        timeZone: "America/Sao_Paulo",
      }).substring(0, 7);
      weekKey = getWeekKey(gameDate);

      // FIX #726: MVP bonus (voting reward) is applied OVER the
      // MAX_XP_PER_GAME cap. The cap only limits game-performance XP
      // (goals/assists/etc), not voting-based rewards. MVP is determined
      // democratically by peers, not by stats that could be inflated.
      // Bola Murcha (-10) is always applied regardless of cap.
      if (xpDelta > 0 && reason !== "MVP") {
        const existingXpLogsSnap = await txn.get(
          db.collection("xp_logs")
            .where("user_id", "==", userId)
            .where("game_id", "==", gameId)
        );
        let totalExistingXp = 0;
        existingXpLogsSnap.forEach((doc) => {
          totalExistingXp +=
            (doc.data().xp_earned as number) || 0;
        });
        if (
          totalExistingXp + xpDelta >
          MAX_XP_PER_GAME
        ) {
          const cappedDelta = Math.max(
            0,
            MAX_XP_PER_GAME - totalExistingXp
          );
          logger.warn(
            `[VOTING_XP] Capping ${reason} XP ` +
            `for ${userId} in ${gameId}: ` +
            `${totalExistingXp} + ${xpDelta} ` +
            "exceeds MAX_XP_PER_GAME " +
            `(${MAX_XP_PER_GAME}). ` +
            `Capped to ${cappedDelta}.`
          );
          if (cappedDelta <= 0) {
            return;
          }
          xpDelta = cappedDelta;
        }
      }

      const userDoc = await txn.get(userRef);
      if (!userDoc.exists) {
        logger.warn(
          `[VOTING_XP] User ${userId} not found, ` +
          `skipping ${reason} XP for ${gameId}`
        );
        return;
      }

      if (reason === "MVP") {
        const statsRef = db.collection("statistics").doc(userId);
        const statsDoc = await txn.get(statsRef);
        const statsData = statsDoc.data() || {};
        const currentMvpStreak =
          ((statsData.currentMvpStreak as number) || 0) + 1;
        const bestMvpStreak = Math.max(
          (statsData.bestMvpStreak as number) || 0,
          currentMvpStreak
        );
        txn.set(statsRef, {
          bestPlayerCount: FieldValue.increment(1),
          currentMvpStreak,
          bestMvpStreak,
        }, {merge: true});
      }

      const currentXp =
        (userDoc.data()
          ?.experience_points as number) || 0;
      const currentLevel =
        (userDoc.data()?.level as number) || 0;
      // FIX #1575 + #2111: piso em MIN_XP_PER_GAME (-100) em vez de 0 pra Bola Murcha
      // não ser absorvida silenciosamente quando o user tem menos XP que a
      // penalidade. Math.max(0,...) zerava a penalidade — comportamento errado.
      // FIX #2111: clamp the increment delta itself so the atomic
      // FieldValue.increment doesn't bypass the floor. Read + write are within
      // the same transaction → safe from race conditions.
      const clampedXpDelta = (currentXp + xpDelta < MIN_XP_PER_GAME) ?
        MIN_XP_PER_GAME - currentXp :
        xpDelta;
      const newXp = Math.max(MIN_XP_PER_GAME, currentXp + xpDelta);

      // FIX #1993: usa getLevelForXp() canônico de xp/pipeline.ts
      // em vez de recalcular level inline (evita drift por inconsistência).
      const newLevel = getLevelForXp(newXp);

      // FIX #1990: atualizar season_participation e ranking_deltas
      // para que o XP de voto conte nos rankings de temporada.
      const isMvp = reason === "MVP";
      const now = FieldValue.serverTimestamp();

      if (activeSeasonId) {
        const seasonPartId = `${activeSeasonId}_${userId}`;
        // Fase 4: espelha o delta de XP/mvp do voto na visão
        // segmentada by_gender.{gender} (campo plano = combinado).
        const gender = normalizeGameGender(rawGame?.gender);
        const inc = FieldValue.increment;
        const genderUpdate: Record<string, unknown> = {
          total_xp: inc(clampedXpDelta),
        };
        const seasonPartUpdate: Record<string, unknown> = {
          total_xp: inc(clampedXpDelta),
          updated_at: now,
        };
        if (isMvp) {
          seasonPartUpdate.mvp_count = inc(1);
          genderUpdate.mvp_count = inc(1);
        }
        seasonPartUpdate.by_gender = {[gender]: genderUpdate};
        txn.set(
          db.collection("season_participation").doc(seasonPartId),
          seasonPartUpdate,
          {merge: true}
        );
      }

      if (weekKey && monthKey) {
        const weekDeltaId = `week_${weekKey}_${userId}`;
        const monthDeltaId = `month_${monthKey}_${userId}`;
        const rankingFields: Record<string, unknown> = {
          xp_added: FieldValue.increment(clampedXpDelta),
          updated_at: now,
        };
        if (isMvp) {
          rankingFields.mvp_added =
            FieldValue.increment(1);
        }
        txn.set(
          db.collection("ranking_deltas").doc(weekDeltaId),
          rankingFields,
          {merge: true}
        );
        txn.set(
          db.collection("ranking_deltas").doc(monthDeltaId),
          rankingFields,
          {merge: true}
        );
      }

      txn.set(logRef, {
        user_id: userId,
        game_id: gameId,
        xp_earned: clampedXpDelta,
        xp_before: currentXp,
        xp_after: newXp,
        level_before: currentLevel,
        level_after: newLevel,
        reason,
        transaction_id: logId,
        source: "mvp_voting_concluded",
        created_at: FieldValue
          .serverTimestamp(),
      });
      txn.update(userRef, {
        experience_points:
          FieldValue.increment(clampedXpDelta),
        level: newLevel,
        updated_at: FieldValue
          .serverTimestamp(),
      });

      logger.info(
        `[VOTING_XP] Applied ${clampedXpDelta} XP ` +
        `to ${userId} for ${reason} ` +
        `in ${gameId} ` +
        `(${currentXp} → ${newXp}, ` +
        `level ${currentLevel} → ${newLevel})`
      );
    });
  } catch (error) {
    logger.error(
      `[VOTING_XP] Error applying ${reason} ` +
      `XP for ${userId} in ${gameId}:`,
      error
    );
    throw error;
  }
}
