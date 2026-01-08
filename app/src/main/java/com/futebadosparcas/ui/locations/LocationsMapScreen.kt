package com.futebadosparcas.ui.locations

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.MapView
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MarkerOptions

/**
 * LocationsMapScreen - Mapa com locais de pelada
 *
 * Features:
 * - Google Maps com marcadores de locais
 * - Estados de loading, success, empty, error
 * - Centralização automática em Curitiba
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationsMapScreen(
    viewModel: LocationsMapViewModel,
    onBackClick: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var googleMap by remember { mutableStateOf<GoogleMap?>(null) }

    // Update markers when locations change
    LaunchedEffect(uiState) {
        if (uiState is LocationsMapUiState.Success) {
            val locations = (uiState as LocationsMapUiState.Success).locations
            googleMap?.let { map ->
                updateMarkers(map, locations)
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Mapa de Locais") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Voltar"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
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
                    MapContent(
                        onMapReady = { map ->
                            googleMap = map
                            val locations = (uiState as LocationsMapUiState.Success).locations
                            updateMarkers(map, locations)
                        }
                    )
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
    onMapReady: (GoogleMap) -> Unit
) {
    val context = LocalContext.current
    val mapView = remember { MapView(context) }

    AndroidView(
        factory = {
            mapView.apply {
                onCreate(null)
                onResume()
                getMapAsync { googleMap ->
                    // Default location: Curitiba, Brazil
                    val curitiba = LatLng(-25.4284, -49.2733)
                    googleMap.moveCamera(CameraUpdateFactory.newLatLngZoom(curitiba, 12f))

                    // Enable UI controls
                    googleMap.uiSettings.apply {
                        isZoomControlsEnabled = true
                        isCompassEnabled = true
                        isMyLocationButtonEnabled = false
                        isMapToolbarEnabled = true
                    }

                    onMapReady(googleMap)
                }
            }
        },
        modifier = Modifier.fillMaxSize()
    )

    DisposableEffect(mapView) {
        onDispose {
            mapView.onPause()
            mapView.onDestroy()
        }
    }
}

@Composable
private fun LoadingState() {
    Box(
        modifier = Modifier.fillMaxSize(),
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
                text = "Nenhum local cadastrado",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "Adicione locais para vê-los no mapa",
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
                text = "Erro ao carregar locais",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.error
            )
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Button(onClick = onRetry) {
                Text("Tentar Novamente")
            }
        }
    }
}

private fun updateMarkers(
    map: GoogleMap,
    locations: List<com.futebadosparcas.data.model.Location>
) {
    map.clear()

    var hasValidLocations = false

    for (location in locations) {
        if (location.latitude != null && location.longitude != null) {
            val position = LatLng(location.latitude!!, location.longitude!!)
            map.addMarker(
                MarkerOptions()
                    .position(position)
                    .title(location.name)
                    .snippet(location.address)
            )
            hasValidLocations = true
        }
    }

    // If we have valid locations, adjust camera to show them
    if (hasValidLocations && locations.isNotEmpty()) {
        locations.firstOrNull { it.latitude != null && it.longitude != null }?.let { first ->
            val firstPosition = LatLng(first.latitude!!, first.longitude!!)
            map.animateCamera(CameraUpdateFactory.newLatLngZoom(firstPosition, 12f))
        }
    }
}
