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
import com.futebadosparcas.data.repository.GroupWallRepository
import com.futebadosparcas.data.LocationRepositoryImpl
import com.futebadosparcas.data.NotificationRepositoryImpl
import com.futebadosparcas.data.RankingRepositoryImpl
import com.futebadosparcas.data.ReleaseNotesRepositoryImpl
import com.futebadosparcas.data.StatisticsRepositoryImpl
import com.futebadosparcas.data.database.DatabaseDriverFactory
import com.futebadosparcas.data.database.DatabaseFactory
import com.futebadosparcas.data.repository.CachedGameRepository
import com.futebadosparcas.data.repository.LiveGameRepositoryImpl
import com.futebadosparcas.data.repository.MeteredLocationRepository
import com.futebadosparcas.data.repository.PaymentRepositoryImpl
import com.futebadosparcas.data.repository.UserRepositoryImpl
import com.futebadosparcas.data.repository.TeamsRepositoryImpl
import com.futebadosparcas.data.repository.OnboardingRepositoryImpl
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
import com.futebadosparcas.domain.repository.ReleaseNotesRepository
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.domain.repository.TeamsRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.releasenotes.ReleaseNotesAssetReader
import com.futebadosparcas.platform.storage.LastSeenVersionStore
import com.futebadosparcas.platform.storage.PreferencesService
import com.futebadosparcas.data.datasource.FirebaseDataSource as AndroidFirebaseDataSource
import com.futebadosparcas.data.datasource.FirebaseDataSourceImpl
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module

val repositoryKoinModule = module {

    single<FirebaseDataSource> {
        FirebaseDataSource()
    }

    // FirebaseDataSource Android (abstração Android, diferente do FirebaseDataSource do shared/KMP)
    single<AndroidFirebaseDataSource> {
        FirebaseDataSourceImpl(get(), get())
    }

    single<FutebaDatabase> {
        val driverFactory = DatabaseDriverFactory(androidContext())
        DatabaseFactory(driverFactory).createDatabase()
    }

    single<PreferencesService> {
        PreferencesService(androidContext())
    }

    // Release notes / "Novidades" (spec feat-2026-05-22 — Fase D)
    single<ReleaseNotesAssetReader> {
        ReleaseNotesAssetReader(androidContext())
    }

    single<LastSeenVersionStore> {
        LastSeenVersionStore(androidContext())
    }

    single<ReleaseNotesRepository> {
        ReleaseNotesRepositoryImpl(get())
    }

    single<UserRepository> {
        UserRepositoryImpl(get(), get(), get())
    }

    single<TeamsRepository> {
        TeamsRepositoryImpl(get())
    }

    single<AuthRepository> {
        AuthRepositoryImpl(get())
    }

    single<com.futebadosparcas.data.repository.PaymentRepository> {
        PaymentRepositoryImpl(get())
    }

    // Onboarding Repository (Fase 1 — spec feat-2026-05-16)
    single<com.futebadosparcas.data.repository.OnboardingRepository> {
        OnboardingRepositoryImpl(get())
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

    // Issue #3230: Chat em tempo real por jogo (épico #3240)
    single<com.futebadosparcas.data.repository.GameChatRepository> {
        com.futebadosparcas.data.repository.GameChatRepository(get(), get())
    }

    // Issue #3234: Comentários livres por jogo (épico #3240)
    single<com.futebadosparcas.data.repository.GameCommentsRepository> {
        com.futebadosparcas.data.repository.GameCommentsRepository(get(), get())
    }

    // Issue #3235: follow/follower social graph (épico #3240)
    single<com.futebadosparcas.data.repository.FollowRepository> {
        com.futebadosparcas.data.repository.FollowRepository(get(), get(), get())
    }

    single<com.futebadosparcas.platform.geocoding.GeocoderService> {
        com.futebadosparcas.platform.geocoding.GeocoderService(androidContext())
    }

    single<AddressRepository> {
        AddressRepositoryImpl(get())
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

    single<GroupWallRepository> {
        GroupWallRepository(get(), get(), get(), androidContext())
    }

    single<com.futebadosparcas.data.repository.SocialFeedRepository> {
        com.futebadosparcas.data.repository.SocialFeedRepository(get(), get(), get(), get())
    }

    single<com.futebadosparcas.data.repository.NearbyPlayersRepository> {
        com.futebadosparcas.data.repository.NearbyPlayersRepository(get(), get(), get())
    }

    // Issue #3231: mensagens diretas 1:1 entre jogadores
    single<com.futebadosparcas.data.repository.DirectMessagesRepository> {
        com.futebadosparcas.data.repository.DirectMessagesRepository(get(), get(), get())
    }

    // Issue #3238: vídeos curtos anexados ao jogo (épico #3240)
    single<com.futebadosparcas.data.repository.GameVideosRepository> {
        com.futebadosparcas.data.repository.GameVideosRepository(get(), get(), get())
    }
}
