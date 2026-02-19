package com.futebadosparcas.di.koin

import com.futebadosparcas.data.repository.AuthRepository as AndroidAuthRepository
import com.futebadosparcas.data.repository.GroupRepository as AndroidGroupRepository
import com.futebadosparcas.ui.admin.UserManagementViewModel
import com.futebadosparcas.ui.auth.LoginViewModel
import com.futebadosparcas.ui.auth.RegisterViewModel
import com.futebadosparcas.ui.badges.BadgesViewModel
import com.futebadosparcas.ui.developer.DeveloperViewModel
import com.futebadosparcas.ui.game_experience.MVPVoteViewModel
import com.futebadosparcas.ui.game_experience.VoteResultViewModel
import com.futebadosparcas.ui.games.CreateGameViewModel
import com.futebadosparcas.ui.games.GameDetailViewModel
import com.futebadosparcas.ui.games.GamesViewModel
import com.futebadosparcas.ui.games.LocationSelectorViewModel
import com.futebadosparcas.ui.games.teamformation.TeamFormationViewModel
import com.futebadosparcas.ui.groups.CashboxViewModel
import com.futebadosparcas.ui.groups.GameSummonViewModel
import com.futebadosparcas.ui.groups.GroupDetailViewModel
import com.futebadosparcas.ui.groups.GroupsViewModel
import com.futebadosparcas.ui.groups.InviteViewModel
import com.futebadosparcas.ui.home.HomeViewModel
import com.futebadosparcas.ui.league.LeagueViewModel
import com.futebadosparcas.ui.livegame.LiveEventsViewModel
import com.futebadosparcas.ui.livegame.LiveGameViewModel
import com.futebadosparcas.ui.livegame.LiveStatsViewModel
import com.futebadosparcas.ui.locations.FieldOwnerDashboardViewModel
import com.futebadosparcas.ui.locations.LocationDetailViewModel
import com.futebadosparcas.ui.locations.LocationsMapViewModel
import com.futebadosparcas.ui.locations.ManageLocationsViewModel
import com.futebadosparcas.ui.notifications.NotificationsViewModel
import com.futebadosparcas.ui.payments.PaymentViewModel
import com.futebadosparcas.ui.player.PlayerCardViewModel
import com.futebadosparcas.ui.players.PlayersViewModel
import com.futebadosparcas.ui.preferences.PreferencesViewModel
import com.futebadosparcas.ui.profile.ProfileViewModel
import com.futebadosparcas.ui.schedules.SchedulesViewModel
import com.futebadosparcas.ui.search.GlobalSearchViewModel
import com.futebadosparcas.ui.settings.SettingsViewModel
import com.futebadosparcas.ui.statistics.RankingViewModel
import com.futebadosparcas.ui.statistics.StatisticsViewModel
import com.futebadosparcas.ui.theme.ThemeViewModel
import org.koin.core.module.dsl.viewModel
import org.koin.dsl.module

