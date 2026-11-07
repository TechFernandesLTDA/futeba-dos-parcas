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
import {
  checkMilestones,
  getLevelForXp,
} from "../xp/pipeline";
import {
  getGameDate,
  getWeekKey,
  isRawParticipationEligible,
  normalizeGameGender,
} from "../game/helpers";
import {Game, UserStatistics} from "../models";
import {isGameShape} from "../validation/guards";
import {
  buildMilestoneBadgeDoc,
  buildUserBadgeAggregateDoc,
} from "../badges/user-badge-docs";

import {db as getFirestore} from "../_db";

// ==========================================
// CONSTANTES
// ==========================================

/** Janela de votação (importada de constants.ts) */
const VOTE_WINDOW_HOURS = MVP_VOTE_WINDOW_HOURS;

/**
 * Monta a entrada de milestones a partir do documento canônico já persistido
 * pela transação de conclusão da votação. Nenhum contador é recalculado aqui.
 *
 * @param {Record<string, unknown>} statsData Estatísticas persistidas.
 * @return {UserStatistics} Snapshot exato usado pela avaliação de milestones.
 */
export function buildCanonicalVotingMilestoneStatistics(
  statsData: Record<string, unknown>
): UserStatistics {
  return {
    totalGames: (statsData.totalGames as number) || 0,
    totalGoals: (statsData.totalGoals as number) || 0,
    totalAssists: (statsData.totalAssists as number) || 0,
    totalSaves: (statsData.totalSaves as number) || 0,
    totalYellowCards: (statsData.totalYellowCards as number) || 0,
    totalRedCards: (statsData.totalRedCards as number) || 0,
    gamesWon: (statsData.gamesWon as number) || 0,
    gamesLost: (statsData.gamesLost as number) || 0,
    gamesDraw: (statsData.gamesDraw as number) || 0,
    bestPlayerCount: (statsData.bestPlayerCount as number) || 0,
    worstPlayerCount: (statsData.worstPlayerCount as number) || 0,
    currentMvpStreak: (statsData.currentMvpStreak as number) || 0,
    bestMvpStreak: (statsData.bestMvpStreak as number) || 0,
  };
}

/** Categorias de votação permitidas */
const VALID_VOTE_CATEGORIES = [
  "MVP",
  "BEST_GOALKEEPER",
  "WORST",
] as const;
type VoteCategory =
  typeof VALID_VOTE_CATEGORIES[number];

const REQUIRED_VOTE_CATEGORIES = [
  "MVP",
  "WORST",
] as const;

const POSITIVE_VOTE_CATEGORIES = [
  "MVP",
  "BEST_GOALKEEPER",
] as const;

const CONTRADICTORY_BALLOT_MESSAGE =
  "O mesmo jogador não pode ser escolhido como destaque e Bola Murcha.";

/**
 * Retorna se o eleitor completou as categorias obrigatórias.
 *
 * @param {ReadonlySet<string>} categories Categorias já registradas.
 * @return {boolean} Verdadeiro quando o ballot obrigatório está completo.
 */
function isBallotComplete(
  categories: ReadonlySet<string>
): boolean {
  return REQUIRED_VOTE_CATEGORIES.every(
    (category) => categories.has(category)
  );
}

// ==========================================
// INTERFACES
// ==========================================

/** Dados de entrada para submissão de voto */
interface SubmitVoteRequest {
  gameId: string;
  votedPlayerId: string;
  category: VoteCategory;
}

/** Voto individual dentro de submissão em lote */
interface SubmitVoteBatchItem {
  votedPlayerId: string;
  category: VoteCategory;
}

