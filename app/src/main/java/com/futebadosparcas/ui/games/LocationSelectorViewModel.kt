package com.futebadosparcas.ui.games

import android.location.Location as AndroidGeoLocation
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.data.model.LocationReview
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.toAndroidField
import com.futebadosparcas.util.toAndroidFields
import com.futebadosparcas.util.toAndroidLocation
import com.futebadosparcas.util.toAndroidLocations
import com.futebadosparcas.util.toAndroidLocationReviews
import com.futebadosparcas.util.toKmpLocation
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.text.Normalizer
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject
import kotlin.math.*

/**
 * ViewModel para seleção de local aprimorada.
 * Suporta:
 * - Mapa interativo com pins
 * - Filtro por distância
 * - Locais favoritos
 * - Histórico de locais recentes
 * - Disponibilidade em tempo real
 * - Galeria de fotos
 * - Avaliações e reviews
 * - Preços de aluguel
 * - Filtro por amenidades
 * - Criação inline de local
 */
@HiltViewModel
class LocationSelectorViewModel @Inject constructor(
    private val locationRepository: LocationRepository,
    private val gameRepository: GameRepository,
    private val authRepository: AuthRepository,
    private val preferencesManager: com.futebadosparcas.util.PreferencesManager
) : ViewModel() {

    companion object {
        private const val TAG = "LocationSelectorVM"
        private const val MAX_RECENT_LOCATIONS = 5
        private const val SEARCH_DEBOUNCE_MS = 300L
    }

    // Estados principais
    private val _uiState = MutableStateFlow<LocationSelectorUiState>(LocationSelectorUiState.Loading)
    val uiState: StateFlow<LocationSelectorUiState> = _uiState.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _locations = MutableStateFlow<List<LocationWithDistance>>(emptyList())
    val locations: StateFlow<List<LocationWithDistance>> = _locations.asStateFlow()

    private val _favoriteLocations = MutableStateFlow<Set<String>>(emptySet())
    val favoriteLocations: StateFlow<Set<String>> = _favoriteLocations.asStateFlow()

    private val _recentLocations = MutableStateFlow<List<Location>>(emptyList())
    val recentLocations: StateFlow<List<Location>> = _recentLocations.asStateFlow()

    private val _userLocation = MutableStateFlow<UserGeoLocation?>(null)
    val userLocation: StateFlow<UserGeoLocation?> = _userLocation.asStateFlow()

    private val _sortMode = MutableStateFlow(LocationSortMode.NAME)
    val sortMode: StateFlow<LocationSortMode> = _sortMode.asStateFlow()

    private val _selectedAmenities = MutableStateFlow<Set<String>>(emptySet())
    val selectedAmenities: StateFlow<Set<String>> = _selectedAmenities.asStateFlow()

    private val _viewMode = MutableStateFlow(LocationViewMode.LIST)
    val viewMode: StateFlow<LocationViewMode> = _viewMode.asStateFlow()

    // Para verificação de disponibilidade
    private val _selectedDate = MutableStateFlow<LocalDate?>(null)
    val selectedDate: StateFlow<LocalDate?> = _selectedDate.asStateFlow()

    private val _selectedTime = MutableStateFlow<LocalTime?>(null)
    val selectedTime: StateFlow<LocalTime?> = _selectedTime.asStateFlow()

    private val _selectedEndTime = MutableStateFlow<LocalTime?>(null)
    val selectedEndTime: StateFlow<LocalTime?> = _selectedEndTime.asStateFlow()

    private val _fieldAvailability = MutableStateFlow<Map<String, Boolean>>(emptyMap())
    val fieldAvailability: StateFlow<Map<String, Boolean>> = _fieldAvailability.asStateFlow()

    // Para detalhes do local selecionado
    private val _selectedLocation = MutableStateFlow<Location?>(null)
    val selectedLocation: StateFlow<Location?> = _selectedLocation.asStateFlow()

    private val _selectedLocationFields = MutableStateFlow<List<Field>>(emptyList())
    val selectedLocationFields: StateFlow<List<Field>> = _selectedLocationFields.asStateFlow()

    private val _selectedLocationReviews = MutableStateFlow<List<LocationReview>>(emptyList())
    val selectedLocationReviews: StateFlow<List<LocationReview>> = _selectedLocationReviews.asStateFlow()

    // Criação inline de local
    private val _showCreateLocationDialog = MutableStateFlow(false)
    val showCreateLocationDialog: StateFlow<Boolean> = _showCreateLocationDialog.asStateFlow()

    private val _createLocationState = MutableStateFlow<CreateLocationState>(CreateLocationState.Idle)
    val createLocationState: StateFlow<CreateLocationState> = _createLocationState.asStateFlow()

    // Cache interno
    private var allLocations: List<Location> = emptyList()
    private var searchJob: Job? = null

    init {
        loadLocations()
        loadFavorites()
        loadRecentLocations()
    }

    // ==================== CARREGAR LOCAIS ====================

    fun loadLocations() {
        viewModelScope.launch {
            _uiState.value = LocationSelectorUiState.Loading
            try {
                val result = locationRepository.getAllLocations()
                result.fold(
                    onSuccess = { kmpLocations ->
                        allLocations = kmpLocations.toAndroidLocations()
                        applyFiltersAndSort()
                        _uiState.value = LocationSelectorUiState.Success
                    },
                    onFailure = { error ->
                        AppLogger.e(TAG, "Erro ao carregar locais", error)
                        _uiState.value = LocationSelectorUiState.Error(
                            error.message ?: "Erro ao carregar locais"
                        )
                    }
                )
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro inesperado", e)
                _uiState.value = LocationSelectorUiState.Error("Erro inesperado")
            }
        }
    }

    // ==================== BUSCA ====================

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(SEARCH_DEBOUNCE_MS)
            applyFiltersAndSort()
        }
    }

    private fun applyFiltersAndSort() {
        val query = _searchQuery.value
        val amenityFilter = _selectedAmenities.value
        val userLoc = _userLocation.value
        val sortBy = _sortMode.value

        var filtered = allLocations

        // Filtrar por busca
        if (query.length >= 2) {
            val normalizedQuery = query.normalizeForSearch()
            filtered = filtered.filter { location ->
                location.name.normalizeForSearch().contains(normalizedQuery) ||
                        location.address.normalizeForSearch().contains(normalizedQuery) ||
                        location.city.normalizeForSearch().contains(normalizedQuery) ||
                        location.neighborhood.normalizeForSearch().contains(normalizedQuery)
            }
        }

        // Filtrar por amenidades
        if (amenityFilter.isNotEmpty()) {
            filtered = filtered.filter { location ->
                amenityFilter.all { amenity ->
                    location.amenities.any { it.equals(amenity, ignoreCase = true) }
                }
            }
        }

        // Calcular distância e ordenar
        val withDistance = filtered.map { location ->
            val distance = if (userLoc != null) {
                val lat = location.latitude
                val lng = location.longitude
                if (lat != null && lng != null) {
                    calculateDistance(userLoc.latitude, userLoc.longitude, lat, lng)
                } else {
                    null
                }
            } else {
                null
            }
            LocationWithDistance(location, distance)
        }

        val sorted = when (sortBy) {
            LocationSortMode.NAME -> withDistance.sortedBy { it.location.name.lowercase() }
            LocationSortMode.DISTANCE -> {
                withDistance.sortedBy { it.distanceKm ?: Double.MAX_VALUE }
            }
            LocationSortMode.RATING -> withDistance.sortedByDescending { it.location.rating }
            LocationSortMode.FAVORITES_FIRST -> {
                val favs = _favoriteLocations.value
                withDistance.sortedByDescending { favs.contains(it.location.id) }
            }
        }

        _locations.value = sorted
    }

    // ==================== ORDENAÇÃO ====================

    fun setSortMode(mode: LocationSortMode) {
        _sortMode.value = mode
        applyFiltersAndSort()
    }

    // ==================== MODO DE VISUALIZAÇÃO ====================

    fun setViewMode(mode: LocationViewMode) {
        _viewMode.value = mode
    }

    // ==================== LOCALIZAÇÃO DO USUÁRIO ====================

    fun setUserLocation(latitude: Double, longitude: Double) {
        _userLocation.value = UserGeoLocation(latitude, longitude)
        applyFiltersAndSort()
    }

    private fun calculateDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371.0 // Raio da Terra em km
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2).pow(2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
                sin(dLon / 2).pow(2)
        val c = 2 * asin(sqrt(a))
        return r * c
    }

    // ==================== FAVORITOS ====================

    private fun loadFavorites() {
        viewModelScope.launch {
            _favoriteLocations.value = preferencesManager.getFavoriteLocations()
        }
    }

    fun toggleFavorite(locationId: String) {
        val current = _favoriteLocations.value.toMutableSet()
        if (current.contains(locationId)) {
            current.remove(locationId)
        } else {
            current.add(locationId)
        }
        _favoriteLocations.value = current
        // Persistir em SharedPreferences ou Firestore
        saveFavorites(current)
        applyFiltersAndSort()
    }

    private fun saveFavorites(favorites: Set<String>) {
        viewModelScope.launch {
            preferencesManager.setFavoriteLocations(favorites)
            AppLogger.d(TAG) { "Favoritos salvos: ${favorites.size}" }
        }
    }

    // ==================== HISTÓRICO RECENTE ====================

    private fun loadRecentLocations() {
        viewModelScope.launch {
            val recentIds = preferencesManager.getRecentLocationIds()
            if (recentIds.isNotEmpty()) {
                // Buscar os locais pelos IDs
                val locations = recentIds.mapNotNull { id ->
                    try {
                        locationRepository.getLocationById(id).getOrNull()?.toAndroidLocation()
                    } catch (e: Exception) {
                        null
                    }
                }
                _recentLocations.value = locations
            }
        }
    }

    fun addToRecentLocations(location: Location) {
        val current = _recentLocations.value.toMutableList()
        // Remover se já existe
        current.removeAll { it.id == location.id }
        // Adicionar no início
        current.add(0, location)
        // Limitar a MAX_RECENT_LOCATIONS
        if (current.size > MAX_RECENT_LOCATIONS) {
            current.removeAt(current.lastIndex)
        }
        _recentLocations.value = current
        saveRecentLocations(current)
    }

    private fun saveRecentLocations(recent: List<Location>) {
        viewModelScope.launch {
            val ids = recent.map { it.id }
            preferencesManager.setRecentLocationIds(ids)
            AppLogger.d(TAG) { "Locais recentes salvos: ${recent.size}" }
        }
    }

    // ==================== AMENIDADES ====================

    fun toggleAmenity(amenity: String) {
        val current = _selectedAmenities.value.toMutableSet()
        if (current.contains(amenity)) {
            current.remove(amenity)
        } else {
            current.add(amenity)
        }
        _selectedAmenities.value = current
        applyFiltersAndSort()
    }

    fun clearAmenityFilters() {
        _selectedAmenities.value = emptySet()
        applyFiltersAndSort()
    }

    // ==================== DISPONIBILIDADE EM TEMPO REAL ====================

    fun setGameDateTime(date: LocalDate?, startTime: LocalTime?, endTime: LocalTime?) {
        _selectedDate.value = date
        _selectedTime.value = startTime
        _selectedEndTime.value = endTime
        checkAllFieldsAvailability()
    }

    private fun checkAllFieldsAvailability() {
        val date = _selectedDate.value ?: return
        val startTime = _selectedTime.value ?: return
        val endTime = _selectedEndTime.value ?: return

        viewModelScope.launch {
            val availabilityMap = mutableMapOf<String, Boolean>()

            // Para cada local, verificar disponibilidade de suas quadras
            allLocations.forEach { location ->
                val fieldsResult = locationRepository.getFieldsByLocation(location.id)
                fieldsResult.getOrNull()?.forEach { kmpField ->
                    val field = kmpField.toAndroidField()
                    val isAvailable = checkFieldAvailability(
                        field.id,
                        date,
                        startTime,
                        endTime
                    )
                    availabilityMap[field.id] = isAvailable
                }
            }

            _fieldAvailability.value = availabilityMap
        }
    }

    private suspend fun checkFieldAvailability(
        fieldId: String,
        date: LocalDate,
        startTime: LocalTime,
        endTime: LocalTime
    ): Boolean {
        return try {
            val dateStr = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
            val startTimeStr = startTime.format(DateTimeFormatter.ofPattern("HH:mm"))
            val endTimeStr = endTime.format(DateTimeFormatter.ofPattern("HH:mm"))

            val result = gameRepository.checkTimeConflict(
                fieldId = fieldId,
                date = dateStr,
                startTime = startTimeStr,
                endTime = endTimeStr,
                excludeGameId = null
            )

            result.fold(
                onSuccess = { conflicts -> conflicts.isEmpty() },
                onFailure = { true } // Assumir disponível se erro
            )
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao verificar disponibilidade", e)
            true
        }
    }

    // ==================== DETALHES DO LOCAL ====================

    fun selectLocation(location: Location) {
        _selectedLocation.value = location
        loadLocationDetails(location.id)
        addToRecentLocations(location)
    }

    fun clearSelectedLocation() {
        _selectedLocation.value = null
        _selectedLocationFields.value = emptyList()
        _selectedLocationReviews.value = emptyList()
    }

    private fun loadLocationDetails(locationId: String) {
        viewModelScope.launch {
            // Carregar quadras e reviews em paralelo
            val fieldsDeferred = async {
                locationRepository.getFieldsByLocation(locationId)
            }
            val reviewsDeferred = async {
                locationRepository.getLocationReviews(locationId)
            }

            val fieldsResult = fieldsDeferred.await()
            val reviewsResult = reviewsDeferred.await()

            fieldsResult.onSuccess { kmpFields ->
                _selectedLocationFields.value = kmpFields.toAndroidFields()
            }

            reviewsResult.onSuccess { kmpReviews ->
                _selectedLocationReviews.value = kmpReviews.toAndroidLocationReviews()
            }
        }
    }

    // ==================== CRIAÇÃO INLINE DE LOCAL ====================

    fun showCreateLocationDialog() {
        _showCreateLocationDialog.value = true
        _createLocationState.value = CreateLocationState.Idle
    }

    fun hideCreateLocationDialog() {
        _showCreateLocationDialog.value = false
        _createLocationState.value = CreateLocationState.Idle
    }

    fun createLocation(
        name: String,
        address: String,
        city: String,
        state: String,
        neighborhood: String = "",
        latitude: Double? = null,
        longitude: Double? = null,
        amenities: List<String> = emptyList()
    ) {
        viewModelScope.launch {
            _createLocationState.value = CreateLocationState.Loading

            try {
                val userId = authRepository.getCurrentUserId() ?: ""
                val newLocation = Location(
                    name = name,
                    address = address,
                    city = city,
                    state = state,
                    neighborhood = neighborhood,
                    latitude = latitude,
                    longitude = longitude,
                    ownerId = userId,
                    amenities = amenities,
                    isActive = true
                )

                val result = locationRepository.createLocation(newLocation.toKmpLocation())
                result.fold(
                    onSuccess = { kmpLocation ->
                        val savedLocation = kmpLocation.toAndroidLocation()
                        _createLocationState.value = CreateLocationState.Success(savedLocation)
                        // Recarregar lista
                        loadLocations()
                        // Fechar dialog
                        hideCreateLocationDialog()
                    },
                    onFailure = { error ->
                        _createLocationState.value = CreateLocationState.Error(
                            error.message ?: "Erro ao criar local"
                        )
                    }
                )
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao criar local", e)
                _createLocationState.value = CreateLocationState.Error("Erro inesperado")
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        searchJob?.cancel()
    }
}

// ==================== DATA CLASSES ====================

data class LocationWithDistance(
    val location: Location,
    val distanceKm: Double?
) {
    fun getFormattedDistance(): String {
        return distanceKm?.let {
            if (it < 1.0) {
                "${(it * 1000).toInt()} m"
            } else {
                String.format(Locale.getDefault(), "%.1f km", it)
            }
        } ?: ""
    }
}

data class UserGeoLocation(
    val latitude: Double,
    val longitude: Double
)

// ==================== ENUMS ====================

enum class LocationSortMode {
    NAME,
    DISTANCE,
    RATING,
    FAVORITES_FIRST
}

enum class LocationViewMode {
    LIST,
    MAP
}

// ==================== UI STATES ====================

sealed class LocationSelectorUiState {
    object Loading : LocationSelectorUiState()
    object Success : LocationSelectorUiState()
    data class Error(val message: String) : LocationSelectorUiState()
}

sealed class CreateLocationState {
    object Idle : CreateLocationState()
    object Loading : CreateLocationState()
    data class Success(val location: Location) : CreateLocationState()
    data class Error(val message: String) : CreateLocationState()
}

// ==================== EXTENSÕES ====================

private fun String.normalizeForSearch(): String {
    return Normalizer.normalize(this, Normalizer.Form.NFD)
        .replace("\\p{InCombiningDiacriticalMarks}+".toRegex(), "")
        .lowercase()
        .trim()
}
