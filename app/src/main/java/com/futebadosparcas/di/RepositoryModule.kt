package com.futebadosparcas.di

import android.content.Context
import com.futebadosparcas.data.*
import com.futebadosparcas.data.database.DatabaseDriverFactory
import com.futebadosparcas.data.database.DatabaseFactory
import com.futebadosparcas.data.repository.LiveGameRepositoryImpl
import com.futebadosparcas.data.repository.UserRepositoryImpl
import com.futebadosparcas.db.FutebaDatabase
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.storage.PreferencesService
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Módulo Hilt para repositórios compartilhados (KMP).
 */
@Module
@InstallIn(SingletonComponent::class)
object RepositoryModule {

    @Provides
    @Singleton
    fun provideFirebaseDataSource(
        firestore: FirebaseFirestore,
        auth: FirebaseAuth
    ): FirebaseDataSource {
        return FirebaseDataSource(firestore, auth)
    }

    @Provides
    @Singleton
    fun provideFutebaDatabase(@ApplicationContext context: Context): FutebaDatabase {
        val driverFactory = DatabaseDriverFactory(context)
        return DatabaseFactory(driverFactory).createDatabase()
    }

    @Provides
    @Singleton
    fun providePreferencesService(@ApplicationContext context: Context): PreferencesService {
        return PreferencesService(context)
    }

    @Provides
    @Singleton
    fun provideUserRepository(
        firebaseDataSource: FirebaseDataSource,
        database: FutebaDatabase,
        preferencesService: PreferencesService
    ): com.futebadosparcas.domain.repository.UserRepository {
        return UserRepositoryImpl(firebaseDataSource, database, preferencesService)
    }

    @Provides
    @Singleton
    fun provideAuthRepository(
        firebaseDataSource: FirebaseDataSource
    ): com.futebadosparcas.domain.repository.AuthRepository {
        return AuthRepositoryImpl(firebaseDataSource)
    }

    @Provides
    @Singleton
    fun providePaymentRepository(
        firebaseDataSource: FirebaseDataSource
    ): com.futebadosparcas.data.repository.PaymentRepository {
        return com.futebadosparcas.data.repository.PaymentRepositoryImpl(firebaseDataSource)
    }

    @Provides
    @Singleton
    fun provideGamificationRepository(
        firebaseDataSource: FirebaseDataSource
    ): com.futebadosparcas.domain.repository.GamificationRepository {
        return GamificationRepositoryImpl(firebaseDataSource)
    }

    @Provides
    @Singleton
    fun provideRankingRepository(
        firebaseDataSource: FirebaseDataSource
    ): com.futebadosparcas.domain.repository.RankingRepository {
        return RankingRepositoryImpl(firebaseDataSource)
    }

    @Provides
    @Singleton
    fun provideNotificationRepository(
        firebaseDataSource: FirebaseDataSource
    ): com.futebadosparcas.domain.repository.NotificationRepository {
        return NotificationRepositoryImpl(firebaseDataSource)
    }

    @Provides
    @Singleton
    fun provideLocationRepository(
        firebaseDataSource: FirebaseDataSource
    ): com.futebadosparcas.domain.repository.LocationRepository {
        return LocationRepositoryImpl(firebaseDataSource)
    }

    @Provides
    @Singleton
    fun provideCashboxRepository(
        firebaseDataSource: FirebaseDataSource
    ): com.futebadosparcas.domain.repository.CashboxRepository {
        return CashboxRepositoryImpl(firebaseDataSource)
    }

    @Provides
    @Singleton
    fun provideStatisticsRepository(
        firebaseDataSource: FirebaseDataSource
    ): com.futebadosparcas.domain.repository.StatisticsRepository {
        return StatisticsRepositoryImpl(firebaseDataSource)
    }

    @Provides
    @Singleton
    fun provideLiveGameRepository(
        firebaseDataSource: FirebaseDataSource
    ): com.futebadosparcas.domain.repository.LiveGameRepository {
        return LiveGameRepositoryImpl(firebaseDataSource)
    }

    @Provides
    @Singleton
    fun provideAddressRepository(
        @ApplicationContext context: Context
    ): com.futebadosparcas.domain.repository.AddressRepository {
        return AddressRepositoryImpl(context)
    }

    @Provides
    @Singleton
    fun provideActivityRepository(
        firebaseDataSource: FirebaseDataSource
    ): com.futebadosparcas.domain.repository.ActivityRepository {
        return com.futebadosparcas.data.ActivityRepositoryImpl(firebaseDataSource)
    }

    @Provides
    @Singleton
    fun provideGroupRepository(
        firebaseDataSource: FirebaseDataSource
    ): com.futebadosparcas.domain.repository.GroupRepository {
        return com.futebadosparcas.data.GroupRepositoryImpl(firebaseDataSource)
    }