val viewModelKoinModule = module {

    viewModel {
        HomeViewModel(
            gameRepository = get(),
            userRepository = get(),
            notificationRepository = get(),
            gamificationRepository = get(),
            statisticsRepository = get(),
            activityRepository = get(),
            gameConfirmationRepository = get(),
            connectivityMonitor = get(),
            savedStateHandle = get(),
            sharedCache = get(),
            prefetchService = get()
        )
    }

    viewModel {
        GamesViewModel(
            gameRepository = get(),
            notificationRepository = get(),
            savedStateHandle = get()
        )
    }

    viewModel {
        PlayersViewModel(
            userRepository = get(),
            statisticsRepository = get(),
            groupRepository = get(),
            inviteRepository = get(),
            notificationRepository = get(),
            savedStateHandle = get()
        )
    }

    viewModel {
        LeagueViewModel(
            gamificationRepository = get(),
            authRepository = get(),
            firestore = get(),
            notificationRepository = get()
        )
    }

    viewModel {
        ProfileViewModel(
            userRepository = get(),
            authRepository = get<AndroidAuthRepository>(),
            gameRepository = get(),
            liveGameRepository = get(),
            gamificationRepository = get(),
            statisticsRepository = get(),
            locationRepository = get(),
            notificationRepository = get(),
            preferencesManager = get(),
            profilePhotoDataSource = get(),
            firestore = get(),
            auth = get()
        )
    }

    viewModel {
        StatisticsViewModel(
            statisticsRepository = get(),
            userRepository = get()
        )
    }

    viewModel {
        RankingViewModel(
            rankingRepository = get(),
            statisticsRepository = get(),
            userRepository = get(),
            leagueService = get(),
            gamificationRepository = get(),
            auth = get(),
            memoryCache = get()
        )
    }

    viewModel {
        BadgesViewModel(
            gamificationRepository = get(),
            authRepository = get(),
            firestore = get()
        )
    }

    viewModel {
        GameDetailViewModel(
            gameRepository = get(),
            authRepository = get<AndroidAuthRepository>(),
            gameExperienceRepository = get(),
            scheduleRepository = get(),
            groupRepository = get(),
            notificationRepository = get(),
            waitlistRepository = get(),
            confirmationUseCase = get(),
            permissionManager = get()
        )
    }

    viewModel {
        CreateGameViewModel(
            gameRepository = get(),
            authRepository = get<AndroidAuthRepository>(),
            gameTemplateRepository = get(),
            scheduleRepository = get(),
            groupRepository = get<AndroidGroupRepository>(),
            notificationRepository = get(),
            draftRepository = get(),
            timeSuggestionService = get(),
            fieldAvailabilityService = get(),
            addressRepository = get()
        )
    }

    viewModel {
        LiveGameViewModel(
            liveGameRepository = get(),
            gameRepository = get(),
            authRepository = get()
        )
    }

    viewModel {
        LiveStatsViewModel(
            liveGameRepository = get()
        )
    }

    viewModel {
        LiveEventsViewModel(
            liveGameRepository = get()
        )
    }

    viewModel {
        MVPVoteViewModel(
            gameRepository = get(),
            gameExperienceRepository = get(),
            userRepository = get(),
            matchFinalizationService = get()
        )
    }

    viewModel {
        GroupsViewModel(
            groupRepository = get<AndroidGroupRepository>(),
            createGroupUseCase = get(),
            updateGroupUseCase = get(),
            archiveGroupUseCase = get(),
            deleteGroupUseCase = get(),
            leaveGroupUseCase = get(),
            manageMembersUseCase = get(),
            transferOwnershipUseCase = get(),
            getGroupsUseCase = get()
        )
    }

    viewModel {
        GroupDetailViewModel(
            groupRepository = get<AndroidGroupRepository>(),
            userRepository = get(),
            auth = get(),
            updateGroupUseCase = get(),
            archiveGroupUseCase = get(),
            deleteGroupUseCase = get(),
            leaveGroupUseCase = get(),
            manageMembersUseCase = get(),
            transferOwnershipUseCase = get()
        )
    }

    viewModel {
        InviteViewModel(
            inviteRepository = get(),
            userRepository = get(),
            groupRepository = get<AndroidGroupRepository>()
        )
    }

    viewModel {
        CashboxViewModel(
            cashboxRepository = get(),
            groupRepository = get<AndroidGroupRepository>()
        )
    }

    viewModel {
        LocationsMapViewModel(
            locationRepository = get(),
            locationAnalytics = get()
        )
    }

    viewModel {
        LocationDetailViewModel(
            locationRepository = get(),
            userRepository = get(),
            addressRepository = get(),
            locationAnalytics = get(),
            fieldPhotoDataSource = get()
        )
    }

    viewModel {
        ManageLocationsViewModel(
            locationRepository = get()
        )
    }

    viewModel {
        FieldOwnerDashboardViewModel(
            locationRepository = get(),
            userRepository = get()
        )
    }

    viewModel {
        PreferencesViewModel(
            userRepository = get()
        )
    }

    viewModel {
        ThemeViewModel(
            themeRepository = get(),
            preferencesManager = get()
        )
    }

    viewModel {
        DeveloperViewModel(
            locationSeeder = get()
        )
    }

    viewModel {
        SettingsViewModel(
            repository = get()
        )
    }

    viewModel {
        SchedulesViewModel(
            scheduleRepository = get(),
            authRepository = get()
        )
    }

    viewModel {
        NotificationsViewModel(
            notificationRepository = get(),
            inviteRepository = get(),
            gameSummonRepository = get()
        )
    }

    viewModel {
        UserManagementViewModel(
            userRepository = get()
        )
    }

    viewModel {
        LoginViewModel(
            authRepository = get()
        )
    }

    viewModel {
        RegisterViewModel()
    }

    viewModel {
        VoteResultViewModel(
            gameRepository = get()
        )
    }

    viewModel {
        TeamFormationViewModel(
            gameRepository = get(),
            authRepository = get<AndroidAuthRepository>(),
            savedFormationRepository = get()
        )
    }

    viewModel {
        LocationSelectorViewModel(
            locationRepository = get(),
            gameRepository = get(),
            authRepository = get<AndroidAuthRepository>(),
            preferencesManager = get()
        )
    }

    viewModel {
        GameSummonViewModel(
            gameSummonRepository = get()
        )
    }

    viewModel {
        GlobalSearchViewModel(
            gameRepository = get(),
            groupRepository = get(),
            userRepository = get(),
            locationRepository = get()
        )
    }

    viewModel {
        PlayerCardViewModel(
            userRepository = get(),
            statisticsRepository = get()
        )
    }

    viewModel {
        PaymentViewModel(
            paymentRepository = get(),
            userRepository = get()
        )
    }
}
