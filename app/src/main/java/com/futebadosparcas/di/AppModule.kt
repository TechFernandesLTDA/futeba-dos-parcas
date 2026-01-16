package com.futebadosparcas.di

import android.content.Context
import com.futebadosparcas.data.repository.*
import com.futebadosparcas.data.ScheduleRepositoryImpl
import com.futebadosparcas.domain.repository.GameConfirmationRepository as KmpGameConfirmationRepository
import com.futebadosparcas.domain.repository.SettingsRepository
import com.futebadosparcas.domain.repository.GameTemplateRepository as KmpGameTemplateRepository
import com.futebadosparcas.domain.repository.InviteRepository as KmpInviteRepository
import com.futebadosparcas.domain.repository.ScheduleRepository
import com.futebadosparcas.domain.repository.UserRepository as KmpUserRepository
import com.futebadosparcas.domain.ranking.LeagueService
import com.futebadosparcas.domain.ranking.MatchFinalizationService
import com.futebadosparcas.domain.ranking.PostGameEventEmitter
import com.futebadosparcas.util.PreferencesManager
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {


    @Provides
    @Singleton
    fun provideMatchFinalizationService(
        firestore: FirebaseFirestore,
        settingsRepository: SettingsRepository,
        leagueService: LeagueService
    ): MatchFinalizationService {
        return MatchFinalizationService(firestore, settingsRepository, leagueService)
    }

    @Provides
    @Singleton
    fun provideSettingsRepository(
        firestore: FirebaseFirestore
    ): SettingsRepository {
        return com.futebadosparcas.data.SettingsRepositoryImpl(firestore)
    }

    @Provides
    @Singleton
    fun provideGameQueryRepository(
        firestore: FirebaseFirestore,
        auth: FirebaseAuth,
        gameDao: com.futebadosparcas.data.local.dao.GameDao,
        groupRepository: GroupRepository,
        confirmationRepository: KmpGameConfirmationRepository
    ): com.futebadosparcas.domain.repository.GameQueryRepository {
        return GameQueryRepositoryImpl(firestore, auth, gameDao, groupRepository, confirmationRepository)
    }

    @Provides
    @Singleton
    fun provideGameConfirmationRepository(
        firebaseDataSource: com.futebadosparcas.platform.firebase.FirebaseDataSource
    ): KmpGameConfirmationRepository {
        return com.futebadosparcas.data.GameConfirmationRepositoryImpl(firebaseDataSource)
    }

    // GameEventsRepository e GameTeamRepository agora providos pelo RepositoryModule (KMP + adapter)

    @Provides
    @Singleton
    fun provideGameRepository(
        preferencesManager: PreferencesManager,
        firestore: FirebaseFirestore,
        auth: FirebaseAuth,
        gameDao: com.futebadosparcas.data.local.dao.GameDao,
        queryRepository: com.futebadosparcas.domain.repository.GameQueryRepository,
        confirmationRepository: KmpGameConfirmationRepository,
        eventsRepository: GameEventsRepository,
        teamRepository: GameTeamRepository,
        liveGameRepository: LiveGameRepository
    ): GameRepository {
        return if (preferencesManager.isMockModeEnabled()) {
            FakeGameRepository()
        } else {
            GameRepositoryImpl(
                firestore,
                auth,
                gameDao,
                queryRepository,
                confirmationRepository,
                eventsRepository,
                teamRepository,
                liveGameRepository
            )
        }
    }

    @Provides
    @Singleton
    fun provideStatisticsRepository(
        preferencesManager: PreferencesManager,
        firestore: FirebaseFirestore,
        auth: FirebaseAuth
    ): IStatisticsRepository {
        return if (preferencesManager.isMockModeEnabled()) {
            FakeStatisticsRepository()
        } else {
            StatisticsRepositoryImpl(firestore, auth)
        }
    }

    @Provides
    @Singleton
    fun provideGameTemplateRepository(
        firestore: FirebaseFirestore
    ): KmpGameTemplateRepository {
        return com.futebadosparcas.data.GameTemplateRepositoryImpl(firestore)
    }

    // RankingRepository migrado para KMP - injetado via FirebaseDataSource
    // Removido provider antigo

    @Provides
    @Singleton
    fun provideLeagueService(
        firestore: FirebaseFirestore
    ): LeagueService {
        return LeagueService(firestore)
    }

    // StatisticsRepository agora provido pelo RepositoryModule (KMP + adapter)

    // ========== KMP Repository Providers ==========

    // OBSERVAÇÃO: Por enquanto, continuamos usando os repositórios Android diretamente nos ViewModels.
    // Os adaptadores KMP foram criados mas precisam de mais work para integração completa.
    // Esta é uma etapa intermediária na migração KMP.

    /*
    @Provides
    @Singleton
    fun provideKmpGameRepository(
        gameRepository: GameRepository,
        queryRepository: GameQueryRepository,
        confirmationRepository: KmpGameConfirmationRepository,
        eventsRepository: GameEventsRepository,
        teamRepository: GameTeamRepository
    ): com.futebadosparcas.domain.repository.GameRepository {
        return com.futebadosparcas.data.repository.kmp.GameRepositoryAdapter(
            gameRepository,
            queryRepository,
            confirmationRepository,
            eventsRepository,
            teamRepository
        )
    }

    @Provides
    @Singleton
    fun provideKmpGroupRepository(
        groupRepository: GroupRepository
    ): com.futebadosparcas.domain.repository.GroupRepository {
        return com.futebadosparcas.data.repository.kmp.GroupRepositoryAdapter(groupRepository)
    }

    @Provides
    @Singleton
    fun provideKmpStatisticsRepository(
        androidStatisticsRepository: StatisticsRepository
    ): com.futebadosparcas.domain.repository.StatisticsRepository {
        return com.futebadosparcas.data.repository.kmp.StatisticsRepositoryAdapter(androidStatisticsRepository)
    }
    */

    @Provides
    @Singleton
    fun provideInviteRepository(
        auth: FirebaseAuth,
        firestore: FirebaseFirestore
    ): KmpInviteRepository {
        return com.futebadosparcas.data.InviteRepositoryImpl(auth, firestore)
    }

    @Provides
    @Singleton
    fun provideScheduleRepository(
        firestore: FirebaseFirestore
    ): ScheduleRepository {
        return ScheduleRepositoryImpl(firestore)
    }

    @Provides
    @Singleton
    fun provideTeamBalancer(
        userRepository: KmpUserRepository
    ): com.futebadosparcas.domain.ai.AiTeamBalancer {
        return com.futebadosparcas.data.ai.GeminiTeamBalancer(userRepository)
    }

    @Provides
    @Singleton
    fun provideHapticManager(@ApplicationContext context: Context): com.futebadosparcas.util.HapticManager {
        return com.futebadosparcas.util.HapticManager(context)
    }

    // ActivityRepository agora provido pelo RepositoryModule (KMP)
    // ActivityRepositoryAdapter provido pelo RepositoryModule para compatibilidade Android

    @Provides
    @Singleton
    fun provideRemoteConfig(): com.google.firebase.remoteconfig.FirebaseRemoteConfig {
        val remoteConfig = com.google.firebase.remoteconfig.FirebaseRemoteConfig.getInstance()
        val configSettings = com.google.firebase.remoteconfig.FirebaseRemoteConfigSettings.Builder()
            .setMinimumFetchIntervalInSeconds(3600)
            .build()
        remoteConfig.setConfigSettingsAsync(configSettings)
        return remoteConfig
    }

    // KMP repositories agora providos pelo RepositoryModule
    // GameRequestRepository, GameEventsRepository, GameExperienceRepository, GameSummonRepository, GameTeamRepository, etc.

    // Adapters para compatibilidade com codigo Android existente tambem movidos para RepositoryModule
}
