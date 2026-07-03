package com.futebadosparcas.data

import com.futebadosparcas.domain.model.GameStatus
import com.futebadosparcas.domain.model.MVPVote
import com.futebadosparcas.domain.model.VoteCategory
import com.futebadosparcas.domain.repository.GameExperienceRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.logging.PlatformLogger
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.DocumentSnapshot
import dev.gitlive.firebase.firestore.Timestamp
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.datetime.Clock

/**
 * Implementação compartilhada (Android+iOS) do GameExperienceRepository.
 *
 * Lógica de votação MVP / Bola Murcha pós-jogo (24h window).
 * Usa GitLive Firebase Kotlin SDK (cross-platform).
 */
class GameExperienceRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource
) : GameExperienceRepository {

    private val firestore = Firebase.firestore
    private val votesCollection = firestore.collection("mvp_votes")
    private val gamesCollection = firestore.collection("games")
    private val confirmationsCollection = firestore.collection("confirmations")

    companion object {
        private const val TAG = "GameExperienceRepository"
        private const val VOTE_WINDOW_HOURS = 24L
    }

    override suspend fun submitVote(vote: MVPVote): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Enviando voto para jogo ${vote.gameId}")

            firebaseDataSource.submitMvpVoteViaCallable(vote).getOrThrow()
            PlatformLogger.d(TAG, "Voto enviado com sucesso")
            Result.success(Unit)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao enviar voto", e)
            Result.failure(e)
        }
    }

    override suspend fun isVotingOpen(gameId: String): Result<Boolean> {
        return try {
            val gameSnapshot = gamesCollection.document(gameId).get()

            val gameStatus = gameSnapshot.get<String?>("status")
            if (gameStatus != GameStatus.FINISHED.name) {
                return Result.success(false)
            }

            val gameDateTimeTs = gameSnapshot.get<Timestamp?>("dateTime")
                ?: return Result.success(false)
            val gameMs = gameDateTimeTs.seconds * 1000L + gameDateTimeTs.nanoseconds / 1_000_000L
            val voteDeadlineMs = gameMs + (VOTE_WINDOW_HOURS * 60 * 60 * 1000L)
            val nowMs = Clock.System.now().toEpochMilliseconds()

            Result.success(nowMs < voteDeadlineMs)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao verificar se votação está aberta", e)
            Result.failure(e)
        }
    }

    override suspend fun hasUserVoted(gameId: String, userId: String): Result<Boolean> {
        return try {
            val snapshot = votesCollection
                .where { "game_id" equalTo gameId }
                .where { "voter_id" equalTo userId }
                .get()
            Result.success(snapshot.documents.isNotEmpty())
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao verificar se usuário votou", e)
            Result.failure(e)
        }
    }

    override suspend fun getGameVotes(gameId: String): Result<List<MVPVote>> {
        return try {
            val snapshot = votesCollection
                .where { "game_id" equalTo gameId }
                .limit(100)
                .get()
            Result.success(snapshot.documents.mapNotNull { docToMVPVote(it.id, it) })
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar votos", e)
            Result.failure(e)
        }
    }

    override fun getGameVotesFlow(gameId: String): Flow<List<MVPVote>> = flow {
        votesCollection
            .where { "game_id" equalTo gameId }
            .snapshots
            .catch { e -> PlatformLogger.e(TAG, "Erro ao ouvir votos", e) }
            .collect { snap ->
                emit(snap.documents.mapNotNull { docToMVPVote(it.id, it) })
            }
    }

    override suspend fun concludeVoting(gameId: String): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Concluindo votação para jogo $gameId")

            val gameRef = gamesCollection.document(gameId)
            val gameSnapshot = gameRef.get()

            val confirmationsSnapshot = confirmationsCollection
                .where { "game_id" equalTo gameId }
                .where { "status" equalTo "CONFIRMED" }
                .get()

            val votesSnapshot = votesCollection
                .where { "game_id" equalTo gameId }
                .limit(100)
                .get()

            val votes = votesSnapshot.documents.mapNotNull { docToMVPVote(it.id, it) }

            if (votes.isEmpty()) {
                PlatformLogger.w(TAG, "Nenhum voto encontrado para o jogo $gameId")
                return Result.success(Unit)
            }

            val mvpCounts = votes.filter { it.category == VoteCategory.MVP }
                .groupingBy { it.votedPlayerId }.eachCount()
            val bestGkCounts = votes.filter { it.category == VoteCategory.BEST_GOALKEEPER }
                .groupingBy { it.votedPlayerId }.eachCount()
            val worstCounts = votes.filter { it.category == VoteCategory.WORST }
                .groupingBy { it.votedPlayerId }.eachCount()

            fun resolveWinner(voteCounts: Map<String, Int>): String? {
                if (voteCounts.isEmpty()) return null
                val maxVotes = voteCounts.values.maxOrNull() ?: return null
                val candidates = voteCounts.filter { it.value == maxVotes }.keys.toList()
                if (candidates.size == 1) return candidates.first()
                val playerNames = confirmationsSnapshot.documents.associate { doc ->
                    (doc.get<String?>("user_id") ?: "") to (doc.get<String?>("user_name") ?: "")
                }
                return candidates.sortedBy { playerNames[it]?.lowercase() ?: "" }.first()
            }

            val mvpId = resolveWinner(mvpCounts)
            val bestGkId = resolveWinner(bestGkCounts)
            val worstId = resolveWinner(worstCounts)

            PlatformLogger.d(TAG, "Resultados da votação - MVP: $mvpId, BestGK: $bestGkId, Worst: $worstId")

            firestore.batch().apply {
                confirmationsSnapshot.documents.forEach { doc ->
                    val userId = doc.get<String?>("user_id") ?: return@forEach
                    val isMvp = mvpId != null && userId == mvpId
                    val isBestGk = bestGkId != null && userId == bestGkId
                    val isWorst = worstId != null && userId == worstId

                    val confId = "${gameId}_${userId}"
                    val confRef = confirmationsCollection.document(confId)
                    update(
                        documentRef = confRef,
                        data = mapOf(
                            "is_mvp" to isMvp,
                            "is_best_gk" to isBestGk,
                            "is_worst_player" to isWorst,
                        )
                    )
                }

                val gameUpdates = mutableMapOf<String, Any?>()
                if (mvpId != null) gameUpdates["mvp_id"] = mvpId
                if (bestGkId != null) gameUpdates["best_gk_id"] = bestGkId
                if (worstId != null) gameUpdates["worst_player_id"] = worstId
                if (gameUpdates.isNotEmpty()) {
                    @Suppress("UNCHECKED_CAST")
                    update(documentRef = gameRef, data = gameUpdates as Map<String, Any?>)
                }
            }.commit()

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
                .where { "game_id" equalTo gameId }
                .where { "status" equalTo "CONFIRMED" }
                .get()
            val confirmedCount = confirmationsSnapshot.documents.size
            if (confirmedCount == 0) return Result.success(false)

            val votesSnapshot = votesCollection
                .where { "game_id" equalTo gameId }
                .limit(100)
                .get()

            val uniqueVoters = votesSnapshot.documents
                .mapNotNull { it.get<String?>("voter_id") }
                .distinct()
                .count()

            Result.success(uniqueVoters >= confirmedCount)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao verificar se todos votaram", e)
            Result.failure(e)
        }
    }

    private fun docToMVPVote(id: String, doc: DocumentSnapshot): MVPVote? {
        return try {
            val votedAtTs = doc.get<Timestamp?>("voted_at")
            MVPVote(
                id = id,
                gameId = doc.get<String?>("game_id") ?: "",
                voterId = doc.get<String?>("voter_id") ?: "",
                votedPlayerId = doc.get<String?>("voted_player_id") ?: "",
                category = try {
                    VoteCategory.valueOf(doc.get<String?>("category") ?: VoteCategory.MVP.name)
                } catch (_: Exception) {
                    VoteCategory.MVP
                },
                votedAt = votedAtTs?.let { it.seconds * 1000L + it.nanoseconds / 1_000_000L },
            )
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao converter documento para MVPVote", e)
            null
        }
    }
}
