package com.futebadosparcas.domain.ranking

import com.futebadosparcas.data.model.*
import com.futebadosparcas.domain.model.AppNotification as DomainAppNotification
import com.futebadosparcas.domain.model.NotificationAction
import com.futebadosparcas.domain.model.NotificationType
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.tasks.await
import java.util.Date
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SeasonClosureService @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val notificationRepository: NotificationRepository
) {

    companion object {
        private const val TAG = "SeasonClosureService"
        private const val COLLECTION_SEASONS = "seasons"
        private const val COLLECTION_SEASON_PARTICIPATION = "season_participation"
        private const val COLLECTION_FINAL_STANDINGS = "season_final_standings"
    }

    /**
     * Encerra uma temporada e processa os resultados finais.
     * Deve ser chamado por uma Cloud Function ou Admin Action.
     */
    suspend fun closeSeason(seasonId: String): Result<Unit> {
        return try {
            AppLogger.d(TAG) { "Iniciando encerramento da temporada $seasonId" }

            val seasonRef = firestore.collection(COLLECTION_SEASONS).document(seasonId)
            val seasonDoc = seasonRef.get().await()

            if (!seasonDoc.exists()) {
                return Result.failure(Exception("Temporada $seasonId não encontrada"))
            }

            val season = seasonDoc.toObject(Season::class.java)
            if (season?.isActive == false) {
                AppLogger.w(TAG) { "Temporada $seasonId já está encerrada." }
                return Result.success(Unit)
            }

            // 1. Marcar temporada como inativa
            seasonRef.update(mapOf(
                "is_active" to false,
                "closed_at" to Date()
            )).await()

            // 2. Processar participações e criar standings finais
            val participationsSnapshot = firestore.collection(COLLECTION_SEASON_PARTICIPATION)
                .whereEqualTo("season_id", seasonId)
                .get()
                .await()

            val participations = participationsSnapshot.toObjects(SeasonParticipationV2::class.java)
            val notifications = mutableListOf<DomainAppNotification>()

            val batch = firestore.batch()
            var batchCount = 0

            for (participation in participations) {
                // Criar registro final congelado
                val finalStanding = SeasonFinalStanding(
                    id = "${seasonId}_${participation.userId}",
                    seasonId = seasonId,
                    userId = participation.userId,
                    finalDivision = participation.division,
                    finalRating = participation.leagueRating,
                    points = participation.points,
                    wins = participation.wins,
                    draws = participation.draws,
                    losses = participation.losses,
                    frozenAt = Date()
                )

                val standingRef = firestore.collection(COLLECTION_FINAL_STANDINGS).document(finalStanding.id)
                batch.set(standingRef, finalStanding, SetOptions.merge())

                // Preparar notificação
                notifications.add(
                    DomainAppNotification(
                        userId = participation.userId,
                        title = "Temporada Encerrada!",
                        message = "A temporada ${season?.name ?: ""} chegou ao fim. Confira sua classificação final!",
                        type = NotificationType.SYSTEM,
                        read = false,
                        createdAt = System.currentTimeMillis()
                    )
                )

                batchCount++
                if (batchCount >= 400) { // Limite do batch é 500
                    batch.commit().await()
                    batchCount = 0
                }
            }

             if (batchCount > 0) {
                batch.commit().await()
            }

            // 3. Enviar notificações em massa
            if (notifications.isNotEmpty()) {
                // Batch create notifications logic inside NotificationRepository can be reused 
                // but we can also just use batch here or call repo method.
                // Repo method 'batchCreateNotifications' exists.
                val notificationBatches = notifications.chunked(400)
                for (chunk in notificationBatches) {
                    notificationRepository.batchCreateNotifications(chunk)
                }
            }

            AppLogger.d(TAG) { "Temporada $seasonId encerrada com sucesso. ${participations.size} registros processados." }
            Result.success(Unit)

        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao encerrar temporada $seasonId", e)
            Result.failure(e)
        }
    }
}
