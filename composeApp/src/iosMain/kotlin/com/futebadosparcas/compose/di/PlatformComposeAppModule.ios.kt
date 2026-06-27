package com.futebadosparcas.compose.di

import com.futebadosparcas.data.AuthRepositoryImpl
import com.futebadosparcas.data.CashboxRepositoryImpl
import com.futebadosparcas.data.GamificationRepositoryImpl
import com.futebadosparcas.data.LocationRepositoryImpl
import com.futebadosparcas.data.RankingRepositoryImpl
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.domain.repository.CashboxRepository
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.domain.repository.RankingRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.storage.PreferencesService
import org.koin.core.module.Module
import org.koin.dsl.module

internal actual fun platformComposeAppModules(): List<Module> = listOf(
    module {
        single { FirebaseDataSource() }
        single { PreferencesService() }
        single<AuthRepository> { AuthRepositoryImpl(get()) }
        single<RankingRepository> { RankingRepositoryImpl(get()) }
        single<GamificationRepository> { GamificationRepositoryImpl(get()) }
        single<LocationRepository> { LocationRepositoryImpl(get()) }
        single<CashboxRepository> { CashboxRepositoryImpl(get()) }
    }
)
