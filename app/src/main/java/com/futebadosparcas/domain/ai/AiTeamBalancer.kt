package com.futebadosparcas.domain.ai

import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.Team

/**
 * Interface para balanceamento de times usando AI (Gemini).
 * Diferente do TeamBalancer KMP no shared module.
 */
interface AiTeamBalancer {
    /**
     * Balances teams based on player skills/level.
     * @param gameId The game ID.
     * @param players List of confirmed players.
     * @param numberOfTeams Target number of teams.
     * @return Result containing list of Teams with players assigned.
     */
    suspend fun balanceTeams(
        gameId: String,
        players: List<GameConfirmation>,
        numberOfTeams: Int
    ): Result<List<Team>>
}
