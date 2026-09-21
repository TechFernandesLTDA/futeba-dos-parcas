package com.futebadosparcas.compose.di

import com.futebadosparcas.domain.repository.ThemeRepository
import com.futebadosparcas.ui.settings.InMemoryThemeRepository
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Harness Android do composeApp (o app Android real é o `:app`, que não depende
 * deste módulo e tem sua própria fiação Koin com DataStore).
 *
 * #4097 — `ThemeRepository` em memória para `App.kt`/tela de tema compilarem e
 * funcionarem sem persistência neste target.
 */
internal actual fun platformComposeAppModules(): List<Module> = listOf(
    module {
        single<ThemeRepository> { InMemoryThemeRepository() }
    }
)
