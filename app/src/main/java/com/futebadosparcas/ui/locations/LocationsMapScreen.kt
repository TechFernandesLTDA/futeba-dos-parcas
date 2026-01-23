package com.futebadosparcas.ui.locations

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.res.stringResource
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Location
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.*

/**
 * LocationsMapScreen - Mapa com locais de pelada
 *
 * Features:
 * - Google Maps nativo em Compose com marcadores de locais
 * - Estados de loading, success, empty, error
 * - Centralização automática em Curitiba
 *
 * MIGRADO para Google Maps Compose SDK - Sem AndroidView wrapper
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationsMapScreen(
    viewModel: LocationsMapViewModel,
    onBackClick: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.locations_map_title)) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.locations_map_back)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface,
                    navigationIconContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(MaterialTheme.colorScheme.background)
        ) {
            when (uiState) {
                is LocationsMapUiState.Loading -> {
                    LoadingState()
                }
                is LocationsMapUiState.Success -> {
                    val locations = (uiState as LocationsMapUiState.Success).locations
                    MapContent(locations = locations)
                }
                is LocationsMapUiState.Empty -> {
                    EmptyState()
                }
                is LocationsMapUiState.Error -> {
                    ErrorState(
                        message = (uiState as LocationsMapUiState.Error).message,
                        onRetry = { viewModel.loadLocations() }
                    )
                }
            }
        }
    }
}

@Composable
private fun MapContent(
    locations: List<Location>
) {
    // Default location: Curitiba, Brazil
    val curitiba = LatLng(-25.4284, -49.2733)

    // Find first valid location for camera position, or use Curitiba as default
    val initialPosition = locations
        .firstOrNull { it.latitude != null && it.longitude != null }
        ?.let { LatLng(it.latitude!!, it.longitude!!) }
        ?: curitiba

    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(initialPosition, 12f)
    }

    val uiSettings by remember {
        mutableStateOf(
            MapUiSettings(
                zoomControlsEnabled = true,
                compassEnabled = true,
                myLocationButtonEnabled = false,
                mapToolbarEnabled = true
            )
        )
    }

    // Descricao para acessibilidade do mapa inteiro
    val validLocationCount = locations.count { it.latitude != null && it.longitude != null }
    val mapDescription = stringResource(R.string.location_map_region_description, validLocationCount)

    GoogleMap(
        modifier = Modifier
            .fillMaxSize()
            .semantics {
                contentDescription = mapDescription
            },
        cameraPositionState = cameraPositionState,
        uiSettings = uiSettings
    ) {
        // Add markers for all valid locations with accessibility contentDescription
        locations.forEach { location ->
            if (location.latitude != null && location.longitude != null) {
                val markerDescription = buildMarkerDescription(location)

                Marker(
                    state = MarkerState(position = LatLng(location.latitude!!, location.longitude!!)),
                    title = location.name,
                    snippet = location.address,
                    contentDescription = markerDescription
                )
            }
        }
    }
}

/**
 * Constroi a descricao de acessibilidade para o marcador do mapa.
 * Formato: "Nome, Bairro, X.X estrelas"
 * Adaptado para quando bairro ou rating nao estao disponiveis.
 */
@Composable
private fun buildMarkerDescription(location: Location): String {
    val hasNeighborhood = location.neighborhood.isNotEmpty()
    val hasRating = location.rating > 0.0

    return when {
        hasNeighborhood && hasRating -> {
            stringResource(
                R.string.location_marker_description,
                location.name,
                location.neighborhood,
                location.rating
            )
        }
        hasNeighborhood && !hasRating -> {
            stringResource(
                R.string.location_marker_description_no_rating,
                location.name,
                location.neighborhood
            )
        }
        !hasNeighborhood && hasRating -> {
            stringResource(
                R.string.location_marker_description_no_neighborhood,
                location.name,
                location.rating
            )
        }
        else -> {
            stringResource(
                R.string.location_marker_description_name_only,
                location.name
            )
        }
    }
}

@Composable
private fun LoadingState() {
    val loadingDescription = stringResource(R.string.location_loading_description)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .semantics {
                contentDescription = loadingDescription
            },
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(48.dp),
            color = MaterialTheme.colorScheme.primary
        )
    }
}

@Composable
private fun EmptyState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = stringResource(R.string.locations_map_no_locations),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = stringResource(R.string.locations_map_add_first),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun ErrorState(
    message: String,
    onRetry: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = stringResource(R.string.locations_map_error_title),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.error
            )
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Button(onClick = onRetry) {
                Text(stringResource(R.string.locations_map_retry))
            }
        }
    }
}
