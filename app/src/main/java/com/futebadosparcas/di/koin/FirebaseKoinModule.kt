package com.futebadosparcas.di.koin

import com.futebadosparcas.data.datasource.ProfilePhotoDataSource
import com.futebadosparcas.util.AnalyticsHelper
import com.futebadosparcas.util.FirebaseRegions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.storage.FirebaseStorage
import org.koin.android.ext.koin.androidApplication
import org.koin.dsl.module

val firebaseKoinModule = module {

    // #4612: emulador e cache são configurados em FirebaseInicial, chamado no começo
    // do Application.onCreate, antes de qualquer uso. Aqui só se devolvem as
    // instâncias padrão, já configuradas.

    single<FirebaseAuth> {
        FirebaseAuth.getInstance()
    }

    single<FirebaseFirestore> {
        FirebaseFirestore.getInstance()
    }

    single<FirebaseMessaging> {
        FirebaseMessaging.getInstance()
    }

    // Firebase Functions (callables: verifyCpf, setUserVerified, etc)
    // Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md
    single<FirebaseFunctions> {
        FirebaseFunctions.getInstance(FirebaseRegions.FUNCTIONS)
    }

    single<FirebaseStorage> {
        FirebaseStorage.getInstance()
    }

    // CMD-06: Provider para ProfilePhotoDataSource
    single<ProfilePhotoDataSource> {
        ProfilePhotoDataSource(get(), androidApplication())
    }

    // Analytics Helper (singleton — usa Firebase.analytics internamente)
    single<AnalyticsHelper> {
        AnalyticsHelper()
    }
}
