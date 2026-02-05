@file:OptIn(ExperimentalLayoutApi::class)

package com.futebadosparcas.ui.games

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Sort
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.data.model.LocationReview
import com.futebadosparcas.ui.components.CachedFieldImage
import com.futebadosparcas.ui.components.states.LoadingState
import com.futebadosparcas.ui.components.states.LoadingItemType
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import java.time.LocalDate
import java.time.LocalTime
import java.util.Locale

/**
 * Tela avançada de seleção de local com:
 * - Visualização em lista ou mapa
 * - Busca com autocomplete
 * - Filtros por amenidades
 * - Ordenação por distância/nome/avaliação
 * - Favoritos e histórico recente
 * - Indicador de disponibilidade
 * - Galeria de fotos
 * - Avaliações
 * - Preços
 * - Criação inline de local
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationSelectorScreen(
    onDismiss: () -> Unit,
    onLocationSelected: (Location) -> Unit,
    onFieldSelected: (Location, Field) -> Unit,
    selectedDate: LocalDate? = null,
    selectedTime: LocalTime? = null,
    selectedEndTime: LocalTime? = null,
    viewModel: LocationSelectorViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val searchQuery by viewModel.searchQuery.collectAsStateWithLifecycle()
    val locations by viewModel.locations.collectAsStateWithLifecycle()
    val favoriteLocations by viewModel.favoriteLocations.collectAsStateWithLifecycle()
    val recentLocations by viewModel.recentLocations.collectAsStateWithLifecycle()
    val sortMode by viewModel.sortMode.collectAsStateWithLifecycle()
    val selectedAmenities by viewModel.selectedAmenities.collectAsStateWithLifecycle()
    val viewMode by viewModel.viewMode.collectAsStateWithLifecycle()
    val selectedLocation by viewModel.selectedLocation.collectAsStateWithLifecycle()
    val selectedLocationFields by viewModel.selectedLocationFields.collectAsStateWithLifecycle()
    val selectedLocationReviews by viewModel.selectedLocationReviews.collectAsStateWithLifecycle()
    val fieldAvailability by viewModel.fieldAvailability.collectAsStateWithLifecycle()
    val showCreateDialog by viewModel.showCreateLocationDialog.collectAsStateWithLifecycle()
    val createLocationState by viewModel.createLocationState.collectAsStateWithLifecycle()
    val userLocation by viewModel.userLocation.collectAsStateWithLifecycle()

    val context = LocalContext.current
    val keyboardController = LocalSoftwareKeyboardController.current

    var showSortMenu by remember { mutableStateOf(false) }
    var showFilterSheet by remember { mutableStateOf(false) }

    // Configurar data/hora para verificação de disponibilidade
    LaunchedEffect(selectedDate, selectedTime, selectedEndTime) {
        viewModel.setGameDateTime(selectedDate, selectedTime, selectedEndTime)
    }

    // Solicitar permissão de localização
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseLocationGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false

        if (fineLocationGranted || coarseLocationGranted) {
            requestUserLocation(context) { lat, lng ->
                viewModel.setUserLocation(lat, lng)
            }
        }
    }

    // Verificar e solicitar permissão na inicialização
    LaunchedEffect(Unit) {
        val hasFineLocation = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val hasCoarseLocation = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (hasFineLocation || hasCoarseLocation) {
            requestUserLocation(context) { lat, lng ->
                viewModel.setUserLocation(lat, lng)
            }
        } else {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = false
        )
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
            Scaffold(
                topBar = {
                    TopAppBar(
                        title = {
                            Text(
                                text = stringResource(R.string.location_selector_title),
                                style = MaterialTheme.typography.titleLarge
                            )
                        },
                        navigationIcon = {
                            IconButton(onClick = onDismiss) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                    contentDescription = stringResource(R.string.close)
                                )
                            }
                        },
                        actions = {
                            // Botão de visualização (Lista/Mapa)
                            IconButton(
                                onClick = {
                                    viewModel.setViewMode(
                                        if (viewMode == LocationViewMode.LIST) LocationViewMode.MAP
                                        else LocationViewMode.LIST
                                    )
                                }
                            ) {
                                Icon(
                                    imageVector = if (viewMode == LocationViewMode.LIST) {
                                        Icons.Default.Map
                                    } else {
                                        Icons.Default.ViewList
                                    },
                                    contentDescription = stringResource(R.string.location_selector_toggle_view)
                                )
                            }

                            // Botão de ordenação
                            Box {
                                IconButton(onClick = { showSortMenu = true }) {
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Filled.Sort,
                                        contentDescription = stringResource(R.string.location_selector_sort)
                                    )
                                }
                                SortDropdownMenu(
                                    expanded = showSortMenu,
                                    onDismiss = { showSortMenu = false },
                                    currentSort = sortMode,
                                    onSortSelected = {
                                        viewModel.setSortMode(it)
                                        showSortMenu = false
                                    },
                                    hasUserLocation = userLocation != null
                                )
                            }

                            // Botão de filtros
                            IconButton(onClick = { showFilterSheet = true }) {
                                BadgedBox(
                                    badge = {
                                        if (selectedAmenities.isNotEmpty()) {
                                            Badge {
                                                Text("${selectedAmenities.size}")
                                            }
                                        }
                                    }
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.FilterList,
                                        contentDescription = stringResource(R.string.location_selector_filter)
                                    )
                                }
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(
                            containerColor = MaterialTheme.colorScheme.surface
                        )
                    )
                },
                floatingActionButton = {
                    ExtendedFloatingActionButton(
                        onClick = { viewModel.showCreateLocationDialog() },
                        icon = { Icon(Icons.Default.Add, contentDescription = null) },
                        text = { Text(stringResource(R.string.location_selector_create_new)) },
                        containerColor = MaterialTheme.colorScheme.primaryContainer,
                        contentColor = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            ) { paddingValues ->
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                ) {
                    // Barra de busca
                    SearchBar(
                        query = searchQuery,
                        onQueryChange = viewModel::onSearchQueryChanged,
                        onClear = { viewModel.onSearchQueryChanged("") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp)
                    )

                    // Chips de amenidades selecionadas
                    if (selectedAmenities.isNotEmpty()) {
                        SelectedAmenitiesRow(
                            amenities = selectedAmenities,
                            onRemove = { viewModel.toggleAmenity(it) },
                            onClearAll = { viewModel.clearAmenityFilters() },
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                        )
                    }

                    // Conteúdo principal
                    when (uiState) {
                        is LocationSelectorUiState.Loading -> {
                            LoadingState(shimmerCount = 8, itemType = LoadingItemType.LOCATION_CARD)
                        }

                        is LocationSelectorUiState.Error -> {
                            ErrorState(
                                message = (uiState as LocationSelectorUiState.Error).message,
                                onRetry = { viewModel.loadLocations() }
                            )
                        }

                        is LocationSelectorUiState.Success -> {
                            when (viewMode) {
                                LocationViewMode.LIST -> {
                                    LocationListView(
                                        locations = locations,
                                        recentLocations = recentLocations,
                                        favoriteLocations = favoriteLocations,
                                        onLocationClick = { location ->
                                            viewModel.selectLocation(location)
                                        },
                                        onFavoriteToggle = { viewModel.toggleFavorite(it) },
                                        searchQuery = searchQuery
                                    )
                                }

                                LocationViewMode.MAP -> {
                                    // Placeholder para mapa
                                    MapViewPlaceholder(
                                        locations = locations,
                                        userLocation = userLocation,
                                        onLocationClick = { location ->
                                            viewModel.selectLocation(location)
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Bottom sheet de detalhes do local
            selectedLocation?.let { location ->
                LocationDetailBottomSheet(
                    location = location,
                    fields = selectedLocationFields,
                    reviews = selectedLocationReviews,
                    isFavorite = favoriteLocations.contains(location.id),
                    fieldAvailability = fieldAvailability,
                    selectedDate = selectedDate,
                    selectedTime = selectedTime,
                    onDismiss = { viewModel.clearSelectedLocation() },
                    onLocationConfirmed = {
                        onLocationSelected(location)
                        viewModel.clearSelectedLocation()
                    },
                    onFieldSelected = { field ->
                        onFieldSelected(location, field)
                        viewModel.clearSelectedLocation()
                    },
                    onFavoriteToggle = { viewModel.toggleFavorite(location.id) }
                )
            }

            // Dialog de filtros
            if (showFilterSheet) {
                AmenitiesFilterSheet(
                    selectedAmenities = selectedAmenities,
                    onToggleAmenity = { viewModel.toggleAmenity(it) },
                    onDismiss = { showFilterSheet = false }
                )
            }

            // Dialog de criação de local
            if (showCreateDialog) {
                CreateLocationDialog(
                    state = createLocationState,
                    onDismiss = { viewModel.hideCreateLocationDialog() },
                    onConfirm = { name, address, city, state, neighborhood, amenities ->
                        viewModel.createLocation(
                            name = name,
                            address = address,
                            city = city,
                            state = state,
                            neighborhood = neighborhood,
                            amenities = amenities
                        )
                    }
                )
            }
        }
    }
}

// ==================== COMPONENTES ====================

@Composable
private fun SearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    onClear: () -> Unit,
    modifier: Modifier = Modifier
) {
    val keyboardController = LocalSoftwareKeyboardController.current

    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = modifier,
        placeholder = { Text(stringResource(R.string.location_selector_search_hint)) },
        leadingIcon = {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        },
        trailingIcon = {
            if (query.isNotEmpty()) {
                IconButton(onClick = onClear) {
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
        ),
        shape = RoundedCornerShape(28.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = Color.Transparent
        )
    )
}

@Composable
private fun SortDropdownMenu(
    expanded: Boolean,
    onDismiss: () -> Unit,
    currentSort: LocationSortMode,
    onSortSelected: (LocationSortMode) -> Unit,
    hasUserLocation: Boolean
) {
    DropdownMenu(
        expanded = expanded,
        onDismissRequest = onDismiss
    ) {
        DropdownMenuItem(
            text = { Text(stringResource(R.string.location_selector_sort_name)) },
            onClick = { onSortSelected(LocationSortMode.NAME) },
            leadingIcon = {
                if (currentSort == LocationSortMode.NAME) {
                    Icon(Icons.Default.Check, contentDescription = null)
                }
            }
        )
        DropdownMenuItem(
            text = { Text(stringResource(R.string.location_selector_sort_distance)) },
            onClick = { onSortSelected(LocationSortMode.DISTANCE) },
            enabled = hasUserLocation,
            leadingIcon = {
                if (currentSort == LocationSortMode.DISTANCE) {
                    Icon(Icons.Default.Check, contentDescription = null)
                }
            }
        )
        DropdownMenuItem(
            text = { Text(stringResource(R.string.location_selector_sort_rating)) },
            onClick = { onSortSelected(LocationSortMode.RATING) },
            leadingIcon = {
                if (currentSort == LocationSortMode.RATING) {
                    Icon(Icons.Default.Check, contentDescription = null)
                }
            }
        )
        DropdownMenuItem(
            text = { Text(stringResource(R.string.location_selector_sort_favorites)) },
            onClick = { onSortSelected(LocationSortMode.FAVORITES_FIRST) },
            leadingIcon = {
                if (currentSort == LocationSortMode.FAVORITES_FIRST) {
                    Icon(Icons.Default.Check, contentDescription = null)
                }
            }
        )
    }
}

@Composable
private fun SelectedAmenitiesRow(
    amenities: Set<String>,
    onRemove: (String) -> Unit,
    onClearAll: () -> Unit,
    modifier: Modifier = Modifier
) {
    LazyRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(amenities.toList(), key = { it }) { amenity ->
            InputChip(
                selected = true,
                onClick = { onRemove(amenity) },
                label = { Text(getAmenityDisplayName(amenity)) },
                trailingIcon = {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = stringResource(R.string.location_selector_remove_filter),
                        modifier = Modifier.size(16.dp)
                    )
                }
            )
        }
        item {
            TextButton(onClick = onClearAll) {
                Text(stringResource(R.string.location_selector_clear_filters))
            }
        }
    }
}

@Composable
private fun LocationListView(
    locations: List<LocationWithDistance>,
    recentLocations: List<Location>,
    favoriteLocations: Set<String>,
    onLocationClick: (Location) -> Unit,
    onFavoriteToggle: (String) -> Unit,
    searchQuery: String
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Seção de locais recentes (só mostrar se não está buscando)
        if (recentLocations.isNotEmpty() && searchQuery.isEmpty()) {
            item {
                Text(
                    text = stringResource(R.string.location_selector_recent),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
            }
            items(recentLocations.take(3), key = { it.id }) { location ->
                RecentLocationCard(
                    location = location,
                    onClick = { onLocationClick(location) }
                )
            }
            item {
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            }
        }

        // Título da seção principal
        item {
            Text(
                text = if (searchQuery.isNotEmpty()) {
                    stringResource(R.string.location_selector_search_results)
                } else {
                    stringResource(R.string.location_selector_all_locations)
                },
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 8.dp)
            )
        }

        if (locations.isEmpty()) {
            item {
                EmptyLocationsState(hasQuery = searchQuery.isNotEmpty())
            }
        } else {
            items(locations, key = { it.location.id }) { locationWithDistance ->
                LocationCard(
                    locationWithDistance = locationWithDistance,
                    isFavorite = favoriteLocations.contains(locationWithDistance.location.id),
                    onClick = { onLocationClick(locationWithDistance.location) },
                    onFavoriteToggle = { onFavoriteToggle(locationWithDistance.location.id) }
                )
            }
        }

        // Espaço para FAB
        item {
            Spacer(modifier = Modifier.height(80.dp))
        }
    }
}

@Composable
private fun RecentLocationCard(
    location: Location,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.History,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = location.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = location.getFullAddress(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
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
private fun LocationCard(
    locationWithDistance: LocationWithDistance,
    isFavorite: Boolean,
    onClick: () -> Unit,
    onFavoriteToggle: () -> Unit
) {
    val location = locationWithDistance.location

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth()
        ) {
            // Imagem do local (se disponível)
            location.photoUrl?.let { photoUrl ->
                AsyncImage(
                    model = photoUrl,
                    contentDescription = null,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp),
                    contentScale = ContentScale.Crop
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Nome e avaliação
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = location.name,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        if (location.rating > 0) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Star,
                                    contentDescription = null,
                                    tint = Color(0xFFFFC107),
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(
                                    text = String.format(Locale.getDefault(), "%.1f", location.rating),
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.Medium
                                )
                                if (location.ratingCount > 0) {
                                    Text(
                                        text = "(${location.ratingCount})",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }

                    // Botão de favorito
                    IconButton(onClick = onFavoriteToggle) {
                        Icon(
                            imageVector = if (isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                            contentDescription = stringResource(R.string.location_selector_favorite),
                            tint = if (isFavorite) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Endereço
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Place,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = location.getFullAddress(),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                }

                // Distância (se disponível)
                locationWithDistance.distanceKm?.let { distance ->
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.NearMe,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = locationWithDistance.getFormattedDistance(),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                // Amenidades (principais)
                if (location.amenities.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        items(location.amenities.take(4)) { amenity ->
                            AmenityChip(amenity = amenity)
                        }
                        if (location.amenities.size > 4) {
                            item {
                                SuggestionChip(
                                    onClick = {},
                                    label = { Text("+${location.amenities.size - 4}") }
                                )
                            }
                        }
                    }
                }

                // Informações adicionais
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    // Número de quadras
                    if (location.fieldCount > 0) {
                        Text(
                            text = stringResource(R.string.location_selector_field_count, location.fieldCount),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    // Tipo principal de quadra
                    location.primaryFieldType?.let { fieldType ->
                        AssistChip(
                            onClick = {},
                            label = { Text(fieldType) },
                            modifier = Modifier.height(24.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AmenityChip(amenity: String) {
    val icon = getAmenityIcon(amenity)
    val displayName = getAmenityDisplayName(amenity)

    SuggestionChip(
        onClick = {},
        label = { Text(displayName, style = MaterialTheme.typography.labelSmall) },
        icon = icon?.let {
            {
                Icon(
                    imageVector = it,
                    contentDescription = null,
                    modifier = Modifier.size(14.dp)
                )
            }
        },
        modifier = Modifier.height(24.dp)
    )
}

@Composable
private fun MapViewPlaceholder(
    locations: List<LocationWithDistance>,
    userLocation: UserGeoLocation?,
    onLocationClick: (Location) -> Unit
) {
    // Placeholder para integração com Google Maps
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Map,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = stringResource(R.string.location_selector_map_placeholder),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
            Text(
                text = stringResource(R.string.location_selector_locations_count, locations.size),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LocationDetailBottomSheet(
    location: Location,
    fields: List<Field>,
    reviews: List<LocationReview>,
    isFavorite: Boolean,
    fieldAvailability: Map<String, Boolean>,
    selectedDate: LocalDate?,
    selectedTime: LocalTime?,
    onDismiss: () -> Unit,
    onLocationConfirmed: () -> Unit,
    onFieldSelected: (Field) -> Unit,
    onFavoriteToggle: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = location.name,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                    if (location.rating > 0) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            repeat(5) { index ->
                                val filled = index < location.rating.toInt()
                                Icon(
                                    imageVector = if (filled) Icons.Default.Star else Icons.Default.StarBorder,
                                    contentDescription = null,
                                    tint = Color(0xFFFFC107),
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            Text(
                                text = String.format(Locale.getDefault(), "%.1f", location.rating),
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium
                            )
                            Text(
                                text = "(${location.ratingCount} ${stringResource(R.string.location_selector_reviews)})",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
                IconButton(onClick = onFavoriteToggle) {
                    Icon(
                        imageVector = if (isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                        contentDescription = null,
                        tint = if (isFavorite) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Endereço
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Place,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = location.getFullAddress(),
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            // Horário de funcionamento
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Schedule,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "${location.openingTime} - ${location.closingTime}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Amenidades
            if (location.amenities.isNotEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = stringResource(R.string.location_selector_amenities),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    location.amenities.forEach { amenity ->
                        AmenityChip(amenity = amenity)
                    }
                }
            }

            // Galeria de fotos (se disponível)
            location.photoUrl?.let {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = stringResource(R.string.location_selector_photos),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                AsyncImage(
                    model = it,
                    contentDescription = null,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .clip(RoundedCornerShape(12.dp)),
                    contentScale = ContentScale.Crop
                )
            }

            // Quadras disponíveis
            if (fields.isNotEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = stringResource(R.string.location_selector_fields),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))

                fields.forEach { field ->
                    val isAvailable = fieldAvailability[field.id] ?: true
                    FieldCard(
                        field = field,
                        isAvailable = isAvailable,
                        showAvailability = selectedDate != null && selectedTime != null,
                        onClick = { onFieldSelected(field) }
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }

            // Reviews
            if (reviews.isNotEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = stringResource(R.string.location_selector_recent_reviews),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))

                reviews.take(3).forEach { review ->
                    ReviewCard(review = review)
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }

            // Botão de confirmação
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = onLocationConfirmed,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(stringResource(R.string.location_selector_select_location))
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun FieldCard(
    field: Field,
    isAvailable: Boolean,
    showAvailability: Boolean,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Foto da quadra
            if (!field.photos.isNullOrEmpty()) {
                CachedFieldImage(
                    imageUrl = field.photos.first(),
                    fieldName = field.name,
                    width = 60.dp,
                    height = 60.dp
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.SportsScore,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = field.name,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    AssistChip(
                        onClick = {},
                        label = { Text(field.getTypeEnum().displayName) },
                        modifier = Modifier.height(24.dp)
                    )
                    if (field.hourlyPrice > 0) {
                        Text(
                            text = stringResource(R.string.location_selector_price_per_hour, field.hourlyPrice),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            // Indicador de disponibilidade
            if (showAvailability) {
                Icon(
                    imageVector = if (isAvailable) Icons.Default.CheckCircle else Icons.Default.Cancel,
                    contentDescription = if (isAvailable) {
                        stringResource(R.string.location_selector_available)
                    } else {
                        stringResource(R.string.location_selector_unavailable)
                    },
                    tint = if (isAvailable) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.error
                    }
                )
            } else {
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun ReviewCard(review: LocationReview) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp)
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Avatar
                review.userPhotoUrl?.let { photoUrl ->
                    AsyncImage(
                        model = photoUrl,
                        contentDescription = null,
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape),
                        contentScale = ContentScale.Crop
                    )
                } ?: Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = review.userName.take(1).uppercase(),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = review.userName,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium
                    )
                    Row {
                        repeat(5) { index ->
                            Icon(
                                imageVector = if (index < review.rating.toInt()) Icons.Default.Star else Icons.Default.StarBorder,
                                contentDescription = null,
                                tint = Color(0xFFFFC107),
                                modifier = Modifier.size(12.dp)
                            )
                        }
                    }
                }
            }

            if (review.comment.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = review.comment,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AmenitiesFilterSheet(
    selectedAmenities: Set<String>,
    onToggleAmenity: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState()
    val amenities = listOf(
        "estacionamento" to Icons.Default.LocalParking,
        "vestiario" to Icons.Default.Checkroom,
        "churrasqueira" to Icons.Default.OutdoorGrill,
        "bar" to Icons.Default.LocalBar,
        "restaurante" to Icons.Default.Restaurant,
        "iluminacao" to Icons.Default.LightMode,
        "wifi" to Icons.Default.Wifi,
        "banheiro" to Icons.Default.Wc
    )

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = stringResource(R.string.location_selector_filter_amenities),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(16.dp))

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                amenities.forEach { (amenity, icon) ->
                    FilterChip(
                        selected = selectedAmenities.contains(amenity),
                        onClick = { onToggleAmenity(amenity) },
                        label = { Text(getAmenityDisplayName(amenity)) },
                        leadingIcon = {
                            Icon(
                                imageVector = icon,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = onDismiss,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(stringResource(R.string.location_selector_apply_filters))
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateLocationDialog(
    state: CreateLocationState,
    onDismiss: () -> Unit,
    onConfirm: (name: String, address: String, city: String, state: String, neighborhood: String, amenities: List<String>) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var stateField by remember { mutableStateOf("") }
    var neighborhood by remember { mutableStateOf("") }
    var selectedAmenities by remember { mutableStateOf(setOf<String>()) }

    var nameError by remember { mutableStateOf(false) }
    var addressError by remember { mutableStateOf(false) }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.95f)
                .fillMaxHeight(0.9f),
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surface
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
                        text = stringResource(R.string.location_selector_create_title),
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = stringResource(R.string.close))
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Form
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedTextField(
                        value = name,
                        onValueChange = {
                            name = it
                            nameError = false
                        },
                        label = { Text(stringResource(R.string.location_selector_field_name)) },
                        isError = nameError,
                        supportingText = if (nameError) {
                            { Text(stringResource(R.string.location_selector_field_required)) }
                        } else null,
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = address,
                        onValueChange = {
                            address = it
                            addressError = false
                        },
                        label = { Text(stringResource(R.string.location_selector_field_address)) },
                        isError = addressError,
                        supportingText = if (addressError) {
                            { Text(stringResource(R.string.location_selector_field_required)) }
                        } else null,
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedTextField(
                            value = city,
                            onValueChange = { city = it },
                            label = { Text(stringResource(R.string.location_selector_field_city)) },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = stateField,
                            onValueChange = { stateField = it },
                            label = { Text(stringResource(R.string.location_selector_field_state)) },
                            modifier = Modifier.weight(0.5f),
                            singleLine = true
                        )
                    }

                    OutlinedTextField(
                        value = neighborhood,
                        onValueChange = { neighborhood = it },
                        label = { Text(stringResource(R.string.location_selector_field_neighborhood)) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    // Amenidades
                    Text(
                        text = stringResource(R.string.location_selector_amenities),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(top = 8.dp)
                    )

                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        listOf(
                            "estacionamento",
                            "vestiario",
                            "churrasqueira",
                            "bar",
                            "iluminacao"
                        ).forEach { amenity ->
                            FilterChip(
                                selected = selectedAmenities.contains(amenity),
                                onClick = {
                                    selectedAmenities = if (selectedAmenities.contains(amenity)) {
                                        selectedAmenities - amenity
                                    } else {
                                        selectedAmenities + amenity
                                    }
                                },
                                label = { Text(getAmenityDisplayName(amenity)) }
                            )
                        }
                    }
                }

                // Error message
                if (state is CreateLocationState.Error) {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer
                        )
                    ) {
                        Text(
                            text = state.message,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }

                // Buttons
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        enabled = state !is CreateLocationState.Loading
                    ) {
                        Text(stringResource(R.string.cancel))
                    }
                    Button(
                        onClick = {
                            nameError = name.isBlank()
                            addressError = address.isBlank()

                            if (!nameError && !addressError) {
                                onConfirm(
                                    name,
                                    address,
                                    city,
                                    stateField,
                                    neighborhood,
                                    selectedAmenities.toList()
                                )
                            }
                        },
                        modifier = Modifier.weight(1f),
                        enabled = state !is CreateLocationState.Loading
                    ) {
                        if (state is CreateLocationState.Loading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                        } else {
                            Text(stringResource(R.string.save))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyLocationsState(hasQuery: Boolean) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = if (hasQuery) Icons.Default.SearchOff else Icons.Default.Place,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = if (hasQuery) {
                stringResource(R.string.location_selector_no_results)
            } else {
                stringResource(R.string.location_selector_no_locations)
            },
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun ErrorState(
    message: String,
    onRetry: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
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
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onRetry) {
            Text(stringResource(R.string.retry))
        }
    }
}

// ==================== HELPERS ====================

@Composable
private fun getAmenityIcon(amenity: String): androidx.compose.ui.graphics.vector.ImageVector? {
    return when (amenity.lowercase()) {
        "estacionamento" -> Icons.Default.LocalParking
        "vestiario" -> Icons.Default.Checkroom
        "churrasqueira" -> Icons.Default.OutdoorGrill
        "bar" -> Icons.Default.LocalBar
        "restaurante" -> Icons.Default.Restaurant
        "iluminacao" -> Icons.Default.LightMode
        "wifi" -> Icons.Default.Wifi
        "banheiro" -> Icons.Default.Wc
        else -> null
    }
}

@Composable
private fun getAmenityDisplayName(amenity: String): String {
    return when (amenity.lowercase()) {
        "estacionamento" -> stringResource(R.string.location_amenity_parking)
        "vestiario" -> stringResource(R.string.location_amenity_locker)
        "churrasqueira" -> stringResource(R.string.location_amenity_bbq)
        "bar" -> stringResource(R.string.location_amenity_bar)
        "restaurante" -> stringResource(R.string.location_amenity_restaurant)
        "iluminacao" -> stringResource(R.string.location_amenity_lighting)
        "wifi" -> stringResource(R.string.location_amenity_wifi)
        "banheiro" -> stringResource(R.string.location_amenity_bathroom)
        else -> amenity.replaceFirstChar { it.uppercase() }
    }
}

@SuppressLint("MissingPermission")
private fun requestUserLocation(
    context: android.content.Context,
    onLocationReceived: (Double, Double) -> Unit
) {
    try {
        val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
        fusedLocationClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null)
            .addOnSuccessListener { location ->
                location?.let {
                    onLocationReceived(it.latitude, it.longitude)
                }
            }
    } catch (e: Exception) {
        // Ignorar erros de localização
    }
}
