package com.futebadosparcas.domain.lifecycle

import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * ListenerLifecycleManager - Gerencia ciclo de vida de listeners do Firestore
 *
 * Propósito:
 * - Rastrear todos os listeners ativos
 * - Remover listeners individuais quando não mais necessários
 * - Cleanup total ao destruir repositório/ViewModel
 * - Prevenir memory leaks de listeners não removidos
 *
 * Padrão de Uso:
 * ```kotlin
 * // Adicionar listener
 * val registration = firestore.document(...).addSnapshotListener { ... }
 * listenerManager.registerListener("userListener", registration)
 *
 * // Remover listener específico
 * listenerManager.removeListener("userListener")
 *
 * // Cleanup total
 * listenerManager.removeAllListeners()
 * ```
 */
class ListenerLifecycleManager {
    private val listeners = mutableMapOf<String, ListenerRegistration>()
    private val mutex = Mutex()

    /**
     * Registra um listener para rastreamento
     *
     * @param key Identificador único do listener
     * @param registration Objeto de registro do Firestore
     */
    suspend fun registerListener(key: String, registration: ListenerRegistration) {
        mutex.withLock {
            listeners[key] = registration
        }
    }

    /**
     * Remove um listener específico
     *
     * @param key Identificador do listener
     */
    suspend fun removeListener(key: String) {
        mutex.withLock {
            listeners.remove(key)?.remove()
        }
    }

    /**
     * Remove todos os listeners rastreados
     * Chamado em cleanup/onCleared do ViewModel
     */
    suspend fun removeAllListeners() {
        mutex.withLock {
            listeners.values.forEach { it.remove() }
            listeners.clear()
        }
    }

    /**
     * Obtém quantidade de listeners ativos
     */
    suspend fun getActiveListenerCount(): Int {
        return mutex.withLock { listeners.size }
    }

    /**
     * Verifica se um listener específico está ativo
     */
    suspend fun isListenerActive(key: String): Boolean {
        return mutex.withLock { listeners.containsKey(key) }
    }
}
