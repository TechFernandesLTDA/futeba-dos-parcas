package com.futebadosparcas.domain.usecase.game

import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.data.repository.GameRepository

/**
 * Use case para obter jogos futuros confirmados do usuário.
 * Retorna apenas jogos com status SCHEDULED e onde o usuário está confirmado.
 */
class GetUpcomingGamesUseCase constructor(
    private val gameRepository: GameRepository
) {
    suspend operator fun invoke(): Result<List<Game>> {
        return gameRepository.getConfirmedUpcomingGamesForUser()
    }
}
