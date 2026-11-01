package com.futebadosparcas.compose.di

import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.ui.account.DeleteAccountViewModel
import com.futebadosparcas.ui.auth.RegisterViewModel
import com.futebadosparcas.ui.core.LoginViewModel
import com.futebadosparcas.ui.settings.ThemeSettingsViewModel
import com.futebadosparcas.ui.whatsnew.releaseNotesModule
import org.koin.core.module.Module
import org.koin.compose.viewmodel.dsl.viewModel
import org.koin.dsl.module

/**
 * Módulo Koin do composeApp (commonMain — compartilhado Android + iOS).
 *
 * Este módulo contém bindings de ViewModels e serviços específicos da camada
 * de UI compartilhada (composeApp). Repositórios e casos de uso ficam em
 * módulos do :shared (providos pela plataforma — Android via app/.../di/koin/,
 * iOS via módulos futuros em composeApp/iosMain conforme a frota de telas cresce).
 *
 * Para adicionar um novo ViewModel compartilhado:
 *
 *   viewModel { MinhaFeatureViewModel(get()) }
 *
 * e consumi-lo na tela com:
 *
 *   val vm: MinhaFeatureViewModel = koinViewModel()
 *
 * Refs: specs/feat-2026-05-16-ios-parity-cmp-phase3.md §3.2
 */
val composeAppModule = module {

    // Bucket Core ViewModels
    viewModel { LoginViewModel(get()) }

    // Cadastro (#4424). Sem `AuthRepository` (modo smoke-test do iOS) a resolução falha
    // e a rota REGISTER mostra o estado "indisponível".
    viewModel { RegisterViewModel(get()) }

    // Preferências — tema (#4097). `ThemeRepository` é provido por plataforma em
    // platformComposeAppModules(): iOS = NSUserDefaults; Android harness/wasmJs = memória.
    viewModel { ThemeSettingsViewModel(get()) }

    // Exclusão de conta (#4391/#4401). Depende do Firebase: sem ele (modo smoke-test no
    // iOS) a resolução falha e a rota mostra o estado "indisponível".
    viewModel {
        val dataSource = get<FirebaseDataSource>()
        DeleteAccountViewModel(
            deleteAccount = { dataSource.deleteAccount() },
            authRepository = get()
        )
    }
    // viewModel { GamesViewModel(get()) }  // requer GameRepository (plataforma)
    // viewModel { ProfileSetupViewModel(get()) }

    // Bucket Gamification
    // viewModel { RankingViewModel(get()) }
    // viewModel { BadgesViewModel(get()) }

    // Bucket Discovery
    // viewModel { LocationsViewModel(get()) }

    // Bucket Power
    // viewModel { CashboxViewModel(get()) }
}

internal expect fun platformComposeAppModules(): List<Module>

/**
 * Lista de módulos Koin do composeApp para uso em startKoin / KoinApplication.
 *
 * Inclui [releaseNotesModule] — fiação `expect/actual` por plataforma da feature
 * "Novidades" (iOS real; Android/wasmJs stub). Spec feat-2026-05-22, Fase G.
 */
val composeAppKoinModules = listOf(composeAppModule, releaseNotesModule()) + platformComposeAppModules()
