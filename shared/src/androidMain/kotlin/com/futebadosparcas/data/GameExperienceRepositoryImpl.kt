package com.futebadosparcas.data

import com.futebadosparcas.domain.model.AttributeRating
import com.futebadosparcas.domain.model.GameStatus
import com.futebadosparcas.domain.model.MVPStreak
import com.futebadosparcas.domain.model.MVPVote
import com.futebadosparcas.domain.model.MVPVoteResult
import com.futebadosparcas.domain.model.VoteCategory
import com.futebadosparcas.domain.model.VoteResultWithPodium
import com.futebadosparcas.domain.model.VotingSettings
import com.futebadosparcas.domain.repository.GameExperienceRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.logging.PlatformLogger
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/**
 * Implementacao Android do GameExperienceRepository.
 * Suporta todas as melhorias de votacao (Issues #51-60).
 */
class GameExperienceRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource
) : GameExperienceRepository {

    private val firestore: FirebaseFirestore by lazy { firebaseDataSource.getFirestore() }

    private val votesCollection get() = firestore.collection("mvp_votes")
    private val gamesCollection get() = firestore.collection("games")
    private val confirmationsCollection get() = firestore.collection("confirmations")
    private val attributeRatingsCollection get() = firestore.collection("attribute_ratings")
    private val mvpStreaksCollection get() = firestore.collection("mvp_streaks")
    private val groupsCollection get() = firestore.collection("groups")

    companion object {
        private const val TAG = "GameExperienceRepository"
        private const val VOTE_WINDOW_HOURS = 24L
    }

    // ==================== VOTACAO MVP ====================

    override suspend fun submitVote(vote: MVPVote, skipped: Boolean): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Enviando voto para jogo ${vote.gameId}")

            val gameRef = gamesCollection.document(vote.gameId)
            val gameSnapshot = gameRef.get().await()

            val gameStatus = gameSnapshot.getString("status")
            if (gameStatus != GameStatus.FINISHED.name) {
                return Result.failure(Exception("Votacao disponivel apenas para jogos finalizados"))
            }

            val gameDateTime = gameSnapshot.getDate("dateTime")
            if (gameDateTime != null) {
                val now = java.util.Date()
                val voteDeadline = java.util.Date(gameDateTime.time + (VOTE_WINDOW_HOURS * 60 * 60 * 1000))
                if (now.after(voteDeadline)) {
                    return Result.failure(Exception("Prazo de votacao expirado (24h apos o jogo)"))
                }
            }

            val voteId = "${vote.gameId}_${vote.voterId}_${vote.category.name}"
            val voteRef = votesCollection.document(voteId)

            val existingVote = voteRef.get().await()
            if (existingVote.exists()) {
                return Result.failure(Exception("Voce ja votou nesta categoria"))
            }

            voteRef.set(
                mapOf(
                    "id" to voteId,
                    "game_id" to vote.gameId,
                    "voter_id" to vote.voterId,
                    "voted_player_id" to if (skipped) "" else vote.votedPlayerId,
                    "category" to vote.category.name,
                    "skipped" to skipped,
                    "voted_at" to FieldValue.serverTimestamp()
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
            val remaining = getVotingTimeRemaining(gameId).getOrNull() ?: 0L
            Result.success(remaining > 0)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao verificar se votacao esta aberta", e)
            Result.failure(e)
        }
    }

    override suspend fun getVotingTimeRemaining(gameId: String): Result<Long> {
        return try {
            val gameRef = gamesCollection.document(gameId)
            val gameSnapshot = gameRef.get().await()

            val gameStatus = gameSnapshot.getString("status")
            if (gameStatus != GameStatus.FINISHED.name) {
                return Result.success(0L)
            }

            val gameDateTime = gameSnapshot.getDate("dateTime") ?: return Result.success(0L)
            val voteDeadline = java.util.Date(gameDateTime.time + (VOTE_WINDOW_HOURS * 60 * 60 * 1000))
            val now = java.util.Date()
            val remaining = voteDeadline.time - now.time

            Result.success(if (remaining > 0) remaining else 0L)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao calcular tempo restante", e)
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
            PlatformLogger.e(TAG, "Erro ao verificar se usuario votou", e)
            Result.failure(e)
        }
    }

    override suspend fun hasUserVotedCategory(gameId: String, userId: String, category: VoteCategory): Result<Boolean> {
        return try {
            val voteId = "${gameId}_${userId}_${category.name}"
            val doc = votesCollection.document(voteId).get().await()
            Result.success(doc.exists())
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao verificar voto na categoria", e)
            Result.failure(e)
        }
    }

    override suspend fun getGameVotes(gameId: String): Result<List<MVPVote>> {
        return try {
            val snapshot = votesCollection
                .whereEqualTo("game_id", gameId)
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

    override suspend fun getVoteResults(gameId: String, isAnonymous: Boolean): Result<List<VoteResultWithPodium>> {
        return try {
            val votesResult = getGameVotes(gameId)
            if (votesResult.isFailure) {
                return Result.failure(votesResult.exceptionOrNull() ?: Exception("Erro ao buscar votos"))
            }

            val votes = votesResult.getOrNull() ?: emptyList()
            val confirmationsSnapshot = confirmationsCollection
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("status", "CONFIRMED")
                .get()
                .await()

            val playerNames = confirmationsSnapshot.documents.associate { doc ->
                (doc.getString("user_id") ?: "") to (doc.getString("user_name") ?: "")
            }
            val playerPhotos = confirmationsSnapshot.documents.associate { doc ->
                (doc.getString("user_id") ?: "") to (doc.getString("user_photo") ?: "")
            }

            val categories = listOf(VoteCategory.MVP, VoteCategory.BEST_GOALKEEPER, VoteCategory.WORST)
            val results = categories.map { category ->
                val categoryVotes = votes.filter { it.category == category && !it.skipped }
                val skippedCount = votes.count { it.category == category && it.skipped }
                val totalVotes = categoryVotes.size

                val voteCounts = categoryVotes.groupingBy { it.votedPlayerId }.eachCount()
                val sortedPlayers = voteCounts.entries.sortedByDescending { it.value }

                val voteResults = sortedPlayers.mapIndexed { index, entry ->
                    MVPVoteResult(
                        playerId = entry.key,
                        playerName = playerNames[entry.key] ?: "",
                        playerPhoto = playerPhotos[entry.key] ?: "",
                        voteCount = entry.value,
                        percentage = if (totalVotes > 0) (entry.value * 100.0 / totalVotes) else 0.0,
                        position = index + 1
                    )
                }

                VoteResultWithPodium(
                    category = category,
                    customCategoryId = null,
                    customCategoryName = null,
                    results = voteResults,
                    totalVotes = totalVotes,
                    skippedCount = skippedCount
                )
            }

            Result.success(results)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao obter resultados", e)
            Result.failure(e)
        }
    }

    override suspend fun concludeVoting(gameId: String): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Concluindo votacao para jogo $gameId")

            val results = getVoteResults(gameId).getOrNull() ?: return Result.success(Unit)
            val mvpResult = results.find { it.category == VoteCategory.MVP }
            val mvpId = mvpResult?.gold?.playerId

            if (mvpId != null) {
                updateMVPStreak(mvpId, gameId, true)
            }

            val gameRef = gamesCollection.document(gameId)
            val gameUpdates = mutableMapOf<String, Any?>()

            results.forEach { result ->
                when (result.category) {
                    VoteCategory.MVP -> result.gold?.let { gameUpdates["mvp_id"] = it.playerId }
                    VoteCategory.BEST_GOALKEEPER -> result.gold?.let { gameUpdates["best_gk_id"] = it.playerId }
                    VoteCategory.WORST -> result.gold?.let { gameUpdates["worst_player_id"] = it.playerId }
                    else -> {}
                }
            }

            if (gameUpdates.isNotEmpty()) {
                gameRef.update(gameUpdates).await()
            }

            PlatformLogger.d(TAG, "Votacao concluida com sucesso")
            Result.success(Unit)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao concluir votacao", e)
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

            val votesSnapshot = votesCollection
                .whereEqualTo("game_id", gameId)
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

    override suspend fun getSkippedCount(gameId: String, category: VoteCategory): Result<Int> {
        return try {
            val snapshot = votesCollection
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("category", category.name)
                .whereEqualTo("skipped", true)
                .get()
                .await()
            Result.success(snapshot.size())
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao contar votos pulados", e)
            Result.failure(e)
        }
    }

    // ==================== AVALIACAO DE ATRIBUTOS (#53) ====================

    override suspend fun submitAttributeRating(rating: AttributeRating): Result<Unit> {
        return try {
            val ratingId = "${rating.gameId}_${rating.raterId}_${rating.ratedPlayerId}"
            attributeRatingsCollection.document(ratingId).set(
                mapOf(
                    "id" to ratingId,
                    "game_id" to rating.gameId,
                    "rater_id" to rating.raterId,
                    "rated_player_id" to rating.ratedPlayerId,
                    "defense" to rating.defense,
                    "attack" to rating.attack,
                    "technique" to rating.technique,
                    "hustle" to rating.hustle,
                    "fair_play" to rating.fairPlay,
                    "created_at" to FieldValue.serverTimestamp()
                )
            ).await()
            Result.success(Unit)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao submeter avaliacao de atributos", e)
            Result.failure(e)
        }
    }

    override suspend fun getPlayerAttributeRatings(gameId: String, playerId: String): Result<List<AttributeRating>> {
        return try {
            val snapshot = attributeRatingsCollection
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("rated_player_id", playerId)
                .get()
                .await()

            val ratings = snapshot.documents.mapNotNull { doc ->
                docToAttributeRating(doc.id, doc.data)
            }
            Result.success(ratings)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar avaliacoes", e)
            Result.failure(e)
        }
    }

    override suspend fun getPlayerAverageRating(gameId: String, playerId: String): Result<AttributeRating?> {
        return try {
            val ratings = getPlayerAttributeRatings(gameId, playerId).getOrNull() ?: emptyList()
            if (ratings.isEmpty()) return Result.success(null)

            val avgDefense = ratings.map { it.defense }.average().toInt()
            val avgAttack = ratings.map { it.attack }.average().toInt()
            val avgTechnique = ratings.map { it.technique }.average().toInt()
            val avgHustle = ratings.map { it.hustle }.average().toInt()
            val avgFairPlay = ratings.map { it.fairPlay }.average().toInt()

            Result.success(AttributeRating(
                gameId = gameId,
                ratedPlayerId = playerId,
                defense = avgDefense,
                attack = avgAttack,
                technique = avgTechnique,
                hustle = avgHustle,
                fairPlay = avgFairPlay
            ))
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao calcular media de atributos", e)
            Result.failure(e)
        }
    }

    // ==================== MVP STREAK (#59) ====================

    override suspend fun getMVPStreak(userId: String): Result<MVPStreak?> {
        return try {
            val doc = mvpStreaksCollection.document(userId).get().await()
            if (!doc.exists()) return Result.success(null)

            Result.success(MVPStreak(
                userId = userId,
                currentStreak = (doc.getLong("current_streak") ?: 0).toInt(),
                maxStreak = (doc.getLong("max_streak") ?: 0).toInt(),
                lastMvpGameId = doc.getString("last_mvp_game_id") ?: ""
            ))
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar streak de MVP", e)
            Result.failure(e)
        }
    }

    override suspend fun updateMVPStreak(userId: String, gameId: String, wasMVP: Boolean): Result<MVPStreak> {
        return try {
            val currentStreak = getMVPStreak(userId).getOrNull()
            val newStreak: Int
            val newMaxStreak: Int

            if (wasMVP) {
                newStreak = (currentStreak?.currentStreak ?: 0) + 1
                newMaxStreak = maxOf(newStreak, currentStreak?.maxStreak ?: 0)
            } else {
                newStreak = 0
                newMaxStreak = currentStreak?.maxStreak ?: 0
            }

            val streakData = MVPStreak(
                userId = userId,
                currentStreak = newStreak,
                maxStreak = newMaxStreak,
                lastMvpGameId = if (wasMVP) gameId else (currentStreak?.lastMvpGameId ?: "")
            )

            mvpStreaksCollection.document(userId).set(
                mapOf(
                    "user_id" to userId,
                    "current_streak" to newStreak,
                    "max_streak" to newMaxStreak,
                    "last_mvp_game_id" to streakData.lastMvpGameId,
                    "updated_at" to FieldValue.serverTimestamp()
                )
            ).await()

            Result.success(streakData)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao atualizar streak de MVP", e)
            Result.failure(e)
        }
    }

    override suspend fun checkMVPStreakBadge(userId: String): Result<Boolean> {
        return try {
            val streak = getMVPStreak(userId).getOrNull()
            Result.success((streak?.currentStreak ?: 0) >= 3)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao verificar badge de streak", e)
            Result.failure(e)
        }
    }

    // ==================== CONFIGURACOES DE VOTACAO ====================

    override suspend fun getVotingSettings(groupId: String): Result<VotingSettings?> {
        return try {
            val doc = groupsCollection.document(groupId).get().await()
            if (!doc.exists()) return Result.success(null)

            val votingSettingsData = doc.get("voting_settings") as? Map<*, *>
            if (votingSettingsData == null) return Result.success(VotingSettings())

            Result.success(VotingSettings(
                isAnonymous = votingSettingsData["is_anonymous"] as? Boolean ?: false,
                votingTimeoutHours = (votingSettingsData["voting_timeout_hours"] as? Long)?.toInt() ?: 24,
                showTop3 = votingSettingsData["show_top_3"] as? Boolean ?: true,
                separateGoalkeeperVoting = votingSettingsData["separate_goalkeeper_voting"] as? Boolean ?: false,
                allowSkipVote = votingSettingsData["allow_skip_vote"] as? Boolean ?: true,
                enabledCategories = (votingSettingsData["enabled_categories"] as? List<*>)?.mapNotNull { it as? String }
                    ?: listOf(VoteCategory.MVP.name, VoteCategory.BEST_GOALKEEPER.name, VoteCategory.WORST.name)
            ))
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar configuracoes de votacao", e)
            Result.failure(e)
        }
    }

    override suspend fun updateVotingSettings(groupId: String, settings: VotingSettings): Result<Unit> {
        return try {
            groupsCollection.document(groupId).update(
                "voting_settings", mapOf(
                    "is_anonymous" to settings.isAnonymous,
                    "voting_timeout_hours" to settings.votingTimeoutHours,
                    "show_top_3" to settings.showTop3,
                    "separate_goalkeeper_voting" to settings.separateGoalkeeperVoting,
                    "allow_skip_vote" to settings.allowSkipVote,
                    "enabled_categories" to settings.enabledCategories
                )
            ).await()
            Result.success(Unit)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao atualizar configuracoes de votacao", e)
            Result.failure(e)
        }
    }

    // ==================== HELPERS ====================

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
                votedAt = (data["voted_at"] as? com.google.firebase.Timestamp)?.seconds?.times(1000),
                skipped = data["skipped"] as? Boolean ?: false
            )
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao converter documento para MVPVote", e)
            null
        }
    }

    private fun docToAttributeRating(id: String, data: Map<String, Any>?): AttributeRating? {
        if (data == null) return null
        return try {
            AttributeRating(
                id = id,
                gameId = data["game_id"] as? String ?: "",
                raterId = data["rater_id"] as? String ?: "",
                ratedPlayerId = data["rated_player_id"] as? String ?: "",
                defense = (data["defense"] as? Long)?.toInt() ?: 0,
                attack = (data["attack"] as? Long)?.toInt() ?: 0,
                technique = (data["technique"] as? Long)?.toInt() ?: 0,
                hustle = (data["hustle"] as? Long)?.toInt() ?: 0,
                fairPlay = (data["fair_play"] as? Long)?.toInt() ?: 0
            )
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao converter documento para AttributeRating", e)
            null
        }
    }
}
