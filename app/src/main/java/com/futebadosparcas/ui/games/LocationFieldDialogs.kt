package com.futebadosparcas.ui.games

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.FieldType as AndroidFieldType
import com.futebadosparcas.domain.model.FieldType as KmpFieldType
import com.futebadosparcas.domain.model.Location
import kotlinx.coroutines.launch
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.ui.games.venue.CityPickerState
import com.futebadosparcas.ui.games.venue.VenueCatalog
import com.futebadosparcas.ui.games.venue.VenueChangeCityDialog
import com.futebadosparcas.ui.games.venue.VenueCity
import com.futebadosparcas.ui.games.venue.VenueCityBar
import com.futebadosparcas.ui.games.venue.VenueDeviceLocationGate
import com.futebadosparcas.ui.games.venue.VenueGeoPoint
import com.futebadosparcas.ui.games.venue.VenueListBuilder
import com.futebadosparcas.ui.games.venue.VenueListResult
import com.futebadosparcas.ui.games.venue.VenueOtherCitiesHeader
import com.futebadosparcas.ui.games.venue.VenueSelectionController
import com.futebadosparcas.ui.games.venue.VenueSelectionState
import com.futebadosparcas.ui.games.venue.VenueUnverifiedBadge
import kotlinx.coroutines.flow.StateFlow
import com.futebadosparcas.util.AppLogger
import com.google.android.libraries.places.api.Places
import com.google.android.libraries.places.api.model.Place
import com.google.android.libraries.places.api.net.FetchPlaceRequest
import com.google.android.libraries.places.api.net.FindAutocompletePredictionsRequest
import kotlinx.coroutines.flow.MutableStateFlow
import com.futebadosparcas.R
import com.futebadosparcas.util.toAndroidLocation
import com.futebadosparcas.util.toAndroidField
import com.futebadosparcas.util.toAndroidFields
import com.futebadosparcas.util.toAndroidLocations
import androidx.compose.ui.res.stringResource

