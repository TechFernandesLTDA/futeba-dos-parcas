package com.futebadosparcas.compose.di

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

    // ViewModels serão registrados aqui conforme a frota de telas for portada.
    // Exemplo:
    //   viewModel { HomeViewModel(get()) }
    //   viewModel { GamesViewModel(get()) }
}

/** Lista de módulos Koin do composeApp para uso em startKoin / KoinApplication */
val composeAppKoinModules = listOf(composeAppModule)
