package com.futebadosparcas.compose.di

import com.futebadosparcas.domain.repository.ThemeRepository
import com.futebadosparcas.ui.settings.InMemoryThemeRepository
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * wasmJs (infraestrutura CMP, não-shipping — a Web real é `web/`).
 *
 * #4097 — `ThemeRepository` em memória: a interface vive em `shared/commonMain`, mas
 * a única persistência multiplataforma real está no iOS (NSUserDefaults).
 */
internal actual fun platformComposeAppModules(): List<Module> = listOf(
    module {
        single<ThemeRepository> { InMemoryThemeRepository() }
    }
)
