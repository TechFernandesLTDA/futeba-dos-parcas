package com.futebadosparcas.ui.whatsnew

import com.futebadosparcas.domain.repository.ReleaseNotesRepository
import org.koin.core.module.Module
import org.koin.core.module.dsl.viewModel
import org.koin.dsl.module

/** Plataforma desta nota. */
private const val PLATFORM_WEB = "web"

/**
 * Stub wasmJs — o target wasmJs do `composeApp` é infraestrutura CMP (Fase 0),
 * não-shipping. `ReleaseNotesRepositoryImpl` vive em `shared/nativeAndAndroidMain`
 * e não existe no wasmJs; a Web real é o app React em `web/` (Fase F). Aqui só
 * registramos um repositório vazio para o target compilar.
 */
actual fun releaseNotesModule(): Module = module {
    single<ReleaseNotesRepository> { EmptyReleaseNotesRepository() }
    viewModel {
        WhatsNewViewModel(
            repository = get(),
            getUnseenReleaseNotes = null,
            currentBuild = 0,
            platform = PLATFORM_WEB,
        )
    }
}
