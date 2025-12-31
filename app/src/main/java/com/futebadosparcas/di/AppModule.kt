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
    fun providePreferencesManager(@ApplicationContext context: Context): PreferencesManager {
        return PreferencesManager(context)
    }

    @Provides
    @Singleton
    fun provideMatchFinalizationService(
        firestore: FirebaseFirestore,
        settingsRepository: SettingsRepository
    ): MatchFinalizationService {
        return MatchFinalizationService(firestore, settingsRepository)
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
    fun provideGameRepository(
        preferencesManager: PreferencesManager,
        firestore: FirebaseFirestore,
        auth: FirebaseAuth,
        gameDao: com.futebadosparcas.data.local.dao.GameDao,
        badgeAwarder: com.futebadosparcas.domain.gamification.BadgeAwarder,
        liveGameRepository: com.futebadosparcas.data.repository.LiveGameRepository,
        matchFinalizationService: MatchFinalizationService,
        postGameEventEmitter: PostGameEventEmitter
    ): GameRepository {
        return if (preferencesManager.isMockModeEnabled()) {
            FakeGameRepository()
        } else {
            GameRepositoryImpl(firestore, auth, gameDao, badgeAwarder, liveGameRepository, matchFinalizationService, postGameEventEmitter)
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
}
