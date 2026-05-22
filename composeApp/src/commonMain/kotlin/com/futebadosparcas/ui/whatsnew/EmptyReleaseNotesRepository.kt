package com.futebadosparcas.ui.whatsnew

import com.futebadosparcas.domain.model.ReleaseNote
import com.futebadosparcas.domain.repository.ReleaseNotesRepository

/**
 * [ReleaseNotesRepository] vazio para targets não-shipping do `composeApp`.
 *
 * O alvo real desta UI é o iOS (ver [releaseNotesModule] em `iosMain`). Os
 * targets Android e wasmJs do `composeApp` são apenas harness de build —
 * `ReleaseNotesRepositoryImpl` vive em `shared/nativeAndAndroidMain` e nem
 * existe no wasmJs, e o app Android real (`:app`) já tem a feature completa.
 * Este stub mantém esses targets compilando sem uma fonte de notas.
 */
class EmptyReleaseNotesRepository : ReleaseNotesRepository {
    override suspend fun getReleaseNotes(
        platform: String,
        sinceBuild: Int,
    ): Result<List<ReleaseNote>> = Result.success(emptyList())
}
