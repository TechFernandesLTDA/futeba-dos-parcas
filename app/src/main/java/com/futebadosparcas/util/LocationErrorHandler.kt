package com.futebadosparcas.util
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import android.content.Context
import com.google.firebase.FirebaseException
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.firestore.FirebaseFirestoreException
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.concurrent.TimeoutException

/**
 * Sistema de tratamento de erros contextual para o módulo de Locations.
 *
 * Categoriza erros em tipos específicos e fornece ações de recuperação
 * apropriadas para cada situação, melhorando a experiência do usuário
 * ao fornecer feedback claro e ações acionáveis.
 *
 * Tipos de erro suportados:
 * - Network: Problemas de conexão ou timeout
 * - Auth: Autenticação ou permissões
 * - Data: Dados não encontrados ou corrompidos
 * - Validation: Campos inválidos no formulário
 *
 * Uso:
 * ```kotlin
 * val error = LocationErrorHandler.categorizeError(throwable)
 * val action = LocationErrorHandler.getRecoveryAction(error)
 * val message = LocationErrorHandler.getErrorMessage(error, context)
 * ```
 */
object LocationErrorHandler {

    /**
     * Categoriza um Throwable em um LocationError específico.
     *
     * Analisa o tipo de exceção e sua mensagem para determinar
     * a categoria mais apropriada do erro.
     *
     * @param throwable A exceção a ser categorizada
     * @return LocationError correspondente ao tipo de erro
     */
    fun categorizeError(throwable: Throwable): LocationError {
        return when (throwable) {
            // Erros de rede
            is SocketTimeoutException,
            is TimeoutException -> LocationError.Network(isTimeout = true)

            is UnknownHostException,
            is FirebaseNetworkException -> LocationError.Network(isTimeout = false)

            is IOException -> {
                val message = throwable.message?.lowercase() ?: ""
                when {
                    message.contains("timeout") -> LocationError.Network(isTimeout = true)
                    message.contains("network") || message.contains("connection") ->
                        LocationError.Network(isTimeout = false)
                    else -> LocationError.Data(throwable.message ?: "Erro de I/O")
                }
            }

            // Erros de autenticação Firebase
            is FirebaseAuthException -> {
                val reason = when (throwable.errorCode) {
                    "ERROR_USER_NOT_FOUND" -> "user_not_found"
                    "ERROR_INVALID_CREDENTIAL" -> "invalid_credential"
                    "ERROR_USER_DISABLED" -> "user_disabled"
                    "ERROR_USER_TOKEN_EXPIRED" -> "token_expired"
                    else -> throwable.errorCode ?: "unknown"
                }
                LocationError.Auth(reason)
            }

            // Erros do Firestore
            is FirebaseFirestoreException -> {
                when (throwable.code) {
                    FirebaseFirestoreException.Code.PERMISSION_DENIED ->
                        LocationError.Auth("permission_denied")
                    FirebaseFirestoreException.Code.UNAUTHENTICATED ->
                        LocationError.Auth("not_authenticated")
                    FirebaseFirestoreException.Code.NOT_FOUND ->
                        LocationError.Data("not_found")
                    FirebaseFirestoreException.Code.UNAVAILABLE ->
                        LocationError.Network(isTimeout = false)
                    FirebaseFirestoreException.Code.DEADLINE_EXCEEDED ->
                        LocationError.Network(isTimeout = true)
                    FirebaseFirestoreException.Code.INVALID_ARGUMENT ->
                        LocationError.Data(throwable.message ?: "Argumento inválido")
                    FirebaseFirestoreException.Code.DATA_LOSS ->
                        LocationError.Data("Dados corrompidos")
                    else ->
                        LocationError.Data(throwable.message ?: "Erro Firestore")
                }
            }

            // Outros erros Firebase
            is FirebaseException -> {
                val message = throwable.message?.lowercase() ?: ""
                when {
                    message.contains("network") -> LocationError.Network(isTimeout = false)
                    message.contains("permission") -> LocationError.Auth("permission_denied")
                    message.contains("auth") -> LocationError.Auth("unknown")
                    else -> LocationError.Data(throwable.message ?: "Erro Firebase")
                }
            }

            // Erros genéricos - analisar mensagem
            else -> categorizeByMessage(throwable)
        }
    }

