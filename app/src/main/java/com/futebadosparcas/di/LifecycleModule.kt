package com.futebadosparcas.di

import com.futebadosparcas.domain.lifecycle.ListenerLifecycleManager
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * LifecycleModule - Configuração Hilt para serviços de ciclo de vida
 *
 * Fornece:
 * - ListenerLifecycleManager: Gerenciamento de listeners do Firestore
 */
@Module
@InstallIn(SingletonComponent::class)
object LifecycleModule {

    /**
     * Fornece instância singleton de ListenerLifecycleManager
     * Gerencia todos os listeners Firestore da aplicação
     */
    @Provides
    @Singleton
    fun provideListenerLifecycleManager(): ListenerLifecycleManager {
        return ListenerLifecycleManager()
    }
}
