package com.futebadosparcas.di

import android.content.Context
import com.futebadosparcas.data.repository.*
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
        return SettingsRepositoryImpl(firestore)
    }

    @Provides
    @Singleton
    fun provideGameQueryRepository(
        firestore: FirebaseFirestore,
        auth: FirebaseAuth,
        gameDao: com.futebadosparcas.data.local.dao.GameDao,
        groupRepository: GroupRepository,
        confirmationRepository: GameConfirmationRepository
    ): GameQueryRepository {
        return GameQueryRepositoryImpl(firestore, auth, gameDao, groupRepository, confirmationRepository)
    }

    @Provides
    @Singleton
    fun provideGameConfirmationRepository(
        firestore: FirebaseFirestore,
        auth: FirebaseAuth,
        matchManagementDataSource: com.futebadosparcas.data.datasource.MatchManagementDataSource
    ): GameConfirmationRepository {
        return GameConfirmationRepositoryImpl(firestore, auth, matchManagementDataSource)
    }

    @Provides
    @Singleton
    fun provideGameEventsRepository(
        liveGameRepository: LiveGameRepository
    ): GameEventsRepository {
        return GameEventsRepositoryImpl(liveGameRepository)
    }

    @Provides
    @Singleton
    fun provideGameTeamRepository(
        firestore: FirebaseFirestore,
        teamBalancer: com.futebadosparcas.domain.ai.TeamBalancer,
        confirmationRepository: GameConfirmationRepository
    ): GameTeamRepository {
        return GameTeamRepositoryImpl(firestore, teamBalancer, confirmationRepository)
    }

    @Provides
    @Singleton
    fun provideGameRepository(
        preferencesManager: PreferencesManager,
        firestore: FirebaseFirestore,
        auth: FirebaseAuth,
        gameDao: com.futebadosparcas.data.local.dao.GameDao,
        queryRepository: GameQueryRepository,
        confirmationRepository: GameConfirmationRepository,
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
    ): GameTemplateRepository {
        return GameTemplateRepositoryImpl(firestore)
    }

    @Provides
    @Singleton
    fun provideRankingRepository(
        firestore: FirebaseFirestore
    ): RankingRepository {
        return RankingRepository(firestore)
    }

    @Provides
    @Singleton
    fun provideLeagueService(
        firestore: FirebaseFirestore
    ): LeagueService {
        return LeagueService(firestore)
    }
    
    @Provides
    @Singleton
    fun provideStatisticsRepositoryInterface(
        firestore: FirebaseFirestore,
        auth: FirebaseAuth
    ): StatisticsRepository {
        return StatisticsRepositoryImpl(firestore, auth)
    }

    @Provides
    @Singleton
    fun provideInviteRepository(
        auth: FirebaseAuth,
        firestore: FirebaseFirestore
    ): InviteRepository {
        return InviteRepositoryImpl(auth, firestore)
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
        userRepository: UserRepository
    ): com.futebadosparcas.domain.ai.TeamBalancer {
        return com.futebadosparcas.data.ai.GeminiTeamBalancer(userRepository)
    }

    @Provides
    @Singleton
    fun provideHapticManager(@ApplicationContext context: Context): com.futebadosparcas.util.HapticManager {
        return com.futebadosparcas.util.HapticManager(context)
    }
    @Provides
    @Singleton
    fun provideActivityRepository(
        firestore: FirebaseFirestore
    ): ActivityRepository {
        return ActivityRepositoryImpl(firestore)
    }

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
}
