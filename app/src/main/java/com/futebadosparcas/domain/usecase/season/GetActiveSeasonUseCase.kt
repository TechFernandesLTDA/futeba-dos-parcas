package com.futebadosparcas.domain.usecase.season

import com.futebadosparcas.data.model.Season
import com.futebadosparcas.domain.usecase.SuspendNoParamsUseCase
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

/**
 * Get Active Season Use Case
 *
 * Busca a temporada ativa atual.
 *
 * Uso:
 * ```kotlin
 * val result = getActiveSeasonUseCase()
 *
 * result.fold(
 *     onSuccess = { season -> println("Temporada: ${season?.name}") },
 *     onFailure = { error -> println("Erro: ${error.message}") }
 * )
 * ```
 */
class GetActiveSeasonUseCase @Inject constructor(
    private val firestore: FirebaseFirestore
) : SuspendNoParamsUseCase<Season?>() {

    override suspend fun execute(): Season? {
        val snapshot = firestore.collection("seasons")
            .whereEqualTo("is_active", true)
            .limit(1)
            .get()
            .await()

        return snapshot.documents.firstOrNull()?.toObject(Season::class.java)
    }
}
