package com.futebadosparcas.util

import com.google.firebase.firestore.DocumentReference
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.QuerySnapshot
import com.google.firebase.firestore.Source
import kotlinx.coroutines.tasks.await

/**
 * Extensoes para Firestore com suporte a offline-first.
 *
 * Estrategia: Tenta cache primeiro, se vazio ou expirado, busca do servidor.
 * Isso reduz latencia e uso de dados moveis.
 */

/**
 * Busca documento com estrategia offline-first.
 * Tenta cache primeiro, depois servidor se necessario.
 */
suspend fun DocumentReference.getOfflineFirst(): DocumentSnapshot {
    return try {
        // Tenta cache primeiro
        val cached = get(Source.CACHE).await()
        if (cached.exists()) {
            cached
        } else {
            // Cache vazio, busca do servidor
            get(Source.SERVER).await()
        }
    } catch (e: Exception) {
        // Cache falhou (ex: primeiro acesso), busca do servidor
        get(Source.SERVER).await()
    }
}

/**
 * Busca documento priorizando servidor (para dados criticos).
 * Usa cache apenas como fallback em caso de erro de rede.
 */
suspend fun DocumentReference.getServerFirst(): DocumentSnapshot {
    return try {
        get(Source.SERVER).await()
    } catch (e: Exception) {
        // Servidor falhou, tenta cache como fallback
        get(Source.CACHE).await()
    }
}

/**
 * Busca query com estrategia offline-first.
 * Ideal para listagens que nao precisam ser 100% atualizadas.
 */
suspend fun Query.getOfflineFirst(): QuerySnapshot {
    return try {
        // Tenta cache primeiro
        val cached = get(Source.CACHE).await()
        if (!cached.isEmpty) {
            cached
        } else {
            // Cache vazio, busca do servidor
            get(Source.SERVER).await()
        }
    } catch (e: Exception) {
        // Cache falhou, busca do servidor
        get(Source.SERVER).await()
    }
}

/**
 * Busca query priorizando servidor.
 * Usa cache apenas como fallback em caso de erro de rede.
 */
suspend fun Query.getServerFirst(): QuerySnapshot {
    return try {
        get(Source.SERVER).await()
    } catch (e: Exception) {
        // Servidor falhou, tenta cache como fallback
        get(Source.CACHE).await()
    }
}

/**
 * Busca query forçando cache (para uso offline garantido).
 * Lanca excecao se cache estiver vazio.
 */
suspend fun Query.getCacheOnly(): QuerySnapshot {
    return get(Source.CACHE).await()
}

/**
 * Busca documento forçando cache (para uso offline garantido).
 * Lanca excecao se cache estiver vazio.
 */
suspend fun DocumentReference.getCacheOnly(): DocumentSnapshot {
    return get(Source.CACHE).await()
}
