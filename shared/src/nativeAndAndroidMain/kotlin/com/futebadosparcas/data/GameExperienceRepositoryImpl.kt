package com.futebadosparcas.data

import com.futebadosparcas.domain.model.GameStatus
import com.futebadosparcas.domain.model.MVPVote
import com.futebadosparcas.domain.model.VoteCategory
import com.futebadosparcas.domain.repository.GameExperienceRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.logging.PlatformLogger
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.Timestamp
import dev.gitlive.firebase.firestore.firestore
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
        return getUserVoteCategories(gameId, userId).map { categories ->
            VoteCategory.MVP in categories && VoteCategory.WORST in categories
        }
    }

    override suspend fun getUserVoteCategories(
        gameId: String,
        userId: String
    ): Result<Set<VoteCategory>> {
        return try {
            val categories = VoteCategory.entries
                .filterNot { it == VoteCategory.CUSTOM }
                .filterTo(mutableSetOf()) { category ->
                    ownVoteExists(gameId, userId, category)
                }
            Result.success(categories)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao verificar categorias votadas", e)
            Result.failure(e)
        }
    }

    override suspend fun concludeVoting(gameId: String): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Concluindo votação para jogo $gameId")
            firebaseDataSource.concludeMvpVotingViaCallable(gameId).getOrThrow()
            PlatformLogger.d(TAG, "Votação concluída com sucesso")
            Result.success(Unit)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao concluir votação", e)
            Result.failure(e)
        }
    }

    override suspend fun checkAllVoted(gameId: String): Result<Boolean> {
        return try {
            val gameSnapshot = gamesCollection.document(gameId).get()
            val submittedCount =
                gameSnapshot.get<Long?>("voting_submitted_count")?.toInt() ?: 0
            val confirmationsSnapshot = confirmationsCollection
                .where { "game_id" equalTo gameId }
                .where { "status" equalTo "CONFIRMED" }
                .get()
            val confirmedCount = confirmationsSnapshot.documents.size
            if (confirmedCount == 0) return Result.success(false)

            Result.success(submittedCount >= confirmedCount)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao verificar se todos votaram", e)
            Result.failure(e)
        }
    }

    private suspend fun ownVoteExists(
        gameId: String,
        userId: String,
        category: VoteCategory
    ): Boolean {
        return votesCollection
            .document("${gameId}_${userId}_${category.name}")
            .get()
            .exists
    }
}
