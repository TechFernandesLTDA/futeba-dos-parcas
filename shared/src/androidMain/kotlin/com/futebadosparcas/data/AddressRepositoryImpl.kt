package com.futebadosparcas.data

import android.os.Build
import com.futebadosparcas.domain.repository.AddressRepository
import com.futebadosparcas.domain.repository.AddressLookupResult
import com.futebadosparcas.domain.repository.LatLngResult
import com.futebadosparcas.data.network.ViaCepClient
import com.futebadosparcas.platform.logging.PlatformLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Locale

/**
 * Implementacao Android do AddressRepository.
 *
 * Usa ViaCepClient (Ktor KMP) para buscas de CEP
 * e Geocoder nativo do Android para geocoding.
 */
class AddressRepositoryImpl(
    private val platformContext: Any // Context do Android (tipado como Any por KMP)
) : AddressRepository {

    companion object {
        private const val TAG = "AddressRepository"
    }

    // Cliente Ktor compartilhado (KMP)
    private val viaCepClient = ViaCepClient()

    // Context do Android - obtido via reflection no runtime
    private val context: android.content.Context by lazy {
        platformContext as android.content.Context
    }

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

    @Suppress("DEPRECATION")
    override suspend fun getGeocode(fullAddress: String): Result<LatLngResult> {
        return withContext(Dispatchers.IO) {
            try {
                PlatformLogger.d(TAG, "Fazendo geocoding para: $fullAddress")

                if (fullAddress.isBlank()) {
                    return@withContext Result.failure(IllegalArgumentException("Endereco vazio"))
                }

                val geocoder = android.location.Geocoder(context, Locale("pt", "BR"))

                // Use Geocoder (Android API)
                // Note: This needs internet and Google Play Services

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    kotlinx.coroutines.suspendCancellableCoroutine { cont ->
                        geocoder.getFromLocationName(fullAddress, 1) { addresses ->
                            if (addresses.isNotEmpty()) {
                                val addr = addresses[0]
                                cont.resume(Result.success(LatLngResult(addr.latitude, addr.longitude))) {
                                    throw it
                                }
                            } else {
                                cont.resume(Result.failure(Exception("Endereco nao localizado pelo Geocoder"))) {
                                    throw it
                                }
                            }
                        }
                    }
                } else {
                    @Suppress("BlockingMethodInNonBlockingContext")
                    val addresses = geocoder.getFromLocationName(fullAddress, 1)
                    if (!addresses.isNullOrEmpty()) {
                        val addr = addresses[0]
                        Result.success(LatLngResult(addr.latitude, addr.longitude))
                    } else {
                        Result.failure(Exception("Endereco nao localizado pelo Geocoder"))
                    }
                }
            } catch (e: Exception) {
                PlatformLogger.e(TAG, "Erro no Geocoding", e)
                Result.failure(e)
            }
        }
    }
}
