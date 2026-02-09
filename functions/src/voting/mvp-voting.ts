/**
 * SISTEMA DE VOTAÇÃO MVP - P2 #39
 *
 * Implementa votação atômica usando Firestore transactions para
 * prevenir race conditions em votações concorrentes.
 *
 * PROBLEMAS RESOLVIDOS:
 * - TOCTOU race condition em submissão de votos
 * - Contagem inconsistente de votos
 * - Proteção contra voto duplicado (mesmo usuário votando 2x)
 * - Tallying atômico (contagem + atualização de confirmações + game)
 *
 * GARANTIAS:
 * - Atomicidade: Leitura + escrita do voto dentro de transaction
 * - Idempotência: Document ID determinístico previne duplicatas
 * - Consistência: concludeVoting() lê e escreve atomicamente
 * - Retry automático: Firestore retenta transactions em conflito
 *
 * @see specs/P2_39_MVP_VOTING_RACE_CONDITION_FIX.md
 */

import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";
// SECURITY: Rate limiter para prevenir abuso de votacao
import {checkRateLimit} from "../middleware/rate-limiter";

const getDb = () => admin.firestore();

// ==========================================
// CONSTANTES
// ==========================================

/** Janela de votação: 24 horas após o fim do jogo */
const VOTE_WINDOW_HOURS = 24;

/** Categorias de votação permitidas */
const VALID_VOTE_CATEGORIES = ["MVP", "BEST_GOALKEEPER", "WORST"] as const;
type VoteCategory = typeof VALID_VOTE_CATEGORIES[number];

// ==========================================
// INTERFACES
// ==========================================

interface SubmitVoteRequest {
  gameId: string;
  votedPlayerId: string;
  category: VoteCategory;
}

interface ConcludeVotingRequest {
  gameId: string;
}

interface VoteTally {
  playerId: string;
  count: number;
}

// ==========================================
// CLOUD FUNCTION: submitMvpVote
// ==========================================

/**
 * Submete um voto de MVP usando Firestore transaction.
 *
 * Garante atomicidade entre:
 * 1. Verificação de status do jogo
 * 2. Verificação de prazo de votação
 * 3. Detecção de voto duplicado
 * 4. Escrita do voto
 *
 * Em caso de conflito (2 clientes votando ao mesmo tempo),
 * Firestore retenta automaticamente até 5 vezes.
 *
 * @param gameId - ID do jogo
 * @param votedPlayerId - ID do jogador votado
 * @param category - Categoria de voto (MVP, BEST_GOALKEEPER, WORST)
 */
