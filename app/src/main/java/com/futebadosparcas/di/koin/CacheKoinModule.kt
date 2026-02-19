package com.futebadosparcas.di.koin

import com.futebadosparcas.domain.cache.SharedCacheService
import com.futebadosparcas.domain.prefetch.PrefetchService
import org.koin.dsl.module

val cacheKoinModule = module {

    single<SharedCacheService> {
        SharedCacheService()
    }

    single<PrefetchService> {
        PrefetchService(
            gameRepository = get(),
            userRepository = get(),
            statisticsRepository = get(),
            sharedCache = get()
        )
    }
}
