package com.futebadosparcas.platform.geocoding

import com.futebadosparcas.domain.repository.LatLngResult

/**
 * Serviço de geocoding plataforma-específico.
 *
 * Android: usa `android.location.Geocoder`.
 * iOS: usa `CLGeocoder` (CoreLocation).
 *
 * Permite que `AddressRepositoryImpl` rode em `nativeAndAndroidMain`
 * (compartilhado) sem precisar de implementações duplicadas.
 */
expect class GeocoderService {
    /**
     * Geocodifica um endereço completo em coordenadas (lat, lng).
     *
     * @param fullAddress endereço completo (ex: "Rua X, 123, São Paulo, SP")
     * @return [LatLngResult] em sucesso, ou falha com mensagem descritiva
     */
    suspend fun geocode(fullAddress: String): Result<LatLngResult>
}
