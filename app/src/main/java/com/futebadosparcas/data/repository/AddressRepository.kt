package com.futebadosparcas.data.repository

import android.content.Context
import android.location.Geocoder
import android.os.Build
import com.futebadosparcas.data.network.ViaCepClient
import com.futebadosparcas.util.AppLogger
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

data class AddressLookupResult(
    val cep: String,
    val street: String,
    val neighborhood: String,
    val city: String,
    val state: String,
    val country: String = "Brasil"
)

data class LatLngResult(
    val latitude: Double,
    val longitude: Double
)

@Singleton
class AddressRepository @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val TAG = "AddressRepository"
    }

    // Cliente Ktor compartilhado (KMP)
    private val viaCepClient = ViaCepClient()

    suspend fun getAddressByCep(cep: String): Result<AddressLookupResult> {
        return withContext(Dispatchers.IO) {
            try {
                // Usa o novo ViaCepClient (Ktor KMP)
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
                        AppLogger.e(TAG, "Erro ao buscar CEP", e)
                    }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao buscar CEP", e)
                Result.failure(e)
            }
        }
    }

    @Suppress("DEPRECATION")
    suspend fun getGeocode(fullAddress: String): Result<LatLngResult> {
        return withContext(Dispatchers.IO) {
            try {
                if (fullAddress.isBlank()) return@withContext Result.failure(Exception("Endereço vazio"))

                val geocoder = Geocoder(context)
                
                // Use Geocoder (Android API)
                // Note: This needs internet and Google Play Services
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    suspendCoroutine { cont ->
                         geocoder.getFromLocationName(fullAddress, 1) { addresses ->
                             if (addresses.isNotEmpty()) {
                                 val addr = addresses[0]
                                 cont.resume(Result.success(LatLngResult(addr.latitude, addr.longitude)))
                             } else {
                                 cont.resume(Result.failure(Exception("Endereço não localizado pelo Geocoder")))
                             }
                         }
                    }
                } else {
                    val addresses = geocoder.getFromLocationName(fullAddress, 1)
                    if (!addresses.isNullOrEmpty()) {
                        val addr = addresses[0]
                         Result.success(LatLngResult(addr.latitude, addr.longitude))
                    } else {
                        Result.failure(Exception("Endereço não localizado pelo Geocoder"))
                    }
                }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro no Geocoding", e)
                Result.failure(e)
            }
        }
    }
}
