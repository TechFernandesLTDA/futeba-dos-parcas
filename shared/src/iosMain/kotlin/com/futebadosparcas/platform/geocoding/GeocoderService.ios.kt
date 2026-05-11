package com.futebadosparcas.platform.geocoding

import com.futebadosparcas.domain.repository.LatLngResult
import com.futebadosparcas.platform.logging.PlatformLogger
import kotlinx.cinterop.useContents
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import platform.CoreLocation.CLGeocoder
import platform.CoreLocation.CLPlacemark

/**
 * Implementação iOS: usa `CLGeocoder` (CoreLocation).
 *
 * O parâmetro `context` é ignorado em iOS — só existe para paridade com Android.
 */
actual class GeocoderService(
    @Suppress("UNUSED_PARAMETER") private val context: Any,
) {

    companion object {
        private const val TAG = "GeocoderService"
    }

    actual suspend fun geocode(fullAddress: String): Result<LatLngResult> {
        // CLGeocoder deve ser instanciado e chamado na main thread (requisito CoreLocation).
        // Usar Dispatchers.Main garante isso; o callback do CLGeocoder também chega na main
        // thread, então cont.resume é chamado no contexto correto (issue #879).
        return withContext(Dispatchers.Main) {
            try {
                if (fullAddress.isBlank()) {
                    return@withContext Result.failure(
                        IllegalArgumentException("Endereco vazio")
                    )
                }

                val geocoder = CLGeocoder()

                suspendCancellableCoroutine { cont ->
                    geocoder.geocodeAddressString(fullAddress) { placemarks, error ->
                        when {
                            error != null -> {
                                PlatformLogger.e(
                                    TAG,
                                    "Erro no CLGeocoder",
                                    error as? Throwable
                                )
                                cont.resume(
                                    Result.failure(Exception(error.localizedDescription))
                                ) { throw it }
                            }
                            !placemarks.isNullOrEmpty() -> {
                                val placemark = placemarks.first() as CLPlacemark
                                val location = placemark.location
                                if (location != null) {
                                    val coordinate = location.coordinate.useContents {
                                        LatLngResult(latitude, longitude)
                                    }
                                    cont.resume(Result.success(coordinate)) { throw it }
                                } else {
                                    cont.resume(
                                        Result.failure(Exception("Coordenadas nao encontradas"))
                                    ) { throw it }
                                }
                            }
                            else -> {
                                cont.resume(
                                    Result.failure(Exception("Endereco nao localizado pelo CLGeocoder"))
                                ) { throw it }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                PlatformLogger.e(TAG, "Erro no Geocoding iOS", e)
                Result.failure(e)
            }
        }
    }
}
