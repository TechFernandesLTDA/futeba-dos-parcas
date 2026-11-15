package com.futebadosparcas.domain.usecase.season

import com.futebadosparcas.data.model.Season
import com.futebadosparcas.domain.usecase.SuspendNoParamsUseCase
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import com.futebadosparcas.data.util.toObjectTolerant

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
class GetActiveSeasonUseCase constructor(
    private val firestore: FirebaseFirestore
) : SuspendNoParamsUseCase<Season?>() {

    override suspend fun execute(): Season? {
        val snapshot = firestore.collection("seasons")
            .whereEqualTo("is_active", true)
            .limit(1)
            .get()
            .await()

        return snapshot.documents.firstOrNull()?.toObjectTolerant(Season::class.java)
    }
}
