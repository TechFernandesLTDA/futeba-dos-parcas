package com.futebadosparcas.data

import com.futebadosparcas.data.network.ViaCepClient
import com.futebadosparcas.domain.repository.AddressLookupResult
import com.futebadosparcas.domain.repository.AddressRepository
import com.futebadosparcas.domain.repository.LatLngResult
import com.futebadosparcas.platform.geocoding.GeocoderService
import com.futebadosparcas.platform.logging.PlatformLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Implementação compartilhada (Android+iOS) do AddressRepository.
 *
 * Usa:
 * - ViaCepClient (Ktor KMP) para buscas de CEP
 * - GeocoderService (expect/actual) para geocoding nativo
 *   (Android: android.location.Geocoder, iOS: CLGeocoder)
 */
class AddressRepositoryImpl(
    private val geocoderService: GeocoderService,
) : AddressRepository {

    companion object {
        private const val TAG = "AddressRepository"
    }

    private val viaCepClient = ViaCepClient()

    override suspend fun getAddressByCep(cep: String): Result<AddressLookupResult> {
        return withContext(Dispatchers.Default) {
            try {
                PlatformLogger.d(TAG, "Buscando endereco para CEP: $cep")
                viaCepClient.getAddress(cep)
                    .map { viaCepAddress ->
                        AddressLookupResult(
                            cep = viaCepAddress.cep,
                            street = viaCepAddress.logradouro,
                            neighborhood = viaCepAddress.bairro,
                            city = viaCepAddress.localidade,
                            state = viaCepAddress.uf,
                        )
                    }
                    .onFailure { e ->
                        PlatformLogger.e(TAG, "Erro ao buscar CEP", e)
                    }
            } catch (e: Exception) {
                PlatformLogger.e(TAG, "Erro ao buscar CEP", e)
                Result.failure(e)
            }
        }
    }

    override suspend fun getGeocode(fullAddress: String): Result<LatLngResult> {
        PlatformLogger.d(TAG, "Fazendo geocoding para: $fullAddress")
        return geocoderService.geocode(fullAddress)
    }
}