/** Dados de entrada para submissão atômica de múltiplos votos */
interface SubmitVotesRequest {
  gameId: string;
  votes: SubmitVoteBatchItem[];
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

type BallotSelections = Partial<Record<VoteCategory, string>>;

/**
 * Detecta se a seleção negativa aponta para algum destaque positivo.
 * MVP e melhor goleiro podem apontar para o mesmo goleiro.
 *
 * @param {BallotSelections} selections Seleções efetivas do ballot.
 * @return {boolean} Verdadeiro quando há combinação contraditória.
 */
function hasContradictoryBallot(
  selections: BallotSelections
): boolean {
  const worstPlayerId = selections.WORST;
  return Boolean(
    worstPlayerId &&
    POSITIVE_VOTE_CATEGORIES.some(
      (category) => selections[category] === worstPlayerId
    )
  );
}

/**
 * Converte itens de voto em seleções por categoria.
 *
 * @param {SubmitVoteBatchItem[]} votes Itens do ballot.
 * @return {BallotSelections} Seleções indexadas por categoria.
 */
function selectionsFromVotes(
  votes: readonly SubmitVoteBatchItem[]
): BallotSelections {
  return votes.reduce<BallotSelections>(
    (selections, vote) => {
      selections[vote.category] = vote.votedPlayerId;
      return selections;
    },
    {}
  );
}

/** Lança erro público consistente para um ballot contraditório. */
function throwContradictoryBallot(): never {
  throw new HttpsError(
    "invalid-argument",
    CONTRADICTORY_BALLOT_MESSAGE
  );
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
           
          ERROR_MSGS.FIELD_REQUIRED("votedPlayerId")
        );
      }
      if (
        !category ||
        !VALID_VOTE_CATEGORIES.includes(category)
      ) {
        throw new HttpsError(
          "invalid-argument",
           
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
              !isRawParticipationEligible(
                voterConfData
              )
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
              !isRawParticipationEligible(
                votedConfSnap.data()
              )
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
            const ballotVoteRefs =
              VALID_VOTE_CATEGORIES.map(
                (ballotCategory) => db
                  .collection("mvp_votes")
                  .doc(
                    `${gameId}_${voterId}` +
                    `_${ballotCategory}`
                  )
              );
            const ballotVoteSnaps = await Promise.all(
              ballotVoteRefs.map(
                (ref) => transaction.get(ref)
              )
            );
            const categoryIndex =
              VALID_VOTE_CATEGORIES.indexOf(category);
            const existingVote =
              ballotVoteSnaps[categoryIndex];

            if (existingVote.exists) {
              throw new HttpsError(
                "already-exists",
                 
                ERROR_MSGS.ALREADY_VOTED(category)
              );
            }

            const categoriesBefore = new Set<string>();
            const ballotSelections: BallotSelections = {};
            ballotVoteSnaps.forEach((snap, index) => {
              if (snap.exists) {
                const existingCategory =
                  VALID_VOTE_CATEGORIES[index];
                categoriesBefore.add(existingCategory);
                const existingData = snap.data();
                const existingPlayerId =
                  existingData?.voted_player_id ||
                  existingData?.votedPlayerId;
                if (existingPlayerId) {
                  ballotSelections[existingCategory] =
                    existingPlayerId;
                }
              }
            });
            ballotSelections[category] = votedPlayerId;
            if (hasContradictoryBallot(ballotSelections)) {
              throwContradictoryBallot();
            }
            const categoriesAfter =
              new Set(categoriesBefore);
            categoriesAfter.add(category);
            const completedNow =
              !isBallotComplete(categoriesBefore) &&
              isBallotComplete(categoriesAfter);

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

            if (completedNow) {
              transaction.update(gameRef, {
                voting_status: "OPEN",
                voting_submitted_count:
                  FieldValue.increment(1),
                updated_at:
                  FieldValue.serverTimestamp(),
              });
            }

            return {
              voteId,
              category,
              votedPlayerId,
              ballotComplete:
                isBallotComplete(categoriesAfter),
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
          ballotComplete: result.ballotComplete,
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
// CLOUD FUNCTION: submitMvpVotes
// ==========================================

/**
 * Submete múltiplas categorias de voto em uma única
 * transaction. Mantém a tela Web atômica ao registrar
 * MVP, melhor goleiro e bola murcha juntos.
 *
 * @param {string} gameId - ID do jogo
 * @param {SubmitVoteBatchItem[]} votes - Votos por categoria
 * @return {object} Resultado dos votos registrados
 */
export const submitMvpVotes =
  onCall<SubmitVotesRequest>(
    {
      region: "southamerica-east1",
      memory: "256MiB",
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

      const {
        allowed,
        remaining,
        resetAt,
      } = await checkRateLimit(voterId, {
        maxRequests: 10,
        windowMs: 60 * 1000,
        keyPrefix: "mvp_votes_batch",
      });

      if (!allowed) {
        const resetInSeconds = Math.ceil(
          (resetAt.getTime() - Date.now()) / 1000
        );
        throw new HttpsError(
          "resource-exhausted",
           
          ERROR_MSGS.RATE_LIMIT_RETRY(resetInSeconds),
          {
            retryAfter: resetInSeconds,
            limit: 10,
            remaining,
          }
        );
      }

      const {
        gameId,
        votes,
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

      if (gameId.includes("/")) {
        throw new HttpsError(
          "invalid-argument",
          ERROR_MSGS.ID_INVALID_CHARS
        );
      }

      if (
        !Array.isArray(votes) ||
        votes.length < 1 ||
        votes.length > VALID_VOTE_CATEGORIES.length
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Informe entre 1 e 3 votos."
        );
      }

      const seenCategories = new Set<string>();
      for (const vote of votes) {
        if (
          !vote ||
          !vote.votedPlayerId ||
          typeof vote.votedPlayerId !== "string" ||
          vote.votedPlayerId.length > 128
        ) {
          throw new HttpsError(
            "invalid-argument",
             
            ERROR_MSGS.FIELD_REQUIRED("votedPlayerId")
          );
        }

        if (
          !vote.category ||
          !VALID_VOTE_CATEGORIES.includes(vote.category)
        ) {
          throw new HttpsError(
            "invalid-argument",
             
            ERROR_MSGS.ALLOWED_VALUES(
              "Categoria",
              VALID_VOTE_CATEGORIES as readonly string[]
            )
          );
        }

        if (seenCategories.has(vote.category)) {
          throw new HttpsError(
            "invalid-argument",
            "Categoria duplicada na votação."
          );
        }
        seenCategories.add(vote.category);

        if (voterId === vote.votedPlayerId) {
          throw new HttpsError(
            "invalid-argument",
            ERROR_MSGS.CANNOT_VOTE_SELF
          );
        }

        if (vote.votedPlayerId.includes("/")) {
          throw new HttpsError(
            "invalid-argument",
            ERROR_MSGS.ID_INVALID_CHARS
          );
        }
      }

      if (hasContradictoryBallot(selectionsFromVotes(votes))) {
        throwContradictoryBallot();
      }

      const db = getFirestore();

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
              !isRawParticipationEligible(
                voterConfData
              )
            ) {
              throw new HttpsError(
                "permission-denied",
                ERROR_MSGS.CONFIRMED_PLAYERS_ONLY
              );
            }

            const voteContexts = votes.map((vote) => {
              const voteId =
                `${gameId}_${voterId}` +
                `_${vote.category}`;
              return {
                vote,
                voteId,
                votedConfRef: db
                  .collection("confirmations")
                  .doc(`${gameId}_${vote.votedPlayerId}`),
                voteRef: db
                  .collection("mvp_votes")
                  .doc(voteId),
              };
            });
            const ballotVoteRefs =
              VALID_VOTE_CATEGORIES.map(
                (ballotCategory) => db
                  .collection("mvp_votes")
                  .doc(
                    `${gameId}_${voterId}` +
                    `_${ballotCategory}`
                  )
              );

            // Firestore exige todas as leituras antes da primeira escrita.
            const [
              votedConfSnaps,
              ballotVoteSnaps,
            ] = await Promise.all([
              Promise.all(
                voteContexts.map(
                  ({votedConfRef}) =>
                    transaction.get(votedConfRef)
                )
              ),
              Promise.all(
                ballotVoteRefs.map(
                  (ref) => transaction.get(ref)
                )
              ),
            ]);

            voteContexts.forEach(({vote}, index) => {
              const votedConfSnap = votedConfSnaps[index];
              if (
                !votedConfSnap.exists ||
                !isRawParticipationEligible(
                  votedConfSnap.data()
                )
              ) {
                throw new HttpsError(
                  "invalid-argument",
                  ERROR_MSGS.PLAYER_NOT_IN_GAME
                );
              }
              const categoryIndex =
                VALID_VOTE_CATEGORIES.indexOf(vote.category);
              if (ballotVoteSnaps[categoryIndex].exists) {
                throw new HttpsError(
                  "already-exists",
                   
                  ERROR_MSGS.ALREADY_VOTED(vote.category)
                );
              }
            });

            const categoriesBefore = new Set<string>();
            const ballotSelections: BallotSelections = {};
            ballotVoteSnaps.forEach((snap, index) => {
              if (snap.exists) {
                const existingCategory =
                  VALID_VOTE_CATEGORIES[index];
                categoriesBefore.add(existingCategory);
                const existingData = snap.data();
                const existingPlayerId =
                  existingData?.voted_player_id ||
                  existingData?.votedPlayerId;
                if (existingPlayerId) {
                  ballotSelections[existingCategory] =
                    existingPlayerId;
                }
              }
            });
            votes.forEach((vote) => {
              ballotSelections[vote.category] =
                vote.votedPlayerId;
            });
            if (hasContradictoryBallot(ballotSelections)) {
              throwContradictoryBallot();
            }
            const categoriesAfter =
              new Set(categoriesBefore);
            votes.forEach((vote) =>
              categoriesAfter.add(vote.category)
            );
            const completedNow =
              !isBallotComplete(categoriesBefore) &&
              isBallotComplete(categoriesAfter);

            voteContexts.forEach(({vote, voteId, voteRef}) => {
              transaction.set(voteRef, {
                id: voteId,
                game_id: gameId,
                voter_id: voterId,
                voted_player_id: vote.votedPlayerId,
                category: vote.category,
                voted_at:
                  FieldValue.serverTimestamp(),
                attempt_timestamp: Date.now(),
              });
            });
            if (completedNow) {
              transaction.update(gameRef, {
                voting_status: "OPEN",
                voting_submitted_count:
                  FieldValue.increment(1),
                updated_at:
                  FieldValue.serverTimestamp(),
              });
            }

            return {
              voteIds: voteContexts.map(({voteId}) => voteId),
              categories: votes.map(
                (vote) => vote.category
              ),
              ballotComplete:
                isBallotComplete(categoriesAfter),
            };
          }
        );

        logger.info(
          "[MVP_VOTE] Votos registrados em lote: " +
          `${voterId} (${result.categories.join(", ")}) ` +
          `no jogo ${gameId}`
        );

        return {
          success: true,
          voteIds: result.voteIds,
          ballotComplete: result.ballotComplete,
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
          `votos em lote: ${errMsg}`
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
                  // #3940: repassa o status da recompensa para o caller
                  // decidir se aplica o XP de votação agora ou adia.
                  xpRewardStatus:
                    (gameData.xp_reward_status as string) ||
                    null,
                };
              }

              // 2.6: Buscar confirmações elegíveis antes da apuração.
              // Mesmo sem votos, elas são necessárias para zerar o streak
              // de MVP no instante canônico em que a votação é concluída.
              // FIX XP/accounting: votos antigos de jogadores que só
              // confirmaram, mas não compareceram, não podem gerar
              // MVP/Bola Murcha nem delta de XP.
              const confirmationsRef = db
                .collection("confirmations")
                .where("game_id", "==", gameId)
                .where("status", "==", "CONFIRMED");
              const confirmationsSnap =
                await transaction.get(
                  confirmationsRef
                );
              const eligibleUserIds = new Set<string>();
              for (const confDoc of confirmationsSnap.docs) {
                const confData = confDoc.data();
                if (!isRawParticipationEligible(confData)) {
                  continue;
                }
                const confUserId =
                  confData.user_id ||
                  confData.userId;
                if (confUserId) {
                  eligibleUserIds.add(confUserId);
                }
              }

              const validVotes = votes.filter((vote) => {
                const voterId =
                  vote.voter_id || vote.voterId;
                const votedId =
                  vote.voted_player_id ||
                  vote.votedPlayerId;
                return eligibleUserIds.has(voterId) &&
                  eligibleUserIds.has(votedId);
              });

              if (validVotes.length !== votes.length) {
                logger.warn(
                  "[MVP_CONCLUDE] Ignoring " +
                  `${votes.length - validVotes.length} ` +
                  "vote(s) from ineligible players " +
                  `in game ${gameId}`
                );
              }

              // 2.8: Contar votos
              const mvpCounts =
                tallyVotes(validVotes, "MVP");
              const bestGkCounts =
                tallyVotes(
                  validVotes,
                  "BEST_GOALKEEPER"
                );
              const worstCounts =
                tallyVotes(validVotes, "WORST");

              // 2.9: Resolver vencedores
              // (determinístico em empate)
              const mvpId =
                resolveWinner(mvpCounts);
              const bestGkId =
                resolveWinner(bestGkCounts);
              const worstPlayerId =
                resolveWinnerWithoutTie(worstCounts);
              const mvpWinnerVotes = mvpId ?
                mvpCounts.find(
                  (item) => item.playerId === mvpId
                )?.count ?? 0 :
                0;
              const bestGkWinnerVotes = bestGkId ?
                bestGkCounts.find(
                  (item) => item.playerId === bestGkId
                )?.count ?? 0 :
                0;
              const worstWinnerVotes = worstPlayerId ?
                worstCounts.find(
                  (item) =>
                    item.playerId === worstPlayerId
                )?.count ?? 0 :
                0;
              const team1Score =
                Number(gameData.team1_score ?? 0);
              const team2Score =
                Number(gameData.team2_score ?? 0);

              // #3588/#3596: o resultado da votação só existe aqui, não no
              // trigger que move o jogo para FINISHED. Leia o streak do MVP
              // antes de qualquer write para atualizar todas as estatísticas
              // de forma atômica com a guarda voting_status=CONCLUDED.
              let newMvpStreak = 0;
              let bestMvpStreak = 0;
              if (mvpId) {
                const mvpStatsSnap = await transaction.get(
                  db.collection("statistics").doc(mvpId)
                );
                const mvpStats = mvpStatsSnap.data() || {};
                newMvpStreak =
                  ((mvpStats.currentMvpStreak as number) || 0) + 1;
                bestMvpStreak = Math.max(
                  (mvpStats.bestMvpStreak as number) || 0,
                  newMvpStreak
                );
              }

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
                      FieldValue
                        .serverTimestamp(),
                  }
                );
              }

              // #3587/#3588/#3596: única fonte de verdade dos contadores
              // derivados da votação. Participantes que não venceram o MVP
              // são zerados somente agora, nunca na transição para FINISHED.
              const statsUpdatedAt = FieldValue.serverTimestamp();
              for (const eligibleUserId of eligibleUserIds) {
                const isMvpWinner = eligibleUserId === mvpId;
                const statsUpdate: Record<string, unknown> = {
                  currentMvpStreak: isMvpWinner ? newMvpStreak : 0,
                  updated_at: statsUpdatedAt,
                };
                if (isMvpWinner) {
                  statsUpdate.bestPlayerCount = FieldValue.increment(1);
                  statsUpdate.bestMvpStreak = bestMvpStreak;
                }
                if (eligibleUserId === worstPlayerId) {
                  statsUpdate.worstPlayerCount = FieldValue.increment(1);
                }
                transaction.set(
                  db.collection("statistics").doc(eligibleUserId),
                  statsUpdate,
                  {merge: true}
                );
              }
              if (mvpId && newMvpStreak >= 3) {
                transaction.set(
                  db.collection("user_badges")
                    .doc(`${mvpId}_mvp_streak_3`),
                  {
                    user_id: mvpId,
                    badge_id: "mvp_streak_3",
                    last_earned_at: statsUpdatedAt,
                    count: FieldValue.increment(1),
                  },
                  {merge: true}
                );
              }

              // 2.11: Atualizar jogo com
              // resultados da votação
              //
              // #3940: anti-fraud hold. Quando o jogo está retido para revisão
              // (HELD_FOR_REVIEW) ou já foi rejeitado pelo admin
              // (REJECTED_BY_ADMIN), o XP de MVP/Bola Murcha NÃO é pago aqui.
              // No fluxo HELD, a ordem natural se inverte (votação apurada
              // antes do pipeline principal), e applyVotingXpDelta pagaria
              // agora — para depois o onGameStatusUpdate pagar de novo ao ser
              // liberado. Adiamos o pagamento: o pipeline principal paga tudo
              // de uma só vez quando o admin aprova; se rejeitar, nunca paga.
              // O flag voting_xp_pending sinaliza o adiamento para auditoria.
              const xpRewardStatus =
                (gameData.xp_reward_status as string) || null;
              const votingXpHeld =
                xpRewardStatus === "HELD_FOR_REVIEW" ||
                xpRewardStatus === "REJECTED_BY_ADMIN";
              const gameUpdates:
                Record<string, unknown> = {
                  voting_status: "CONCLUDED",
                  voting_concluded: true,
                  voting_concluded_at:
                    FieldValue
                      .serverTimestamp(),
                  voting_concluded_by:
                    userId,
                  total_votes: validVotes.length,
                  ignored_votes:
                    votes.length - validVotes.length,
                  mvp_votes: mvpWinnerVotes,
                  mvp_total_votes:
                    countTalliedVotes(mvpCounts),
                  best_gk_votes: bestGkWinnerVotes,
                  best_gk_total_votes:
                    countTalliedVotes(bestGkCounts),
                  worst_player_votes:
                    worstWinnerVotes,
                  worst_player_total_votes:
                    countTalliedVotes(worstCounts),
                  worst_player_id:
                    worstPlayerId,
                  winner_team:
                    team1Score > team2Score ?
                      "A" :
                      team2Score > team1Score ?
                        "B" :
                        "DRAW",
                  voting_xp_pending: votingXpHeld,
                };

              if (mvpId) {
                gameUpdates.mvp_id = mvpId;
              }
              if (bestGkId) {
                gameUpdates.best_gk_id =
                  bestGkId;
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
                totalVotes: validVotes.length,
                mvpVotes:
                  countTalliedVotes(mvpCounts),
                bestGkVotes:
                  countTalliedVotes(bestGkCounts),
                worstVotes:
                  countTalliedVotes(worstCounts),
                xpRewardStatus,
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

        // FIX #579: aplicar XP delta MVP +50 / Bola Murcha -10.
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
        // (timeout, network blip) → MVP perdia +50 XP permanentemente
        // sem recovery automático.
        // Separado em dois try/catch independentes para que falha no MVP
        // não impeça aplicação do XP do Bola Murcha e vice-versa.
        //
        // FIX #3940: anti-fraud hold. Se xp_reward_status é HELD_FOR_REVIEW
        // ou REJECTED_BY_ADMIN, NÃO pagamos o XP de votação aqui. No fluxo
        // HELD a votação é apurada antes do pipeline principal, então pagar
        // agora duplicaria o crédito quando o admin aprovasse (e nunca seria
        // retido se rejeitasse). Adiamos: o onGameStatusUpdate paga tudo de
        // uma vez no release (APPROVE). voting_xp_pending já foi marcado na
        // transaction acima para auditoria.
        const votingXpHeld =
          result.xpRewardStatus === "HELD_FOR_REVIEW" ||
          result.xpRewardStatus === "REJECTED_BY_ADMIN";

        if (votingXpHeld) {
          logger.info(
            "[VOTING_XP] Game " +
            `${gameId} xp_reward_status=` +
            `${result.xpRewardStatus} — deferring ` +
            "MVP/Bola Murcha XP to the main " +
            "pipeline on release (issue #3940)"
          );
        }

        let mvpXpApplied = false;
        let worstXpApplied = false;
        if (result.mvpId && !votingXpHeld) {
          try {
            await applyVotingXpDelta(
              db,
              gameId,
              result.mvpId as string,
              "MVP",
              XP_ACTIONS.MVP,
              {
                totalVotes: result.totalVotes,
                categoryVotes: result.mvpVotes,
              }
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
        if (result.worstPlayerId && !votingXpHeld) {
          try {
            await applyVotingXpDelta(
              db,
              gameId,
              result.worstPlayerId as string,
              "BOLA_MURCHA",
              XP_ACTIONS.WORST_PLAYER,
              {
                totalVotes: result.totalVotes,
                categoryVotes: result.worstVotes,
              }
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

        // Quando o XP está deliberadamente adiado (hold/reject), consideramos
        // allOk=true: nenhum erro ocorreu, o pagamento foi só postergado.
        const xpAllOk = votingXpHeld ||
          ((!result.mvpId || mvpXpApplied) &&
           (!result.worstPlayerId || worstXpApplied));

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
            // #3940: sinaliza ao cliente que o XP de votação foi adiado
            // (não falhou) porque o jogo está sob revisão anti-fraude.
            deferred: votingXpHeld,
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
 * Soma votos contabilizados em uma categoria.
 *
 * @param {VoteTally[]} tallies - Contagem por jogador.
 * @return {number} Total de votos da categoria.
 */
function countTalliedVotes(tallies: VoteTally[]): number {
  return tallies.reduce((total, tally) => total + tally.count, 0);
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
 * Resolve uma categoria que exige vencedor único. Empates exatos retornam
 * `null`, evitando transformar um critério técnico em penalidade de XP.
 *
 * @param {VoteTally[]} tallies Contagem por jogador.
 * @return {string|null} Jogador com vantagem real ou null em vazio/empate.
 */
function resolveWinnerWithoutTie(
  tallies: VoteTally[]
): string | null {
  if (tallies.length === 0) return null;

  const maxCount = tallies[0].count;
  const leaders = tallies.filter(
    (item) => item.count === maxCount
  );
  if (leaders.length !== 1) {
    logger.info(
      "[MVP_TIEBREAK] Empate em WORST: " +
      "nenhuma penalidade aplicada"
    );
    return null;
  }

  return leaders[0].playerId;
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
 * FIX #3882: exportada para testes diretos (recebe `db` injetável) e
 * corrige season_final_standings quando a temporada já foi congelada.
 *
 * @param {admin.firestore.Firestore} db - instância do Firestore
 * @param {string} gameId - ID do jogo
 * @param {string} userId - ID do usuário (MVP ou worst player)
 * @param {"MVP" | "BOLA_MURCHA"} reason - tipo de delta
 * @param {number} xpDelta - +30 (MVP) ou -10 (Bola Murcha)
 * @param {object} audit - Metadados auditáveis da votação que gerou o XP
 * @return {Promise<void>}
 */
export async function applyVotingXpDelta(
  db: admin.firestore.Firestore,
  gameId: string,
  userId: string,
  reason: "MVP" | "BOLA_MURCHA",
  xpDelta: number,
  audit: Record<string, number | undefined> = {}
): Promise<void> {
  const logId =
    reason === "MVP" ?
      `mvp_${gameId}_${userId}` :
      `bola_murcha_${gameId}_${userId}`;
  const logRef = db
    .collection("xp_logs")
    .doc(logId);
  const mainXpLogRef = db
    .collection("xp_logs")
    .doc(`game_${gameId}_user_${userId}`);
  const userRef = db
    .collection("users")
    .doc(userId);

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

      const mainXpLog = await txn.get(mainXpLogRef);
      const mainXpLogData = mainXpLog.data();

      if (reason === "MVP") {
        if (mainXpLog.exists && (mainXpLogData?.xp_mvp as number) > 0) {
          logger.info(
            `[VOTING_XP] Skipping MVP XP for ${userId} in ${gameId} ` +
            "- main trigger already paid MVP XP (dedup)"
          );
          return;
        }
      }

      // #2992: guard simetrico ao de MVP. O trigger principal
      // (onGameStatusUpdate) ja aplica a penalidade de Bola Murcha quando
      // is_worst_player esta setado no instante da transicao para FINISHED,
      // gravando xp_penalty < 0 / was_worst_player no log principal. Sem
      // esta verificacao, o caminho de votacao pagaria -10 de novo (-20 total).
      if (reason === "BOLA_MURCHA") {
        const mainXpPenalty =
          mainXpLogData?.xp_penalty as number | undefined;
        const mainWasWorstPlayer =
          mainXpLogData?.was_worst_player === true;
        if (
          mainXpLog.exists &&
          ((typeof mainXpPenalty === "number" &&
            mainXpPenalty < 0) ||
            mainWasWorstPlayer)
        ) {
          logger.info(
            `[VOTING_XP] Skipping BOLA_MURCHA XP for ${userId} in ` +
            `${gameId} - main trigger already applied penalty (dedup)`
          );
          return;
        }
      }

      let weekKey: string | null = null;
      let monthKey: string | null = null;
      let gameSeasonId: string | null = null;

      const gameSnap = await txn.get(
        db.collection("games").doc(gameId)
      );
      const rawGame =
        typeof gameSnap.data === "function" ?
          gameSnap.data() :
          {};
      const gameDoc: Game | undefined =
        isGameShape(rawGame) ? rawGame : undefined;
      const gameDate = getGameDate(gameDoc);
      monthKey = gameDate.toLocaleDateString("en-CA", {
        timeZone: "America/Sao_Paulo",
      }).substring(0, 7);
      weekKey = getWeekKey(gameDate);
      const explicitSeasonId =
        typeof rawGame?.season_id === "string" ? rawGame.season_id.trim() : "";
      if (explicitSeasonId) {
        gameSeasonId = explicitSeasonId;
      } else {
        const activeSeasonSnap = await txn.get(
          db.collection("seasons")
            .where("is_active", "==", true)
            .limit(1)
        );
        gameSeasonId = activeSeasonSnap.empty === false &&
          Array.isArray(activeSeasonSnap.docs) &&
          activeSeasonSnap.docs[0]?.id ?
          activeSeasonSnap.docs[0].id : null;
      }

      // FIX #3882: voto concluído APÓS o congelamento da temporada
      // (checkSeasonEnd roda às 03:00 do dia 1º; a votação fica aberta até
      // gameEnd + 24h). O incremento em season_participation abaixo não é
      // relido pelo freeze (one-shot, idempotente por doc-id), então o
      // mvp_count em season_final_standings ficaria errado para sempre.
      // Aqui detectamos o standing já congelado e o corrigimos na MESMA
      // transaction (leitura antes de qualquer write, como o Firestore
      // exige). Doc id espelha o freeze: `${seasonId}_${safeUserId}`.
      let frozenStandingRef:
        admin.firestore.DocumentReference | null = null;
      if (reason === "MVP" && gameSeasonId) {
        const safeUserId = userId.replace(/\//g, "_");
        const candidateRef = db
          .collection("season_final_standings")
          .doc(`${gameSeasonId}_${safeUserId}`);
        const frozenSnap = await txn.get(candidateRef);
        if (frozenSnap.exists) {
          frozenStandingRef = candidateRef;
        }
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
      const isMvp = reason === "MVP";
      const now = FieldValue.serverTimestamp();
      let milestoneXp = 0;
      let newMilestones: string[] = [];

      if (reason === "MVP") {
        const statsRef = db.collection("statistics").doc(userId);
        const statsDoc = await txn.get(statsRef);
        const statsData = statsDoc.data() || {};
        // #3588/#3596: concludeMvpVoting já persistiu contagem e streak na
        // transação canônica. Aqui os valores são somente entrada de milestone.
        const achievedMilestones = Array.isArray(
          userDoc.data()?.milestones_achieved
        ) ?
          userDoc.data()?.milestones_achieved as string[] :
          [];
        const milestoneResult = checkMilestones(
          buildCanonicalVotingMilestoneStatistics(statsData),
          achievedMilestones
        );
        newMilestones = milestoneResult.newMilestones;
        milestoneXp = milestoneResult.xp;
      }
      const totalGrantedXp =
        clampedXpDelta + milestoneXp;
      const newXp = Math.max(
        MIN_XP_PER_GAME,
        currentXp + totalGrantedXp
      );

      // FIX #1993: usa getLevelForXp() canônico de xp/pipeline.ts
      // em vez de recalcular level inline (evita drift por inconsistência).
      const newLevel = getLevelForXp(newXp);
      const sourceTotalVotes =
        typeof audit.totalVotes === "number" ? audit.totalVotes : null;
      const sourceCategoryVotes =
        typeof audit.categoryVotes === "number" ? audit.categoryVotes : null;

      // FIX #1990 + #3457: aplicar o delta na temporada do jogo.
      if (gameSeasonId) {
        const seasonPartId = `${gameSeasonId}_${userId}`;
        // Fase 4: espelha o delta de XP/mvp do voto na visão
        // segmentada by_gender.{gender} (campo plano = combinado).
        const gender = normalizeGameGender(
          (rawGame?.gender as string | undefined) ?? "MIXED"
        );
        const inc = FieldValue.increment;
        const genderUpdate: Record<string, unknown> = {
          total_xp: inc(totalGrantedXp),
        };
        const seasonPartUpdate: Record<string, unknown> = {
          // FIX #4053: user_id e points são obrigatórios para os leitores de
          // season_participation. Sem user_id, o cleanup LGPD por user_id não
          // acha o doc e o freeze (season/index.ts) pula a standing; sem
          // points, o orderBy("points") do ranking exclui o doc (Firestore
          // omite docs que não têm o campo do orderBy). increment(0) cria o
          // campo sem alterar o valor.
          user_id: userId,
          season_id: gameSeasonId,
          total_xp: inc(totalGrantedXp),
          points: inc(0),
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

        // FIX #3882: temporada já congelada — corrige o mvp_count do
        // standing final na mesma transaction (idempotente: a transaction
        // inteira é guardada pelo logRef determinístico acima).
        if (isMvp && frozenStandingRef) {
          txn.set(
            frozenStandingRef,
            {mvp_count: inc(1)},
            {merge: true}
          );
          logger.warn(
            `[VOTING_XP] Season ${gameSeasonId} already frozen when MVP ` +
            `vote for ${userId} in ${gameId} concluded — patched ` +
            "season_final_standings.mvp_count (+1) to keep frozen " +
            "standings consistent (issue #3882)"
          );
        }
      }

      if (weekKey && monthKey) {
        const weekDeltaId = `week_${weekKey}_${userId}`;
        const monthDeltaId = `month_${monthKey}_${userId}`;
        const rankingFields: Record<string, unknown> = {
          xp_added: FieldValue.increment(totalGrantedXp),
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
        xp_earned: totalGrantedXp,
        xp_before: currentXp,
        xp_after: newXp,
        level_before: currentLevel,
        level_after: newLevel,
        xp_mvp: isMvp ? clampedXpDelta : 0,
        xp_milestones: milestoneXp,
        xp_penalty: isMvp ? 0 : clampedXpDelta,
        milestones_unlocked: newMilestones,
        game_status: "FINISHED",
        was_mvp: isMvp,
        was_worst_player: reason === "BOLA_MURCHA",
        reason,
        transaction_id: logId,
        source: "mvp_voting_concluded",
        source_collection: "mvp_votes",
        source_event_id: gameId,
        source_vote_category: reason,
        source_total_votes: sourceTotalVotes,
        source_category_votes: sourceCategoryVotes,
        created_at: FieldValue
          .serverTimestamp(),
      });
      if (newMilestones.length > 0) {
        for (const milestoneName of newMilestones) {
          const badgeRef = db
            .collection("user_badges")
            .doc(`${userId}_${milestoneName}`);
          txn.set(
            badgeRef,
            buildUserBadgeAggregateDoc(
              userId,
              buildMilestoneBadgeDoc(
                milestoneName,
                now
              )
            ),
            {merge: true}
          );
        }
      }
      txn.update(userRef, {
        experience_points:
          FieldValue.increment(totalGrantedXp),
        level: newLevel,
        updated_at: FieldValue
          .serverTimestamp(),
        ...(newMilestones.length > 0 ? {
          milestones_achieved:
            FieldValue.arrayUnion(...newMilestones),
        } : {}),
      });
      if (mainXpLog.exists) {
        txn.set(mainXpLogRef, {
          was_mvp: isMvp ? true : mainXpLogData?.was_mvp === true,
          was_worst_player:
            reason === "BOLA_MURCHA" ?
              true :
              mainXpLogData?.was_worst_player === true,
          updated_at: now,
        }, {merge: true});
      }

      logger.info(
        `[VOTING_XP] Applied ${totalGrantedXp} XP ` +
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
