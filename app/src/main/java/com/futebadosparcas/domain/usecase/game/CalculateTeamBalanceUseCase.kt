package com.futebadosparcas.domain.usecase.game

import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.Team
import com.futebadosparcas.domain.ai.AiTeamBalancer

/**
 * Use case para calcular balanceamento de times.
 * Utiliza o TeamBalancer para criar times equilibrados baseado nas habilidades dos jogadores.
 */
class CalculateTeamBalanceUseCase constructor(
    private val teamBalancer: AiTeamBalancer
) {
    /**
     * Calcula o balanceamento de times para um jogo.
     *
     * @param gameId ID do jogo
     * @param players Lista de confirmações de jogadores
     * @param numberOfTeams Número de times a criar (padrão: 2)
     * @return Result com lista de times balanceados
     */
    suspend operator fun invoke(
        gameId: String,
        players: List<GameConfirmation>,
        numberOfTeams: Int = 2
    ): Result<List<Team>> {
        // Validação de parâmetros
        if (gameId.isBlank()) {
            return Result.failure(IllegalArgumentException("ID do jogo não pode estar vazio"))
        }

        if (players.isEmpty()) {
            return Result.failure(IllegalArgumentException("Lista de jogadores não pode estar vazia"))
        }

        if (numberOfTeams < 2) {
            return Result.failure(
                IllegalArgumentException("Número de times deve ser no mínimo 2")
            )
        }

        if (numberOfTeams > players.size) {
            return Result.failure(
                IllegalArgumentException(
                    "Número de times ($numberOfTeams) não pode ser maior que número de jogadores (${players.size})"
                )
            )
        }

        // Calcular balanceamento
        return teamBalancer.balanceTeams(gameId, players, numberOfTeams)
    }
}
