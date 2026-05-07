package com.futebadosparcas.data

import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import kotlinx.coroutines.flow.Flow

/**
 * Implementação Android do AuthRepository.
 *
 * Este repositório gerencia o estado de autenticação do usuário,
 * incluindo login, logout e sessão do usuário atual.
 *
 * @param firebaseDataSource Fonte de dados Firebase (específica da plataforma Android)
 */
class AuthRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource
) : AuthRepository {

    override val authStateFlow: Flow<String?>
        get() = firebaseDataSource.getAuthStateFlow()

    override fun isLoggedIn(): Boolean {
        return firebaseDataSource.isLoggedIn()
    }

    override fun getCurrentUserId(): String? {
        return firebaseDataSource.getCurrentAuthUserId()
    }

    override suspend fun getCurrentUser(): Result<User> {
        return firebaseDataSource.getCurrentAuthUser()
    }

    override fun logout() {
        firebaseDataSource.logout()
    }
}
