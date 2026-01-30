package com.futebadosparcas.domain.usecase.game

import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase
import javax.inject.Inject

/**
 * Duplicate Game Use Case
 *
 * Duplica um jogo existente com nova data/hora.
 * Útil para criar jogos recorrentes baseados em configurações anteriores.
 *
 * Uso:
 * ```kotlin
 * val result = duplicateGameUseCase(DuplicateGameParams(
 *     originalGameId = "game123",
 *     newDate = "2026-01-30",
 *     newTime = "20:00"
 * ))
 * ```
 */
class DuplicateGameUseCase @Inject constructor(
    private val gameRepository: GameRepository
) : SuspendUseCase<DuplicateGameParams, Game>() {

    override suspend fun execute(params: DuplicateGameParams): Game {
        // Validar parâmetros
        require(params.originalGameId.isNotBlank()) { "ID do jogo original é obrigatório" }
        require(params.newDate.isNotBlank()) { "Nova data é obrigatória" }
        require(params.newTime.isNotBlank()) { "Novo horário é obrigatório" }

        // Buscar jogo original
        val originalGame = gameRepository.getGameDetails(params.originalGameId).getOrNull()
            ?: throw IllegalArgumentException("Jogo original não encontrado")

        // Criar cópia com nova data/hora
        val duplicatedGame = Game(
            date = params.newDate,
            time = params.newTime,
            endTime = params.newEndTime ?: originalGame.endTime,
            status = GameStatus.SCHEDULED.name,
            maxPlayers = originalGame.maxPlayers,
            maxGoalkeepers = originalGame.maxGoalkeepers,
            ownerId = originalGame.ownerId,
            ownerName = originalGame.ownerName,
            locationId = originalGame.locationId,
            locationName = originalGame.locationName,
            locationAddress = originalGame.locationAddress,
            locationLat = originalGame.locationLat,
            locationLng = originalGame.locationLng,
            fieldId = originalGame.fieldId,
            fieldName = originalGame.fieldName,
            gameType = originalGame.gameType,
            dailyPrice = originalGame.dailyPrice,
            totalCost = originalGame.totalCost,
            pixKey = originalGame.pixKey,
            numberOfTeams = originalGame.numberOfTeams,
            isPublic = originalGame.isPublic,
            visibility = originalGame.visibility,
            groupId = originalGame.groupId,
            groupName = originalGame.groupName
        )

        // Salvar novo jogo
        return gameRepository.createGame(duplicatedGame).getOrThrow()
    }
}

/**
 * Parâmetros para duplicar jogo
 */
data class DuplicateGameParams(
    val originalGameId: String,
    val newDate: String,
    val newTime: String,
    val newEndTime: String? = null
)
