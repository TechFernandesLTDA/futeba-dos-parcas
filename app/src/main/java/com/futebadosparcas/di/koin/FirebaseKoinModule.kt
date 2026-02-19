package com.futebadosparcas.di.koin

import com.futebadosparcas.data.datasource.ProfilePhotoDataSource
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.MemoryCacheSettings
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.storage.FirebaseStorage
import org.koin.android.ext.koin.androidApplication
import org.koin.dsl.module

val firebaseKoinModule = module {

    // ⚠️ ALTERNE AQUI: true = Banco Local (Emulador), false = Banco de Produção (Real)
    val useEmulator = false

    single<FirebaseAuth> {
        val auth = FirebaseAuth.getInstance()
        if (com.futebadosparcas.BuildConfig.DEBUG && useEmulator) {
            try {
                auth.useEmulator("10.0.2.2", 9099)
            } catch (e: Exception) {
                // Ignorar se já conectado
            }
        }
        auth
    }

    single<FirebaseFirestore> {
        val firestore = FirebaseFirestore.getInstance()
        if (com.futebadosparcas.BuildConfig.DEBUG && useEmulator) {
            try {
                firestore.useEmulator("10.0.2.2", 8085)
                val settings = com.google.firebase.firestore.FirebaseFirestoreSettings.Builder()
                    .setLocalCacheSettings(MemoryCacheSettings.newBuilder().build())
                    .build()
                firestore.firestoreSettings = settings
            } catch (e: Exception) {
                // Ignorar
            }
        } else {
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
                // Settings já configuradas
            }
        }
        firestore
    }

    single<FirebaseMessaging> {
        FirebaseMessaging.getInstance()
    }

    single<FirebaseStorage> {
        val storage = FirebaseStorage.getInstance()
        if (com.futebadosparcas.BuildConfig.DEBUG && useEmulator) {
            try {
                storage.useEmulator("10.0.2.2", 9199)
            } catch (e: Exception) {
                // Ignorar
            }
        }
        storage
    }

    // CMD-06: Provider para ProfilePhotoDataSource
    single<ProfilePhotoDataSource> {
        ProfilePhotoDataSource(get(), androidApplication())
    }
}