    @Provides
    @Singleton
    fun provideGameEventsRepository(
        liveGameRepository: com.futebadosparcas.domain.repository.LiveGameRepository
    ): com.futebadosparcas.domain.repository.GameEventsRepository {
        return GameEventsRepositoryImpl(liveGameRepository)
    }

    @Provides
    @Singleton
    fun provideGameExperienceRepository(
        firebaseDataSource: FirebaseDataSource
    ): com.futebadosparcas.domain.repository.GameExperienceRepository {
        return GameExperienceRepositoryImpl(firebaseDataSource)
    }

    @Provides
    @Singleton
    fun provideGameRequestRepository(
        firebaseDataSource: FirebaseDataSource,
        authRepository: com.futebadosparcas.domain.repository.AuthRepository
    ): com.futebadosparcas.domain.repository.GameRequestRepository {
        return GameRequestRepositoryImpl(firebaseDataSource, authRepository)
    }

    @Provides
    @Singleton
    fun provideGameSummonRepository(
        firebaseDataSource: FirebaseDataSource
    ): com.futebadosparcas.domain.repository.GameSummonRepository {
        return GameSummonRepositoryImpl(firebaseDataSource)
    }

    @Provides
    @Singleton
    fun provideGameTeamRepository(
        firebaseDataSource: FirebaseDataSource,
        confirmationRepository: com.futebadosparcas.domain.repository.GameConfirmationRepository
    ): com.futebadosparcas.domain.repository.GameTeamRepository {
        return com.futebadosparcas.data.GameTeamRepositoryImpl(firebaseDataSource, confirmationRepository)
    }

    // ========== Adaptadores para compatibilidade com UI Android ==========

    /**
     * Adaptador que converte entre modelos Android e KMP para ActivityRepository.
     * Mantém compatibilidade com HomeViewModel que usa o modelo Android Activity.
     */
    @Provides
    @Singleton
    fun provideAndroidActivityRepository(
        kmpRepository: com.futebadosparcas.domain.repository.ActivityRepository
    ): com.futebadosparcas.data.repository.ActivityRepository {
        return com.futebadosparcas.data.repository.ActivityRepositoryAdapter(kmpRepository)
    }

    /**
     * Adaptador que converte entre modelos Android e KMP para StatisticsRepository.
     * Mantém compatibilidade com HomeViewModel que usa o modelo Android UserStatistics.
     */
    @Provides
    @Singleton
    fun provideAndroidStatisticsRepository(
        kmpRepository: com.futebadosparcas.domain.repository.StatisticsRepository
    ): com.futebadosparcas.data.repository.StatisticsRepository {
        return com.futebadosparcas.data.repository.StatisticsRepositoryAdapter(kmpRepository)
    }

    /**
     * Adaptador para GameRequestRepository.
     */
    @Provides
    @Singleton
    fun provideAndroidGameRequestRepository(
        kmpRepository: com.futebadosparcas.domain.repository.GameRequestRepository
    ): com.futebadosparcas.data.repository.GameRequestRepository {
        return com.futebadosparcas.data.repository.GameRequestRepositoryAdapter(kmpRepository)
    }

    /**
     * Adaptador para GameSummonRepository.
     */
    @Provides
    @Singleton
    fun provideAndroidGameSummonRepository(
        kmpRepository: com.futebadosparcas.domain.repository.GameSummonRepository
    ): com.futebadosparcas.data.repository.GameSummonRepository {
        return com.futebadosparcas.data.repository.GameSummonRepositoryAdapter(kmpRepository)
    }

    /**
     * Adaptador para GameExperienceRepository.
     */
    @Provides
    @Singleton
    fun provideAndroidGameExperienceRepository(
        kmpRepository: com.futebadosparcas.domain.repository.GameExperienceRepository
    ): com.futebadosparcas.data.repository.GameExperienceRepository {
        return com.futebadosparcas.data.repository.GameExperienceRepositoryAdapter(kmpRepository)
    }

    /**
     * Adaptador para GameEventsRepository.
     */
    @Provides
    @Singleton
    fun provideAndroidGameEventsRepository(
        kmpRepository: com.futebadosparcas.domain.repository.GameEventsRepository
    ): com.futebadosparcas.data.repository.GameEventsRepository {
        return com.futebadosparcas.data.repository.GameEventsRepositoryAdapter(kmpRepository)
    }

    /**
     * Adaptador para GameTeamRepository.
     */
    @Provides
    @Singleton
    fun provideAndroidGameTeamRepository(
        kmpRepository: com.futebadosparcas.domain.repository.GameTeamRepository
    ): com.futebadosparcas.data.repository.GameTeamRepository {
        return com.futebadosparcas.data.repository.GameTeamRepositoryAdapter(kmpRepository)
    }
}
