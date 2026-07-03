package com.futebadosparcas.di.koin

import com.futebadosparcas.domain.usecase.CalculateTeamBalanceUseCase
import com.futebadosparcas.domain.usecase.ConfirmPresenceUseCase
import com.futebadosparcas.domain.usecase.GetLeagueRankingUseCase
import com.futebadosparcas.domain.usecase.GetPlayerStatisticsUseCase
import com.futebadosparcas.domain.usecase.GetUnseenReleaseNotesUseCase
import com.futebadosparcas.domain.usecase.GetUpcomingGamesUseCase
import com.futebadosparcas.domain.usecase.ConfirmationUseCase
import com.futebadosparcas.domain.usecase.livegame.AddGameEventUseCase
import com.futebadosparcas.domain.usecase.livegame.FinishLiveGameUseCase
import com.futebadosparcas.domain.usecase.notification.ObserveUnreadCountUseCase
import com.futebadosparcas.domain.usecase.group.ArchiveGroupUseCase
import com.futebadosparcas.domain.usecase.group.CreateGroupUseCase
import com.futebadosparcas.domain.usecase.group.DeleteGroupUseCase
import com.futebadosparcas.domain.usecase.group.GetGroupsUseCase
import com.futebadosparcas.domain.usecase.group.LeaveGroupUseCase
import com.futebadosparcas.domain.usecase.group.ManageMembersUseCase
import com.futebadosparcas.domain.usecase.group.TransferOwnershipUseCase
import com.futebadosparcas.domain.usecase.group.UpdateGroupUseCase
import org.koin.dsl.module

val useCaseKoinModule = module {

    single<GetUpcomingGamesUseCase> {
        GetUpcomingGamesUseCase(get())
    }

    single<ConfirmPresenceUseCase> {
        ConfirmPresenceUseCase(get(), get())
    }

    single<GetPlayerStatisticsUseCase> {
        GetPlayerStatisticsUseCase(get(), get())
    }

    single<CalculateTeamBalanceUseCase> {
        CalculateTeamBalanceUseCase(get(), get())
    }

    single<GetLeagueRankingUseCase> {
        GetLeagueRankingUseCase(get(), get())
    }

    single<ConfirmationUseCase> {
        ConfirmationUseCase(get(), get(), get(), get(), get())
    }

    // Live game use cases
    single<AddGameEventUseCase> { AddGameEventUseCase(get()) }
    single<FinishLiveGameUseCase> { FinishLiveGameUseCase(get()) }

    // Notification use cases
    single<ObserveUnreadCountUseCase> { ObserveUnreadCountUseCase(get()) }

    // Release notes / "Novidades" (spec feat-2026-05-22 — Fase D)
    single<GetUnseenReleaseNotesUseCase> { GetUnseenReleaseNotesUseCase(get(), get()) }

    // Group use cases (todos têm @Inject constructor)
    single<CreateGroupUseCase> { CreateGroupUseCase(get()) }
    single<UpdateGroupUseCase> { UpdateGroupUseCase(get()) }
    single<ArchiveGroupUseCase> { ArchiveGroupUseCase(get()) }
    single<DeleteGroupUseCase> { DeleteGroupUseCase(get()) }
    single<LeaveGroupUseCase> { LeaveGroupUseCase(get()) }
    single<ManageMembersUseCase> { ManageMembersUseCase(get()) }
    single<TransferOwnershipUseCase> { TransferOwnershipUseCase(get()) }
    single<GetGroupsUseCase> { GetGroupsUseCase(get()) }
}
