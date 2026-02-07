package com.futebadosparcas.data.remote.model

import com.google.gson.annotations.SerializedName
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Resposta da API ViaCEP para busca de endereço.
 * Suporte dual: Gson (@SerializedName) + kotlinx.serialization (@SerialName)
 * para migração gradual. Remover Gson quando migração estiver completa.
 */
@Serializable
data class ViaCepResponse(
    @SerializedName("cep") @SerialName("cep") val cep: String?,
    @SerializedName("logradouro") @SerialName("logradouro") val logradouro: String?,
    @SerializedName("complemento") @SerialName("complemento") val complemento: String?,
    @SerializedName("bairro") @SerialName("bairro") val bairro: String?,
    @SerializedName("localidade") @SerialName("localidade") val localidade: String?,
    @SerializedName("uf") @SerialName("uf") val uf: String?,
    @SerializedName("erro") @SerialName("erro") val erro: Boolean? = false
)
