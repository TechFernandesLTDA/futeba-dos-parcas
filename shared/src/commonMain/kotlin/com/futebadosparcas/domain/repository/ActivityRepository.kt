package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.Activity
import kotlinx.coroutines.flow.Flow

/**
 * Interface de repositorio de atividades do usuario.
 * Implementacoes especificas de plataforma em androidMain/iosMain.
 */
interface ActivityRepository {
    /**
     * Busca atividades recentes publicas.
     * @param limit Numero maximo de atividades a retornar
     * @return Result com lista de atividades ou erro
     */
    suspend fun getRecentActivities(limit: Int = 20): Result<List<Activity>>

    /**
     * Flow que emite atividades recentes publicas em tempo real.
     * @param limit Numero maximo de atividades a retornar
     * @return Flow que emite listas de atividades
     */
    fun getRecentActivitiesFlow(limit: Int = 20): Flow<List<Activity>>

    /**
     * Cria uma nova atividade no Firestore.
     * @param activity Atividade a ser criada
     * @return Result indicando sucesso ou falha
     */
    suspend fun createActivity(activity: Activity): Result<Unit>

    /**
     * Busca atividades de um usuario especifico.
     * @param userId ID do usuario
     * @param limit Numero maximo de atividades a retornar
     * @return Result com lista de atividades do usuario ou erro
     */
    suspend fun getUserActivities(userId: String, limit: Int = 20): Result<List<Activity>>
}
