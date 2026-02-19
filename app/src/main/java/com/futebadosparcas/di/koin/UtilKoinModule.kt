package com.futebadosparcas.di.koin

import com.futebadosparcas.util.ConnectivityMonitor
import com.futebadosparcas.util.LocationAnalytics
import com.futebadosparcas.util.LocationSeeder
import com.futebadosparcas.util.PerformanceTracker
import com.futebadosparcas.util.PreferencesManager
import com.futebadosparcas.data.cache.MemoryCache
import com.futebadosparcas.ui.games.teamformation.SavedFormationRepository
import com.futebadosparcas.data.datasource.GroupPhotoDataSource
import com.futebadosparcas.domain.service.FieldAvailabilityService
import com.futebadosparcas.domain.service.TimeSuggestionService
import com.futebadosparcas.data.repository.CreateGameDraftRepository
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module

val utilKoinModule = module {

    single<PerformanceTracker> {
        PerformanceTracker()
    }

    single<PreferencesManager> {
        PreferencesManager(androidContext())
    }

    single<ConnectivityMonitor> {
        ConnectivityMonitor(androidContext())
    }

    single<LocationAnalytics> {
        LocationAnalytics()
    }

    single<LocationSeeder> {
        LocationSeeder(get())
    }

    single<MemoryCache> {
        MemoryCache()
    }

    single<SavedFormationRepository> {
        SavedFormationRepository(get())
    }

    single<GroupPhotoDataSource> {
        GroupPhotoDataSource(get(), androidContext())
    }

    single<TimeSuggestionService> {
        TimeSuggestionService(get())
    }

    single<FieldAvailabilityService> {
        FieldAvailabilityService(get())
    }

    single<CreateGameDraftRepository> {
        CreateGameDraftRepository(get())
    }
}