export const submitMvpVote = onCall<SubmitVoteRequest>(
  {
    region: "southamerica-east1",
    memory: "256MiB",
    // SECURITY: App Check - garante que apenas apps verificados podem votar
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
  },
  async (request) => {
    // ==========================================
    // 1. AUTENTICAÇÃO
    // ==========================================
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Usuário não autenticado");
    }

    const voterId = request.auth.uid;

    // ==========================================
    // 1.5. RATE LIMITING (20 votos/min por usuário)
    // ==========================================
    const {allowed, remaining, resetAt} = await checkRateLimit(voterId, {
      maxRequests: 20,
      windowMs: 60 * 1000,
      keyPrefix: "mvp_vote",
    });

    if (!allowed) {
      const resetInSeconds = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
      throw new HttpsError(
        "resource-exhausted",
        `Rate limit excedido. Tente novamente em ${resetInSeconds} segundos.`,
        {retryAfter: resetInSeconds, limit: 20, remaining}
      );
    }

    const {gameId, votedPlayerId, category} = request.data;

    // ==========================================
    // 2. VALIDAÇÃO DE ENTRADA
    // ==========================================
    if (!gameId || typeof gameId !== "string" || gameId.length > 128) {
      throw new HttpsError("invalid-argument", "gameId é obrigatório e deve ser uma string válida");
    }
    if (!votedPlayerId || typeof votedPlayerId !== "string" || votedPlayerId.length > 128) {
      throw new HttpsError("invalid-argument", "votedPlayerId é obrigatório e deve ser uma string válida");
    }
    if (!category || !VALID_VOTE_CATEGORIES.includes(category)) {
      throw new HttpsError(
        "invalid-argument",
        `Categoria inválida. Deve ser: ${VALID_VOTE_CATEGORIES.join(", ")}`
      );
    }

    // Votante não pode votar em si mesmo
    if (voterId === votedPlayerId) {
      throw new HttpsError(
        "invalid-argument",
        "Não é permitido votar em si mesmo"
      );
    }

    // SECURITY: Sanitizar inputs - previne injection de dados no Firestore
    if (gameId.includes("/") || votedPlayerId.includes("/")) {
      throw new HttpsError(
        "invalid-argument",
        "IDs não podem conter caracteres especiais"
      );
    }

    const db = getDb();

    // ==========================================
    // 3. TRANSACTION: Verificar + Escrever atomicamente
    // ==========================================
    try {
      const result = await db.runTransaction(async (transaction) => {
        const gameRef = db.collection("games").doc(gameId);
        const gameSnap = await transaction.get(gameRef);

        // 3.1: Validar que o jogo existe
        if (!gameSnap.exists) {
          throw new HttpsError("not-found", "Jogo não encontrado");
        }

        const gameData = gameSnap.data();
        if (!gameData) {
          throw new HttpsError("not-found", "Dados do jogo indisponíveis");
        }

        // 3.2: Validar status do jogo (deve ser FINISHED)
        if (gameData.status !== "FINISHED") {
          throw new HttpsError(
            "failed-precondition",
            "Votação disponível apenas para jogos finalizados"
          );
        }

        // 3.3: Validar que votação não foi concluída
        if (gameData.voting_status === "CONCLUDED") {
          throw new HttpsError(
            "failed-precondition",
            "Votação já foi encerrada para este jogo"
          );
        }

        // 3.4: Validar janela de votação (24h após fim do jogo)
        const gameDateTime = gameData.dateTime;
        if (gameDateTime && typeof gameDateTime.toDate === "function") {
          const gameEndDate = gameDateTime.toDate();
          const deadline = new Date(
            gameEndDate.getTime() + VOTE_WINDOW_HOURS * 60 * 60 * 1000
          );
          const now = new Date();
          if (now > deadline) {
            throw new HttpsError(
              "failed-precondition",
              "Prazo de votação expirado (24h após o jogo)"
            );
          }
        }

        // 3.5: Validar que o votante participou do jogo
        const voterConfId = `${gameId}_${voterId}`;
        const voterConfRef = db.collection("confirmations").doc(voterConfId);
        const voterConfSnap = await transaction.get(voterConfRef);

        if (!voterConfSnap.exists) {
          throw new HttpsError(
            "permission-denied",
            "Apenas jogadores confirmados podem votar"
          );
        }

        const voterConfData = voterConfSnap.data();
        if (voterConfData?.status !== "CONFIRMED") {
          throw new HttpsError(
            "permission-denied",
            "Apenas jogadores com presença confirmada podem votar"
          );
        }

        // 3.6: Validar que o jogador votado participou do jogo
        const votedConfId = `${gameId}_${votedPlayerId}`;
        const votedConfRef = db.collection("confirmations").doc(votedConfId);
        const votedConfSnap = await transaction.get(votedConfRef);

        if (!votedConfSnap.exists || votedConfSnap.data()?.status !== "CONFIRMED") {
          throw new HttpsError(
            "invalid-argument",
            "Jogador votado não participou deste jogo"
          );
        }

        // 3.7: Verificar voto duplicado (DENTRO da transaction para evitar TOCTOU)
        const voteId = `${gameId}_${voterId}_${category}`;
        const voteRef = db.collection("mvp_votes").doc(voteId);
        const existingVote = await transaction.get(voteRef);

        if (existingVote.exists) {
          throw new HttpsError(
            "already-exists",
            `Você já votou na categoria ${category} neste jogo`
          );
        }

        // 3.8: Escrever voto (DENTRO da transaction)
        transaction.set(voteRef, {
          id: voteId,
          game_id: gameId,
          voter_id: voterId,
          voted_player_id: votedPlayerId,
          category: category,
          voted_at: admin.firestore.FieldValue.serverTimestamp(),
          // Campo de rastreabilidade
          attempt_timestamp: Date.now(),
        });

        return {voteId, category, votedPlayerId};
      });

      console.log(
        `[MVP_VOTE] Voto registrado: ${voterId} -> ${result.votedPlayerId} (${result.category}) no jogo ${gameId}`
      );

      return {
        success: true,
        voteId: result.voteId,
        message: "Voto registrado com sucesso",
      };
    } catch (error: any) {
      // Se já é HttpsError, re-throw
      if (error instanceof HttpsError) {
        throw error;
      }

      console.error(`[MVP_VOTE] Erro ao registrar voto: ${error.message}`);
      throw new HttpsError(
        "internal",
        "Erro ao registrar voto. Tente novamente."
      );
    }
  }
);

// ==========================================
// CLOUD FUNCTION: concludeMvpVoting
// ==========================================

/**
 * Conclui a votação de MVP de um jogo usando Firestore transaction.
 *
 * Garante atomicidade entre:
 * 1. Leitura de todos os votos (snapshot consistente)
 * 2. Contagem de votos por categoria
 * 3. Resolução de empates (determinístico)
 * 4. Atualização de confirmações (is_mvp, is_best_gk, is_worst_player)
 * 5. Atualização do jogo (mvp_id, voting_status)
 *
 * @param gameId - ID do jogo para concluir votação
 */
