package com.futebadosparcas.domain.usecase.livegame

import com.futebadosparcas.data.repository.LiveGameRepository
import com.futebadosparcas.domain.model.GameEvent
import com.futebadosparcas.domain.model.GameEventType
import com.futebadosparcas.util.AppLogger

/**
 * Use Case para adicionar eventos em um jogo ao vivo (gol, defesa, cartão).
 *
 * Responsabilidades:
 * - Validar parâmetros do evento
 * - Delegar criação do evento ao LiveGameRepository
 * - Centralizar lógica de criação de eventos que antes era repetida
 *   em 4 métodos quase idênticos no LiveGameViewModel
 */
class AddGameEventUseCase(
    private val liveGameRepository: LiveGameRepository
) {

    companion object {
        private const val TAG = "AddGameEventUseCase"
    }

    /**
     * Adiciona um evento ao jogo ao vivo.
     *
     * @param params Parâmetros do evento (gameId, tipo, jogador, time, etc.)
     * @return Result com o evento criado ou erro
     */
    suspend operator fun invoke(params: AddGameEventParams): Result<GameEvent> {
        // Validação de parâmetros obrigatórios
        if (params.gameId.isEmpty()) {
            return Result.failure(IllegalArgumentException("ID do jogo não pode ser vazio"))
        }
        if (params.playerId.isEmpty()) {
            return Result.failure(IllegalArgumentException("ID do jogador não pode ser vazio"))
        }
        if (params.teamId.isEmpty()) {
            return Result.failure(IllegalArgumentException("ID do time não pode ser vazio"))
        }

        AppLogger.d(TAG) {
            "Adicionando evento ${params.eventType} - gameId=${params.gameId}, playerId=${params.playerId}"
        }

        return liveGameRepository.addGameEvent(
            gameId = params.gameId,
            eventType = params.eventType,
            playerId = params.playerId,
            playerName = params.playerName,
            teamId = params.teamId,
            assistedById = params.assistedById,
            assistedByName = params.assistedByName,
            minute = params.minute
        )
    }
}

/**
 * Parâmetros para adicionar um evento ao jogo ao vivo.
 */
data class AddGameEventParams(
    val gameId: String,
    val eventType: GameEventType,
    val playerId: String,
    val playerName: String,
    val teamId: String,
    val assistedById: String? = null,
    val assistedByName: String? = null,
    val minute: Int = 0
)
