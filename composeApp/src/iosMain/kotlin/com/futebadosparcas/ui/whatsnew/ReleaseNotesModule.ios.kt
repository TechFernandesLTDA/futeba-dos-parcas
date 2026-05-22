package com.futebadosparcas.ui.whatsnew

import com.futebadosparcas.data.ReleaseNotesRepositoryImpl
import com.futebadosparcas.domain.repository.ReleaseNotesRepository
import com.futebadosparcas.domain.usecase.GetUnseenReleaseNotesUseCase
import com.futebadosparcas.platform.releasenotes.ReleaseNotesAssetReader
import com.futebadosparcas.platform.storage.LastSeenVersionStore
import org.koin.core.module.Module
import org.koin.core.module.dsl.viewModel
import org.koin.dsl.module
import platform.Foundation.NSBundle

/** Plataforma desta nota — casa com o filtro `where("platform" == ...)` do Firestore. */
private const val PLATFORM_IOS = "ios"

/**
 * Fiação real da feature "Novidades" no iOS — o alvo de produção desta UI.
 *
 * Tudo no `shared` é compartilhado: `ReleaseNotesRepositoryImpl` (Firestore +
 * fallback do bundle), `LastSeenVersionStore` (`NSUserDefaults`) e
 * `GetUnseenReleaseNotesUseCase`. Nenhum construtor precisa de `Context`.
 */
actual fun releaseNotesModule(): Module = module {
    single { ReleaseNotesAssetReader() }
    single { LastSeenVersionStore() }
    single<ReleaseNotesRepository> { ReleaseNotesRepositoryImpl(get()) }
    single { GetUnseenReleaseNotesUseCase(get(), get()) }
    viewModel {
        WhatsNewViewModel(
            repository = get(),
            getUnseenReleaseNotes = get(),
            currentBuild = currentIosBuildNumber(),
            platform = PLATFORM_IOS,
        )
    }
}

/**
 * `buildNumber` instalado neste dispositivo — `CFBundleVersion` do app bundle iOS.
 * `0` se ausente/ilegível (o pop-up simplesmente não aparece — spec §3.10).
 */
private fun currentIosBuildNumber(): Int {
    val raw = NSBundle.mainBundle.objectForInfoDictionaryKey("CFBundleVersion") as? String
    return raw?.toIntOrNull() ?: 0
}
