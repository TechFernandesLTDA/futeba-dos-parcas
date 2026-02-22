package com.futebadosparcas.data

import com.futebadosparcas.domain.model.Schedule
import com.futebadosparcas.domain.repository.ScheduleRepository
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/**
 * Implementacao Android do ScheduleRepository.
 * Usa Firebase Firestore para gerenciar horarios recorrentes.
 */
class ScheduleRepositoryImpl constructor(
    private val firestore: FirebaseFirestore
) : ScheduleRepository {

    private val schedulesCollection = firestore.collection("schedules")

    override fun getSchedules(ownerId: String): Flow<Result<List<Schedule>>> = callbackFlow {
        // P1 #12: Limit 50 - maximo realista de horarios por dono
        val subscription = schedulesCollection
            .whereEqualTo("owner_id", ownerId)
            .orderBy("created_at", Query.Direction.DESCENDING)
            .limit(50)
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
                    val kmpSchedules = snapshot.toObjects(Schedule::class.java)
                    val fromCache = snapshot.metadata.isFromCache
                    AppLogger.d("ScheduleRepo") { "Loaded ${kmpSchedules.size} schedules for owner: $ownerId (fromCache: $fromCache)" }
                    trySend(Result.success(kmpSchedules))
                }
            }
        awaitClose { subscription.remove() }
    }

    override suspend fun createSchedule(schedule: Schedule): Result<String> {
        return try {
            val docRef = schedulesCollection.add(schedule).await()
            Result.success(docRef.id)
        } catch (e: Exception) {
            AppLogger.e("ScheduleRepo", "Error creating schedule", e)
            Result.failure(e)
        }
    }

    override suspend fun updateSchedule(schedule: Schedule): Result<Unit> {
        return try {
            schedulesCollection.document(schedule.id).set(schedule).await()
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

    override suspend fun getScheduleById(scheduleId: String): Result<Schedule> {
        return try {
            val snapshot = schedulesCollection.document(scheduleId).get().await()
            val schedule = snapshot.toObject(Schedule::class.java)
            if (schedule != null) {
                Result.success(schedule)
            } else {
                Result.failure(Exception("Schedule not found"))
            }
        } catch (e: Exception) {
            AppLogger.e("ScheduleRepo", "Error getting schedule by id", e)
            Result.failure(e)
        }
    }
}
