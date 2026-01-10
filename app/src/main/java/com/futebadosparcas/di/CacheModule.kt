package com.futebadosparcas.di

import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.StatisticsRepository
import com.futebadosparcas.domain.cache.SharedCacheService
import com.futebadosparcas.domain.prefetch.PrefetchService
import com.futebadosparcas.domain.repository.UserRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Hilt DI Module para serviços de cache.
 * Fornece instâncias singleton de serviços de cache compartilhado e prefetch.
 */
@Module
@InstallIn(SingletonComponent::class)
object CacheModule {

    /**
     * Fornece a instância singleton do SharedCacheService.
     *
     * Usado por ViewModels e Repositórios para cache global
     * de usuários, jogos e outros dados frequentemente acessados.
     */
    @Provides
    @Singleton
    fun provideSharedCacheService(): SharedCacheService {
        return SharedCacheService()
    }

    /**
     * Fornece a instância singleton do PrefetchService.
     *
     * Serviço de prefetch preditivo que carrega dados em background
     * antes do usuário navegar, reduzindo latência percebida.
     */
    @Provides
    @Singleton
    fun providePrefetchService(
        gameRepository: GameRepository,
        userRepository: UserRepository,
        statisticsRepository: StatisticsRepository,
        sharedCache: SharedCacheService
    ): PrefetchService {
        return PrefetchService(
            gameRepository = gameRepository,
            userRepository = userRepository,
            statisticsRepository = statisticsRepository,
            sharedCache = sharedCache
        )
    }
}
