package com.futebadosparcas.domain.usecase.game

import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase
import com.futebadosparcas.util.ValidationHelper

/**
 * Edit Game Use Case
 *
 * Edita os detalhes de um jogo existente.
 *
 * Regras de negócio:
 * - Apenas o dono do jogo pode editá-lo
 * - Valida número de jogadores
 * - Valida preço se informado
 * - Verifica conflito de horário se data/hora foram alteradas
 * - Não permite editar jogos LIVE ou FINISHED
 * - Atualiza apenas os campos fornecidos
 *
 * Usage:
 * ```kotlin
 * val result = editGameUseCase(EditGameParams(
 *     gameId = "game123",
 *     editedById = "user456",
 *     date = "2026-02-01",
 *     time = "19:00",
 *     maxPlayers = 16,
 *     dailyPrice = 25.0,
 *     locationName = "Quadra Nova"
 * ))
 *
 * result.fold(
 *     onSuccess = { updatedGame -> /* game updated */ },
 *     onFailure = { error -> /* handle error */ }
 * )
 * ```
 */
class EditGameUseCase constructor(
    private val gameRepository: GameRepository
) : SuspendUseCase<EditGameParams, Game>() {

    override suspend fun execute(params: EditGameParams): Game {
        // Validar parâmetros obrigatórios
        require(params.gameId.isNotBlank()) { "ID do jogo é obrigatório" }
        require(params.editedById.isNotBlank()) { "ID de quem edita é obrigatório" }

        // Obter jogo atual
        val currentGame = gameRepository.getGameDetails(params.gameId).getOrThrow()

        // Validar se o usuário é o dono do jogo
        require(currentGame.ownerId == params.editedById) {
            "Apenas o dono do jogo pode editá-lo"
        }

        // Validar se o jogo está em status permitido para edição
        // Não permite editar jogos LIVE ou FINISHED
        require(
            currentGame.status !in listOf("LIVE", "FINISHED")
        ) {
            "Não é possível editar um jogo em status ${currentGame.status}"
        }

        // Atualizar os campos fornecidos usando copy() com named parameters
        val updatedGame = currentGame.copy(
            date = params.date ?: currentGame.date,
            time = params.time ?: currentGame.time,
            endTime = params.endTime ?: currentGame.endTime,
            maxPlayers = params.maxPlayers ?: currentGame.maxPlayers,
            maxGoalkeepers = params.maxGoalkeepers ?: currentGame.maxGoalkeepers,
            locationId = params.locationId ?: currentGame.locationId,
            locationName = params.locationName ?: currentGame.locationName,
            locationAddress = params.locationAddress ?: currentGame.locationAddress,
            locationLat = params.locationLat ?: currentGame.locationLat,
            locationLng = params.locationLng ?: currentGame.locationLng,
            gameType = params.gameType ?: currentGame.gameType,
            dailyPrice = params.dailyPrice ?: currentGame.dailyPrice,
            numberOfTeams = params.numberOfTeams ?: currentGame.numberOfTeams,
            isPublic = params.isPublic ?: currentGame.isPublic,
            visibility = params.visibility ?: currentGame.visibility
        )

        // Validar número de jogadores se foi alterado
        params.maxPlayers?.let { maxPlayers ->
            val playerCountError = ValidationHelper.validatePlayerCount(maxPlayers)
            require(playerCountError == null) { playerCountError ?: "Número de jogadores inválido" }
        }

        // Validar preço se foi alterado
        params.dailyPrice?.let { price ->
            val priceError = ValidationHelper.validatePrice(price)
            require(priceError == null) { priceError ?: "Preço inválido" }
        }

        // Verificar conflito de horário se data/hora/local foram alterados
        if (
            (params.date != null && params.date != currentGame.date) ||
            (params.time != null && params.time != currentGame.time) ||
            (params.endTime != null && params.endTime != currentGame.endTime) ||
            (params.locationId != null && params.locationId != currentGame.locationId)
        ) {
            val conflicts = gameRepository.checkTimeConflict(
                fieldId = updatedGame.locationId.ifBlank { updatedGame.fieldId },
                date = updatedGame.date,
                startTime = updatedGame.time,
                endTime = updatedGame.endTime.ifBlank { "23:59" },
                excludeGameId = params.gameId
            ).getOrThrow()

            require(conflicts.isEmpty()) {
                "Conflito de horário detectado: a quadra já possui um jogo agendado neste horário"
            }
        }

        // Validar integridade do jogo
        val validationErrors = updatedGame.validate()
        require(validationErrors.isEmpty()) {
            "Jogo contém dados inválidos: ${validationErrors.joinToString(", ") { it.message }}"
        }

        // Salvar jogo atualizado
        gameRepository.updateGame(updatedGame).getOrThrow()
        return updatedGame
    }
}

/**
 * Parâmetros para edição de jogo
 * Todos os campos são opcionais - apenas os fornecidos serão atualizados
 */
data class EditGameParams(
    val gameId: String,
    val editedById: String,
    val date: String? = null,
    val time: String? = null,
    val endTime: String? = null,
    val maxPlayers: Int? = null,
    val maxGoalkeepers: Int? = null,
    val locationId: String? = null,
    val locationName: String? = null,
    val locationAddress: String? = null,
    val locationLat: Double? = null,
    val locationLng: Double? = null,
    val gameType: String? = null,
    val dailyPrice: Double? = null,
    val numberOfTeams: Int? = null,
    val isPublic: Boolean? = null,
    val visibility: String? = null
)