    /**
     * Categoriza erro baseado na mensagem quando o tipo não é específico.
     */
    private fun categorizeByMessage(throwable: Throwable): LocationError {
        val message = throwable.message?.lowercase() ?: ""

        return when {
            // Padrões de erro de rede
            message.contains("timeout") ||
            message.contains("timed out") -> LocationError.Network(isTimeout = true)

            message.contains("network") ||
            message.contains("connection") ||
            message.contains("internet") ||
            message.contains("offline") ||
            message.contains("unavailable") -> LocationError.Network(isTimeout = false)

            // Padrões de autenticação
            message.contains("não autenticado") ||
            message.contains("not authenticated") ||
            message.contains("usuário não logado") ||
            message.contains("not logged in") -> LocationError.Auth("not_authenticated")

            message.contains("permissão") ||
            message.contains("permission") ||
            message.contains("sem acesso") ||
            message.contains("denied") -> LocationError.Auth("permission_denied")

            // Padrões de dados
            message.contains("não encontrado") ||
            message.contains("not found") -> LocationError.Data("not_found")

            message.contains("inválido") ||
            message.contains("invalid") -> LocationError.Data(throwable.message ?: "Dados inválidos")

            // Padrões de validação
            message.contains("obrigatório") ||
            message.contains("required") ||
            message.contains("campo") -> {
                val fields = extractFieldsFromMessage(message)
                if (fields.isNotEmpty()) {
                    LocationError.Validation(fields)
                } else {
                    LocationError.Data(throwable.message ?: "Erro de validação")
                }
            }

            // Fallback
            else -> LocationError.Data(throwable.message ?: "Erro desconhecido")
        }
    }

    /**
     * Extrai nomes de campos de mensagens de validação.
     */
    private fun extractFieldsFromMessage(message: String): List<String> {
        val fields = mutableListOf<String>()

        // Padrões comuns de mensagens de validação
        val patterns = listOf(
            "nome" to "name",
            "endereço" to "address",
            "cep" to "cep",
            "telefone" to "phone",
            "descrição" to "description",
            "horário" to "schedule",
            "preço" to "price"
        )

        patterns.forEach { (pt, en) ->
            if (message.contains(pt) || message.contains(en)) {
                fields.add(pt)
            }
        }

        return fields
    }

    /**
     * Determina a ação de recuperação apropriada para um tipo de erro.
     *
     * @param error O erro categorizado
     * @return RecoveryAction apropriada para o erro
     */
    fun getRecoveryAction(error: LocationError): RecoveryAction {
        return when (error) {
            is LocationError.Network -> {
                if (error.isTimeout) RecoveryAction.Retry
                else RecoveryAction.CheckInternet
            }

            is LocationError.Auth -> {
                when (error.reason) {
                    "not_authenticated",
                    "user_not_found",
                    "token_expired" -> RecoveryAction.Login
                    "permission_denied" -> RecoveryAction.GoBack
                    else -> RecoveryAction.Login
                }
            }

            is LocationError.Data -> {
                when {
                    error.message.contains("not_found") ||
                    error.message.contains("não encontrado") -> RecoveryAction.GoBack
                    else -> RecoveryAction.Retry
                }
            }

            is LocationError.Validation -> RecoveryAction.FixFields(error.fields)
        }
    }