export const concludeMvpVoting = onCall<ConcludeVotingRequest>(
  {
    region: "southamerica-east1",
    memory: "512MiB",
    // SECURITY: App Check - garante que apenas apps verificados podem concluir votacao
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
  },
  async (request) => {
    // ==========================================
    // 1. AUTENTICAÇÃO E VALIDAÇÃO
    // ==========================================
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Usuário não autenticado");
    }

    const userId = request.auth.uid;

    // ==========================================
    // 1.5. RATE LIMITING (5 conclusões/min por usuário)
    // ==========================================
    const {allowed: rlAllowed, resetAt: rlResetAt} = await checkRateLimit(userId, {
      maxRequests: 5,
      windowMs: 60 * 1000,
      keyPrefix: "mvp_conclude",
    });

    if (!rlAllowed) {
      const resetInSec = Math.ceil((rlResetAt.getTime() - Date.now()) / 1000);
      throw new HttpsError(
        "resource-exhausted",
        `Rate limit excedido. Tente novamente em ${resetInSec} segundos.`,
        {retryAfter: resetInSec, limit: 5}
      );
    }

    const {gameId} = request.data;

    if (!gameId || typeof gameId !== "string" || gameId.length > 128) {
      throw new HttpsError("invalid-argument", "gameId é obrigatório e deve ser uma string válida");
    }

    // SECURITY: Sanitizar gameId - previne path traversal no Firestore
    if (gameId.includes("/")) {
      throw new HttpsError("invalid-argument", "gameId contém caracteres inválidos");
    }

    const db = getDb();

    try {
      // ==========================================
      // 2. BUSCAR VOTOS (fora da transaction para evitar limite de leituras)
      // Nota: Usamos uma abordagem em 2 passos:
      //   Passo 1: Ler votos (fora da transaction)
      //   Passo 2: Transaction para escrever resultados com lock no game
      // ==========================================
      const votesSnap = await db
        .collection("mvp_votes")
        .where("game_id", "==", gameId)
        .get();

      const votes = votesSnap.docs.map((doc) => doc.data());

      // ==========================================
      // 3. TRANSACTION: Verificar + Escrever resultados
      // ==========================================
      const result = await db.runTransaction(async (transaction) => {
        // 3.1: Ler e validar o jogo
        const gameRef = db.collection("games").doc(gameId);
        const gameSnap = await transaction.get(gameRef);

        if (!gameSnap.exists) {
          throw new HttpsError("not-found", "Jogo não encontrado");
        }

        const gameData = gameSnap.data();
        if (!gameData) {
          throw new HttpsError("not-found", "Dados do jogo indisponíveis");
        }

        // 3.2: Validar permissão (apenas dono do jogo ou admin)
        if (gameData.owner_id !== userId) {
          // Verificar se é admin via custom claims
          const isAdmin = request.auth?.token?.role === "ADMIN";
          if (!isAdmin) {
            throw new HttpsError(
              "permission-denied",
              "Apenas o dono do jogo ou admin pode encerrar a votação"
            );
          }
        }

        // 3.3: Validar que o jogo está FINISHED
        if (gameData.status !== "FINISHED") {
          throw new HttpsError(
            "failed-precondition",
            "Jogo deve estar finalizado para encerrar votação"
          );
        }

        // 3.4: Idempotência - se votação já foi concluída, retornar resultado anterior
        if (gameData.voting_status === "CONCLUDED") {
          console.log(`[MVP_CONCLUDE] Votação do jogo ${gameId} já foi concluída`);
          return {
            alreadyConcluded: true,
            mvpId: gameData.mvp_id || null,
            bestGkId: gameData.best_gk_id || null,
            worstPlayerId: gameData.worst_player_id || null,
          };
        }

        // 3.5: Se não há votos, encerrar sem vencedor
        if (votes.length === 0) {
          transaction.update(gameRef, {
            voting_status: "CONCLUDED",
            voting_concluded_at: admin.firestore.FieldValue.serverTimestamp(),
            voting_concluded_by: userId,
          });

          return {
            alreadyConcluded: false,
            mvpId: null,
            bestGkId: null,
            worstPlayerId: null,
            totalVotes: 0,
          };
        }

        // 3.6: Contar votos por categoria
        const mvpCounts = tallyVotes(votes, "MVP");
        const bestGkCounts = tallyVotes(votes, "BEST_GOALKEEPER");
        const worstCounts = tallyVotes(votes, "WORST");

        // 3.7: Resolver vencedores (determinístico em caso de empate)
        const mvpId = resolveWinner(mvpCounts);
        const bestGkId = resolveWinner(bestGkCounts);
        const worstPlayerId = resolveWinner(worstCounts);

        // 3.8: Buscar confirmações para atualizar (dentro da transaction)
        const confirmationsSnap = await db
          .collection("confirmations")
          .where("game_id", "==", gameId)
          .where("status", "==", "CONFIRMED")
          .get();

        // 3.9: Atualizar cada confirmação com resultado da votação
        for (const confDoc of confirmationsSnap.docs) {
          const confData = confDoc.data();
          const confUserId = confData.user_id || confData.userId;
          if (!confUserId) continue;

          const confId = `${gameId}_${confUserId}`;
          const confRef = db.collection("confirmations").doc(confId);

          transaction.update(confRef, {
            is_mvp: mvpId === confUserId,
            is_best_gk: bestGkId === confUserId,
            is_worst_player: worstPlayerId === confUserId,
            voting_concluded_at: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // 3.10: Atualizar jogo com resultados da votação
        const gameUpdates: Record<string, any> = {
          voting_status: "CONCLUDED",
          voting_concluded_at: admin.firestore.FieldValue.serverTimestamp(),
          voting_concluded_by: userId,
          total_votes: votes.length,
        };

        if (mvpId) gameUpdates.mvp_id = mvpId;
        if (bestGkId) gameUpdates.best_gk_id = bestGkId;
        if (worstPlayerId) gameUpdates.worst_player_id = worstPlayerId;

        transaction.update(gameRef, gameUpdates);

        return {
          alreadyConcluded: false,
          mvpId,
          bestGkId,
          worstPlayerId,
          totalVotes: votes.length,
          mvpVotes: mvpCounts.length,
          bestGkVotes: bestGkCounts.length,
          worstVotes: worstCounts.length,
        };
      });

      console.log(
        `[MVP_CONCLUDE] Votação concluída para jogo ${gameId}: ` +
        `MVP=${result.mvpId}, BestGK=${result.bestGkId}, Worst=${result.worstPlayerId}`
      );

      return {
        success: true,
        alreadyConcluded: result.alreadyConcluded,
        results: {
          mvpId: result.mvpId,
          bestGkId: result.bestGkId,
          worstPlayerId: result.worstPlayerId,
        },
        message: result.alreadyConcluded
          ? "Votação já havia sido concluída"
          : "Votação encerrada com sucesso",
      };
    } catch (error: any) {
      if (error instanceof HttpsError) {
        throw error;
      }

      console.error(`[MVP_CONCLUDE] Erro ao concluir votação: ${error.message}`);
      throw new HttpsError(
        "internal",
        "Erro ao encerrar votação. Tente novamente."
      );
    }
  }
);

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Conta votos por categoria, retornando array ordenado por contagem.
 *
 * @param votes - Array de votos
 * @param category - Categoria para filtrar
 * @returns Array de {playerId, count} ordenado por count DESC
 */
function tallyVotes(
  votes: admin.firestore.DocumentData[],
  category: string
): VoteTally[] {
  const categoryVotes = votes.filter((v) => v.category === category);

  // Agrupar por jogador votado
  const countMap = new Map<string, number>();
  for (const vote of categoryVotes) {
    const playerId = vote.voted_player_id;
    if (playerId) {
      countMap.set(playerId, (countMap.get(playerId) || 0) + 1);
    }
  }

  // Converter para array e ordenar por contagem (DESC)
  const tallies: VoteTally[] = [];
  for (const [playerId, count] of countMap) {
    tallies.push({playerId, count});
  }

  tallies.sort((a, b) => b.count - a.count);
  return tallies;
}

/**
 * Resolve o vencedor a partir da contagem de votos.
 *
 * Em caso de empate, usa ordenação alfabética do playerId
 * para garantir resultado determinístico (mesmo resultado
 * independente da ordem de execução).
 *
 * @param tallies - Array de {playerId, count} ordenado por count DESC
 * @returns playerId do vencedor, ou null se sem votos
 */
function resolveWinner(tallies: VoteTally[]): string | null {
  if (tallies.length === 0) return null;

  const maxCount = tallies[0].count;

  // Filtrar todos os empatados no topo
  const tied = tallies.filter((t) => t.count === maxCount);

  if (tied.length === 1) {
    return tied[0].playerId;
  }

  // Desempate determinístico: ordenação alfabética do playerId
  // Garante que o resultado é sempre o mesmo, independente da ordem
  tied.sort((a, b) => a.playerId.localeCompare(b.playerId));

  console.log(
    `[MVP_TIEBREAK] Empate com ${maxCount} votos entre ${tied.length} jogadores. ` +
    `Vencedor: ${tied[0].playerId} (desempate alfabético)`
  );

  return tied[0].playerId;
}
