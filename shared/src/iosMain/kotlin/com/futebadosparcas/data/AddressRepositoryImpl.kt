package com.futebadosparcas.data

import com.futebadosparcas.domain.repository.AddressRepository
import com.futebadosparcas.domain.repository.AddressLookupResult
import com.futebadosparcas.domain.repository.LatLngResult
import com.futebadosparcas.network.ViaCepClient
import com.futebadosparcas.platform.logging.PlatformLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import platform.CoreLocation.*
import platform.Foundation.*

/**
 * Implementacao iOS do AddressRepository.
 *
 * Usa ViaCepClient (Ktor KMP) para buscas de CEP
 * e CLGeocoder nativo do iOS para geocoding.
 */
class AddressRepositoryImpl(
    private val platformContext: Any // Placeholder para consistencia entre plataformas
) : AddressRepository {

    companion object {
        private const val TAG = "AddressRepository"
    }

    // Cliente Ktor compartilhado (KMP)
    private val viaCepClient = ViaCepClient()

    override suspend fun getAddressByCep(cep: String): Result<AddressLookupResult> {
        return withContext(Dispatchers.IO) {
            try {
                PlatformLogger.d(TAG, "Buscando endereco para CEP: $cep")

                // Usa o ViaCepClient (Ktor KMP)
                viaCepClient.getAddress(cep)
                    .map { viaCepAddress ->
                        AddressLookupResult(
                            cep = viaCepAddress.cep,
                            street = viaCepAddress.logradouro,
                            neighborhood = viaCepAddress.bairro,
                            city = viaCepAddress.localidade,
                            state = viaCepAddress.uf
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
        return withContext(Dispatchers.IO) {
            try {
                PlatformLogger.d(TAG, "Fazendo geocoding para: $fullAddress")

                if (fullAddress.isBlank()) {
                    return@withContext Result.failure(IllegalArgumentException("Endereco vazio"))
                }

                // Usa CLGeocoder do iOS
                val geocoder = CLGeocoder()
                val nsString = fullAddress as NSString

                // Geocoding assincrono no iOS
                kotlinx.coroutines.suspendCancellableCoroutine { cont ->
                    geocoder.geocodeAddressString(nsString) { placemarks, error ->
                        when {
                            error != null -> {
                            PlatformLogger.e(TAG, "Erro no CLGeocoder", error as? Throwable)
                            cont.resume(Result.failure(Exception(error.localizedDescription))) {
                                throw it
                            }
                        }
                            !placemarks.isNullOrEmpty() -> {
                            val placemark = placemarks.first()
                            val location = placemark.location
                            if (location != null) {
                                val coordinate = location.coordinate
                                cont.resume(Result.success(LatLngResult(coordinate.latitude, coordinate.longitude))) {
                                    throw it
                                }
                            } else {
                                cont.resume(Result.failure(Exception("Coordenadas nao encontradas"))) {
                                    throw it
                                }
                            }
                        }
                            else -> {
                            cont.resume(Result.failure(Exception("Endereco nao localizado pelo CLGeocoder"))) {
                                throw it
                            }
                        }
                        }
                    }
                }
            } catch (e: Exception) {
                PlatformLogger.e(TAG, "Erro no Geocoding", e)
                Result.failure(e)
            }
        }
    }
}
