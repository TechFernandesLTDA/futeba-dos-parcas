package com.futebadosparcas.data.ai

import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.Team
import com.futebadosparcas.domain.model.PlayerRatingRole
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.domain.ai.AiTeamBalancer
import com.futebadosparcas.util.AppLogger
import kotlin.math.ceil

class GeminiTeamBalancer constructor(
    private val userRepository: UserRepository
) : AiTeamBalancer {

    companion object {
        private const val TAG = "GeminiTeamBalancer"

        /** Peso do rating na fórmula de score (rating * RATING_WEIGHT + level) */
        private const val RATING_WEIGHT = 10

        /** Rating padrão para jogadores sem avaliação */
        private const val DEFAULT_RATING = 3.0
    }

    override suspend fun balanceTeams(
        gameId: String,
        players: List<GameConfirmation>,
        numberOfTeams: Int
    ): Result<List<Team>> {
        return try {
            val userIds = players.map { it.userId }
            val usersResult = userRepository.getUsersByIds(userIds)
            
            val usersMap = if (usersResult.isSuccess) {
                usersResult.getOrNull()?.associateBy { it.id } ?: emptyMap()
            } else {
                emptyMap()
            }

            // Calculate score for each player
            // Formula: Base Rating (0-5) * 10 + Level (1-100)
            val scoredPlayers = players.map { confirmation ->
                val user = usersMap[confirmation.userId]
                val rating = if (user != null) {
                    when (confirmation.position) {
                        "GOALKEEPER" -> user.getEffectiveRating(PlayerRatingRole.GOALKEEPER)
                        else -> maxOf(
                            user.getEffectiveRating(PlayerRatingRole.STRIKER),
                            user.getEffectiveRating(PlayerRatingRole.MID),
                            user.getEffectiveRating(PlayerRatingRole.DEFENDER)
                        )
                    }
                } else 0.0
                
                // Fallback para rating padrão se não avaliado
                val effectiveRating = if (rating > 0) rating else DEFAULT_RATING
                val level = user?.level ?: 1

                val score = (effectiveRating * RATING_WEIGHT) + level
                Pair(confirmation, score)
            }.sortedByDescending { it.second } // Sort strongest first

            // Distribute players
            val teamBuilders = List(numberOfTeams) { mutableListOf<GameConfirmation>() }
            val teamScores = MutableList(numberOfTeams) { 0.0 }
            
            // Separate GKs and Field players
            val gks = scoredPlayers.filter { it.first.position == "GOALKEEPER" }
            val fields = scoredPlayers.filter { it.first.position != "GOALKEEPER" }

            // Distribute GKs first
            gks.forEach { (player, score) ->
                // Add to team with fewest players, tie-break lowest score
                val targetTeamIndex = teamBuilders.indices.minWith(
                    compareBy<Int> { teamBuilders[it].size }
                        .thenBy { teamScores[it] }
                )
                teamBuilders[targetTeamIndex].add(player)
                teamScores[targetTeamIndex] += score
            }

            // Distribute Field Players using Snake Draft or Greedy to lowest total score
            fields.forEach { (player, score) ->
                // Add to team with lowest total score, respecting max size if needed (but here we just distribute)
                // To keep teams even size, prioritize size balance first?
                // Standard balancing: Try to keep sizes equal, then score equal.
                
                val targetTeamIndex = teamBuilders.indices.minWith(
                    compareBy<Int> { teamBuilders[it].size }
                        .thenBy { teamScores[it] }
                )
                teamBuilders[targetTeamIndex].add(player)
                teamScores[targetTeamIndex] += score
            }

            // Create Team objects
            val teams = teamBuilders.mapIndexed { index, members ->
                Team(
                    gameId = gameId,
                    name = "Time ${index + 1}", // Can be enhanced later with AI names
                    playerIds = members.map { it.userId }
                )
            }

            Result.success(teams)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao balancear times para gameId=$gameId", e)
            Result.failure(e)
        }
    }
}
