package com.futebadosparcas.di.koin

import com.futebadosparcas.data.ActivityRepositoryImpl
import com.futebadosparcas.data.AddressRepositoryImpl
import com.futebadosparcas.data.AuthRepositoryImpl
import com.futebadosparcas.data.CashboxRepositoryImpl
import com.futebadosparcas.data.GamificationRepositoryImpl
import com.futebadosparcas.data.GameConfirmationRepositoryImpl
import com.futebadosparcas.data.GameEventsRepositoryImpl
import com.futebadosparcas.data.GameExperienceRepositoryImpl
import com.futebadosparcas.data.GameRequestRepositoryImpl
import com.futebadosparcas.data.GameSummonRepositoryImpl
import com.futebadosparcas.data.GameTeamRepositoryImpl
import com.futebadosparcas.data.GroupRepositoryImpl
import com.futebadosparcas.data.LocationRepositoryImpl
import com.futebadosparcas.data.NotificationRepositoryImpl
import com.futebadosparcas.data.RankingRepositoryImpl
import com.futebadosparcas.data.StatisticsRepositoryImpl
import com.futebadosparcas.data.database.DatabaseDriverFactory
import com.futebadosparcas.data.database.DatabaseFactory
import com.futebadosparcas.data.repository.CachedGameRepository
import com.futebadosparcas.data.repository.LiveGameRepositoryImpl
import com.futebadosparcas.data.repository.MeteredLocationRepository
import com.futebadosparcas.data.repository.PaymentRepositoryImpl
import com.futebadosparcas.data.repository.UserRepositoryImpl
import com.futebadosparcas.data.repository.WaitlistRepositoryImpl
import com.futebadosparcas.db.FutebaDatabase
import com.futebadosparcas.domain.repository.ActivityRepository
import com.futebadosparcas.domain.repository.AddressRepository
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.domain.repository.CashboxRepository
import com.futebadosparcas.domain.repository.GameConfirmationRepository
import com.futebadosparcas.domain.repository.GameEventsRepository
import com.futebadosparcas.domain.repository.GameExperienceRepository
import com.futebadosparcas.domain.repository.GameRequestRepository
import com.futebadosparcas.domain.repository.GameSummonRepository
import com.futebadosparcas.domain.repository.GameTeamRepository
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.repository.GroupRepository
import com.futebadosparcas.domain.repository.LiveGameRepository
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.domain.repository.RankingRepository
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.storage.PreferencesService
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module

val repositoryKoinModule = module {

    single<FirebaseDataSource> {
        FirebaseDataSource()
    }

    single<FutebaDatabase> {
        val driverFactory = DatabaseDriverFactory(androidContext())
        DatabaseFactory(driverFactory).createDatabase()
    }

    single<PreferencesService> {
        PreferencesService(androidContext())
    }

    single<UserRepository> {
        UserRepositoryImpl(get(), get(), get())
    }

    single<AuthRepository> {
        AuthRepositoryImpl(get())
    }

    single<com.futebadosparcas.data.repository.PaymentRepository> {
        PaymentRepositoryImpl(get())
    }

    single<GamificationRepository> {
        GamificationRepositoryImpl(get())
    }

    single<RankingRepository> {
        RankingRepositoryImpl(get())
    }

    single<NotificationRepository> {
        NotificationRepositoryImpl(get())
    }

    single<LocationRepository> {
        val baseRepository = LocationRepositoryImpl(get())
        MeteredLocationRepository(baseRepository)
    }

    single<CashboxRepository> {
        CashboxRepositoryImpl(get())
    }

    single<StatisticsRepository> {
        StatisticsRepositoryImpl(get())
    }

    single<LiveGameRepository> {
        LiveGameRepositoryImpl(get())
    }

    single<AddressRepository> {
        AddressRepositoryImpl(androidContext())
    }

    single<ActivityRepository> {
        ActivityRepositoryImpl(get())
    }

    single<GroupRepository> {
        GroupRepositoryImpl(get(), get())
    }

    single<GameEventsRepository> {
        GameEventsRepositoryImpl(get())
    }

    single<GameExperienceRepository> {
        GameExperienceRepositoryImpl(get())
    }

    single<GameRequestRepository> {
        GameRequestRepositoryImpl(get(), get())
    }

    single<GameSummonRepository> {
        GameSummonRepositoryImpl(get())
    }

    single<GameTeamRepository> {
        GameTeamRepositoryImpl(get(), get())
    }

    single<com.futebadosparcas.data.repository.WaitlistRepository> {
        WaitlistRepositoryImpl(get())
    }

    single<com.futebadosparcas.data.repository.CachedGameRepository> {
        CachedGameRepository(get(), get())
    }
}
