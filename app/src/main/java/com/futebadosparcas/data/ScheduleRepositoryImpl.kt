package com.futebadosparcas.data

import com.futebadosparcas.data.model.Schedule as AndroidSchedule
import com.futebadosparcas.util.toAndroidSchedule
import com.futebadosparcas.util.toKmpSchedule
import com.futebadosparcas.domain.repository.ScheduleRepository
import com.futebadosparcas.domain.model.Schedule as KmpSchedule
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Implementacao Android do ScheduleRepository.
 * Usa Firebase Firestore para gerenciar horarios recorrentes.
 */
@Singleton
class ScheduleRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore
) : ScheduleRepository {

    private val schedulesCollection = firestore.collection("schedules")

    override fun getSchedules(ownerId: String): Flow<Result<List<KmpSchedule>>> = callbackFlow {
        val subscription = schedulesCollection
            .whereEqualTo("owner_id", ownerId)
            .orderBy("created_at", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e("ScheduleRepo", "Error loading schedules for owner: $ownerId", error)
                    val errorMessage = if (error.message?.contains("index") == true ||
                        error.message?.contains("Index") == true) {
                        "Indice Firestore nao configurado. Contate o suporte."
                    } else {
                        error.message ?: "Erro ao carregar horarios"
                    }
                    trySend(Result.failure(Exception(errorMessage, error)))
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val androidSchedules = snapshot.toObjects(AndroidSchedule::class.java)
                    val kmpSchedules = androidSchedules.map { it.toKmpSchedule() }
                    val fromCache = snapshot.metadata.isFromCache
                    AppLogger.d("ScheduleRepo") { "Loaded ${kmpSchedules.size} schedules for owner: $ownerId (fromCache: $fromCache)" }
                    trySend(Result.success(kmpSchedules))
                }
            }
        awaitClose { subscription.remove() }
    }

    override suspend fun createSchedule(schedule: KmpSchedule): Result<String> {
        return try {
            val androidSchedule = schedule.toAndroidSchedule()
            val docRef = schedulesCollection.add(androidSchedule).await()
            Result.success(docRef.id)
        } catch (e: Exception) {
            AppLogger.e("ScheduleRepo", "Error creating schedule", e)
            Result.failure(e)
        }
    }

    override suspend fun updateSchedule(schedule: KmpSchedule): Result<Unit> {
        return try {
            val androidSchedule = schedule.toAndroidSchedule()
            schedulesCollection.document(schedule.id).set(androidSchedule).await()
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e("ScheduleRepo", "Error updating schedule", e)
            Result.failure(e)
        }
    }

    override suspend fun deleteSchedule(scheduleId: String): Result<Unit> {
        return try {
            schedulesCollection.document(scheduleId).delete().await()
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e("ScheduleRepo", "Error deleting schedule", e)
            Result.failure(e)
        }
    }

    override suspend fun getScheduleById(scheduleId: String): Result<KmpSchedule> {
        return try {
            val snapshot = schedulesCollection.document(scheduleId).get().await()
            val androidSchedule = snapshot.toObject(AndroidSchedule::class.java)
            if (androidSchedule != null) {
                Result.success(androidSchedule.toKmpSchedule())
            } else {
                Result.failure(Exception("Schedule not found"))
            }
        } catch (e: Exception) {
            AppLogger.e("ScheduleRepo", "Error getting schedule by id", e)
            Result.failure(e)
        }
    }
}
