package com.futebadosparcas.di

import com.futebadosparcas.data.datasource.FirebaseDataSource
import com.futebadosparcas.data.datasource.FirebaseDataSourceImpl
import com.futebadosparcas.domain.ai.TeamBalancer
import com.futebadosparcas.domain.usecase.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Módulo Hilt para injeção de dependências de UseCases e DataSources.
 *
 * Este módulo configura:
 * - FirebaseDataSource (abstração do Firebase)
 * - UseCases de domínio (GetUpcomingGames, ConfirmPresence, etc)
 */
@Module
@InstallIn(SingletonComponent::class)
object UseCaseModule {

    // ========== DATA SOURCES ==========

    /**
     * Provê implementação do FirebaseDataSource.
     *
     * Esta abstração permite:
     * - Mock em testes
     * - Retry automático
     * - Migração futura para KMP
     */
    @Provides
    @Singleton
    fun provideFirebaseDataSource(
        firestore: FirebaseFirestore,
        auth: FirebaseAuth
    ): FirebaseDataSource {
        return FirebaseDataSourceImpl(firestore, auth)
    }

    // ========== USE CASES ==========

    /**
     * Provê UseCase para buscar jogos futuros.
     */
    @Provides
    @Singleton
    fun provideGetUpcomingGamesUseCase(
        firebaseDataSource: FirebaseDataSource
    ): GetUpcomingGamesUseCase {
        return GetUpcomingGamesUseCase(firebaseDataSource)
    }

    /**
     * Provê UseCase para confirmar presença em jogos.
     */
    @Provides
    @Singleton
    fun provideConfirmPresenceUseCase(
        firebaseDataSource: FirebaseDataSource,
        auth: FirebaseAuth
    ): ConfirmPresenceUseCase {
        return ConfirmPresenceUseCase(firebaseDataSource, auth)
    }

    /**
     * Provê UseCase para buscar estatísticas de jogadores.
     */
    @Provides
    @Singleton
    fun provideGetPlayerStatisticsUseCase(
        firebaseDataSource: FirebaseDataSource,
        auth: FirebaseAuth
    ): GetPlayerStatisticsUseCase {
        return GetPlayerStatisticsUseCase(firebaseDataSource, auth)
    }

    /**
     * Provê UseCase para calcular balanceamento de times.
     */
    @Provides
    @Singleton
    fun provideCalculateTeamBalanceUseCase(
        firebaseDataSource: FirebaseDataSource,
        teamBalancer: TeamBalancer
    ): CalculateTeamBalanceUseCase {
        return CalculateTeamBalanceUseCase(firebaseDataSource, teamBalancer)
    }

    /**
     * Provê UseCase para buscar rankings da liga.
     */
    @Provides
    @Singleton
    fun provideGetLeagueRankingUseCase(
        firebaseDataSource: FirebaseDataSource,
        auth: FirebaseAuth
    ): GetLeagueRankingUseCase {
        return GetLeagueRankingUseCase(firebaseDataSource, auth)
    }
}
