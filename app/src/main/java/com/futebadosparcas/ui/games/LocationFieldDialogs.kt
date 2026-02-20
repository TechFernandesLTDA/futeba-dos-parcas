package com.futebadosparcas.ui.games
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import androidx.compose.animation.*
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.domain.model.FieldType
import com.futebadosparcas.domain.model.Location
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.util.AppLogger
import com.google.android.libraries.places.api.Places
import com.google.android.libraries.places.api.model.Place
import com.google.android.libraries.places.api.net.FetchPlaceRequest
import com.google.android.libraries.places.api.net.FindAutocompletePredictionsRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.text.Normalizer
import com.futebadosparcas.util.toAndroidLocations
import com.futebadosparcas.util.toAndroidFields

/**
 * Dialog moderno de seleção de local com busca integrada ao Google Places
 * Preparado para KMP/iOS
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationSelectionDialog(
    onDismiss: () -> Unit,
    onLocationSelected: (Location) -> Unit,
    viewModel: LocationSelectionViewModel = org.koin.compose.viewmodel.koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val searchQuery by viewModel.searchQuery.collectAsStateWithLifecycle()
    val locations by viewModel.locations.collectAsStateWithLifecycle()

    val keyboardController = LocalSoftwareKeyboardController.current

    BasicAlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier
            .fillMaxWidth()
            .fillMaxHeight(0.8f)
    ) {
        Surface(
            shape = MaterialTheme.shapes.extraLarge,
            tonalElevation = 6.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(Res.string.dialog_select_location_text_1),
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = stringResource(Res.string.close)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Search field
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = viewModel::onSearchQueryChanged,
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text(stringResource(Res.string.dialog_select_location_hint_2)) },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = null
                        )
                    },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { viewModel.onSearchQueryChanged("") }) {
                                Icon(
                                    imageVector = Icons.Default.Clear,
                                    contentDescription = stringResource(Res.string.empty_state_clear_search)
                                )
                            }
                        }
                    },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(
                        onSearch = { keyboardController?.hide() }
                    )
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Section title
                Text(
                    text = if (searchQuery.length >= 3) {
                        stringResource(Res.string.create_game_search_results)
                    } else {
                        stringResource(Res.string.dialog_select_location_text_3)
                    },
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Content
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                ) {
                    when (uiState) {
                        is LocationSelectionUiState.Loading -> {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator()
                            }
                        }

                        is LocationSelectionUiState.Success -> {
                            if (locations.isEmpty()) {
                                EmptyLocationState(searchQuery = searchQuery)
                            } else {
                                LocationList(
                                    locations = locations,
                                    onLocationClick = { location ->
                                        val placeId = location.placeId
                                        if (location.id.startsWith("places_") && placeId != null) {
                                            viewModel.fetchAndSavePlace(placeId) { savedLocation ->
                                                onLocationSelected(savedLocation)
                                            }
                                        } else {
                                            onLocationSelected(location)
                                        }
                                    }
                                )
                            }
                        }

                        is LocationSelectionUiState.Error -> {
                            ErrorLocationState(
                                message = (uiState as LocationSelectionUiState.Error).message,
                                onRetry = viewModel::loadLocations
                            )
                        }

                        LocationSelectionUiState.Idle -> {
                            // Initial state
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Action button
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Text(stringResource(Res.string.cancel))
                }
            }
        }
    }
}

@Composable
private fun LocationList(
    locations: List<Location>,
    onLocationClick: (Location) -> Unit
) {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(locations, key = { it.id }) { location ->
            LocationItem(
                location = location,
                onClick = { onLocationClick(location) }
            )
        }
    }
}

@Composable
private fun LocationItem(
    location: Location,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Place,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = location.name,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold
                )
                if (location.address.isNotEmpty()) {
                    Text(
                        text = location.getFullAddress(),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun EmptyLocationState(searchQuery: String) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.SearchOff,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = if (searchQuery.length >= 3) {
                stringResource(Res.string.empty_state_no_results_title)
            } else {
                stringResource(Res.string.dialog_select_location_text_4)
            },
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun ErrorLocationState(
    message: String,
    onRetry: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Error,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.error
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onRetry) {
            Text(stringResource(Res.string.retry))
        }
    }
}

/**
 * Dialog moderno de seleção de quadra/campo
 * Preparado para KMP/iOS
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FieldSelectionDialog(
    location: Location,
    onDismiss: () -> Unit,
    onFieldSelected: (Field) -> Unit,
    viewModel: FieldSelectionViewModel = org.koin.compose.viewmodel.koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val fields by viewModel.fields.collectAsStateWithLifecycle()
    val selectedFieldType by viewModel.selectedFieldType.collectAsStateWithLifecycle()

    LaunchedEffect(location.id) {
        viewModel.loadFields(location.id)
    }

    BasicAlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier
            .fillMaxWidth()
            .fillMaxHeight(0.7f)
    ) {
        Surface(
            shape = MaterialTheme.shapes.extraLarge,
            tonalElevation = 6.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = stringResource(Res.string.dialog_select_field_text_1),
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = location.name,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = stringResource(Res.string.close)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Filter chips
                ScrollableTabRow(
                    selectedTabIndex = when (selectedFieldType) {
                        null -> 0
                        FieldType.SOCIETY -> 1
                        FieldType.FUTSAL -> 2
                        FieldType.CAMPO -> 3
                        else -> 0
                    },
                    edgePadding = 0.dp
                ) {
                    FilterChipTab(
                        text = stringResource(Res.string.dialog_select_field_text_3),
                        isSelected = selectedFieldType == null,
                        onClick = { viewModel.filterByType(null) }
                    )
                    FilterChipTab(
                        text = stringResource(Res.string.dialog_select_field_text_4),
                        isSelected = selectedFieldType == FieldType.SOCIETY,
                        onClick = { viewModel.filterByType(FieldType.SOCIETY) }
                    )
                    FilterChipTab(
                        text = stringResource(Res.string.dialog_select_field_text_5),
                        isSelected = selectedFieldType == FieldType.FUTSAL,
                        onClick = { viewModel.filterByType(FieldType.FUTSAL) }
                    )
                    FilterChipTab(
                        text = stringResource(Res.string.dialog_select_field_text_6),
                        isSelected = selectedFieldType == FieldType.CAMPO,
                        onClick = { viewModel.filterByType(FieldType.CAMPO) }
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Content
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                ) {
                    when (uiState) {
                        is FieldSelectionUiState.Loading -> {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator()
                            }
                        }

                        is FieldSelectionUiState.Success -> {
                            if (fields.isEmpty()) {
                                EmptyFieldState()
                            } else {
                                FieldList(
                                    fields = fields,
                                    onFieldClick = onFieldSelected
                                )
                            }
                        }

                        is FieldSelectionUiState.Error -> {
                            ErrorFieldState(
                                message = (uiState as FieldSelectionUiState.Error).message,
                                onRetry = { viewModel.loadFields(location.id) }
                            )
                        }

                        FieldSelectionUiState.Idle -> {
                            // Initial state
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Action button
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Text(stringResource(Res.string.cancel))
                }
            }
        }
    }
}

@Composable
private fun FilterChipTab(
    text: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Tab(
        selected = isSelected,
        onClick = onClick,
        text = {
            Text(
                text = text,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
            )
        }
    )
}

@Composable
private fun FieldList(
    fields: List<Field>,
    onFieldClick: (Field) -> Unit
) {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(fields, key = { it.id }) { field ->
            FieldItem(
                field = field,
                onClick = { onFieldClick(field) }
            )
        }
    }
}

@Composable
private fun FieldItem(
    field: Field,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.SportsScore,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSecondaryContainer
            )

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = field.name,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSecondaryContainer
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    AssistChip(
                        onClick = {},
                        label = {
                            Text(
                                text = field.getTypeEnum().displayName,
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    )
                    if (field.hourlyPrice > 0) {
                        Text(
                            text = "R$ ${field.hourlyPrice}/h",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
                        )
                    }
                }
            }

            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSecondaryContainer
            )
        }
    }
}

@Composable
private fun EmptyFieldState() {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.SportsSoccer,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = stringResource(Res.string.dialog_select_field_text_7),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun ErrorFieldState(
    message: String,
    onRetry: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Error,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.error
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onRetry) {
            Text(stringResource(Res.string.retry))
        }
    }
}

// ViewModels para os dialogs

class LocationSelectionViewModel(
    private val locationRepository: LocationRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<LocationSelectionUiState>(LocationSelectionUiState.Idle)
    val uiState: StateFlow<LocationSelectionUiState> = _uiState

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery

    private val _locations = MutableStateFlow<List<Location>>(emptyList())
    val locations: StateFlow<List<Location>> = _locations

    private var savedLocations: List<Location> = emptyList()

    init {
        loadLocations()
    }

    fun loadLocations() {
        viewModelScope.launch {
            _uiState.value = LocationSelectionUiState.Loading
            try {
                val result = locationRepository.getAllLocations()
                result.fold(
                    onSuccess = { list ->
                        savedLocations = list.toAndroidLocations()
                        _locations.value = list.toAndroidLocations()
                        _uiState.value = LocationSelectionUiState.Success
                    },
                    onFailure = { error ->
                        AppLogger.e("LocationSelectionVM", "Erro ao carregar locais", error)
                        _uiState.value = LocationSelectionUiState.Error(
                            error.message ?: "Erro ao carregar locais"
                        )
                    }
                )
            } catch (e: Exception) {
                AppLogger.e("LocationSelectionVM", "Erro inesperado", e)
                _uiState.value = LocationSelectionUiState.Error("Erro inesperado")
            }
        }
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query

        if (query.length < 3) {
            _locations.value = savedLocations
            return
        }

        // Debounce e busca
        viewModelScope.launch {
            delay(300)
            searchLocations(query)
        }
    }

    private fun searchLocations(query: String) {
        val normalizedQuery = query.normalizeForSearch()

        val localResults = savedLocations.filter { location ->
            location.name.normalizeForSearch().contains(normalizedQuery) ||
                    location.address.normalizeForSearch().contains(normalizedQuery) ||
                    location.city.normalizeForSearch().contains(normalizedQuery) ||
                    location.neighborhood.normalizeForSearch().contains(normalizedQuery)
        }

        _locations.value = localResults
    }

    fun fetchAndSavePlace(placeId: String, onSaved: (Location) -> Unit) {
        // Implementação da busca no Google Places seria aqui
        // Por enquanto, apenas log
        AppLogger.d("LocationSelectionVM") { "Fetch place: $placeId" }
    }
}

class FieldSelectionViewModel(
    private val locationRepository: LocationRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<FieldSelectionUiState>(FieldSelectionUiState.Idle)
    val uiState: StateFlow<FieldSelectionUiState> = _uiState

    private val _fields = MutableStateFlow<List<Field>>(emptyList())
    val fields: StateFlow<List<Field>> = _fields

    private val _selectedFieldType = MutableStateFlow<FieldType?>(null)
    val selectedFieldType: StateFlow<FieldType?> = _selectedFieldType

    private var allFields: List<Field> = emptyList()

    fun loadFields(locationId: String) {
        viewModelScope.launch {
            _uiState.value = FieldSelectionUiState.Loading
            try {
                val result = locationRepository.getFieldsByLocation(locationId)
                result.fold(
                    onSuccess = { list ->
                        allFields = list.toAndroidFields()
                        applyFilter()
                        _uiState.value = FieldSelectionUiState.Success
                    },
                    onFailure = { error ->
                        AppLogger.e("FieldSelectionVM", "Erro ao carregar quadras", error)
                        _uiState.value = FieldSelectionUiState.Error(
                            error.message ?: "Erro ao carregar quadras"
                        )
                    }
                )
            } catch (e: Exception) {
                AppLogger.e("FieldSelectionVM", "Erro inesperado", e)
                _uiState.value = FieldSelectionUiState.Error("Erro inesperado")
            }
        }
    }

    fun filterByType(type: FieldType?) {
        _selectedFieldType.value = type
        applyFilter()
    }

    private fun applyFilter() {
        _fields.value = if (_selectedFieldType.value == null) {
            allFields
        } else {
            allFields.filter { it.getTypeEnum() == _selectedFieldType.value }
        }
    }
}

sealed class LocationSelectionUiState {
    object Idle : LocationSelectionUiState()
    object Loading : LocationSelectionUiState()
    object Success : LocationSelectionUiState()
    data class Error(val message: String) : LocationSelectionUiState()
}

sealed class FieldSelectionUiState {
    object Idle : FieldSelectionUiState()
    object Loading : FieldSelectionUiState()
    object Success : FieldSelectionUiState()
    data class Error(val message: String) : FieldSelectionUiState()
}

// Extension function para normalizar strings
private fun String.normalizeForSearch(): String {
    return Normalizer.normalize(this, Normalizer.Form.NFD)
        .replace("\\p{InCombiningDiacriticalMarks}+".toRegex(), "")
        .lowercase()
        .trim()
}
