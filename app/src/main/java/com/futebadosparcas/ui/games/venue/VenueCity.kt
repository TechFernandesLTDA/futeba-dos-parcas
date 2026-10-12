package com.futebadosparcas.ui.games.venue

import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.Location
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneOffset

/** Estado brasileiro (UF + nome), usado no seletor "Trocar cidade" (UF -> cidade). */
data class BrazilianState(val uf: String, val name: String)

object BrazilianStates {
    val all: List<BrazilianState> = listOf(
        BrazilianState("AC", "Acre"), BrazilianState("AL", "Alagoas"), BrazilianState("AP", "Amapá"),
        BrazilianState("AM", "Amazonas"), BrazilianState("BA", "Bahia"), BrazilianState("CE", "Ceará"),
        BrazilianState("DF", "Distrito Federal"), BrazilianState("ES", "Espírito Santo"),
        BrazilianState("GO", "Goiás"), BrazilianState("MA", "Maranhão"), BrazilianState("MT", "Mato Grosso"),
        BrazilianState("MS", "Mato Grosso do Sul"), BrazilianState("MG", "Minas Gerais"),
        BrazilianState("PA", "Pará"), BrazilianState("PB", "Paraíba"), BrazilianState("PR", "Paraná"),
        BrazilianState("PE", "Pernambuco"), BrazilianState("PI", "Piauí"), BrazilianState("RJ", "Rio de Janeiro"),
        BrazilianState("RN", "Rio Grande do Norte"), BrazilianState("RS", "Rio Grande do Sul"),
        BrazilianState("RO", "Rondônia"), BrazilianState("RR", "Roraima"), BrazilianState("SC", "Santa Catarina"),
        BrazilianState("SP", "São Paulo"), BrazilianState("SE", "Sergipe"), BrazilianState("TO", "Tocantins")
    )

    private val byNormalizedName: Map<String, String> =
        all.associate { VenueSearch.normalize(it.name) to it.uf }

    /** "PR", "pr" e "Paraná" viram "PR". Valor desconhecido volta em caixa alta. */
    fun toUf(raw: String): String {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return ""
        if (trimmed.length == 2) return trimmed.uppercase()
        return byNormalizedName[VenueSearch.normalize(trimmed)] ?: trimmed.uppercase()
    }

    fun nameOf(uf: String): String = all.firstOrNull { it.uf == toUf(uf) }?.name ?: uf

    /** Valores que um documento pode guardar no campo `state` para esta UF (sigla e nome por extenso). */
    fun storedValues(uf: String): List<String> {
        val normalizedUf = toUf(uf)
        val name = all.firstOrNull { it.uf == normalizedUf }?.name
        return listOfNotNull(normalizedUf.takeIf { it.isNotEmpty() }, name).distinct()
    }
}

/** Cidade + UF. A comparacao ignora acento e caixa. */
data class VenueCity(val city: String, val state: String) {
    val uf: String get() = BrazilianStates.toUf(state)
    val normalizedCity: String get() = VenueSearch.normalize(city)
    val label: String get() = if (uf.isEmpty()) city else "$city - $uf"

    fun sameAs(other: VenueCity?): Boolean =
        other != null && normalizedCity == other.normalizedCity && uf == other.uf

    companion object {
        fun of(location: Location): VenueCity? {
            val city = location.city.trim()
            return if (city.isEmpty()) null else VenueCity(city, location.state.trim())
        }
    }
}

/** Origem da cidade atual, na ordem de prioridade definida pelo produto. */
enum class CitySource { DEVICE, PROFILE, LAST_CHOSEN, MANUAL }

data class CityResolution(val city: VenueCity, val source: CitySource)

data class VenueGeoPoint(val latitude: Double, val longitude: Double)

object VenueCityResolver {

    /** Acima desta distancia a quadra mais proxima nao representa a cidade do aparelho. */
    const val MAX_NEAREST_VENUE_KM = 100.0

    private const val EARTH_RADIUS_KM = 6371.0
    private const val KM_PER_LATITUDE_DEGREE = 111.0

