package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.Schedule
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ScheduleRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore
) : ScheduleRepository {

    private val schedulesCollection = firestore.collection("schedules")

    override fun getSchedules(ownerId: String): Flow<Result<List<Schedule>>> = callbackFlow {
        val subscription = schedulesCollection
            .whereEqualTo("owner_id", ownerId)
            .orderBy("created_at", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val schedules = snapshot.toObjects(Schedule::class.java)
                    trySend(Result.success(schedules))
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
