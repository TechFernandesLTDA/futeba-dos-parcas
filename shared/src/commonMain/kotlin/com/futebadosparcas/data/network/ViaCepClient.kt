package com.futebadosparcas.data.network

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Modelo de resposta da API ViaCEP.
 *
 * Mapeia os campos da API pública brasileira de consulta de CEP.
 */
@Serializable
data class ViaCepAddress(
    val cep: String = "",
    val logradouro: String = "",
    val complemento: String = "",
    val bairro: String = "",
    val localidade: String = "",
    val uf: String = "",
    val ibge: String? = null,
    val gia: String? = null,
    val ddd: String? = null,
    val siafi: String? = null,
    val erro: Boolean? = null  // API retorna {"erro": true} quando CEP não existe
)

/**
 * Cliente HTTP multiplataforma para consulta de CEP via ViaCEP API.
 *
 * Substitui o Retrofit (Android-only) por Ktor Client (KMP).
 *
 * API: https://viacep.com.br/
 * Exemplo: https://viacep.com.br/ws/01310100/json/
 */
class ViaCepClient {
    private val client = HttpClient {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
                coerceInputValues = true
            })
        }
    }

    /**
     * Busca endereço por CEP.
     *
     * @param cep CEP com ou sem máscara (aceita 01310-100 ou 01310100)
     * @return Result com ViaCepAddress ou erro
     */
    suspend fun getAddress(cep: String): Result<ViaCepAddress> {
        return try {
            // Remove máscara do CEP se houver
            val cleanCep = cep.replace("-", "").trim()

            if (cleanCep.length != 8) {
                return Result.failure(IllegalArgumentException("CEP inválido: deve conter 8 dígitos"))
            }

            val response: ViaCepAddress = client.get("https://viacep.com.br/ws/$cleanCep/json/").body()

            // API retorna {"erro": true} quando CEP não existe
            if (response.erro == true) {
                return Result.failure(Exception("CEP não encontrado"))
            }

            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Fecha o cliente HTTP.
     *
     * Importante chamar ao finalizar uso para liberar recursos.
     */
    fun close() {
        client.close()
    }
}
