package com.futebadosparcas.domain.gamification

import com.futebadosparcas.data.model.LeagueDivision
import com.futebadosparcas.data.model.Season
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Classe responsável por garantir que as temporadas existam e estejam ativas.
 * Funciona como um processo "vivo" dentro do app.
 */
@Singleton
class SeasonGuardian @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val seasonClosureService: com.futebadosparcas.domain.ranking.SeasonClosureService
) {
    companion object {
        private const val TAG = "SeasonGuardian"
        private const val COLLECTION_SEASONS = "seasons"
    }

    /**
     * Verifica e inicializa as temporadas atuais se necessário.
     * Deve ser chamado por um Administrador ao abrir o app.
     */
    suspend fun guardSeasons(): Result<Unit> {
        return try {
            val now = Calendar.getInstance()
            val currentYear = now.get(Calendar.YEAR)
            val currentMonth = now.get(Calendar.MONTH) + 1
            
            val monthSdf = SimpleDateFormat("MMMM", Locale("pt", "BR"))
            val monthName = monthSdf.format(now.time).replaceFirstChar { it.uppercase() }

            // 1. Garantir Temporada Mensal
            val monthId = "monthly_${currentYear}_${currentMonth.toString().padStart(2, '0')}"
            ensureSeason(
                id = monthId,
                name = "Liga Mensal - $monthName / $currentYear",
                startDate = getMonthStart(now),
                endDate = getMonthEnd(now),
                type = "MONTHLY"
            )

            // 2. Garantir Temporada Anual
            val yearId = "annual_$currentYear"
            ensureSeason(
                id = yearId,
                name = "Liga Anual - $currentYear",
                startDate = "$currentYear-01-01",
                endDate = "$currentYear-12-31",
                type = "ANNUAL"
            )

            // 3. Encerrar temporadas passadas que ainda constam como ativas
            closePastSeasons(now)

            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao proteger temporadas", e)
            Result.failure(e)
        }
    }

    private suspend fun ensureSeason(
        id: String,
        name: String,
        startDate: String,
        endDate: String,
        type: String
    ) {
        val docRef = firestore.collection(COLLECTION_SEASONS).document(id)
        val doc = docRef.get().await()

        if (!doc.exists()) {
            AppLogger.d(TAG) { "Criando temporada $type: $name" }
            val season = mapOf(
                "name" to name,
                "start_date" to startDate,
                "end_date" to endDate,
                "is_active" to true,
                "type" to type,
                "created_at" to com.google.firebase.Timestamp.now()
            )
            docRef.set(season).await()
        } else if (doc.getBoolean("is_active") != true) {
            // Se existe mas está inativa (e deveria estar ativa por ser o mês/ano atual)
            AppLogger.d(TAG) { "Reativando temporada $type: $name" }
            docRef.update("is_active", true).await()
        }
    }

    private fun getMonthStart(cal: Calendar): String {
        val temp = cal.clone() as Calendar
        temp.set(Calendar.DAY_OF_MONTH, 1)
        return SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(temp.time)
    }

    private fun getMonthEnd(cal: Calendar): String {
        val temp = cal.clone() as Calendar
        temp.set(Calendar.DAY_OF_MONTH, temp.getActualMaximum(Calendar.DAY_OF_MONTH))
        return SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(temp.time)
    }


    private suspend fun closePastSeasons(currentDate: Calendar) {
        try {
            val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(currentDate.time)
            
            val snapshot = firestore.collection(COLLECTION_SEASONS)
                .whereEqualTo("is_active", true)
                .whereLessThan("end_date", todayStr)
                .get()
                .await()

            if (!snapshot.isEmpty) {
                AppLogger.i(TAG) { "Encontradas ${snapshot.size()} temporadas expiradas para encerrar." }
                for (doc in snapshot.documents) {
                    seasonClosureService.closeSeason(doc.id)
                }
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao tentar fechar temporadas passadas", e)
        }
    }
}
