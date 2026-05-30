package com.futebadosparcas.domain.usecase

import android.location.Location
import com.futebadosparcas.domain.model.CancellationReason
import com.futebadosparcas.domain.model.ConfirmationStatus
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.GameCancellation
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.GameWaitlist
import com.futebadosparcas.domain.model.PlayerAttendance
import com.futebadosparcas.domain.model.WaitlistStatus
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.WaitlistRepository
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
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
    private val firestore: FirebaseFirestore,
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance("southamerica-east1")
) {

    companion object {
        private const val TAG = "ConfirmationUseCase"

        const val CHECK_IN_RADIUS_METERS = 200

        const val CHECK_IN_MAX_GPS_ACCURACY_METERS = 100f

        @Deprecated("Use CHECK_IN_RADIUS_METERS", ReplaceWith("CHECK_IN_RADIUS_METERS"))
        const val DEFAULT_CHECKIN_RADIUS_METERS = CHECK_IN_RADIUS_METERS

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
            // STUB(#2294): getConfirmationDeadline() foi removido do modelo Game.
            // Deadline de confirmação deve ser lido das configurações do Group
            // (ex: group.confirmationDeadlineHours). Até implementação completa,
            // permite confirmação sempre.
            Result.success(ConfirmationCheck(canConfirm = true, timeRemainingMs = 0L))
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

            // STUB(#2294): isConfirmationDeadlinePassed() e isFull() foram removidos do modelo Game.
            // Lógica de deadline implementada manualmente abaixo via playersCount/maxPlayers.
            val totalPlayers = game.playersCount + game.goalkeepersCount
            val maxTotal = game.maxPlayers + game.maxGoalkeepers

            // Verificar se jogo esta lotado
            if (totalPlayers >= maxTotal) {
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

            // Calcular horas antes do jogo reconstruindo o timestamp a partir
            // de date+time (o modelo KMP Game expõe essas strings). #2294
            val gameStartMillis = parseGameStartMillis(game.date, game.time)
            val hoursBeforeGame = if (gameStartMillis != null) {
                ((gameStartMillis - System.currentTimeMillis()) / 3_600_000.0)
                    .coerceAtLeast(0.0)
            } else {
                0.0
            }

            // Registrar cancelamento (Issue #39)
            val cancellation = GameCancellation(
                gameId = gameId,
                userId = user.id,
                userName = user.name,
                reason = reason.name,
                reasonText = if (reason == CancellationReason.OTHER) reasonText else null,
                cancelledAt = System.currentTimeMillis(),
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
            // waitlistAutoPromoteMinutes esta no Group, nao no Game. Usando valor padrao.
            val nextResult = waitlistRepository.notifyNextInLine(
                gameId,
                30 // default: 30 minutos
            )

            val nextInLine = nextResult.getOrNull()
            if (nextInLine != null) {
                // Criar notificacao in-app sobre vaga disponivel
                // Use default 30 minutos para promoção da waitlist (propriedade foi removida do Game)
                val autoPromoteMinutes = 30
                val notification = com.futebadosparcas.domain.model.AppNotification(
                    userId = nextInLine.userId,
                    type = com.futebadosparcas.domain.model.NotificationType.GAME_VACANCY,
                    title = "Vaga Disponível!",
                    message = "Uma vaga abriu para o jogo ${game.date} às ${game.time} em ${game.locationName}. Você tem $autoPromoteMinutes minutos para confirmar.",
                    referenceId = gameId,
                    referenceType = "game",
                    actionType = com.futebadosparcas.domain.model.NotificationAction.CONFIRM_POSITION,
                    createdAt = System.currentTimeMillis(),
                    expiresAt = System.currentTimeMillis() + (autoPromoteMinutes * 60 * 1000L)
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
            if (isMockLocation(userLocation)) {
                AppLogger.w(TAG) { "Mock GPS detected - blocking check-in" }
                return Result.failure(Exception("Localizacao mock detectada. Desative GPS simulado."))
            }

            if (userLocation.accuracy > CHECK_IN_MAX_GPS_ACCURACY_METERS) {
                return Result.failure(
                    Exception("Precisao GPS insuficiente (${userLocation.accuracy.toInt()}m). Maximo ${CHECK_IN_MAX_GPS_ACCURACY_METERS.toInt()}m.")
                )
            }

            val data = hashMapOf(
                "gameId" to gameId,
                "lat" to userLocation.latitude,
                "lng" to userLocation.longitude,
                "accuracy" to userLocation.accuracy.toDouble()
            )

            val result = functions
                .getHttpsCallable("checkInToGame")
                .call(data)
                .await()

            @Suppress("UNCHECKED_CAST")
            val resultMap = result.data as? Map<String, Any>

            val distance = (resultMap?.get("distance_m") as? Number)?.toFloat() ?: 0f

            AppLogger.i(TAG) { "Check-in via Cloud Function para jogo $gameId (distancia: ${distance.toInt()}m)" }

            Result.success(
                CheckInResult(
                    success = true,
                    distance = distance,
                    maxRadius = CHECK_IN_RADIUS_METERS.toFloat()
                )
            )
        } catch (e: com.google.firebase.functions.FirebaseFunctionsException) {
            AppLogger.e(TAG, "Cloud Function check-in falhou", e)
            Result.failure(Exception(e.message ?: "Erro no check-in"))
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao realizar check-in", e)
            Result.failure(e)
        }
    }

    private fun isMockLocation(location: Location): Boolean {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            location.isMock
        } else {
            @Suppress("DEPRECATION")
            location.isFromMockProvider
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

            // STUB(#2294): PlayerAttendance.calculate() não existe no modelo KMP.
            // Cálculo feito manualmente a partir das confirmações e cancelamentos do Firestore.
            val totalConfirmed = confirmations.size
            val totalAttended = confirmations.count { it.wasPresent == true }
            val totalCancelled = cancellations.size
            val lastMinuteCancellations = cancellations.count { it.hoursBeforeGame <= 24.0 }
            val attendanceRate = if (totalConfirmed > 0) {
                totalAttended.toDouble() / totalConfirmed.toDouble()
            } else 1.0

            val attendance = PlayerAttendance(
                userId = userId,
                totalConfirmed = totalConfirmed,
                totalAttended = totalAttended,
                totalCancelled = totalCancelled,
                lastMinuteCancellations = lastMinuteCancellations,
                attendanceRate = attendanceRate,
                lastUpdated = System.currentTimeMillis()
            )

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

    /**
     * Reconstrói o timestamp (millis) de início do jogo a partir das strings
     * date ("yyyy-MM-dd") e time ("HH:mm") do modelo KMP Game. #2294
     * Retorna null se o parse falhar (formato inesperado/vazio).
     */
    private fun parseGameStartMillis(date: String, time: String): Long? {
        if (date.isBlank() || time.isBlank()) return null
        return try {
            val sdf = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm", java.util.Locale.US)
            sdf.parse("$date $time")?.time
        } catch (e: Exception) {
            null
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
