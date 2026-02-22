package com.futebadosparcas.domain.usecase.game

import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.GameStatus
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase
import com.futebadosparcas.util.ValidationHelper
import java.util.Date

/**
 * Create Game Use Case
 *
 * Cria um novo jogo com validação e regras de negócio.
 *
 * Usage:
 * ```kotlin
 * val result = createGameUseCase(CreateGameParams(
 *     date = "2026-01-25",
 *     time = "20:00",
 *     ownerId = "user789",
 *     ownerName = "João",
 *     maxPlayers = 14,
 *     locationId = "location456",
 *     locationName = "Quadra do Parque"
 * ))
 *
 * result.fold(
 *     onSuccess = { game -> /* game created */ },
 *     onFailure = { error -> /* handle error */ }
 * )
 * ```
 */
class CreateGameUseCase constructor(
    private val gameRepository: GameRepository
) : SuspendUseCase<CreateGameParams, Game>() {

    override suspend fun execute(params: CreateGameParams): Game {
        // Validar número de jogadores
        val playerCountError = ValidationHelper.validatePlayerCount(params.maxPlayers)
        require(playerCountError == null) { playerCountError ?: "Número de jogadores inválido" }

        // Validar preço se informado
        if (params.dailyPrice != null) {
            val priceError = ValidationHelper.validatePrice(params.dailyPrice)
            require(priceError == null) { priceError ?: "Preço inválido" }
        }

        // Validar dono do jogo
        require(params.ownerId.isNotBlank()) { "ID do dono é obrigatório" }
        require(params.ownerName.isNotBlank()) { "Nome do dono é obrigatório" }

        // Criar o jogo
        val game = Game(
            date = params.date,
            time = params.time,
            endTime = params.endTime ?: "",
            status = GameStatus.SCHEDULED.name,
            maxPlayers = params.maxPlayers,
            maxGoalkeepers = params.maxGoalkeepers,
            ownerId = params.ownerId,
            ownerName = params.ownerName,
            locationId = params.locationId ?: "",
            locationName = params.locationName ?: "",
            locationAddress = params.locationAddress ?: "",
            gameType = params.gameType,
            dailyPrice = params.dailyPrice ?: 0.0,
            isPublic = params.isPublic,
            groupId = params.groupId,
            groupName = params.groupName
        )

        // Salvar via repositório
        return gameRepository.createGame(game).getOrThrow()
    }
}

/**
 * Parâmetros para criação de jogo
 */
data class CreateGameParams(
    val date: String,
    val time: String,
    val endTime: String? = null,
    val ownerId: String,
    val ownerName: String,
    val maxPlayers: Int = 14,
    val maxGoalkeepers: Int = 3,
    val locationId: String? = null,
    val locationName: String? = null,
    val locationAddress: String? = null,
    val gameType: String = "Society",
    val dailyPrice: Double? = null,
    val isPublic: Boolean = true,
    val groupId: String? = null,
    val groupName: String? = null
)
