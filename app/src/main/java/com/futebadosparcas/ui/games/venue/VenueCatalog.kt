package com.futebadosparcas.ui.games.venue

import com.futebadosparcas.data.repository.GameFilterType
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.PreferencesManager
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

/** Cidade salva no perfil do usuario (campos `city`/`state` do documento `users/{uid}`), se existir. */
interface ProfileCitySource {
    suspend fun profileCity(): VenueCity?
}

/** Ultima cidade escolhida no seletor, guardada localmente. */
interface LastVenueCityStore {
    fun load(): VenueCity?
    fun save(city: VenueCity)
}

class PreferencesLastVenueCityStore(
    private val preferencesManager: PreferencesManager
) : LastVenueCityStore {
    override fun load(): VenueCity? =
        preferencesManager.getLastVenueCity()?.let { (city, state) -> VenueCity(city, state) }

    override fun save(city: VenueCity) {
        preferencesManager.setLastVenueCity(city.city, city.uf)
    }
}

class FirestoreProfileCitySource(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) : ProfileCitySource {
    override suspend fun profileCity(): VenueCity? {
        val uid = auth.currentUser?.uid ?: return null
        return try {
            val doc = firestore.collection("users").document(uid).get().await()
            val city = doc.getString("city")?.trim().orEmpty()
            if (city.isEmpty()) null else VenueCity(city, doc.getString("state").orEmpty().trim())
        } catch (e: Exception) {
            AppLogger.w(TAG) { "Cidade do perfil indisponivel: ${e.message}" }
            null
        }
    }

    private companion object {
        const val TAG = "ProfileCitySource"
    }
}

/**
 * Acesso a dados do seletor de quadras: descobre a cidade atual, carrega as quadras
 * SOMENTE da cidade/UF (nunca a colecao inteira) e calcula a "ultima utilizacao" do usuario.
 * A logica de busca/ordenacao fica nas funcoes puras de [VenueSearch]/[VenueOrdering]/[VenueListBuilder].
 */
class VenueCatalog(
    private val locationRepository: LocationRepository,
    private val gameRepository: GameRepository,
    private val profileCitySource: ProfileCitySource,
    private val lastCityStore: LastVenueCityStore
) {
    private val stateCache = HashMap<String, List<Location>>()

    /**
     * Cidade atual: aparelho (quadra mais proxima) -> perfil -> ultima cidade escolhida.
     * [device] e nulo quando nao ha permissao de localizacao ou o GPS nao respondeu.
     */
    suspend fun resolveCity(device: VenueGeoPoint?): CityResolution? {
        val fromDevice = device?.let { cityFromDevice(it) }
        val fromProfile = if (fromDevice == null) profileCitySource.profileCity() else null
        val fromLast = if (fromDevice == null && fromProfile == null) lastCityStore.load() else null
        return VenueCityResolver.resolve(fromDevice, fromProfile, fromLast)
    }

    private suspend fun cityFromDevice(point: VenueGeoPoint): VenueCity? {
        for (radiusKm in NEARBY_RADII_KM) {
            val band = VenueCityResolver.latitudeBand(point, radiusKm)
            val venues = locationRepository
                .getLocationsInLatitudeBand(band.start, band.endInclusive)
                .getOrElse { error ->
                    AppLogger.w(TAG) { "Faixa de latitude indisponivel: ${error.message}" }
                    return null
                }
            VenueCityResolver.cityFromDevice(point, venues, radiusKm)?.let { return it }
        }
        return null
    }

    /** Quadras da cidade (consulta por city/state; tolera variacao de caixa/acento via UF). */
    suspend fun loadCity(city: VenueCity): Result<List<Location>> {
        val exact = locationRepository.getLocationsByCity(city.city, city.uf.ifEmpty { null })
        val exactVenues = exact.getOrNull()
        if (exactVenues != null && exactVenues.isNotEmpty()) return exact
        if (city.uf.isEmpty()) return exact
        // Fallback: documentos com grafia diferente ("curitiba", "Sao Paulo") ou UF por extenso.
        val stateVenues = loadState(city.uf).getOrNull() ?: return exact
        return Result.success(stateVenues.filter { VenueCity.of(it)?.sameAs(city) == true })
    }

    /** Quadras de uma UF (consulta por state, com cache de sessao). */
    suspend fun loadState(uf: String): Result<List<Location>> {
        val normalized = BrazilianStates.toUf(uf)
        stateCache[normalized]?.let { return Result.success(it) }
        return locationRepository.getLocationsByStates(BrazilianStates.storedValues(normalized)).onSuccess {
            stateCache[normalized] = it
        }
    }

    /** Busca remota leve (prefixo no nome) usada so quando a cidade e a UF nao tem resultado. */
    suspend fun searchRemote(query: String): List<Location> =
        locationRepository.searchLocations(query.trim()).getOrElse { emptyList() }

    /** Quando o usuario usou cada quadra pela ultima vez (jogos que criou ou em que jogou). */
    suspend fun lastUsedByLocation(): Map<String, Long> {
        val games = gameRepository.getGamesByFilter(GameFilterType.MY_GAMES).getOrNull().orEmpty()
        return VenueOrdering.lastUsedByLocation(VenueOrdering.gameRefs(games.map { it.game }))
    }

    fun rememberCity(city: VenueCity) = lastCityStore.save(city)

    private companion object {
        const val TAG = "VenueCatalog"

        /** Primeiro raio curto (barato); se nao achar quadra, amplia uma vez. */
        val NEARBY_RADII_KM = listOf(60.0, VenueCityResolver.MAX_NEAREST_VENUE_KM)
    }
}
