package com.futebadosparcas.di

import com.futebadosparcas.util.PerformanceTracker
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * UtilModule - Configuração Hilt para utilitários e ferramentas
 *
 * Fornece:
 * - PerformanceTracker: Rastreamento de métricas de performance
 */
@Module
@InstallIn(SingletonComponent::class)
object UtilModule {

    /**
     * Fornece instância singleton de PerformanceTracker
     * Rastreia métricas de performance: screen load times e cache hit rates
     */
    @Provides
    @Singleton
    fun providePerformanceTracker(): PerformanceTracker {
        return PerformanceTracker()
    }
}
