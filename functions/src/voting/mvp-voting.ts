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

import * as admin from "firebase-admin";
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
  LEVEL_TABLE,
  MAX_XP_PER_GAME,
} from "../constants";

const getDb = () => admin.firestore();

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

      const voterId = request.auth!.uid;

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
          "Rate limit excedido. Tente " +
          "novamente em " +
          `${resetInSeconds} segundos.`,
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

      // ======================================
      // 2. VALIDAÇÃO DE ENTRADA
      // ======================================
      if (
        !gameId ||
        typeof gameId !== "string" ||
        gameId.length > 128
      ) {
        throw new HttpsError(
          "invalid-argument",
          "gameId é obrigatório e deve " +
          "ser uma string válida"
        );
      }
      if (
        !votedPlayerId ||
        typeof votedPlayerId !== "string" ||
        votedPlayerId.length > 128
      ) {
        throw new HttpsError(
          "invalid-argument",
          "votedPlayerId é obrigatório " +
          "e deve ser uma string válida"
        );
      }
      if (
        !category ||
        !VALID_VOTE_CATEGORIES.includes(category)
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Categoria inválida. Deve ser: " +
          `${VALID_VOTE_CATEGORIES.join(", ")}`
        );
      }

      // Votante não pode votar em si mesmo
      if (voterId === votedPlayerId) {
        throw new HttpsError(
          "invalid-argument",
          "Não é permitido votar em si mesmo"
        );
      }

      // SECURITY: Sanitizar inputs - previne
      // injection de dados no Firestore
      if (
        gameId.includes("/") ||
        votedPlayerId.includes("/")
      ) {
        throw new HttpsError(
          "invalid-argument",
          "IDs não podem conter " +
          "caracteres especiais"
        );
      }

      const db = getDb();

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

            // 3.1: Validar que o jogo existe
            if (!gameSnap.exists) {
              throw new HttpsError(
                "not-found",
                "Jogo não encontrado"
              );
            }

            const gameData = gameSnap.data();
            if (!gameData) {
              throw new HttpsError(
                "not-found",
                "Dados do jogo indisponíveis"
              );
            }

            // 3.2: Validar status (FINISHED)
            if (gameData.status !== "FINISHED") {
              throw new HttpsError(
                "failed-precondition",
                "Votação disponível apenas " +
                "para jogos finalizados"
              );
            }

            // 3.3: Validar que votação não
            // foi concluída
            if (
              gameData.voting_status ===
              "CONCLUDED"
            ) {
              throw new HttpsError(
                "failed-precondition",
                "Votação já foi encerrada " +
                "para este jogo"
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
              // FIX #648/B2: sem dateTime, NÃO usar
              // created_at como fallback (causa timezone
              // issues). Throw em vez disso.
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
                "Prazo de votação expirado " +
                "(24h após o jogo)"
              );
            }

            // 3.5: Validar que o votante
            // participou do jogo
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
                "Apenas jogadores " +
                "confirmados podem votar"
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
                "Apenas jogadores com " +
                "presença confirmada " +
                "podem votar"
              );
            }

            // 3.6: Validar que o jogador
            // votado participou do jogo
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
                "Jogador votado não " +
                "participou deste jogo"
              );
            }

            // 3.7: Verificar voto duplicado
            // (DENTRO da transaction - TOCTOU)
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
                "Você já votou na " +
                `categoria ${category} ` +
                "neste jogo"
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
                admin.firestore.FieldValue
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

        console.log(
          "[MVP_VOTE] Voto registrado: " +
          `${voterId} -> ` +
          `${result.votedPlayerId} ` +
          `(${result.category}) ` +
          `no jogo ${gameId}`
        );

        return {
          success: true,
          voteId: result.voteId,
          message:
            "Voto registrado com sucesso",
        };
      } catch (error: unknown) {
        // Se já é HttpsError, re-throw
        if (error instanceof HttpsError) {
          throw error;
        }

        const errMsg =
          error instanceof Error ?
            error.message :
            String(error);
        console.error(
          "[MVP_VOTE] Erro ao registrar " +
          `voto: ${errMsg}`
        );
        throw new HttpsError(
          "internal",
          "Erro ao registrar voto. " +
          "Tente novamente."
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

      const userId = request.auth!.uid;

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
          "Rate limit excedido. Tente " +
          "novamente em " +
          `${resetInSec} segundos.`,
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
          "gameId é obrigatório e deve " +
          "ser uma string válida"
        );
      }

      // SECURITY: Sanitizar gameId - previne
      // path traversal no Firestore
      if (gameId.includes("/")) {
        throw new HttpsError(
          "invalid-argument",
          "gameId contém caracteres " +
          "inválidos"
        );
      }

      const db = getDb();

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
                  "Jogo não encontrado"
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

              // 2.3: Validar permissão
              // (apenas dono ou admin)
              if (
                gameData.owner_id !== userId
              ) {
                // Verificar admin via claims
                const isAdmin =
                  request.auth?.token?.role ===
                  "ADMIN";
                if (!isAdmin) {
                  throw new HttpsError(
                    "permission-denied",
                    "Apenas o dono do jogo " +
                    "ou admin pode encerrar " +
                    "a votação"
                  );
                }
              }

              // 2.4: Validar FINISHED
              if (
                gameData.status !== "FINISHED"
              ) {
                throw new HttpsError(
                  "failed-precondition",
                  "Jogo deve estar " +
                  "finalizado para " +
                  "encerrar votação"
                );
              }

              // 2.5: Idempotência - se já
              // concluída, retornar anterior
              if (
                gameData.voting_status ===
                "CONCLUDED"
              ) {
                console.log(
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

                const confId =
                  `${gameId}_${confUserId}`;
                const confRef = db
                  .collection(
                    "confirmations"
                  )
                  .doc(confId);

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

        console.log(
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
        if (result.mvpId) {
          try {
            await applyVotingXpDelta(
              db,
              gameId,
              result.mvpId as string,
              "MVP",
              XP_ACTIONS.MVP
            );
          } catch (xpError) {
            console.error(
              "[VOTING_XP] MVP application failed " +
              "(will be safe on retry — idempotente):",
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
          } catch (xpError) {
            console.error(
              "[VOTING_XP] Bola Murcha application failed " +
              "(will be safe on retry — idempotente):",
              xpError
            );
          }
        }

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
          message:
            result.alreadyConcluded ?
              "Votação já havia sido " +
              "concluída" :
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
        console.error(
          "[MVP_CONCLUDE] Erro ao " +
          "concluir votação: " +
          errMsg
        );
        throw new HttpsError(
          "internal",
          "Erro ao encerrar votação. " +
          "Tente novamente."
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

  console.log(
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

  try {
    await db.runTransaction(async (txn) => {
      const logDoc = await txn.get(logRef);
      if (logDoc.exists) {
        console.log(
          `[VOTING_XP] Skipping ${reason} XP ` +
          `for ${userId} in ${gameId} ` +
          "— log already exists (idempotent)"
        );
        return;
      }

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
          console.warn(
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
        console.warn(
          `[VOTING_XP] User ${userId} not found, ` +
          `skipping ${reason} XP for ${gameId}`
        );
        return;
      }

      const currentXp =
        (userDoc.data()
          ?.experience_points as number) || 0;
      const newXp = Math.max(0, currentXp + xpDelta);

      // FIX #648/B3: recalcula level apos aplicar XP
      // (antes era feito sem atualizar level no user doc).
      const levelTable = LEVEL_TABLE.levels;
      const sortedLevels = [...levelTable].sort(
        (a, b) => b.xpRequired - a.xpRequired
      );
      const newLevel =
        sortedLevels.find(
          (l) => newXp >= l.xpRequired
        )?.level ?? 0;

      txn.set(logRef, {
        user_id: userId,
        game_id: gameId,
        xp_earned: xpDelta,
        xp_before: currentXp,
        xp_after: newXp,
        reason,
        transaction_id: logId,
        source: "mvp_voting_concluded",
        created_at: admin.firestore.FieldValue
          .serverTimestamp(),
      });
      txn.update(userRef, {
        experience_points: newXp,
        level: newLevel,
        updated_at: admin.firestore.FieldValue
          .serverTimestamp(),
      });

      console.log(
        `[VOTING_XP] Applied ${xpDelta} XP ` +
        `to ${userId} for ${reason} ` +
        `in ${gameId} ` +
        `(${currentXp} → ${newXp}, ` +
        `level ${newLevel})`
      );
    });
  } catch (error) {
    console.error(
      `[VOTING_XP] Error applying ${reason} ` +
      `XP for ${userId} in ${gameId}:`,
      error
    );
  }
}