    /**
     * Retorna uma mensagem de erro amigável para o usuário.
     *
     * @param error O erro categorizado
     * @param context Context para acessar strings
     * @return Mensagem de erro localizada
     */
    fun getErrorMessage(error: LocationError, context: Context): String {
        return when (error) {
            is LocationError.Network -> {
                if (error.isTimeout) {
                    context.getString(Res.string.location_error_timeout)
                } else {
                    context.getString(Res.string.location_error_no_connection)
                }
            }

            is LocationError.Auth -> {
                when (error.reason) {
                    "not_authenticated",
                    "user_not_found" -> context.getString(Res.string.location_error_not_authenticated)
                    "permission_denied" -> context.getString(Res.string.location_error_permission_denied)
                    "token_expired" -> context.getString(Res.string.location_error_session_expired)
                    else -> context.getString(Res.string.location_error_auth_generic)
                }
            }

            is LocationError.Data -> {
                when {
                    error.message.contains("not_found") ||
                    error.message.contains("não encontrado") ->
                        context.getString(Res.string.location_error_not_found)
                    error.message.contains("corrompido") ||
                    error.message.contains("corrupted") ->
                        context.getString(Res.string.location_error_corrupted_data)
                    else -> error.message.ifBlank {
                        context.getString(Res.string.location_error_data_generic)
                    }
                }
            }

            is LocationError.Validation -> {
                if (error.fields.isNotEmpty()) {
                    context.getString(Res.string.location_error_validation_fields, error.fields.joinToString(", "))
                } else {
                    context.getString(Res.string.location_error_validation_generic)
                }
            }
        }
    }

    /**
     * Retorna o texto do botão de ação baseado na ação de recuperação.
     *
     * @param action A ação de recuperação
     * @param context Context para acessar strings
     * @return Texto localizado para o botão
     */
    fun getActionButtonText(action: RecoveryAction, context: Context): String {
        return when (action) {
            is RecoveryAction.Retry -> context.getString(Res.string.location_error_action_retry)
            is RecoveryAction.CheckInternet -> context.getString(Res.string.location_error_action_check_connection)
            is RecoveryAction.Login -> context.getString(Res.string.location_error_action_login)
            is RecoveryAction.GoBack -> context.getString(Res.string.location_error_action_go_back)
            is RecoveryAction.FixFields -> context.getString(Res.string.location_error_action_fix_fields)
        }
    }

    /**
     * Cria um LocationError a partir de uma mensagem de erro simples.
     *
     * Útil para quando temos apenas uma string de erro do backend.
     *
     * @param message Mensagem de erro
     * @return LocationError categorizado
     */
    fun fromMessage(message: String): LocationError {
        return categorizeByMessage(Exception(message))
    }
}

/**
 * Tipos de erro categorizados para o módulo de Locations.
 */
sealed class LocationError {
    /**
     * Erro de rede (sem conexão ou timeout).
     *
     * @param isTimeout true se foi um timeout, false se sem conexão
     */
    data class Network(val isTimeout: Boolean) : LocationError()

    /**
     * Erro de autenticação ou autorização.
     *
     * @param reason Razão do erro (ex: "not_authenticated", "permission_denied")
     */
    data class Auth(val reason: String) : LocationError()

    /**
     * Erro relacionado a dados (não encontrado, corrompido, etc).
     *
     * @param message Mensagem descritiva do erro
     */
    data class Data(val message: String) : LocationError()

    /**
     * Erro de validação de campos do formulário.
     *
     * @param fields Lista de campos com erro
     */
    data class Validation(val fields: List<String>) : LocationError()
}

/**
 * Ações de recuperação disponíveis para erros.
 */
sealed class RecoveryAction {
    /** Tentar a operação novamente */
    data object Retry : RecoveryAction()

    /** Verificar conexão com internet */
    data object CheckInternet : RecoveryAction()

    /** Realizar login novamente */
    data object Login : RecoveryAction()

    /** Voltar para tela anterior */
    data object GoBack : RecoveryAction()

    /**
     * Corrigir campos específicos do formulário.
     *
     * @param fields Lista de campos a corrigir
     */
    data class FixFields(val fields: List<String>) : RecoveryAction()
}
