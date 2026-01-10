package com.futebadosparcas.di

import android.content.Context
import com.futebadosparcas.data.database.DatabaseDriverFactory
import com.futebadosparcas.data.database.DatabaseFactory
import com.futebadosparcas.db.FutebaDatabase
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.storage.PreferencesService
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Módulo Hilt para repositórios compartilhados (KMP).
 *
 * Configuração moderna com Kotlin Multiplatform, Jetpack Compose,
 * e injeção de dependência centralizada.
 */
@Module
@InstallIn(SingletonComponent::class)
object RepositoryModule {

    @Provides
    @Singleton
    fun provideFirebaseDataSource(
        firestore: FirebaseFirestore,
        auth: FirebaseAuth
    ): FirebaseDataSource {
        return FirebaseDataSource(firestore, auth)
    }

    @Provides
    @Singleton
    fun provideFutebaDatabase(@ApplicationContext context: Context): FutebaDatabase {
        val driverFactory = DatabaseDriverFactory(context)
        return DatabaseFactory(driverFactory).createDatabase()
    }

    @Provides
    @Singleton
    fun providePreferencesService(@ApplicationContext context: Context): PreferencesService {
        return PreferencesService(context)
    }

    @Provides
    @Singleton
    fun provideUserRepository(
        firebaseDataSource: FirebaseDataSource,
        database: FutebaDatabase,
        preferencesService: PreferencesService
    ): UserRepository {
        // Instancia o UserRepositoryImpl compartilhado (KMP) do módulo shared
        return com.futebadosparcas.data.repository.UserRepositoryImpl(
            firebaseDataSource,
            database,
            preferencesService
        )
    }
}
