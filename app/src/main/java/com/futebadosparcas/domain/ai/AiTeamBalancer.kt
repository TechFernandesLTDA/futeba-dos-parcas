package com.futebadosparcas.domain.ai

import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.Team

/**
 * Interface para balanceamento de N times no módulo Android (`:app`).
 *
 * Nota: Apesar do pacote `domain.ai` e da implementação `GeminiTeamBalancer`,
 * o balanceamento atual usa algoritmo heurístico local (Greedy por tamanho e score
 * `rating * 10 + level`), sem chamadas à API Gemini/IA.
 * Diferente de [TeamBalancer] KMP no módulo `:shared` (focado em 2 times via Snake Draft).
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
