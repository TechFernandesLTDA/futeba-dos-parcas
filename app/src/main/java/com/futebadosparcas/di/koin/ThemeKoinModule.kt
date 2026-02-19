package com.futebadosparcas.di.koin

import com.futebadosparcas.data.ThemeRepositoryImpl
import com.futebadosparcas.domain.repository.ThemeRepository
import org.koin.dsl.module

val themeKoinModule = module {

    single<ThemeRepository> {
        ThemeRepositoryImpl(get())
    }
}
