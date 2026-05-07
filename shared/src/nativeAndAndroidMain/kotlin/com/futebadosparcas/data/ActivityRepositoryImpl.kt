package com.futebadosparcas.data

import com.futebadosparcas.domain.model.Activity
import com.futebadosparcas.domain.model.ActivityVisibility
import com.futebadosparcas.domain.repository.ActivityRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.logging.PlatformLogger
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map

/**
 * Implementação Android do ActivityRepository.
 *
 * Este repositório gerencia atividades dos usuários no Firestore.
 */
class ActivityRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource
) : ActivityRepository {

    companion object {
        private const val TAG = "ActivityRepository"
    }

    override suspend fun getRecentActivities(limit: Int): Result<List<Activity>> {
        return try {
            PlatformLogger.d(TAG, "Buscando atividades recentes (limit=$limit)")
            firebaseDataSource.getRecentActivities(limit)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar atividades recentes", e)
            Result.failure(e)
        }
    }

    override fun getRecentActivitiesFlow(limit: Int): Flow<List<Activity>> {
        return firebaseDataSource.getRecentActivitiesFlow(limit)
            .map { result -> result.getOrNull() ?: emptyList() }
            .catch { emit(emptyList()) }
    }

    override suspend fun createActivity(activity: Activity): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Criando atividade: ${activity.title}")
            firebaseDataSource.createActivity(activity)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao criar atividade", e)
            Result.failure(e)
        }
    }

    override suspend fun getUserActivities(userId: String, limit: Int): Result<List<Activity>> {
        return try {
            PlatformLogger.d(TAG, "Buscando atividades do usuário: $userId (limit=$limit)")
            firebaseDataSource.getUserActivities(userId, limit)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar atividades do usuário", e)
            Result.failure(e)
        }
    }
}
