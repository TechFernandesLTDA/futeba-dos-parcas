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

    override suspend fun signIn(email: String, password: String): Result<String> {
        return firebaseDataSource.signInWithEmailPassword(email, password)
    }

    override suspend fun signUp(email: String, password: String): Result<String> {
        return firebaseDataSource.signUpWithEmailPassword(email, password)
    }

    override suspend fun sendPasswordResetEmail(email: String): Result<Unit> {
        return firebaseDataSource.sendPasswordResetEmail(email)
    }

    override suspend fun logout() {
        firebaseDataSource.logout()
    }
}
