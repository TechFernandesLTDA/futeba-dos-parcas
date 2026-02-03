package com.futebadosparcas.domain.usecase.location

import com.futebadosparcas.data.model.Location
import com.futebadosparcas.domain.usecase.SuspendUseCase
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import kotlin.math.*

/**
 * Get Nearby Locations Use Case
 *
 * Busca locais de jogo próximos a uma coordenada.
 *
 * Uso:
 * ```kotlin
 * val result = getNearbyLocationsUseCase(GetNearbyLocationsParams(
 *     latitude = -23.5505,
 *     longitude = -46.6333,
 *     radiusKm = 10.0
 * ))
 * ```
 */
class GetNearbyLocationsUseCase @Inject constructor(
    private val firestore: FirebaseFirestore
) : SuspendUseCase<GetNearbyLocationsParams, List<LocationWithDistance>>() {

    override suspend fun execute(params: GetNearbyLocationsParams): List<LocationWithDistance> {
        // Validar parâmetros
        require(params.latitude in -90.0..90.0) { "Latitude inválida" }
        require(params.longitude in -180.0..180.0) { "Longitude inválida" }
        require(params.radiusKm > 0) { "Raio deve ser positivo" }

        // Buscar todos os locais (filtragem será feita localmente)
        val snapshot = firestore.collection("locations")
            .limit(100)
            .get()
            .await()

        val locations = snapshot.toObjects(Location::class.java)

        // Calcular distância e filtrar por raio
        return locations
            .mapNotNull { location ->
                val lat = location.latitude ?: return@mapNotNull null
                val lng = location.longitude ?: return@mapNotNull null
                val distance = calculateDistance(
                    params.latitude, params.longitude,
                    lat, lng
                )
                LocationWithDistance(location, distance)
            }
            .filter { it.distanceKm <= params.radiusKm }
            .sortedBy { it.distanceKm }
            .take(params.limit)
    }

    /**
     * Calcula distância entre dois pontos usando fórmula de Haversine
     */
    private fun calculateDistance(
        lat1: Double, lon1: Double,
        lat2: Double, lon2: Double
    ): Double {
        val earthRadiusKm = 6371.0

        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)

        val a = sin(dLat / 2).pow(2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
                sin(dLon / 2).pow(2)

        val c = 2 * atan2(sqrt(a), sqrt(1 - a))

        return earthRadiusKm * c
    }
}

/**
 * Parâmetros para buscar locais próximos
 */
data class GetNearbyLocationsParams(
    val latitude: Double,
    val longitude: Double,
    val radiusKm: Double = 10.0,
    val limit: Int = 20
)

/**
 * Local com distância calculada
 */
data class LocationWithDistance(
    val location: Location,
    val distanceKm: Double
)
