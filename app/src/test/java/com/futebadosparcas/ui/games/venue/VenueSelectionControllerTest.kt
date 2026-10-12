package com.futebadosparcas.ui.games.venue

import com.futebadosparcas.data.repository.GameFilterType
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.ui.games.GameWithConfirmations
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

internal class FakeLastVenueCityStore(var stored: VenueCity? = null) : LastVenueCityStore {
    val saved = mutableListOf<VenueCity>()
    override fun load(): VenueCity? = stored
    override fun save(city: VenueCity) {
        saved += city
        stored = city
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
@ExtendWith(MockLogExtension::class)
@DisplayName("VenueSelectionController")
class VenueSelectionControllerTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var locations: LocationRepository
    private lateinit var games: GameRepository
    private lateinit var lastStore: FakeLastVenueCityStore
    private var profileCity: VenueCity? = null
    private var profileCalls = 0

    private val curitibaUser = VenueGeoPoint(-25.43, -49.27)

    private val arena = venue("arena", name = "Arena Portão", neighborhood = "Portão", latitude = -25.47, longitude = -49.30)
    private val bola = venue("bola", name = "Bola Cheia", neighborhood = "Centro", latitude = -25.43, longitude = -49.27)
    private val campo = venue(
        "campo", name = "Campo Sul", neighborhood = "Sítio Cercado",
        isVerified = false, publicationStatus = "DRAFT", latitude = -25.53, longitude = -49.26
    )
    private val curitibaVenues = listOf(campo, arena, bola)

    private val londrina = venue("lon", name = "Arena Londrina", city = "Londrina", latitude = -23.31, longitude = -51.16)
    private val maringa = venue("mar", name = "Quadra Maringá", city = "Maringá", latitude = -23.42, longitude = -51.93)
    private val paranaVenues = curitibaVenues + londrina + maringa

    @BeforeEach
    fun setUp() {
        locations = mockk()
        games = mockk()
        lastStore = FakeLastVenueCityStore()
        profileCity = null
        profileCalls = 0
        coEvery { games.getGamesByFilter(GameFilterType.MY_GAMES) } returns Result.success(emptyList())
        coEvery { locations.getLocationsInLatitudeBand(any(), any()) } returns Result.success(curitibaVenues)
        coEvery { locations.getLocationsByCity("Curitiba", "PR") } returns Result.success(curitibaVenues)
        coEvery { locations.getLocationsByStates(listOf("PR", "Paraná")) } returns Result.success(paranaVenues)
        coEvery { locations.searchLocations(any()) } returns Result.success(emptyList())
    }

    private fun controller(): VenueSelectionController {
        val catalog = VenueCatalog(
            locationRepository = locations,
            gameRepository = games,
            profileCitySource = object : ProfileCitySource {
                override suspend fun profileCity(): VenueCity? {
                    profileCalls++
                    return this@VenueSelectionControllerTest.profileCity
                }
            },
            lastCityStore = lastStore
        )
        return VenueSelectionController(catalog, CoroutineScope(dispatcher))
    }

    private fun gameAt(locationId: String, date: String) =
        GameWithConfirmations(Game(id = "g-$locationId-$date", locationId = locationId, date = date, time = "20:00"), 5)

    @Test
    fun `usa a cidade da quadra mais proxima do aparelho e carrega so a cidade`() = runTest(dispatcher) {
        val controller = controller()
        controller.start(curitibaUser)
        advanceUntilIdle()

        val state = controller.state.value
        assertEquals(VenueCity("Curitiba", "PR"), state.city)
        assertEquals(CitySource.DEVICE, state.citySource)
        assertFalse(state.isLoading)
        assertEquals(setOf("arena", "bola", "campo"), state.result.cityVenues.map { it.id }.toSet())
        assertEquals(0, profileCalls, "perfil nao e consultado quando o aparelho resolve")
        coVerify(exactly = 1) { locations.getLocationsByCity("Curitiba", "PR") }
        coVerify(exactly = 0) { locations.getAllLocations() }
        coVerify(exactly = 0) { locations.getLocationsWithPagination(any(), any()) }
    }

    @Test
    fun `sem aparelho cai na cidade do perfil`() = runTest(dispatcher) {
        profileCity = VenueCity("Curitiba", "PR")
        val controller = controller()
        controller.start(null)
        advanceUntilIdle()

        assertEquals(CitySource.PROFILE, controller.state.value.citySource)
        assertEquals("Curitiba - PR", controller.state.value.city?.label)
        coVerify(exactly = 0) { locations.getLocationsInLatitudeBand(any(), any()) }
    }

    @Test
    fun `sem perfil cai na ultima cidade escolhida`() = runTest(dispatcher) {
        lastStore.stored = VenueCity("Curitiba", "PR")
        val controller = controller()
        controller.start(null)
        advanceUntilIdle()

        assertEquals(CitySource.LAST_CHOSEN, controller.state.value.citySource)
        assertEquals(3, controller.state.value.result.cityVenues.size)
    }

    @Test
    fun `aparelho longe de qualquer quadra segue para o perfil`() = runTest(dispatcher) {
        profileCity = VenueCity("Curitiba", "PR")
        coEvery { locations.getLocationsInLatitudeBand(any(), any()) } returns Result.success(listOf(londrina))
        val controller = controller()
        controller.start(curitibaUser)
        advanceUntilIdle()

        assertEquals(CitySource.PROFILE, controller.state.value.citySource)
        coVerify(exactly = 2) { locations.getLocationsInLatitudeBand(any(), any()) } // raio curto e ampliado
    }

    @Test
    fun `sem nenhuma fonte pede para escolher a cidade e a escolha fica salva`() = runTest(dispatcher) {
        val controller = controller()
        controller.start(null)
        advanceUntilIdle()

        assertNull(controller.state.value.city)
        assertTrue(controller.state.value.needsCityChoice)

        controller.selectCity(VenueCity("Curitiba", "PR"))
        advanceUntilIdle()

        val state = controller.state.value
        assertEquals(CitySource.MANUAL, state.citySource)
        assertFalse(state.needsCityChoice)
        assertEquals(listOf(VenueCity("Curitiba", "PR")), lastStore.saved)
        assertEquals(3, state.result.cityVenues.size)
    }

    @Test
    fun `so a primeira chamada de start vale`() = runTest(dispatcher) {
        val controller = controller()
        controller.start(curitibaUser)
        controller.start(null)
        advanceUntilIdle()

        assertEquals(CitySource.DEVICE, controller.state.value.citySource)
    }

    @Test
    fun `ordem do produto - jogos do usuario primeiro, mais recente antes, depois alfabetica`() = runTest(dispatcher) {
        coEvery { games.getGamesByFilter(GameFilterType.MY_GAMES) } returns Result.success(
            listOf(
                gameAt("campo", "2026-09-01"),
                gameAt("arena", "2026-10-05"),
                gameAt("campo", "2026-10-09"),
                gameAt("outra-cidade", "2026-10-10")
            )
        )
        val controller = controller()
        controller.start(curitibaUser)
        advanceUntilIdle()

        // campo (09/10) > arena (05/10); "bola" nunca usada vai por ultimo
        assertEquals(listOf("campo", "arena", "bola"), controller.state.value.result.cityVenues.map { it.id })
    }

    @Test
    fun `falha ao ler os jogos nao impede a lista`() = runTest(dispatcher) {
        coEvery { games.getGamesByFilter(GameFilterType.MY_GAMES) } returns Result.failure(IllegalStateException("offline"))
        val controller = controller()
        controller.start(curitibaUser)
        advanceUntilIdle()

        assertEquals(listOf("arena", "bola", "campo"), controller.state.value.result.cityVenues.map { it.id })
    }

    @Test
    fun `busca filtra a cidade apos o debounce`() = runTest(dispatcher) {
        val controller = controller()
        controller.start(curitibaUser)
        advanceUntilIdle()

        controller.onQueryChanged("portao")
        advanceTimeBy(VenueSelectionController.SEARCH_DEBOUNCE_MS - 1)
        assertEquals(3, controller.state.value.result.cityVenues.size, "ainda no debounce")
        advanceUntilIdle()

        assertEquals("portao", controller.state.value.query)
        assertEquals(listOf("arena"), controller.state.value.result.cityVenues.map { it.id })
    }

    @Test
    fun `busca tolera erro de digitacao e abreviacao`() = runTest(dispatcher) {
        val controller = controller()
        controller.start(curitibaUser)
        advanceUntilIdle()

        controller.onQueryChanged("sitio sercado")
        advanceUntilIdle()
        assertEquals(listOf("campo"), controller.state.value.result.cityVenues.map { it.id })

        controller.onQueryChanged("")
        advanceUntilIdle()
        assertEquals(3, controller.state.value.result.cityVenues.size)
    }

    @Test
    fun `sem resultado na cidade mostra outras cidades do estado sem busca remota`() = runTest(dispatcher) {
        val controller = controller()
        controller.start(curitibaUser)
        advanceUntilIdle()

        controller.onQueryChanged("londrina")
        advanceUntilIdle()

        val result = controller.state.value.result
        assertTrue(result.cityVenues.isEmpty())
        assertEquals(listOf("lon"), result.otherCityVenues.map { it.id })
        coVerify(exactly = 0) { locations.searchLocations(any()) }
    }

    @Test
    fun `sem resultado no estado cai na busca remota por prefixo`() = runTest(dispatcher) {
        val florianopolis = venue("fln", name = "Arena Floripa", city = "Florianópolis", state = "SC")
        coEvery { locations.searchLocations("floripa") } returns Result.success(listOf(florianopolis))
        val controller = controller()
        controller.start(curitibaUser)
        advanceUntilIdle()

        controller.onQueryChanged("floripa")
        advanceUntilIdle()

        assertEquals(listOf("fln"), controller.state.value.result.otherCityVenues.map { it.id })
        coVerify(exactly = 1) { locations.searchLocations("floripa") }
    }

    @Test
    fun `cidade com grafia diferente no banco e achada pela UF`() = runTest(dispatcher) {
        val saoPaulo = venue("sp1", name = "Arena SP", city = "sao paulo", state = "São Paulo")
        coEvery { locations.getLocationsByCity("São Paulo", "SP") } returns Result.success(emptyList())
        coEvery { locations.getLocationsByStates(listOf("SP", "São Paulo")) } returns Result.success(listOf(saoPaulo))
        val controller = controller()
        controller.selectCity(VenueCity("São Paulo", "SP"))
        advanceUntilIdle()

        assertEquals(listOf("sp1"), controller.state.value.result.cityVenues.map { it.id })
    }

    @Test
    fun `erro ao carregar a cidade mostra falha e tentar de novo recarrega`() = runTest(dispatcher) {
        coEvery { locations.getLocationsByCity("Curitiba", "PR") } returns Result.failure(IllegalStateException("boom"))
        coEvery { locations.getLocationsByStates(listOf("PR", "Paraná")) } returns Result.failure(IllegalStateException("boom"))
        val controller = controller()
        controller.start(curitibaUser)
        advanceUntilIdle()

        assertTrue(controller.state.value.loadFailed)
        assertFalse(controller.state.value.isLoading)

        coEvery { locations.getLocationsByCity("Curitiba", "PR") } returns Result.success(curitibaVenues)
        controller.retry()
        advanceUntilIdle()

        assertFalse(controller.state.value.loadFailed)
        assertEquals(3, controller.state.value.result.cityVenues.size)
    }

    @Test
    fun `seletor Trocar cidade lista as cidades da UF em ordem alfabetica`() = runTest(dispatcher) {
        val controller = controller()
        controller.start(curitibaUser)
        advanceUntilIdle()

        controller.openStatePicker("pr")
        advanceUntilIdle()

        val picker = controller.picker.value
        assertEquals("PR", picker.uf)
        assertEquals(listOf("Curitiba", "Londrina", "Maringá"), picker.cities)
        assertFalse(picker.isLoading)

        controller.closePicker()
        assertEquals(CityPickerState(), controller.picker.value)
    }

    @Test
    fun `seletor Trocar cidade informa falha ao carregar o estado`() = runTest(dispatcher) {
        coEvery { locations.getLocationsByStates(listOf("SC", "Santa Catarina")) } returns Result.failure(IllegalStateException("x"))
        val controller = controller()
        controller.openStatePicker("SC")
        advanceUntilIdle()

        assertTrue(controller.picker.value.failed)
    }

    @Test
    fun `selos - rascunho importado aparece na lista da cidade`() = runTest(dispatcher) {
        val controller = controller()
        controller.start(curitibaUser)
        advanceUntilIdle()

        val unverified: List<Location> = controller.state.value.result.cityVenues.filter { VenueListBuilder.isUnverified(it) }
        assertEquals(listOf("campo"), unverified.map { it.id })
    }
}
