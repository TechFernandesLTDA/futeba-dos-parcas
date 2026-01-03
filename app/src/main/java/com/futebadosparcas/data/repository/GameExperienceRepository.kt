package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.MVPVote
import com.futebadosparcas.data.model.VoteCategory
import com.futebadosparcas.data.model.MVPVoteResult
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GameExperienceRepository @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) {
    private val votesCollection = firestore.collection("mvp_votes")

    companion object {
        private const val TAG = "GameExperienceRepository"
    }

    /**
     * Submete um voto, verificando se o usuário já votou nesta categoria para este jogo.
     * Usa ID determinístico: {gameId}_{voterId}_{category} para evitar duplicatas.
     */
    suspend fun submitVote(vote: MVPVote): Result<Unit> {
        return try {
            // ID determinístico para evitar votos duplicados na mesma categoria
            val voteId = "${vote.gameId}_${vote.voterId}_${vote.category.name}"
            val voteRef = votesCollection.document(voteId)

            // Verificar se já votou nesta categoria
            val existingVote = voteRef.get().await()
            if (existingVote.exists()) {
                AppLogger.w(TAG) { "Usuário ${vote.voterId} já votou na categoria ${vote.category} para o jogo ${vote.gameId}" }
                return Result.failure(Exception("Você já votou nesta categoria"))
            }

            voteRef.set(vote.copy(id = voteId)).await()
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao enviar voto", e)
            Result.failure(e)
        }
    }

    suspend fun hasUserVoted(gameId: String, userId: String): Result<Boolean> {
        return try {
            val snapshot = votesCollection
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("voter_id", userId)
                .get()
                .await()
            Result.success(!snapshot.isEmpty)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getGameVotes(gameId: String): Result<List<MVPVote>> {
        return try {
            val snapshot = votesCollection
                .whereEqualTo("game_id", gameId)
                .get()
                .await()
            Result.success(snapshot.toObjects(MVPVote::class.java))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    /**
     * Conclui a votação calculando os resultados.
     * Atualiza as confirmações com os resultados da votação (MVP, melhor goleiro, bola murcha).
     * NÃO calcula XP aqui - isso é feito pelo MatchFinalizationService ao finalizar o jogo.
     */
    suspend fun concludeVoting(gameId: String): Result<Unit> {
        return try {
            val db = firestore

            // 1. Fetch Data - usando collections ROOT (não subcollections)
            val gameRef = db.collection("games").document(gameId)
            val gameSnapshot = gameRef.get().await()
            val game = gameSnapshot.toObject(com.futebadosparcas.data.model.Game::class.java)
                ?: return Result.failure(Exception("Game not found"))

            // Collections ROOT
            val confirmationsSnapshot = db.collection("confirmations")
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("status", "CONFIRMED")
                .get()
                .await()
            val confirmations = confirmationsSnapshot.toObjects(com.futebadosparcas.data.model.GameConfirmation::class.java)

            val votesSnapshot = votesCollection.whereEqualTo("game_id", gameId).get().await()
            val votes = votesSnapshot.toObjects(MVPVote::class.java)

            if (votes.isEmpty()) {
                AppLogger.w(TAG) { "Nenhum voto encontrado para o jogo $gameId" }
            }

            // 2. Tally Votes
            val mvpCounts = votes.filter { it.category == VoteCategory.MVP }.groupingBy { it.votedPlayerId }.eachCount()
            val bestGkCounts = votes.filter { it.category == VoteCategory.BEST_GOALKEEPER }.groupingBy { it.votedPlayerId }.eachCount()
            val worstCounts = votes.filter { it.category == VoteCategory.WORST }.groupingBy { it.votedPlayerId }.eachCount()

            // Obter vencedores apenas se houver votos (evitar null quando nao ha votos)
            val mvpId = if (mvpCounts.isNotEmpty()) mvpCounts.maxByOrNull { it.value }?.key else null
            val bestGkId = if (bestGkCounts.isNotEmpty()) bestGkCounts.maxByOrNull { it.value }?.key else null
            val worstId = if (worstCounts.isNotEmpty()) worstCounts.maxByOrNull { it.value }?.key else null

            AppLogger.d(TAG) { "Resultados da votação - MVP: $mvpId, BestGK: $bestGkId, Worst: $worstId" }

            // 3. Update Confirmations with vote results (NÃO calcula XP aqui)
            val batch = db.batch()

            confirmations.forEach { conf ->
                // Verificar se o jogador foi eleito (null-safe)
                val isMvp = mvpId != null && conf.userId == mvpId
                val isBestGk = bestGkId != null && conf.userId == bestGkId
                val isWorst = worstId != null && conf.userId == worstId

                // Usar ID determinístico padronizado: {gameId}_{userId}
                val confId = "${gameId}_${conf.userId}"
                val confRef = db.collection("confirmations").document(confId)

                batch.update(confRef, mapOf(
                    "is_mvp" to isMvp,
                    "is_best_gk" to isBestGk,
                    "is_worst_player" to isWorst
                ))
            }

            // 4. Update Game with MVP ID (apenas se houver MVP eleito)
            val gameUpdates = mutableMapOf<String, Any?>()
            if (mvpId != null) {
                gameUpdates["mvp_id"] = mvpId
            }
            if (bestGkId != null) {
                gameUpdates["best_gk_id"] = bestGkId
            }
            if (worstId != null) {
                gameUpdates["worst_player_id"] = worstId
            }

            if (gameUpdates.isNotEmpty()) {
                batch.update(gameRef, gameUpdates)
            }

            batch.commit().await()
            AppLogger.d(TAG) { "Votação concluída para o jogo $gameId" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao concluir votação", e)
            Result.failure(e)
        }
    }

    suspend fun checkAllVoted(gameId: String): Result<Boolean> {
        return try {
            val db = firestore

            // Get Confirmed Players - usando collection ROOT
            val confirmationsSnapshot = db.collection("confirmations")
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("status", "CONFIRMED")
                .get()
                .await()
            val confirmedCount = confirmationsSnapshot.size()

            if (confirmedCount == 0) return Result.success(false)

            // Get Unique Voters
            val votesSnapshot = votesCollection
                .whereEqualTo("game_id", gameId)
                .get()
                .await()

            val uniqueVoters = votesSnapshot.toObjects(MVPVote::class.java)
                .map { it.voterId }
                .distinct()
                .count()

            Result.success(uniqueVoters >= confirmedCount)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
