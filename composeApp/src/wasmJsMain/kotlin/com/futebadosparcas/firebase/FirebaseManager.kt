package com.futebadosparcas.firebase

import kotlinx.coroutines.delay

/**
 * Firebase Manager para Web (wasmJs) - VERSÃO MOCK
 *
 * TODO: Implementar Firebase real usando external declarations (FirebaseWeb.kt)
 * Por enquanto, usa autenticação mock para desenvolvimento rápido.
 */
object FirebaseManager {

    // Mock user database (apenas para desenvolvimento)
    private val mockUsers = mapOf(
        "test@futeba.com" to "123456",
        "admin@futeba.com" to "admin123"
    )

    private var currentUserId: String? = null
    private var currentUserEmail: String? = null

    /**
     * Inicializa Firebase (mock - não faz nada por enquanto)
     */
    fun initialize() {
        println("FirebaseManager (MOCK) initialized")
    }

    /**
     * Faz login com email e senha (MOCK)
     * @return userId se sucesso, null se falhar
     */
    suspend fun signInWithEmailAndPassword(email: String, password: String): String? {
        // Simular delay de rede
        delay(500)

        return if (mockUsers[email] == password) {
            currentUserId = "mock-user-${email.hashCode()}"
            currentUserEmail = email
            currentUserId
        } else {
            null
        }
    }

    /**
     * Faz logout (MOCK)
     */
    suspend fun signOut() {
        delay(200)
        currentUserId = null
        currentUserEmail = null
    }

    /**
     * Retorna o usuário atual logado (email)
     */
    fun getCurrentUserEmail(): String? {
        return currentUserEmail
    }

    /**
     * Retorna o UID do usuário atual
     */
    fun getCurrentUserId(): String? {
        return currentUserId
    }

    /**
     * Busca documentos de uma collection (MOCK)
     * @return Lista de Maps com dados mockados
     */
    suspend fun getCollection(collectionPath: String, limitCount: Int = 50): List<Map<String, Any?>> {
        delay(300)

        return when (collectionPath) {
            "games" -> listOf(
                mapOf(
                    "id" to "game1",
                    "title" to "Pelada Sábado",
                    "date" to "2026-02-22T15:00:00",
                    "location" to "Campo do Parque",
                    "players" to 10
                ),
                mapOf(
                    "id" to "game2",
                    "title" to "Racha Domingo",
                    "date" to "2026-02-23T09:00:00",
                    "location" to "Ginásio Central",
                    "players" to 8
                )
            )
            else -> emptyList()
        }
    }

    /**
     * Busca grupos do usuário atual (MOCK)
     */
    suspend fun getUserGroups(): List<Map<String, Any?>> {
        delay(300)

        if (currentUserId == null) return emptyList()

        return listOf(
            mapOf(
                "id" to "group1",
                "name" to "Pelada dos Parças",
                "members" to 15,
                "nextGame" to "Sábado 15:00"
            ),
            mapOf(
                "id" to "group2",
                "name" to "Racha da Firma",
                "members" to 12,
                "nextGame" to "Domingo 09:00"
            )
        )
    }
}
