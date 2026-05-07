package com.futebadosparcas.platform.geocoding

import android.content.Context
import android.location.Geocoder
import android.os.Build
import com.futebadosparcas.domain.repository.LatLngResult
import com.futebadosparcas.platform.logging.PlatformLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.util.Locale

/**
 * Implementação Android: usa `android.location.Geocoder`.
 * Suporta API 33+ (Tiramisu, async) e fallback síncrono pra APIs antigas.
 */
actual class GeocoderService(
    private val context: Any, // Context Android (tipado como Any para KMP)
) {

    companion object {
        private const val TAG = "GeocoderService"
    }

    private val androidContext: Context by lazy { context as Context }

    @Suppress("DEPRECATION")
    actual suspend fun geocode(fullAddress: String): Result<LatLngResult> {
        return withContext(Dispatchers.IO) {
            try {
                if (fullAddress.isBlank()) {
                    return@withContext Result.failure(
                        IllegalArgumentException("Endereco vazio")
                    )
                }

                val geocoder = Geocoder(androidContext, Locale.forLanguageTag("pt-BR"))

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    suspendCancellableCoroutine { cont ->
                        geocoder.getFromLocationName(fullAddress, 1) { addresses ->
                            if (addresses.isNotEmpty()) {
                                val addr = addresses[0]
                                cont.resume(
                                    Result.success(LatLngResult(addr.latitude, addr.longitude))
                                ) { throw it }
                            } else {
                                cont.resume(
                                    Result.failure(Exception("Endereco nao localizado pelo Geocoder"))
                                ) { throw it }
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
                PlatformLogger.e(TAG, "Erro no Geocoding Android", e)
                Result.failure(e)
            }
        }
    }
}