    fun distanceKm(from: VenueGeoPoint, toLat: Double, toLng: Double): Double {
        val dLat = Math.toRadians(toLat - from.latitude)
        val dLng = Math.toRadians(toLng - from.longitude)
        val a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(Math.toRadians(from.latitude)) * Math.cos(Math.toRadians(toLat)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2)
        return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(a))
    }

    /** Faixa de latitude (em graus) que cobre [radiusKm] ao redor do ponto. */
    fun latitudeBand(point: VenueGeoPoint, radiusKm: Double): ClosedFloatingPointRange<Double> {
        val delta = radiusKm / KM_PER_LATITUDE_DEGREE
        return (point.latitude - delta)..(point.latitude + delta)
    }

    /** (0,0) e o valor padrao de documentos sem coordenadas: nao e uma posicao real no Brasil. */
    private fun isUsableCoordinate(lat: Double, lng: Double): Boolean = !(lat == 0.0 && lng == 0.0)

    /** Quadra com coordenadas validas mais proxima de [point] (sem geocodificacao externa). */
    fun nearestVenue(
        point: VenueGeoPoint,
        venues: List<Location>,
        maxKm: Double = MAX_NEAREST_VENUE_KM
    ): Location? {
        return venues
            .mapNotNull { venue ->
                val lat = venue.latitude
                val lng = venue.longitude
                if (lat == null || lng == null || !isUsableCoordinate(lat, lng) || VenueCity.of(venue) == null) {
                    null
                } else {
                    venue to distanceKm(point, lat, lng)
                }
            }
            .filter { (_, km) -> km <= maxKm }
            .minByOrNull { (_, km) -> km }
            ?.first
    }

    /** Cidade/UF da quadra mais proxima do aparelho. */
    fun cityFromDevice(
        point: VenueGeoPoint,
        venues: List<Location>,
        maxKm: Double = MAX_NEAREST_VENUE_KM
    ): VenueCity? = nearestVenue(point, venues, maxKm)?.let { VenueCity.of(it) }

    /** Ordem: aparelho -> perfil -> ultima cidade escolhida. */
    fun resolve(device: VenueCity?, profile: VenueCity?, lastChosen: VenueCity?): CityResolution? = when {
        device != null -> CityResolution(device, CitySource.DEVICE)
        profile != null -> CityResolution(profile, CitySource.PROFILE)
        lastChosen != null -> CityResolution(lastChosen, CitySource.LAST_CHOSEN)
        else -> null
    }

    /** Cidades distintas (ordem alfabetica pt-BR sem acento) das quadras de uma UF. */
    fun citiesOf(venues: List<Location>, uf: String): List<String> {
        val target = BrazilianStates.toUf(uf)
        return venues
            .filter { BrazilianStates.toUf(it.state) == target }
            .mapNotNull { VenueCity.of(it)?.city }
            .distinctBy { VenueSearch.normalize(it) }
            .sortedWith(compareBy({ VenueSearch.normalize(it) }, { it }))
    }

    /** UFs que possuem ao menos uma quadra, para destacar no seletor. */
    fun statesWithVenues(venues: List<Location>): Set<String> =
        venues.map { BrazilianStates.toUf(it.state) }.filter { it.isNotEmpty() }.toSet()
}

/** Jogo do usuario (jogou ou criou) que usou uma quadra. */
data class VenueGameRef(val locationId: String, val playedAtMillis: Long)

object VenueOrdering {

    /** Quando cada quadra foi usada pela ultima vez pelo usuario (maior instante vence). */
    fun lastUsedByLocation(games: List<VenueGameRef>): Map<String, Long> {
        val result = HashMap<String, Long>()
        games.forEach { ref ->
            if (ref.locationId.isNotBlank()) {
                val current = result[ref.locationId]
                if (current == null || ref.playedAtMillis > current) result[ref.locationId] = ref.playedAtMillis
            }
        }
        return result
    }

    /** Converte jogos do dominio em referencias; ignora jogos apagados e sem quadra. */
    fun gameRefs(games: List<Game>): List<VenueGameRef> = games
        .filter { !it.isSoftDeleted && it.locationId.isNotBlank() }
        .map { VenueGameRef(it.locationId, playedAtMillis(it)) }

    internal fun playedAtMillis(game: Game): Long {
        return try {
            val date = LocalDate.parse(game.date.trim())
            val time = game.time.trim().takeIf { it.isNotEmpty() }?.let { LocalTime.parse(it) } ?: LocalTime.MIDNIGHT
            date.atTime(time).toInstant(ZoneOffset.UTC).toEpochMilli()
        } catch (e: Exception) {
            game.createdAt ?: 0L
        }
    }

    /**
     * Ordem do produto: primeiro as quadras que o usuario usou (mais recente primeiro),
     * depois as demais em ordem alfabetica pt-BR ignorando acento e caixa.
     */
    fun order(locations: List<Location>, lastUsedAt: Map<String, Long>): List<Location> {
        val alphabetical = compareBy<Location>({ VenueSearch.normalize(it.name) }, { it.name }, { it.id })
        val (used, others) = locations.partition { lastUsedAt.containsKey(it.id) }
        val usedSorted = used.sortedWith(
            compareByDescending<Location> { lastUsedAt[it.id] ?: Long.MIN_VALUE }.then(alphabetical)
        )
        return usedSorted + others.sortedWith(alphabetical)
    }
}

/** Resultado do seletor: quadras da cidade e, se nao houver nenhuma, quadras de outras cidades. */
data class VenueListResult(
    val cityVenues: List<Location>,
    val otherCityVenues: List<Location>
) {
    val isEmpty: Boolean get() = cityVenues.isEmpty() && otherCityVenues.isEmpty()
}

object VenueListBuilder {

    /** "Nao verificada": rascunho importado, sem dono verificado. */
    fun isUnverified(location: Location): Boolean =
        !location.isVerified && location.publicationStatus.equals("DRAFT", ignoreCase = true)

    /**
     * Monta a lista exibida.
     * - busca vazia: todas as quadras da cidade (ordem do produto);
     * - busca com resultados na cidade: so as da cidade;
     * - busca sem resultados na cidade: "Resultados em outras cidades".
     */
    fun build(
        city: VenueCity?,
        cityPool: List<Location>,
        otherPool: List<Location>,
        query: String,
        lastUsedAt: Map<String, Long>
    ): VenueListResult {
        val inCity = cityPool.filter { it.isActive }
        val cityMatches = VenueOrdering.order(VenueSearch.filter(inCity, query), lastUsedAt)
        val searching = VenueSearch.tokenize(query).isNotEmpty()
        if (!searching || cityMatches.isNotEmpty()) return VenueListResult(cityMatches, emptyList())

        val cityIds = inCity.map { it.id }.toSet()
        val outside = otherPool
            .filter { it.isActive && it.id !in cityIds && !(city != null && city.sameAs(VenueCity.of(it))) }
            .distinctBy { it.id }
        return VenueListResult(emptyList(), VenueOrdering.order(VenueSearch.filter(outside, query), lastUsedAt))
    }
}
