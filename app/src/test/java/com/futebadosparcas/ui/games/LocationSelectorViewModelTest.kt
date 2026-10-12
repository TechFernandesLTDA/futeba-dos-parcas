package com.futebadosparcas.ui.games

import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.GameFilterType
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.ui.games.venue.CitySource
import com.futebadosparcas.ui.games.venue.LastVenueCityStore
import com.futebadosparcas.ui.games.venue.ProfileCitySource
import com.futebadosparcas.ui.games.venue.VenueCatalog
import com.futebadosparcas.ui.games.venue.VenueCity
import com.futebadosparcas.ui.games.venue.VenueGeoPoint
import com.futebadosparcas.util.MockLogExtension
import com.futebadosparcas.util.PreferencesManager
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

@OptIn(ExperimentalCoroutinesApi::class)
@ExtendWith(MockLogExtension::class)
@DisplayName("LocationSelectorViewModel - quadras da cidade atual")
class LocationSelectorViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var locations: LocationRepository
    private lateinit var games: GameRepository
    private lateinit var auth: AuthRepository
    private lateinit var prefs: PreferencesManager

    private val curitiba = VenueGeoPoint(-25.43, -49.27)

    private fun loc(
        id: String,
        name: String,
        city: String = "Curitiba",
        state: String = "PR",
        lat: Double? = null,
        lng: Double? = null,
        rating: Double = 0.0,
        verified: Boolean = true,
        status: String = "PUBLISHED",
        amenities: List<String> = emptyList(),
        neighborhood: String = ""
    ) = Location(
        id = id, name = name, city = city, state = state, latitude = lat, longitude = lng, rating = rating,
        isVerified = verified, publicationStatus = status, amenities = amenities, neighborhood = neighborhood
    )

    private val zeta = loc("zeta", "Zeta Society", lat = -25.50, lng = -49.30, rating = 4.9, amenities = listOf("estacionamento"))
    private val arena = loc("arena", "Árvore Arena", lat = -25.431, lng = -49.271, rating = 3.0, neighborhood = "Portão")
    private val bola = loc("bola", "Bola Cheia", lat = -25.60, lng = -49.40, rating = 4.0, verified = false, status = "DRAFT")
    private val londrina = loc("lon", "Arena Londrina", city = "Londrina", lat = -23.31, lng = -51.16)

    private fun viewModel(
        profile: VenueCity? = null,
        last: VenueCity? = null
    ): LocationSelectorViewModel {
        val catalog = VenueCatalog(
            locationRepository = locations,
            gameRepository = games,
            profileCitySource = object : ProfileCitySource {
                override suspend fun profileCity(): VenueCity? = profile
            },
            lastCityStore = object : LastVenueCityStore {
                override fun load(): VenueCity? = last
                override fun save(city: VenueCity) = Unit
            }
        )
        return LocationSelectorViewModel(locations, games, auth, prefs, catalog)
    }

    @BeforeEach
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        locations = mockk()
        games = mockk()
        auth = mockk()
        prefs = mockk(relaxed = true)
        every { prefs.getFavoriteLocations() } returns emptySet()
        every { prefs.getRecentLocationIds() } returns emptyList()
        coEvery { games.getGamesByFilter(GameFilterType.MY_GAMES) } returns Result.success(emptyList())
        coEvery { locations.getLocationsInLatitudeBand(any(), any()) } returns Result.success(listOf(zeta, arena, bola))
        coEvery { locations.getLocationsByCity("Curitiba", "PR") } returns Result.success(listOf(zeta, arena, bola))
        coEvery { locations.getLocationsByStates(listOf("PR", "Paraná")) } returns
            Result.success(listOf(zeta, arena, bola, londrina))
        coEvery { locations.searchLocations(any()) } returns Result.success(emptyList())
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `antes da tela informar a posicao fica em Loading e nada e consultado`() = runTest(dispatcher) {
        val vm = viewModel()
        advanceUntilIdle()

        assertEquals(LocationSelectorUiState.Loading, vm.uiState.value)
        coVerify(exactly = 0) { locations.getAllLocations() }
        coVerify(exactly = 0) { locations.getLocationsByCity(any(), any()) }
    }

    @Test
    fun `startSelection mostra as quadras da cidade do aparelho em ordem alfabetica sem acento`() = runTest(dispatcher) {
        val vm = viewModel()
        vm.startSelection(curitiba)
        advanceUntilIdle()

        assertEquals(LocationSelectorUiState.Success, vm.uiState.value)
        assertEquals(VenueCity("Curitiba", "PR"), vm.venueState.value.city)
        assertEquals(CitySource.DEVICE, vm.venueState.value.citySource)
        // "Árvore" entra como "arvore": vem antes de "Bola" e "Zeta"
        assertEquals(listOf("arena", "bola", "zeta"), vm.locations.value.map { it.location.id })
        assertNotNull(vm.userLocation.value)
        assertTrue(vm.locations.value.all { it.distanceKm != null })
        coVerify(exactly = 0) { locations.getAllLocations() }
    }

    @Test
    fun `quadras que o usuario usou vem primeiro, da mais recente para a mais antiga`() = runTest(dispatcher) {
        coEvery { games.getGamesByFilter(GameFilterType.MY_GAMES) } returns Result.success(
            listOf(
                GameWithConfirmations(Game(id = "1", locationId = "zeta", date = "2026-10-01", time = "19:00"), 4),
                GameWithConfirmations(Game(id = "2", locationId = "bola", date = "2026-10-08", time = "19:00"), 4)
            )
        )
        val vm = viewModel()
        vm.startSelection(null)
        // sem aparelho nem perfil: usa a ultima cidade escolhida
        advanceUntilIdle()
        assertTrue(vm.venueState.value.needsCityChoice)

        vm.selectCity(VenueCity("Curitiba", "PR"))
        advanceUntilIdle()

        assertEquals(listOf("bola", "zeta", "arena"), vm.locations.value.map { it.location.id })
    }

    @Test
    fun `busca nao usa acento nem caixa e atualiza o texto na hora`() = runTest(dispatcher) {
        val vm = viewModel()
        vm.startSelection(curitiba)
        advanceUntilIdle()

        vm.onSearchQueryChanged("ÁRVORE")
        assertEquals("ÁRVORE", vm.searchQuery.value)
        advanceUntilIdle()

        assertEquals(listOf("arena"), vm.locations.value.map { it.location.id })
    }

    @Test
    fun `busca por bairro com erro de digitacao`() = runTest(dispatcher) {
        val vm = viewModel()
        vm.startSelection(curitiba)
        advanceUntilIdle()

        vm.onSearchQueryChanged("portao arena")
        advanceUntilIdle()
        assertEquals(listOf("arena"), vm.locations.value.map { it.location.id })

        vm.onSearchQueryChanged("sociaty") // 7 letras, 1 erro
        advanceUntilIdle()
        assertEquals(listOf("zeta"), vm.locations.value.map { it.location.id })
    }

    @Test
    fun `sem resultado na cidade expoe resultados de outras cidades`() = runTest(dispatcher) {
        val vm = viewModel()
        vm.startSelection(curitiba)
        advanceUntilIdle()

        vm.onSearchQueryChanged("londrina")
        advanceUntilIdle()

        assertTrue(vm.locations.value.isEmpty())
        assertEquals(listOf("lon"), vm.otherCityLocations.value.map { it.location.id })
    }

    @Test
    fun `busca vazia volta para a lista da cidade`() = runTest(dispatcher) {
        val vm = viewModel()
        vm.startSelection(curitiba)
        advanceUntilIdle()
        vm.onSearchQueryChanged("londrina")
        advanceUntilIdle()

        vm.onSearchQueryChanged("")
        advanceUntilIdle()

        assertEquals(3, vm.locations.value.size)
        assertTrue(vm.otherCityLocations.value.isEmpty())
    }

    @Test
    fun `modos de ordenacao continuam funcionando`() = runTest(dispatcher) {
        val vm = viewModel()
        vm.startSelection(curitiba)
        advanceUntilIdle()

        vm.setSortMode(LocationSortMode.RATING)
        assertEquals(listOf("zeta", "bola", "arena"), vm.locations.value.map { it.location.id })

        vm.setSortMode(LocationSortMode.DISTANCE)
        assertEquals(listOf("arena", "zeta", "bola"), vm.locations.value.map { it.location.id })

        vm.setSortMode(LocationSortMode.NAME)
        assertEquals(listOf("arena", "bola", "zeta"), vm.locations.value.map { it.location.id })

        vm.setSortMode(LocationSortMode.RECENT_USE)
        assertEquals(listOf("arena", "bola", "zeta"), vm.locations.value.map { it.location.id })
    }

    @Test
    fun `filtro de amenidades combina com a cidade`() = runTest(dispatcher) {
        val vm = viewModel()
        vm.startSelection(curitiba)
        advanceUntilIdle()

        vm.toggleAmenity("Estacionamento")
        assertEquals(listOf("zeta"), vm.locations.value.map { it.location.id })

        vm.clearAmenityFilters()
        assertEquals(3, vm.locations.value.size)
    }

    @Test
    fun `quadra DRAFT importada continua na lista (o selo vem da UI)`() = runTest(dispatcher) {
        val vm = viewModel()
        vm.startSelection(curitiba)
        advanceUntilIdle()

        val bolaItem = vm.locations.value.first { it.location.id == "bola" }
        assertEquals("DRAFT", bolaItem.location.publicationStatus)
        assertEquals(false, bolaItem.location.isVerified)
    }

    @Test
    fun `erro ao carregar vira estado de Error e loadLocations tenta de novo`() = runTest(dispatcher) {
        coEvery { locations.getLocationsByCity("Curitiba", "PR") } returns Result.failure(IllegalStateException("x"))
        coEvery { locations.getLocationsByStates(listOf("PR", "Paraná")) } returns Result.failure(IllegalStateException("x"))
        val vm = viewModel()
        vm.startSelection(curitiba)
        advanceUntilIdle()
        assertInstanceOf(LocationSelectorUiState.Error::class.java, vm.uiState.value)

        coEvery { locations.getLocationsByCity("Curitiba", "PR") } returns Result.success(listOf(zeta))
        vm.loadLocations()
        advanceUntilIdle()

        assertEquals(LocationSelectorUiState.Success, vm.uiState.value)
        assertEquals(listOf("zeta"), vm.locations.value.map { it.location.id })
    }

    @Test
    fun `cadastrar quadra recarrega na cidade da nova quadra`() = runTest(dispatcher) {
        val created = loc("novo", "Quadra Nova", city = "Londrina")
        every { auth.getCurrentUserId() } returns "user-1"
        coEvery { locations.createLocation(any()) } returns Result.success(created)
        coEvery { locations.getLocationsByCity("Londrina", "PR") } returns Result.success(listOf(created, londrina))
        val vm = viewModel()
        vm.startSelection(curitiba)
        advanceUntilIdle()

        vm.createLocation(name = "Quadra Nova", address = "Rua A, 1", city = "Londrina", state = "PR")
        advanceUntilIdle()

        assertEquals(VenueCity("Londrina", "PR"), vm.venueState.value.city)
        assertEquals(listOf("lon", "novo"), vm.locations.value.map { it.location.id })
        coVerify(exactly = 1) { locations.getLocationsByCity("Londrina", "PR") }
    }

    @Test
    fun `Trocar cidade lista as cidades da UF`() = runTest(dispatcher) {
        val vm = viewModel()
        vm.startSelection(curitiba)
        advanceUntilIdle()

        vm.openStatePicker("PR")
        advanceUntilIdle()

        assertEquals(listOf("Curitiba", "Londrina"), vm.cityPicker.value.cities)
        vm.closeCityPicker()
        assertTrue(vm.cityPicker.value.cities.isEmpty())
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
@ExtendWith(MockLogExtension::class)
@DisplayName("LocationSelectionViewModel - dialog do Criar Jogo")
class LocationSelectionViewModelTest {

    private val dispatcher = StandardTestDispatcher()

    @BeforeEach
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `usa a ultima cidade escolhida e lista so as quadras dela`() = runTest(dispatcher) {
        val locations = mockk<LocationRepository>()
        val games = mockk<GameRepository>()
        val joinville = Location(id = "j1", name = "Arena Joinville", city = "Joinville", state = "SC")
        coEvery { games.getGamesByFilter(GameFilterType.MY_GAMES) } returns Result.success(emptyList())
        coEvery { locations.getLocationsByCity("Joinville", "SC") } returns Result.success(listOf(joinville))
        val catalog = VenueCatalog(
            locationRepository = locations,
            gameRepository = games,
            profileCitySource = object : ProfileCitySource {
                override suspend fun profileCity(): VenueCity? = null
            },
            lastCityStore = object : LastVenueCityStore {
                override fun load(): VenueCity = VenueCity("Joinville", "SC")
                override fun save(city: VenueCity) = Unit
            }
        )
        val vm = LocationSelectionViewModel(catalog)

        assertEquals(false, vm.state.value.started)
        vm.start(null)
        advanceUntilIdle()

        assertEquals(listOf("j1"), vm.state.value.result.cityVenues.map { it.id })
        assertEquals("Joinville - SC", vm.state.value.city?.label)
        coVerify(exactly = 0) { locations.getAllLocations() }
    }
}
