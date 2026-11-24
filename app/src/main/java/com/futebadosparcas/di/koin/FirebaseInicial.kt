package com.futebadosparcas.di.koin

import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.FirebaseRegions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreSettings
import com.google.firebase.firestore.MemoryCacheSettings
import com.google.firebase.firestore.PersistentCacheSettings
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.storage.FirebaseStorage

/**
 * Configuração do Firebase que precisa acontecer antes de qualquer uso (#4612).
 *
 * `useEmulator` e as configurações do Firestore só valem antes da primeira leitura
 * ou escrita. Quando ficavam dentro do `single` do Koin, qualquer ponto que pegasse
 * a instância padrão antes (widget, rastreadores, módulo compartilhado) fazia o
 * `useEmulator` lançar, o `catch` engolia o erro e o app seguia falando com o
 * Firestore de produção com um token emitido pelo emulador. Chamado no começo do
 * `Application.onCreate`, antes do Koin, todas as instâncias padrão nascem certas.
 */
internal object FirebaseInicial {

    /** O emulador Android enxerga o Mac por 10.0.2.2. */
    private const val HOST_EMULADOR = "10.0.2.2"
    private const val PORTA_AUTH = 9099
    private const val PORTA_FIRESTORE = 8085
    private const val PORTA_FUNCTIONS = 5001
    private const val PORTA_STORAGE = 9199
    private const val CACHE_PRODUCAO_BYTES = 100L * 1024L * 1024L
    private const val TAG = "FirebaseInicial"

    fun configurar(usarEmulador: Boolean) {
        if (usarEmulador) apontarParaEmuladores() else configurarCacheDeProducao()
    }

    /**
     * Com o emulador pedido, falhar é melhor que seguir: seguir mandaria leituras e
     * escritas para produção. Por isso aqui não há `catch` que esconda o erro.
     */
    private fun apontarParaEmuladores() {
        try {
            FirebaseAuth.getInstance().useEmulator(HOST_EMULADOR, PORTA_AUTH)
            val firestore = FirebaseFirestore.getInstance()
            firestore.useEmulator(HOST_EMULADOR, PORTA_FIRESTORE)
            firestore.firestoreSettings = FirebaseFirestoreSettings.Builder()
                .setLocalCacheSettings(MemoryCacheSettings.newBuilder().build())
                .build()
            FirebaseFunctions.getInstance(FirebaseRegions.FUNCTIONS)
                .useEmulator(HOST_EMULADOR, PORTA_FUNCTIONS)
            FirebaseStorage.getInstance().useEmulator(HOST_EMULADOR, PORTA_STORAGE)
        } catch (e: IllegalStateException) {
            throw IllegalStateException(
                "Não foi possível apontar o Firebase para o emulador: alguma instância já " +
                    "estava em uso. O app parou para não falar com produção.",
                e
            )
        }
        AppLogger.w(TAG) { "Firebase apontado para o emulador em $HOST_EMULADOR" }
    }

    private fun configurarCacheDeProducao() {
        try {
            FirebaseFirestore.getInstance().firestoreSettings = FirebaseFirestoreSettings.Builder()
                .setLocalCacheSettings(
                    PersistentCacheSettings.newBuilder()
                        .setSizeBytes(CACHE_PRODUCAO_BYTES)
                        .build()
                )
                .build()
        } catch (e: IllegalStateException) {
            // Instância já em uso: fica com o cache padrão, sem risco de ambiente errado.
            AppLogger.w(TAG) { "Cache do Firestore já configurado: ${e.message}" }
        }
    }
}
