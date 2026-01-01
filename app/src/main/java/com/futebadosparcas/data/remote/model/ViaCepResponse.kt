package com.futebadosparcas.data.remote.model

import com.google.gson.annotations.SerializedName

data class ViaCepResponse(
    @SerializedName("cep") val cep: String?,
    @SerializedName("logradouro") val logradouro: String?,
    @SerializedName("complemento") val complemento: String?,
    @SerializedName("bairro") val bairro: String?,
    @SerializedName("localidade") val localidade: String?, // City
    @SerializedName("uf") val uf: String?,
    @SerializedName("erro") val erro: Boolean? = false
)
