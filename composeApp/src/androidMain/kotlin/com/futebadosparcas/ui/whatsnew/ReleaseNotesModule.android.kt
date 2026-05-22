package com.futebadosparcas.ui.whatsnew

import com.futebadosparcas.domain.repository.ReleaseNotesRepository
import org.koin.core.module.Module
import org.koin.core.module.dsl.viewModel
import org.koin.dsl.module

/** Plataforma desta nota. */
private const val PLATFORM_ANDROID = "android"

/**
 * Stub Android — o target Android do `composeApp` é apenas harness de build.
 *
 * O app Android real (`:app`) já tem a feature "Novidades" completa (Fase E),
 * com a fiação real do `LastSeenVersionStore` (que precisa de `Context`). Aqui
 * só registramos um repositório vazio e o use case nulo, mantendo o target
 * compilando sem `koin-android`.
 */
actual fun releaseNotesModule(): Module = module {
    single<ReleaseNotesRepository> { EmptyReleaseNotesRepository() }
    viewModel {
        WhatsNewViewModel(
            repository = get(),
            getUnseenReleaseNotes = null,
            currentBuild = 0,
            platform = PLATFORM_ANDROID,
        )
    }
}
