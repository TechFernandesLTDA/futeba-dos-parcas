package com.futebadosparcas.domain.usecase

import android.location.Location
import com.futebadosparcas.data.model.CancellationReason
import com.futebadosparcas.domain.model.ConfirmationStatus
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.GameCancellation
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.domain.model.GameWaitlist
import com.futebadosparcas.domain.model.PlayerAttendance
import com.futebadosparcas.domain.model.WaitlistStatus
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.WaitlistRepository
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import java.util.Date

/**
 * Use case para gerenciar confirmacoes de presenca em jogos (Issues #31-40).
 *
 * Funcionalidades:
 * - Confirmar presenca com validacao de deadline
 * - Adicionar a lista de espera quando lotado
 * - Cancelar com motivo obrigatorio
 * - Marcar "A caminho" com ETA
 * - Check-in por GPS
 * - Calcular taxa de presenca
 */
class ConfirmationUseCase constructor(
    private val gameRepository: GameRepository,
    private val waitlistRepository: WaitlistRepository,
    private val notificationRepository: NotificationRepository,
    private val userRepository: UserRepository,
    private val firestore: FirebaseFirestore
) {

    companion object {
        private const val TAG = "ConfirmationUseCase"

        // Raio padrao para check-in em metros
        const val DEFAULT_CHECKIN_RADIUS_METERS = 100

        // Opcoes de deadline em horas
        val DEADLINE_OPTIONS = listOf(0, 1, 2, 4, 12, 24)
    }

    // ========== ISSUE #31 - Confirmation Deadline ==========

    /**
     * Verifica se ainda eh possivel confirmar presenca no jogo.
     *
     * @param game Jogo
     * @return Resultado com true se pode confirmar, false se passou do deadline
     */
    suspend fun canConfirmPresence(game: Game): Result<ConfirmationCheck> {
        return try {
            val deadline = game.getConfirmationDeadline()

            if (deadline == null) {
                Result.success(ConfirmationCheck(canConfirm = true))
            } else {
                val now = Date()
                val canConfirm = now.before(deadline)
                val timeRemaining = if (canConfirm) deadline.time - now.time else 0L

                Result.success(
                    ConfirmationCheck(
                        canConfirm = canConfirm,
                        deadline = deadline,
                        timeRemainingMs = timeRemaining
                    )
                )
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao verificar deadline", e)
            Result.failure(e)
        }
    }

    /**
     * Confirma presenca no jogo, respeitando deadline e limite de jogadores.
     *
     * @param gameId ID do jogo
     * @param position Posicao (GOALKEEPER ou FIELD)
     * @param isCasual Se eh jogador casual
     * @return Resultado com a confirmacao ou entrada na lista de espera
     */
    suspend fun confirmPresence(
        gameId: String,
        position: String,
        isCasual: Boolean = false
    ): Result<ConfirmationResult> {
        return try {
            // Buscar jogo
            val gameResult = gameRepository.getGameDetails(gameId)
            val game = gameResult.getOrNull()
                ?: return Result.failure(Exception("Jogo nao encontrado"))

            // Verificar deadline
            if (game.isConfirmationDeadlinePassed()) {
                return Result.success(
                    ConfirmationResult(
                        success = false,
                        errorMessage = "Prazo para confirmacao encerrado"
                    )
                )
            }

            // Verificar se jogo esta lotado
            if (game.isFull()) {
                // Adicionar a lista de espera (Issue #32)
                val user = userRepository.getCurrentUser().getOrNull()
                    ?: return Result.failure(Exception("Usuario nao autenticado"))

                val waitlistResult = waitlistRepository.addToWaitlist(
                    gameId = gameId,
                    userId = user.id,
                    userName = user.name,
                    userPhoto = user.photoUrl,
                    position = position
                )

                val waitlistEntry = waitlistResult.getOrNull()
                    ?: return Result.failure(waitlistResult.exceptionOrNull() ?: Exception("Erro ao adicionar a lista de espera"))

                return Result.success(
                    ConfirmationResult(
                        success = true,
                        addedToWaitlist = true,
                        waitlistPosition = waitlistEntry.queuePosition
                    )
                )
            }

            // Confirmar presenca normalmente
            val confirmResult = gameRepository.confirmPresence(gameId, position, isCasual)

            if (confirmResult.isSuccess) {
                val confirmation = confirmResult.getOrThrow()

                // Calcular ordem de confirmacao (Issue #40)
                val confirmations = gameRepository.getGameConfirmations(gameId).getOrNull() ?: emptyList()
                val order = confirmations.count { it.status == ConfirmationStatus.CONFIRMED.name }

                // Atualizar ordem
                updateConfirmationOrder(gameId, confirmation.userId, order)

                Result.success(
                    ConfirmationResult(
                        success = true,
                        confirmation = confirmation,
                        confirmationOrder = order
                    )
                )
            } else {
                Result.failure(confirmResult.exceptionOrNull() ?: Exception("Erro ao confirmar"))
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao confirmar presenca", e)
            Result.failure(e)
        }
    }

    // ========== ISSUE #33 - Vacancy Notification ==========

    /**
     * Processa cancelamento e notifica proximo da fila.
     *
     * @param gameId ID do jogo
     * @param reason Motivo do cancelamento
     * @param reasonText Texto customizado (para motivo OTHER)
     * @return Resultado do cancelamento
     */
    suspend fun cancelWithReason(
        gameId: String,
        reason: CancellationReason,
        reasonText: String? = null
    ): Result<Unit> {
        return try {
            val user = userRepository.getCurrentUser().getOrNull()
                ?: return Result.failure(Exception("Usuario nao autenticado"))

            val gameResult = gameRepository.getGameDetails(gameId)
            val game = gameResult.getOrNull()
                ?: return Result.failure(Exception("Jogo nao encontrado"))

            // Calcular horas antes do jogo
            val gameDateTime = game.dateTime
            val hoursBeforeGame = if (gameDateTime != null) {
                val diff = gameDateTime.time - System.currentTimeMillis()
                diff.toDouble() / (1000 * 60 * 60)
            } else 0.0

            // Registrar cancelamento (Issue #39)
            val cancellation = GameCancellation(
                gameId = gameId,
                userId = user.id,
                userName = user.name,
                reason = reason.name,
                reasonText = if (reason == CancellationReason.OTHER) reasonText else null,
                cancelledAtRaw = Date(),
                hoursBeforeGame = hoursBeforeGame
            )

            // Salvar cancelamento
            saveCancellation(gameId, cancellation)

            // Cancelar confirmacao
            val cancelResult = gameRepository.cancelConfirmation(gameId)
            if (cancelResult.isFailure) {
                return cancelResult
            }

            // Notificar proximo da fila (Issue #33)
            val nextResult = waitlistRepository.notifyNextInLine(
                gameId,
                game.waitlistAutoPromoteMinutes
            )

            val nextInLine = nextResult.getOrNull()
            if (nextInLine != null) {
                // Criar notificacao in-app sobre vaga disponivel
                val notification = com.futebadosparcas.domain.model.AppNotification(
                    userId = nextInLine.userId,
                    type = com.futebadosparcas.domain.model.NotificationType.GAME_VACANCY,
                    title = "Vaga Disponível!",
                    message = "Uma vaga abriu para o jogo ${game.date} às ${game.time} em ${game.locationName}. Você tem ${game.waitlistAutoPromoteMinutes} minutos para confirmar.",
                    referenceId = gameId,
                    referenceType = "game",
                    actionType = com.futebadosparcas.domain.model.NotificationAction.CONFIRM_POSITION,
                    createdAt = System.currentTimeMillis(),
                    expiresAt = System.currentTimeMillis() + (game.waitlistAutoPromoteMinutes * 60 * 1000L)
                )
                notificationRepository.createNotification(notification)

                AppLogger.i(TAG) { "Notificado ${nextInLine.userName} sobre vaga no jogo $gameId" }
            }

            // Atualizar taxa de presenca (Issue #37)
            updateAttendanceRate(user.id)

            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao cancelar presenca", e)
            Result.failure(e)
        }
    }

    // ========== ISSUE #35 - On My Way Status ==========

    /**
     * Marca o jogador como "A caminho" do jogo.
     *
     * @param gameId ID do jogo
     * @param etaMinutes Tempo estimado de chegada em minutos
     * @return Resultado de sucesso
     */
    suspend fun markOnTheWay(gameId: String, etaMinutes: Int?): Result<Unit> {
        return try {
            val user = userRepository.getCurrentUser().getOrNull()
                ?: return Result.failure(Exception("Usuario nao autenticado"))

            val updates = mapOf(
                "is_on_the_way" to true,
                "eta_minutes" to etaMinutes,
                "on_the_way_at" to Date()
            )

            firestore.collection("games")
                .document(gameId)
                .collection("confirmations")
                .whereEqualTo("user_id", user.id)
                .get()
                .await()
                .documents
                .firstOrNull()
                ?.reference
                ?.update(updates)
                ?.await()

            AppLogger.i(TAG) { "Usuario ${user.id} marcado como 'a caminho' do jogo $gameId" }

            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao marcar 'a caminho'", e)
            Result.failure(e)
        }
    }

    /**
     * Atualiza o ETA do jogador.
     *
     * @param gameId ID do jogo
     * @param etaMinutes Novo tempo estimado
     * @return Resultado de sucesso
     */
    suspend fun updateEta(gameId: String, etaMinutes: Int): Result<Unit> {
        return try {
            val user = userRepository.getCurrentUser().getOrNull()
                ?: return Result.failure(Exception("Usuario nao autenticado"))

            firestore.collection("games")
                .document(gameId)
                .collection("confirmations")
                .whereEqualTo("user_id", user.id)
                .get()
                .await()
                .documents
                .firstOrNull()
                ?.reference
                ?.update("eta_minutes", etaMinutes)
                ?.await()

            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao atualizar ETA", e)
            Result.failure(e)
        }
    }

    // ========== ISSUE #36 - Location Check-in ==========

    /**
     * Realiza check-in por GPS no local do jogo.
     *
     * @param gameId ID do jogo
     * @param userLocation Localizacao atual do usuario
     * @return Resultado do check-in
     */
    suspend fun checkIn(gameId: String, userLocation: Location): Result<CheckInResult> {
        return try {
            val user = userRepository.getCurrentUser().getOrNull()
                ?: return Result.failure(Exception("Usuario nao autenticado"))

            val gameResult = gameRepository.getGameDetails(gameId)
            val game = gameResult.getOrNull()
                ?: return Result.failure(Exception("Jogo nao encontrado"))

            // Verificar se o jogo tem coordenadas
            val gameLat = game.locationLat
            val gameLng = game.locationLng

            if (gameLat == null || gameLng == null) {
                return Result.success(
                    CheckInResult(
                        success = false,
                        errorMessage = "Local do jogo nao possui coordenadas"
                    )
                )
            }

            // Calcular distancia
            val gameLocation = Location("game").apply {
                latitude = gameLat
                longitude = gameLng
            }

            val distance = userLocation.distanceTo(gameLocation)
            val maxRadius = game.checkinRadiusMeters.takeIf { it > 0 } ?: DEFAULT_CHECKIN_RADIUS_METERS

            if (distance > maxRadius) {
                return Result.success(
                    CheckInResult(
                        success = false,
                        distance = distance,
                        maxRadius = maxRadius.toFloat(),
                        errorMessage = "Voce esta muito longe do local (${distance.toInt()}m)"
                    )
                )
            }

            // Realizar check-in
            val updates = mapOf(
                "checked_in" to true,
                "checked_in_at" to Date(),
                "is_on_the_way" to false,
                "was_present" to true
            )

            firestore.collection("games")
                .document(gameId)
                .collection("confirmations")
                .whereEqualTo("user_id", user.id)
                .get()
                .await()
                .documents
                .firstOrNull()
                ?.reference
                ?.update(updates)
                ?.await()

            AppLogger.i(TAG) { "Check-in realizado para usuario ${user.id} no jogo $gameId (distancia: ${distance.toInt()}m)" }

            Result.success(
                CheckInResult(
                    success = true,
                    distance = distance,
                    maxRadius = maxRadius.toFloat()
                )
            )
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao realizar check-in", e)
            Result.failure(e)
        }
    }

    // ========== ISSUE #37 - Absence History ==========

    /**
     * Busca o historico de presenca de um jogador.
     *
     * @param userId ID do usuario
     * @return Dados de presenca
     */
    suspend fun getAttendanceHistory(userId: String): Result<PlayerAttendance> {
        return try {
            val doc = firestore.collection("users")
                .document(userId)
                .get()
                .await()

            val attendance = doc.toObject(PlayerAttendance::class.java)
                ?: PlayerAttendance(userId = userId)

            Result.success(attendance)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar historico de presenca", e)
            Result.failure(e)
        }
    }

    /**
     * Atualiza a taxa de presenca de um usuario.
     */
    private suspend fun updateAttendanceRate(userId: String) {
        try {
            // Buscar ultimos 90 dias de confirmacoes
            val threeMonthsAgo = Date(System.currentTimeMillis() - 90L * 24 * 60 * 60 * 1000)

            // Buscar confirmacoes
            val confirmations = firestore.collectionGroup("confirmations")
                .whereEqualTo("user_id", userId)
                .whereGreaterThan("confirmed_at", threeMonthsAgo)
                .get()
                .await()
                .documents
                .mapNotNull { it.toObject(GameConfirmation::class.java) }

            // Buscar cancelamentos
            val cancellations = firestore.collectionGroup("cancellations")
                .whereEqualTo("user_id", userId)
                .whereGreaterThan("cancelled_at", threeMonthsAgo)
                .get()
                .await()
                .documents
                .mapNotNull { it.toObject(GameCancellation::class.java) }

            val attendance = PlayerAttendance.calculate(userId, confirmations, cancellations)

            // Salvar no documento do usuario
            firestore.collection("users")
                .document(userId)
                .update(
                    mapOf(
                        "attendance_rate" to attendance.attendanceRate,
                        "total_confirmed" to attendance.totalConfirmed,
                        "total_attended" to attendance.totalAttended,
                        "total_cancelled" to attendance.totalCancelled,
                        "last_minute_cancellations" to attendance.lastMinuteCancellations
                    )
                )
                .await()

            AppLogger.i(TAG) { "Taxa de presenca atualizada para usuario $userId: ${attendance.attendanceRate}" }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao atualizar taxa de presenca", e)
        }
    }

    // ========== ISSUE #40 - Order by Confirmation Time ==========

    /**
     * Atualiza a ordem de confirmacao de um jogador.
     */
    private suspend fun updateConfirmationOrder(gameId: String, userId: String, order: Int) {
        try {
            firestore.collection("games")
                .document(gameId)
                .collection("confirmations")
                .whereEqualTo("user_id", userId)
                .get()
                .await()
                .documents
                .firstOrNull()
                ?.reference
                ?.update("confirmation_order", order)
                ?.await()
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao atualizar ordem de confirmacao", e)
        }
    }

    /**
     * Salva o registro de cancelamento.
     */
    private suspend fun saveCancellation(gameId: String, cancellation: GameCancellation) {
        try {
            firestore.collection("games")
                .document(gameId)
                .collection("cancellations")
                .add(cancellation)
                .await()
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao salvar cancelamento", e)
        }
    }
}

/**
 * Resultado da verificacao de confirmacao.
 */
data class ConfirmationCheck(
    val canConfirm: Boolean,
    val deadline: Date? = null,
    val timeRemainingMs: Long = 0
) {
    /**
     * Formata o tempo restante para exibicao.
     */
    fun getTimeRemainingDisplay(): String {
        if (timeRemainingMs <= 0) return "Encerrado"

        val minutes = timeRemainingMs / (1000 * 60)
        val hours = minutes / 60
        val remainingMinutes = minutes % 60

        return when {
            hours > 0 -> "${hours}h ${remainingMinutes}min"
            else -> "${remainingMinutes}min"
        }
    }
}

/**
 * Resultado da confirmacao de presenca.
 */
data class ConfirmationResult(
    val success: Boolean,
    val confirmation: GameConfirmation? = null,
    val addedToWaitlist: Boolean = false,
    val waitlistPosition: Int = 0,
    val confirmationOrder: Int = 0,
    val errorMessage: String? = null
)

/**
 * Resultado do check-in.
 */
data class CheckInResult(
    val success: Boolean,
    val distance: Float = 0f,
    val maxRadius: Float = 0f,
    val errorMessage: String? = null
)
