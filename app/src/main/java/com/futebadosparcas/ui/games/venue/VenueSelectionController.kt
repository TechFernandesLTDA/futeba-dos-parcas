package com.futebadosparcas.ui.games.venue

import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Estado do seletor de quadras por cidade (compartilhado pelos dois ViewModels do seletor). */
data class VenueSelectionState(
    /** false ate a tela informar a localizacao do aparelho (ou a ausencia dela). */
    val started: Boolean = false,
    val isLoading: Boolean = true,
    val loadFailed: Boolean = false,
    val city: VenueCity? = null,
    val citySource: CitySource? = null,
    val query: String = "",
    val result: VenueListResult = VenueListResult(emptyList(), emptyList()),
    val lastUsedAt: Map<String, Long> = emptyMap()
) {
    /** Sem cidade descoberta: a tela deve abrir o seletor "Trocar cidade". */
    val needsCityChoice: Boolean get() = started && !isLoading && city == null
}

/** Estado do seletor "Trocar cidade" (UF -> cidade). */
data class CityPickerState(
    val uf: String? = null,
    val cities: List<String> = emptyList(),
    val isLoading: Boolean = false,
    val failed: Boolean = false
)

/**
 * Orquestra o seletor: descobre a cidade atual, carrega so as quadras dela, aplica busca e ordem.
 * Sem dependencia de Android; roda em [scope] (viewModelScope no app, TestScope nos testes).
 */
class VenueSelectionController(
    private val catalog: VenueCatalog,
    private val scope: CoroutineScope,
    private val searchDebounceMs: Long = SEARCH_DEBOUNCE_MS
) {
    private val _state = MutableStateFlow(VenueSelectionState())
    val state: StateFlow<VenueSelectionState> = _state.asStateFlow()

    private val _picker = MutableStateFlow(CityPickerState())
    val picker: StateFlow<CityPickerState> = _picker.asStateFlow()

    private var cityPool: List<Location> = emptyList()
    private var statePool: List<Location> = emptyList()
    private var remotePool: List<Location> = emptyList()
    private var started = false
    private var loadJob: Job? = null
    private var searchJob: Job? = null
    private var remoteJob: Job? = null
    private var pickerJob: Job? = null

    /** Inicia a descoberta da cidade. [device] e a posicao do aparelho (nulo sem permissao/GPS). So a 1a chamada vale. */
    fun start(device: VenueGeoPoint?) {
        if (started) return
        started = true
        _state.update { it.copy(started = true, isLoading = true, loadFailed = false) }
        loadJob = scope.launch {
            val usedJob = launch { loadLastUsed() }
            val resolution = try {
                catalog.resolveCity(device)
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao descobrir a cidade", e)
                null
            }
            usedJob.join()
            if (resolution == null) {
                _state.update { it.copy(isLoading = false, city = null, citySource = null) }
                recompute()
            } else {
                loadCityVenues(resolution.city, resolution.source)
            }
        }
    }

    /** Escolha manual em "Trocar cidade". Guarda a cidade como ultima escolhida. */
    fun selectCity(city: VenueCity) {
        started = true
        loadJob?.cancel()
        remoteJob?.cancel()
        _state.update { it.copy(started = true, isLoading = true, loadFailed = false, query = "") }
        catalog.rememberCity(city)
        loadJob = scope.launch {
            if (_state.value.lastUsedAt.isEmpty()) loadLastUsed()
            loadCityVenues(city, CitySource.MANUAL)
        }
    }

    fun retry() {
        val city = _state.value.city
        if (city != null) selectCity(city) else {
            started = false
            start(null)
        }
    }

    fun onQueryChanged(query: String) {
        _state.update { it.copy(query = query) }
        searchJob?.cancel()
        searchJob = scope.launch {
            delay(searchDebounceMs)
            recompute()
            fetchRemoteIfNeeded(query)
        }
    }

    /** Carrega as cidades de uma UF para o seletor "Trocar cidade". */
    fun openStatePicker(uf: String) {
        pickerJob?.cancel()
        _picker.value = CityPickerState(uf = BrazilianStates.toUf(uf), isLoading = true)
        pickerJob = scope.launch {
            val result = catalog.loadState(uf)
            val venues = result.getOrNull()
            _picker.value = if (venues == null) {
                CityPickerState(uf = BrazilianStates.toUf(uf), failed = true)
            } else {
                CityPickerState(uf = BrazilianStates.toUf(uf), cities = VenueCityResolver.citiesOf(venues, uf))
            }
        }
    }

    fun closePicker() {
        pickerJob?.cancel()
        _picker.value = CityPickerState()
    }

    private suspend fun loadLastUsed() {
        val used = try {
            catalog.lastUsedByLocation()
        } catch (e: Exception) {
            AppLogger.w(TAG) { "Jogos do usuario indisponiveis: ${e.message}" }
            emptyMap()
        }
        _state.update { it.copy(lastUsedAt = used) }
    }

    private suspend fun loadCityVenues(city: VenueCity, source: CitySource) {
        remotePool = emptyList()
        val result = try {
            catalog.loadCity(city)
        } catch (e: Exception) {
            Result.failure(e)
        }
        val venues = result.getOrNull()
        if (venues == null) {
            AppLogger.e(TAG, "Erro ao carregar quadras de ${city.label}", result.exceptionOrNull())
            _state.update {
                it.copy(isLoading = false, city = city, citySource = source, loadFailed = true)
            }
            return
        }
        cityPool = venues
        statePool = emptyList()
        _state.update { it.copy(isLoading = false, city = city, citySource = source, loadFailed = false) }
        recompute()
        fetchRemoteIfNeeded(_state.value.query)
    }

    /** Sem resultado na cidade: amplia para a UF (consulta por state) e, por fim, busca remota por prefixo. */
    private fun fetchRemoteIfNeeded(query: String) {
        remoteJob?.cancel()
        val current = _state.value
        val city = current.city ?: return
        if (VenueSearch.tokenize(query).isEmpty() || current.result.cityVenues.isNotEmpty()) return
        remoteJob = scope.launch {
            if (statePool.isEmpty() && city.uf.isNotEmpty()) {
                statePool = catalog.loadState(city.uf).getOrNull().orEmpty()
                recompute()
            }
            if (_state.value.result.otherCityVenues.isEmpty()) {
                remotePool = catalog.searchRemote(query)
                recompute()
            }
        }
    }

    private fun recompute() {
        val current = _state.value
        val others = (statePool + remotePool).distinctBy { it.id }
        val result = VenueListBuilder.build(current.city, cityPool, others, current.query, current.lastUsedAt)
        _state.update { it.copy(result = result) }
    }

    companion object {
        private const val TAG = "VenueSelection"
        const val SEARCH_DEBOUNCE_MS = 250L
    }
}
