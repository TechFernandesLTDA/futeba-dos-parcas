package com.futebadosparcas.data.remote

import com.futebadosparcas.data.remote.model.ViaCepResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path

interface ViaCepService {
    @GET("{cep}/json")
    suspend fun getAddress(@Path("cep") cep: String): Response<ViaCepResponse>
}
