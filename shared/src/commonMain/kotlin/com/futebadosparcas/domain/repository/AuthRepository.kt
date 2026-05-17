package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.User
import kotlinx.coroutines.flow.Flow

/**
 * Interface de repositório de autenticação.
 * Implementações específicas de plataforma em androidMain/iosMain.
 *
 * Este repositório gerencia:
 * - Estado de autenticação do usuário
 * - Login/logout
 * - Sessão do usuário atual
 */
interface AuthRepository {

    /**
     * Flow que emite o estado de autenticação em tempo real.
     * Emite o ID do usuário quando logado, null quando deslogado.
     */
    val authStateFlow: Flow<String?>

    /**
     * Verifica se há um usuário logado.
     */
    fun isLoggedIn(): Boolean

    /**
     * Retorna o ID do usuário atual.
     */
    fun getCurrentUserId(): String?

    /**
     * Busca os dados completos do usuário atual.
     *
     * Inclui lógica de retry para casos onde o Firebase Auth
     * ainda não sincronizou com o Firestore após login.
     */
    suspend fun getCurrentUser(): Result<User>

    /**
     * Autentica com email e senha. Retorna o uid do usuário em caso de sucesso.
     */
    suspend fun signIn(email: String, password: String): Result<String>

    /**
     * Cria uma conta com email e senha. Retorna o uid do usuário em caso de sucesso.
     */
    suspend fun signUp(email: String, password: String): Result<String>

    /**
     * Realiza logout do usuário.
     *
     * Suspend para evitar runBlocking em iOS (deadlock garantido se chamado da main thread).
     */
    suspend fun logout()
}
