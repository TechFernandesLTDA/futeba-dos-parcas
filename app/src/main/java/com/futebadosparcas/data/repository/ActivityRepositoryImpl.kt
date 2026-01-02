package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.Activity
import com.futebadosparcas.data.model.ActivityVisibility
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
class ActivityRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore
) : ActivityRepository {

    private val activitiesCollection = firestore.collection("activities")

    override suspend fun getRecentActivities(limit: Int): Result<List<Activity>> {
        return try {
            val snapshot = activitiesCollection
                .whereEqualTo("visibility", ActivityVisibility.PUBLIC.name)
                .orderBy("created_at", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val activities = snapshot.toObjects(Activity::class.java)
            Result.success(activities)
        } catch (e: Exception) {
            AppLogger.e("ActivityRepo", "Error fetching activities", e)
            Result.failure(e)
        }
    }

    override fun getRecentActivitiesFlow(limit: Int): Flow<List<Activity>> = callbackFlow {
        val listener = activitiesCollection
            .whereEqualTo("visibility", ActivityVisibility.PUBLIC.name)
            .orderBy("created_at", Query.Direction.DESCENDING)
            .limit(limit.toLong())
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e("ActivityRepo", "Listen failed", error)
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val activities = snapshot.toObjects(Activity::class.java)
                    trySend(activities)
                }
            }

        awaitClose { listener.remove() }
    }

    override suspend fun createActivity(activity: Activity): Result<Unit> {
        return try {
            activitiesCollection.add(activity).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getUserActivities(userId: String, limit: Int): Result<List<Activity>> {
        return try {
            val snapshot = activitiesCollection
                .whereEqualTo("user_id", userId)
                .orderBy("created_at", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()
            
            val activities = snapshot.toObjects(Activity::class.java)
            Result.success(activities)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
