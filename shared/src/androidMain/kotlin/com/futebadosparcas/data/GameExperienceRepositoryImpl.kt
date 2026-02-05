package com.futebadosparcas.data

import com.futebadosparcas.domain.model.GameStatus
import com.futebadosparcas.domain.model.MVPVote
import com.futebadosparcas.domain.model.VoteCategory
import com.futebadosparcas.domain.repository.GameExperienceRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.logging.PlatformLogger
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/**
 * Implementacao Android do GameExperienceRepository.
 */
class GameExperienceRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource
) : GameExperienceRepository {

    private val firestore: FirebaseFirestore by lazy { firebaseDataSource.getFirestore() }

    private val votesCollection get() = firestore.collection("mvp_votes")
    private val gamesCollection get() = firestore.collection("games")
    private val confirmationsCollection get() = firestore.collection("confirmations")

    companion object {
        private const val TAG = "GameExperienceRepository"
        private const val VOTE_WINDOW_HOURS = 24L // Janela de tempo para votacao em horas
    }

    override suspend fun submitVote(vote: MVPVote): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Enviando voto para jogo ${vote.gameId}")

            // 1. Verificar janela de tempo de votacao (24h)
            val gameRef = gamesCollection.document(vote.gameId)
            val gameSnapshot = gameRef.get().await()

            // Verificar se o jogo foi finalizado
            val gameStatus = gameSnapshot.getString("status")
            if (gameStatus != GameStatus.FINISHED.name) {
                return Result.failure(Exception("Votação disponível apenas para jogos finalizados"))
            }

            // Verificar se esta dentro da janela de 24h
            val gameDateTime = gameSnapshot.getDate("dateTime")
            if (gameDateTime != null) {
                val now = java.util.Date()
                val voteDeadline = java.util.Date(gameDateTime.time + (VOTE_WINDOW_HOURS * 60 * 60 * 1000))

                if (now.after(voteDeadline)) {
                    return Result.failure(Exception("Prazo de votação expirado (24h após o jogo)"))
                }
            }

            // 2. ID determinístico para evitar votos duplicados na mesma categoria
            val voteId = "${vote.gameId}_${vote.voterId}_${vote.category.name}"
            val voteRef = votesCollection.document(voteId)

            // 3. Verificar se já votou nesta categoria
            val existingVote = voteRef.get().await()
            if (existingVote.exists()) {
                return Result.failure(Exception("Você já votou nesta categoria"))
            }

            voteRef.set(
                mapOf(
                    "id" to voteId,
                    "game_id" to vote.gameId,
                    "voter_id" to vote.voterId,
                    "voted_player_id" to vote.votedPlayerId,
                    "category" to vote.category.name,
                    "voted_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                )
            ).await()

            PlatformLogger.d(TAG, "Voto enviado com sucesso")
            Result.success(Unit)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao enviar voto", e)
            Result.failure(e)
        }
    }

    override suspend fun isVotingOpen(gameId: String): Result<Boolean> {
        return try {
            val gameRef = gamesCollection.document(gameId)
            val gameSnapshot = gameRef.get().await()

            val gameStatus = gameSnapshot.getString("status")
            if (gameStatus != GameStatus.FINISHED.name) {
                return Result.success(false)
            }

            val gameDateTime = gameSnapshot.getDate("dateTime")
                ?: return Result.success(false)

            val now = java.util.Date()
            val voteDeadline = java.util.Date(gameDateTime.time + (VOTE_WINDOW_HOURS * 60 * 60 * 1000))

            Result.success(now.before(voteDeadline))
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao verificar se votação está aberta", e)
            Result.failure(e)
        }
    }

    override suspend fun hasUserVoted(gameId: String, userId: String): Result<Boolean> {
        return try {
            val snapshot = votesCollection
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("voter_id", userId)
                .get()
                .await()
            Result.success(!snapshot.isEmpty)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao verificar se usuário votou", e)
            Result.failure(e)
        }
    }

    override suspend fun getGameVotes(gameId: String): Result<List<MVPVote>> {
        return try {
            // P1 #12: Adicionar .limit() para evitar fetchar todos os votos
            // Max 100 votos por jogo (limite realista para segurança)
            val snapshot = votesCollection
                .whereEqualTo("game_id", gameId)
                .limit(100)
                .get()
                .await()

            val votes = snapshot.documents.mapNotNull { doc ->
                docToMVPVote(doc.id, doc.data)
            }
            Result.success(votes)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar votos", e)
            Result.failure(e)
        }
    }

    override fun getGameVotesFlow(gameId: String): Flow<List<MVPVote>> = callbackFlow {
        val listener = votesCollection
            .whereEqualTo("game_id", gameId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    PlatformLogger.e(TAG, "Erro ao ouvir votos", error)
                    return@addSnapshotListener
                }

                val votes = snapshot?.documents?.mapNotNull { doc ->
                    docToMVPVote(doc.id, doc.data)
                } ?: emptyList()
                trySend(votes)
            }

        awaitClose { listener.remove() }
    }

    override suspend fun concludeVoting(gameId: String): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Concluindo votação para jogo $gameId")

            // 1. Fetch Data
            val gameRef = gamesCollection.document(gameId)
            val gameSnapshot = gameRef.get().await()

            val confirmationsSnapshot = confirmationsCollection
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("status", "CONFIRMED")
                .get()
                .await()

            // P1 #12: Adicionar .limit() para prevenir leitura excessiva
            val votesSnapshot = votesCollection.whereEqualTo("game_id", gameId).limit(100).get().await()

            val votes = votesSnapshot.documents.mapNotNull { doc ->
                docToMVPVote(doc.id, doc.data)
            }

            if (votes.isEmpty()) {
                PlatformLogger.w(TAG, "Nenhum voto encontrado para o jogo $gameId")
                return Result.success(Unit)
            }

            // 2. Tally Votes
            val mvpCounts = votes.filter { it.category == VoteCategory.MVP }
                .groupingBy { it.votedPlayerId }
                .eachCount()

            val bestGkCounts = votes.filter { it.category == VoteCategory.BEST_GOALKEEPER }
                .groupingBy { it.votedPlayerId }
                .eachCount()

            val worstCounts = votes.filter { it.category == VoteCategory.WORST }
                .groupingBy { it.votedPlayerId }
                .eachCount()

            // Função helper para resolver empates
            fun resolveWinner(voteCounts: Map<String, Int>): String? {
                if (voteCounts.isEmpty()) return null
                val maxVotes = voteCounts.values.maxOrNull() ?: return null
                val candidates = voteCounts.filter { it.value == maxVotes }.keys.toList()

                if (candidates.size == 1) return candidates.first()

                // Desempate: ordem alfabética pelo nome do jogador
                val playerNames = confirmationsSnapshot.documents.associate { doc ->
                    (doc.getString("user_id") ?: "") to (doc.getString("user_name") ?: "")
                }
                return candidates.sortedBy { playerNames[it]?.lowercase() ?: "" }.first()
            }

            val mvpId = resolveWinner(mvpCounts)
            val bestGkId = resolveWinner(bestGkCounts)
            val worstId = resolveWinner(worstCounts)

            PlatformLogger.d(TAG, "Resultados da votação - MVP: $mvpId, BestGK: $bestGkId, Worst: $worstId")

            // 3. Update Confirmations with vote results
            val batch = firestore.batch()

            confirmationsSnapshot.documents.forEach { doc ->
                val userId = doc.getString("user_id") ?: return@forEach
                val isMvp = mvpId != null && userId == mvpId
                val isBestGk = bestGkId != null && userId == bestGkId
                val isWorst = worstId != null && userId == worstId

                val confId = "${gameId}_${userId}"
                val confRef = confirmationsCollection.document(confId)

                batch.update(confRef, mapOf(
                    "is_mvp" to isMvp,
                    "is_best_gk" to isBestGk,
                    "is_worst_player" to isWorst
                ))
            }

            // 4. Update Game with winners
            val gameUpdates = mutableMapOf<String, Any?>()
            if (mvpId != null) gameUpdates["mvp_id"] = mvpId
            if (bestGkId != null) gameUpdates["best_gk_id"] = bestGkId
            if (worstId != null) gameUpdates["worst_player_id"] = worstId

            if (gameUpdates.isNotEmpty()) {
                batch.update(gameRef, gameUpdates)
            }

            batch.commit().await()
            PlatformLogger.d(TAG, "Votação concluída com sucesso")
            Result.success(Unit)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao concluir votação", e)
            Result.failure(e)
        }
    }

    override suspend fun checkAllVoted(gameId: String): Result<Boolean> {
        return try {
            val confirmationsSnapshot = confirmationsCollection
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("status", "CONFIRMED")
                .get()
                .await()
            val confirmedCount = confirmationsSnapshot.size()

            if (confirmedCount == 0) return Result.success(false)

            // P1 #12: Adicionar .limit() para prevenção de leitura excessiva
            val votesSnapshot = votesCollection
                .whereEqualTo("game_id", gameId)
                .limit(100)
                .get()
                .await()

            val uniqueVoters = votesSnapshot.documents
                .mapNotNull { it.getString("voter_id") }
                .distinct()
                .count()

            Result.success(uniqueVoters >= confirmedCount)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao verificar se todos votaram", e)
            Result.failure(e)
        }
    }

    private fun docToMVPVote(id: String, data: Map<String, Any>?): MVPVote? {
        if (data == null) return null
        return try {
            MVPVote(
                id = id,
                gameId = data["game_id"] as? String ?: "",
                voterId = data["voter_id"] as? String ?: "",
                votedPlayerId = data["voted_player_id"] as? String ?: "",
                category = try {
                    VoteCategory.valueOf(data["category"] as? String ?: VoteCategory.MVP.name)
                } catch (e: Exception) {
                    VoteCategory.MVP
                },
                votedAt = (data["voted_at"] as? com.google.firebase.Timestamp)?.seconds?.times(1000)
            )
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao converter documento para MVPVote", e)
            null
        }
    }
}