/**
 * Dialog de seleção de local: mostra as quadras da cidade atual (aparelho -> perfil -> última escolhida),
 * com "Trocar cidade", ordem por último uso e busca inteligente (#4371).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationSelectionDialog(
    onDismiss: () -> Unit,
    onLocationSelected: (Location) -> Unit,
    viewModel: LocationSelectionViewModel = org.koin.compose.viewmodel.koinViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val picker by viewModel.picker.collectAsStateWithLifecycle()
    var showCityPicker by remember { mutableStateOf(false) }

    val keyboardController = LocalSoftwareKeyboardController.current

    if (!state.started) {
        VenueDeviceLocationGate(onResolved = viewModel::start)
    }
    LaunchedEffect(state.needsCityChoice) {
        if (state.needsCityChoice) showCityPicker = true
    }
    if (showCityPicker) {
        VenueChangeCityDialog(
            picker = picker,
            onPickState = viewModel::openStatePicker,
            onPickCity = { city ->
                viewModel.selectCity(city)
                viewModel.closePicker()
                showCityPicker = false
            },
            onBackToStates = viewModel::closePicker,
            onDismiss = {
                viewModel.closePicker()
                showCityPicker = false
            }
        )
    }

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
                        text = stringResource(R.string.dialog_select_location_text_1),
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = stringResource(R.string.close)
                        )
                    }
                }

                VenueCityBar(
                    city = state.city,
                    onChangeCity = { showCityPicker = true }
                )

                // Search field
                OutlinedTextField(
                    value = state.query,
                    onValueChange = viewModel::onSearchQueryChanged,
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text(stringResource(R.string.venue_search_hint)) },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = null
                        )
                    },
                    trailingIcon = {
                        if (state.query.isNotEmpty()) {
                            IconButton(onClick = { viewModel.onSearchQueryChanged("") }) {
                                Icon(
                                    imageVector = Icons.Default.Clear,
                                    contentDescription = stringResource(R.string.empty_state_clear_search)
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
                    text = if (state.query.isNotBlank()) {
                        stringResource(R.string.create_game_search_results)
                    } else {
                        stringResource(R.string.dialog_select_location_text_3)
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
                    when {
                        !state.started || state.isLoading -> {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator()
                            }
                        }

                        state.loadFailed -> {
                            ErrorLocationState(
                                message = stringResource(R.string.venue_load_failed),
                                onRetry = viewModel::retry
                            )
                        }

                        state.result.isEmpty -> {
                            EmptyLocationState(query = state.query, city = state.city)
                        }

                        else -> {
                            LocationList(
                                result = state.result,
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
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Action button
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Text(stringResource(R.string.cancel))
                }
            }
        }
    }
}

@Composable
private fun LocationList(
    result: VenueListResult,
    onLocationClick: (Location) -> Unit
) {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(result.cityVenues, key = { it.id }) { location ->
            LocationItem(
                location = location,
                onClick = { onLocationClick(location) }
            )
        }
        if (result.otherCityVenues.isNotEmpty()) {
            item(key = "other_cities_header") { VenueOtherCitiesHeader() }
            items(result.otherCityVenues, key = { "other_${it.id}" }) { location ->
                LocationItem(
                    location = location,
                    onClick = { onLocationClick(location) }
                )
            }
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
                if (VenueListBuilder.isUnverified(location)) {
                    VenueUnverifiedBadge(modifier = Modifier.padding(top = 4.dp))
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
private fun EmptyLocationState(query: String, city: VenueCity?) {
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
            text = when {
                city == null -> stringResource(R.string.venue_no_city_hint)
                query.isNotBlank() -> stringResource(R.string.venue_no_results_in_city, city.label)
                else -> stringResource(R.string.venue_empty_in_city, city.label)
            },
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
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
            Text(stringResource(R.string.retry))
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
                            text = stringResource(R.string.dialog_select_field_text_1),
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
                            contentDescription = stringResource(R.string.close)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Filter chips
                ScrollableTabRow(
                    selectedTabIndex = when (selectedFieldType) {
                        null -> 0
                        KmpFieldType.SOCIETY -> 1
                        KmpFieldType.FUTSAL -> 2
                        KmpFieldType.CAMPO -> 3
                        else -> 0
                    },
                    edgePadding = 0.dp
                ) {
                    FilterChipTab(
                        text = stringResource(R.string.dialog_select_field_text_3),
                        isSelected = selectedFieldType == null,
                        onClick = { viewModel.filterByType(null) }
                    )
                    FilterChipTab(
                        text = stringResource(R.string.dialog_select_field_text_4),
                        isSelected = selectedFieldType == KmpFieldType.SOCIETY,
                        onClick = { viewModel.filterByType(KmpFieldType.SOCIETY) }
                    )
                    FilterChipTab(
                        text = stringResource(R.string.dialog_select_field_text_5),
                        isSelected = selectedFieldType == KmpFieldType.FUTSAL,
                        onClick = { viewModel.filterByType(KmpFieldType.FUTSAL) }
                    )
                    FilterChipTab(
                        text = stringResource(R.string.dialog_select_field_text_6),
                        isSelected = selectedFieldType == KmpFieldType.CAMPO,
                        onClick = { viewModel.filterByType(KmpFieldType.CAMPO) }
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
                    Text(stringResource(R.string.cancel))
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
                            // getTypeEnum() retorna AndroidFieldType, que tem displayName
                            val androidFieldType: AndroidFieldType = field.getTypeEnum()
                            Text(
                                text = androidFieldType.displayName,
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
            text = stringResource(R.string.dialog_select_field_text_7),
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
            Text(stringResource(R.string.retry))
        }
    }
}

// ViewModels para os dialogs

/**
 * Seletor de local do "Criar Jogo". Toda a logica (cidade atual, ordem, busca) fica em
 * [VenueSelectionController]; aqui so a ponte com o ciclo de vida da tela.
 */
class LocationSelectionViewModel(
    catalog: VenueCatalog
) : ViewModel() {

    private val controller = VenueSelectionController(catalog, viewModelScope)

    val state: StateFlow<VenueSelectionState> = controller.state
    val picker: StateFlow<CityPickerState> = controller.picker

    /** Chamado pela tela quando a posicao do aparelho (ou sua ausencia) e conhecida. */
    fun start(device: VenueGeoPoint?) = controller.start(device)

    fun onSearchQueryChanged(query: String) = controller.onQueryChanged(query)

    fun selectCity(city: VenueCity) = controller.selectCity(city)

    fun openStatePicker(uf: String) = controller.openStatePicker(uf)

    fun closePicker() = controller.closePicker()

    fun retry() = controller.retry()

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

    private val _selectedFieldType = MutableStateFlow<KmpFieldType?>(null)
    val selectedFieldType: StateFlow<KmpFieldType?> = _selectedFieldType

    private var allFields: List<Field> = emptyList()

    fun loadFields(locationId: String) {
        viewModelScope.launch {
            _uiState.value = FieldSelectionUiState.Loading
            try {
                val result = locationRepository.getFieldsByLocation(locationId)
                result.fold(
                    onSuccess = { kmpFields ->
                        allFields = kmpFields.toAndroidFields()
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

    fun filterByType(type: KmpFieldType?) {
        _selectedFieldType.value = type
        applyFilter()
    }

    private fun applyFilter() {
        _fields.value = if (_selectedFieldType.value == null) {
            allFields
        } else {
            val targetTypeName = _selectedFieldType.value?.name?.uppercase()
            allFields.filter { it.type.uppercase() == targetTypeName }
        }
    }
}

sealed class FieldSelectionUiState {
    object Idle : FieldSelectionUiState()
    object Loading : FieldSelectionUiState()
    object Success : FieldSelectionUiState()
    data class Error(val message: String) : FieldSelectionUiState()
}
