package com.futebadosparcas.domain.repository

import kotlinx.serialization.Serializable

/**
 * Resultado da busca de endereco por CEP.
 */
@Serializable
data class AddressLookupResult(
    val cep: String,
    val street: String,
    val neighborhood: String,
    val city: String,
    val state: String,
    val country: String = "Brasil"
)

/**
 * Resultado da busca de coordenadas (geocoding).
 */
@Serializable
data class LatLngResult(
    val latitude: Double,
    val longitude: Double
)

/**
 * Interface de repositorio para buscas de endereco e CEP.
 * Implementacoes especificas de plataforma em androidMain/iosMain.
 *
 * Funcionalidades:
 * - Busca de endereco por CEP (ViaCEP API)
 * - Geocoding de endereco para coordenadas (Android Geocoder / iOS CLGeocoder)
 */
interface AddressRepository {

    /**
     * Busca endereco pelo CEP usando API ViaCEP.
     *
     * @param cep CEP com ou sem mascara (aceita 01310-100 ou 01310100)
     * @return Result com AddressLookupResult ou erro
     */
    suspend fun getAddressByCep(cep: String): Result<AddressLookupResult>

    /**
     * Converte endereco completo em coordenadas (latitude, longitude).
     * Usa Geocoder nativo da plataforma.
     *
     * @param fullAddress Endereco completo para geocoding
     * @return Result com LatLngResult ou erro
     */
    suspend fun getGeocode(fullAddress: String): Result<LatLngResult>
}
