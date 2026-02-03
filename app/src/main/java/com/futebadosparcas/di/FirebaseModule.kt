package com.futebadosparcas.di

import com.futebadosparcas.data.datasource.ProfilePhotoDataSource
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.MemoryCacheSettings
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.storage.FirebaseStorage
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object FirebaseModule {

    // ⚠️ ALTERNE AQUI: true = Banco Local (Emulador), false = Banco de Produção (Real)
    private const val USE_EMULATOR = false

    @Provides
    @Singleton
    fun provideFirebaseAuth(): FirebaseAuth {
        val auth = FirebaseAuth.getInstance()
        if (com.futebadosparcas.BuildConfig.DEBUG && USE_EMULATOR) {
            try {
                auth.useEmulator("10.0.2.2", 9099)
            } catch (e: Exception) {
                // Ignore if already connected
            }
        }
        return auth
    }

    @Provides
    @Singleton
    fun provideFirebaseFirestore(): FirebaseFirestore {
        val firestore = FirebaseFirestore.getInstance()

        if (com.futebadosparcas.BuildConfig.DEBUG && USE_EMULATOR) {
            try {
                firestore.useEmulator("10.0.2.2", 8085)
                val settings = com.google.firebase.firestore.FirebaseFirestoreSettings.Builder()
                    .setLocalCacheSettings(MemoryCacheSettings.newBuilder().build())
                    .build()
                firestore.firestoreSettings = settings
            } catch (e: Exception) {
                // Ignore
            }
        } else {
            // PERFORMANCE OPTIMIZATION: Enable Persistent Cache (100MB)
            // Permite funcionar offline com cache local persistente
            try {
                val settings = com.google.firebase.firestore.FirebaseFirestoreSettings.Builder()
                    .setLocalCacheSettings(
                        com.google.firebase.firestore.PersistentCacheSettings.newBuilder()
                            .setSizeBytes(100L * 1024L * 1024L) // 100MB cache size
                            .build()
                    )
                    .build()
                firestore.firestoreSettings = settings
            } catch (e: Exception) {
                // Settings already configured
            }
        }

        return firestore
    }

    @Provides
    @Singleton
    fun provideFirebaseMessaging(): FirebaseMessaging {
        return FirebaseMessaging.getInstance()
    }

    @Provides
    @Singleton
    fun provideFirebaseStorage(): FirebaseStorage {
        val storage = FirebaseStorage.getInstance()
        if (com.futebadosparcas.BuildConfig.DEBUG && USE_EMULATOR) {
            try {
                storage.useEmulator("10.0.2.2", 9199)
            } catch (e: Exception) {
                // Ignore
            }
        }
        return storage
    }

    // CMD-06: Provider para ProfilePhotoDataSource
    @Provides
    @Singleton
    fun provideProfilePhotoDataSource(
        storage: FirebaseStorage,
        application: android.app.Application
    ): ProfilePhotoDataSource {
        return ProfilePhotoDataSource(storage, application)
    }
}
