package com.futebadosparcas.data

import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.GameStatus
import com.futebadosparcas.domain.model.PlayerPosition
import com.futebadosparcas.domain.repository.GameConfirmationRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.text.ParseException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Implementacao Android do GameConfirmationRepository (KMP).
 *
 * Usa FirebaseDataSource (KMP) internamente.
 * Inclui validacoes de limite de jogadores, duplicatas e deadline.
 *
 * @param dataSource DataSource Firebase para acesso aos dados
 */
@Singleton
class GameConfirmationRepositoryImpl @Inject constructor(
    private val dataSource: FirebaseDataSource
) : GameConfirmationRepository {

    companion object {
        private const val TAG = "GameConfirmationRepo"
    }

    override suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>> {
        return dataSource.getGameConfirmations(gameId)
    }

    override fun getGameConfirmationsFlow(gameId: String): Flow<Result<List<GameConfirmation>>> {
        return dataSource.getGameConfirmationsFlow(gameId)
    }

    override suspend fun confirmPresence(
        gameId: String,
        position: String,
        isCasual: Boolean
    ): Result<GameConfirmation> {
        // ========== VALIDACAO 0: Validar parametro position ==========
        val validPositions = PlayerPosition.entries.map { it.name }
        if (position !in validPositions) {
            AppLogger.w(TAG) { "Posicao invalida recebida: $position" }
            return Result.failure(
                IllegalArgumentException("Posicao invalida: $position. Valores aceitos: $validPositions")
            )
        }

        // Buscar usuario atual para obter informacoes necessarias
        val currentUserResult = dataSource.getCurrentUser()
        if (currentUserResult.isFailure) {
            return Result.failure(
                currentUserResult.exceptionOrNull() ?: Exception("Falha ao obter usuario atual")
            )
        }

        val user = currentUserResult.getOrNull()
            ?: return Result.failure(Exception("Usuario atual nao encontrado"))

        // ========== VALIDACAO 1: Verificar se usuario ja confirmou (duplicata) ==========
        val existingConfirmations = dataSource.getGameConfirmations(gameId).getOrNull() ?: emptyList()
        val alreadyConfirmed = existingConfirmations.any {
            it.userId == user.id && it.status in listOf("CONFIRMED", "PENDING")
        }
        if (alreadyConfirmed) {
            return Result.failure(
                IllegalStateException("Voce ja esta confirmado neste jogo")
            )
        }

        // ========== VALIDACAO 2: Verificar limite de jogadores ==========
        val gameResult = dataSource.getGameById(gameId)
        if (gameResult.isFailure) {
            return Result.failure(
                gameResult.exceptionOrNull() ?: Exception("Falha ao obter detalhes do jogo")
            )
        }
        val game = gameResult.getOrNull()
            ?: return Result.failure(Exception("Jogo nao encontrado"))

        // Verificar se jogo esta em status que aceita confirmacoes
        // SCHEDULED = jogo agendado, lista aberta
        // CONFIRMED = lista fechada (apenas manager pode adicionar, validado no ViewModel)
        // IN_PROGRESS/FINISHED = jogo em andamento ou encerrado, nao aceita confirmacoes
        val gameStatus = try { GameStatus.valueOf(game.status) } catch (e: Exception) { GameStatus.SCHEDULED }
        val acceptsConfirmations = gameStatus in listOf(GameStatus.SCHEDULED, GameStatus.CONFIRMED)
        if (!acceptsConfirmations) {
            return Result.failure(
                IllegalStateException("Este jogo nao esta aceitando confirmacoes (status: ${game.status})")
            )
        }

        // Contar confirmados por posicao
        val confirmedPlayers = existingConfirmations.filter {
            it.status in listOf("CONFIRMED", "PENDING")
        }
        val confirmedFieldPlayers = confirmedPlayers.count { it.position == "FIELD" }
        val confirmedGoalkeepers = confirmedPlayers.count { it.position == "GOALKEEPER" }

        // Verificar limite por posicao
        if (position == "GOALKEEPER") {
            if (confirmedGoalkeepers >= game.maxGoalkeepers) {
                return Result.failure(
                    IllegalStateException("Limite de goleiros atingido (${game.maxGoalkeepers})")
                )
            }
        } else {
            // Para jogadores de linha, verificar limite total
            val totalMax = game.maxPlayers
            val totalConfirmed = confirmedFieldPlayers + confirmedGoalkeepers
            if (totalConfirmed >= totalMax) {
                return Result.failure(
                    IllegalStateException("Jogo lotado (${totalConfirmed}/${totalMax} jogadores)")
                )
            }
        }

        // ========== VALIDACAO 3: Verificar deadline (jogo ja iniciou?) ==========
        // SEGURANCA: Validacao estrita - nao permite confirmacao apos inicio do jogo
        val gameDateTime: Date? = try {
            // Tentar parsear data/hora do jogo
            if (game.date.isNotBlank() && game.time.isNotBlank()) {
                val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
                dateFormat.isLenient = false // Parsing estrito
                dateFormat.parse("${game.date} ${game.time}")
            } else {
                null
            }
        } catch (e: ParseException) {
            // SEGURANCA: Logar tentativa de parsing com dados invalidos
            AppLogger.w(TAG) { "Falha ao parsear data/hora do jogo $gameId: date=${game.date}, time=${game.time}" }
            null
        }

        // Se conseguimos determinar a data/hora, verificar se jogo ja iniciou
        if (gameDateTime != null && Date().after(gameDateTime)) {
            AppLogger.w(TAG) { "Tentativa de confirmacao apos inicio do jogo $gameId por usuario ${user.id}" }
            return Result.failure(
                IllegalStateException("Nao eh possivel confirmar apos o inicio do jogo")
            )
        }

        return dataSource.confirmPresence(
            gameId = gameId,
            userId = user.id,
            userName = user.name,
            userPhoto = user.photoUrl,
            position = position,
            isCasualPlayer = isCasual
        )
    }

    override suspend fun getGoalkeeperCount(gameId: String): Result<Int> {
        return dataSource.getGameConfirmations(gameId).map { confirmations ->
            confirmations.count {
                it.position == "GOALKEEPER" &&
                (it.status == "CONFIRMED" || it.status == "PENDING")
            }
        }
    }

    override suspend fun cancelConfirmation(gameId: String): Result<Unit> {
        val userId = dataSource.getCurrentUserId()
            ?: return Result.failure(Exception("Usuario nao autenticado"))

        return dataSource.cancelConfirmation(gameId, userId)
    }

    override suspend fun removePlayerFromGame(gameId: String, userId: String): Result<Unit> {
        return dataSource.removePlayerFromGame(gameId, userId)
    }

    override suspend fun updatePaymentStatus(
        gameId: String,
        userId: String,
        isPaid: Boolean
    ): Result<Unit> {
        return dataSource.updatePaymentStatus(gameId, userId, isPaid)
    }

    override suspend fun summonPlayers(
        gameId: String,
        confirmations: List<GameConfirmation>
    ): Result<Unit> {
        return dataSource.summonPlayers(gameId, confirmations)
    }

    override suspend fun getUserConfirmationIds(userId: String): Set<String> {
        return if (userId.isEmpty()) {
            emptySet()
        } else {
            // Buscar jogos confirmados pelo usuario
            dataSource.getConfirmedGamesForUser(userId)
                .map { games -> games.map { it.id }.toSet() }
                .getOrDefault(emptySet())
        }
    }

    override suspend fun getConfirmedGameIds(userId: String): List<String> {
        return dataSource.getConfirmedGamesForUser(userId)
            .map { games -> games.map { it.id } }
            .getOrDefault(emptyList())
    }

    override fun getUserConfirmationsFlow(userId: String): Flow<Set<String>> {
        if (userId.isEmpty()) {
            return kotlinx.coroutines.flow.flowOf(emptySet())
        }

        return dataSource.getUpcomingGamesFlow()
            .map { result ->
                result.getOrDefault(emptyList())
                    .map { it.id }
                    .toSet()
            }
            .catch { emit(emptySet()) }
    }

    override suspend fun acceptInvitation(
        gameId: String,
        position: String
    ): Result<GameConfirmation> {
        val userId = dataSource.getCurrentUserId()
            ?: return Result.failure(Exception("Usuario nao autenticado"))

        return dataSource.acceptInvitation(gameId, userId, position)
    }

    override suspend fun updateConfirmationStatus(
        gameId: String,
        status: String
    ): Result<Unit> {
        val userId = dataSource.getCurrentUserId()
            ?: return Result.failure(Exception("Usuario nao autenticado"))

        return dataSource.updateConfirmationStatus(gameId, userId, status)
    }

    override suspend fun updateConfirmationStatusForUser(
        gameId: String,
        userId: String,
        status: String
    ): Result<Unit> {
        return dataSource.updateConfirmationStatus(gameId, userId, status)
    }
}
