package com.futebadosparcas.di.koin

import com.futebadosparcas.data.AddressRepositoryImpl
import com.futebadosparcas.data.repository.AuthRepository as AndroidAuthRepository
import com.futebadosparcas.data.repository.GroupRepository as AndroidGroupRepository
import com.futebadosparcas.data.GameTemplateRepositoryImpl
import com.futebadosparcas.data.InviteRepositoryImpl
import com.futebadosparcas.data.ScheduleRepositoryImpl
import com.futebadosparcas.data.SettingsRepositoryImpl
import com.futebadosparcas.data.StatisticsRepositoryImpl
import com.futebadosparcas.data.ai.GeminiTeamBalancer
import com.futebadosparcas.data.repository.GameQueryRepositoryImpl
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.GameRepositoryImpl
import com.futebadosparcas.domain.ai.AiTeamBalancer
import com.futebadosparcas.domain.ranking.LeagueService
import com.futebadosparcas.domain.ranking.MatchFinalizationService
import com.futebadosparcas.domain.ranking.PostGameEventEmitter
import com.futebadosparcas.domain.repository.GameQueryRepository
import com.futebadosparcas.domain.repository.GameConfirmationRepository
import com.futebadosparcas.domain.repository.GameTemplateRepository
import com.futebadosparcas.domain.repository.InviteRepository
import com.futebadosparcas.domain.repository.ScheduleRepository
import com.futebadosparcas.domain.repository.SettingsRepository
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.util.HapticManager
import com.futebadosparcas.util.PreferencesManager
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module

val appKoinModule = module {

    single<MatchFinalizationService> {
        MatchFinalizationService(get(), get(), get())
    }

    single<SettingsRepository> {
        SettingsRepositoryImpl(get())
    }

    single<GameQueryRepository> {
        GameQueryRepositoryImpl(get(), get(), get(), get(), get(), get())
    }

    single<GameConfirmationRepository> {
        com.futebadosparcas.data.GameConfirmationRepositoryImpl(get())
    }

    single<GameRepository> {
        val preferencesManager: PreferencesManager = get()
        if (preferencesManager.isMockModeEnabled()) {
            com.futebadosparcas.data.repository.FakeGameRepository()
        } else {
            GameRepositoryImpl(get(), get(), get(), get(), get(), get(), get(), get())
        }
    }

    single<com.futebadosparcas.domain.repository.StatisticsRepository> {
        // TODO: Re-adicionar mock mode após criar FakeStatisticsRepository
        com.futebadosparcas.data.StatisticsRepositoryImpl(get())
    }

    single<GameTemplateRepository> {
        GameTemplateRepositoryImpl(get())
    }

    single<LeagueService> {
        LeagueService(get())
    }

    single<InviteRepository> {
        InviteRepositoryImpl(get(), get())
    }

    single<ScheduleRepository> {
        ScheduleRepositoryImpl(get())
    }

    single<AiTeamBalancer> {
        GeminiTeamBalancer(get())
    }

    single<HapticManager> {
        HapticManager(androidContext())
    }

    // Repositórios Android (camada de dados Android, não KMP)
    single<AndroidAuthRepository> {
        AndroidAuthRepository(get(), get())
    }

    single<AndroidGroupRepository> {
        AndroidGroupRepository(get(), get(), get(), get())
    }

    single<com.google.firebase.remoteconfig.FirebaseRemoteConfig> {
        val remoteConfig = com.google.firebase.remoteconfig.FirebaseRemoteConfig.getInstance()
        val configSettings = com.google.firebase.remoteconfig.FirebaseRemoteConfigSettings.Builder()
            .setMinimumFetchIntervalInSeconds(3600)
            .build()
        remoteConfig.setConfigSettingsAsync(configSettings)
        remoteConfig
    }
}
