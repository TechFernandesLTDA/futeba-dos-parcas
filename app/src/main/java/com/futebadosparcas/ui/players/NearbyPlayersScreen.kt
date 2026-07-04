package com.futebadosparcas.ui.players

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.LocationOff
import androidx.compose.material.icons.filled.Message
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.PersonSearch
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.data.repository.DirectMessagesRepository
import com.futebadosparcas.data.repository.NearbyPlayer
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.states.LoadingItemType
import com.futebadosparcas.ui.components.states.LoadingState
import com.google.android.gms.location.LocationServices
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel

private data class CurrentLocation(val lat: Double, val lng: Double)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NearbyPlayersScreen(
    onNavigateBack: () -> Unit,
    onOpenChat: (String) -> Unit = {},
    viewModel: NearbyPlayersViewModel = koinViewModel()
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    val directMessagesRepository: DirectMessagesRepository = koinInject()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val sharingEnabled by viewModel.sharingEnabled.collectAsStateWithLifecycle()
    val sharingLoading by viewModel.sharingLoading.collectAsStateWithLifecycle()
    val radiusKm by viewModel.radiusKm.collectAsStateWithLifecycle()
    val socialFilter by viewModel.socialFilter.collectAsStateWithLifecycle()

    val permissionDenied = stringResource(R.string.nearby_players_permission_denied)
    val sharingEnabledMessage = stringResource(R.string.nearby_players_sharing_enabled)
    val sharingDisabledMessage = stringResource(R.string.nearby_players_sharing_disabled)
    val sharingErrorMessage = stringResource(R.string.nearby_players_sharing_error)
    val createChatErrorMessage = stringResource(R.string.direct_messages_create_error)
    var creatingChatFor by remember { mutableStateOf<String?>(null) }

    fun withCurrentLocation(action: (CurrentLocation) -> Unit) {
        scope.launch {
            runCatching { currentLocation(context) }
                .onSuccess(action)
                .onFailure { snackbarHostState.showSnackbar(permissionDenied) }
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
            withCurrentLocation { viewModel.search(it.lat, it.lng) }
        } else {
            scope.launch { snackbarHostState.showSnackbar(permissionDenied) }
        }
    }

    fun requestSearch() {
        if (hasLocationPermission(context)) {
            withCurrentLocation { viewModel.search(it.lat, it.lng) }
        } else {
            permissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    fun toggleSharing(checked: Boolean) {
        if (!checked) {
            viewModel.disableSharing { success ->
                scope.launch {
                    snackbarHostState.showSnackbar(
                        if (success) sharingDisabledMessage else sharingErrorMessage
                    )
                }
            }
            return
        }

        if (hasLocationPermission(context)) {
            withCurrentLocation { location ->
                viewModel.enableSharing(location.lat, location.lng) { success ->
                    scope.launch {
                        snackbarHostState.showSnackbar(
                            if (success) sharingEnabledMessage else sharingErrorMessage
                        )
                    }
                }
            }
        } else {
            permissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.nearby_players_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.back)
                        )
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        LazyColumn(
            contentPadding = PaddingValues(
                start = 16.dp,
                top = paddingValues.calculateTopPadding() + 16.dp,
                end = 16.dp,
                bottom = 16.dp
            ),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            item {
                SharingCard(
                    enabled = sharingEnabled,
                    loading = sharingLoading,
                    onToggle = ::toggleSharing
                )
            }

            item {
                NearbyFilters(
                    radiusKm = radiusKm,
                    socialFilter = socialFilter,
                    onRadiusChange = viewModel::setRadius,
                    onFilterChange = viewModel::setSocialFilter,
                    onSearch = ::requestSearch
                )
            }

            when (val state = uiState) {
                NearbyPlayersUiState.Idle -> {
                    item {
                        EmptyState(
                            type = EmptyStateType.NoData(
                                title = stringResource(R.string.nearby_players_idle_title),
                                description = stringResource(R.string.nearby_players_idle_desc),
                                icon = Icons.Default.PersonSearch,
                                actionLabel = stringResource(R.string.nearby_players_search),
                                onAction = ::requestSearch
                            )
                        )
                    }
                }
                NearbyPlayersUiState.Loading -> {
                    item {
                        LoadingState(
                            shimmerCount = 4,
                            itemType = LoadingItemType.CARD,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
                NearbyPlayersUiState.Empty -> {
                    item {
                        EmptyState(
                            type = EmptyStateType.NoData(
                                title = stringResource(R.string.nearby_players_empty_title),
                                description = stringResource(R.string.nearby_players_empty_desc),
                                icon = Icons.Default.LocationOff,
                                actionLabel = stringResource(R.string.nearby_players_search),
                                onAction = ::requestSearch
                            )
                        )
                    }
                }
                is NearbyPlayersUiState.Error -> {
                    item {
                        EmptyState(
                            type = EmptyStateType.Error(
                                title = stringResource(R.string.error),
                                description = state.message,
                                actionLabel = stringResource(R.string.retry),
                                onRetry = ::requestSearch
                            )
                        )
                    }
                }
                is NearbyPlayersUiState.Success -> {
                    items(state.players, key = { it.id }) { player ->
                        NearbyPlayerCard(
                            player = player,
                            creatingChat = creatingChatFor == player.id,
                            onMessage = {
                                scope.launch {
                                    creatingChatFor = player.id
                                    directMessagesRepository.createChat(player.id)
                                        .onSuccess(onOpenChat)
                                        .onFailure { snackbarHostState.showSnackbar(createChatErrorMessage) }
                                    creatingChatFor = null
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SharingCard(
    enabled: Boolean,
    loading: Boolean,
    onToggle: (Boolean) -> Unit
) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.MyLocation, contentDescription = null)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.nearby_players_sharing_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = stringResource(R.string.nearby_players_sharing_desc),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (loading) {
                CircularProgressIndicator(modifier = Modifier.height(24.dp), strokeWidth = 2.dp)
            } else {
                Switch(checked = enabled, onCheckedChange = onToggle)
            }
        }
    }
}

@Composable
private fun NearbyFilters(
    radiusKm: Int,
    socialFilter: String,
    onRadiusChange: (Int) -> Unit,
    onFilterChange: (String) -> Unit,
    onSearch: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(1, 5, 10, 25).forEach { radius ->
                FilterChip(
                    selected = radiusKm == radius,
                    onClick = { onRadiusChange(radius) },
                    label = { Text(stringResource(R.string.nearby_players_radius_km, radius)) }
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = socialFilter == "all",
                onClick = { onFilterChange("all") },
                label = { Text(stringResource(R.string.nearby_players_filter_all)) }
            )
            FilterChip(
                selected = socialFilter == "following",
                onClick = { onFilterChange("following") },
                label = { Text(stringResource(R.string.nearby_players_filter_following)) }
            )
        }
        Button(onClick = onSearch, modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.MyLocation, contentDescription = null)
            Spacer(modifier = Modifier.padding(horizontal = 4.dp))
            Text(stringResource(R.string.nearby_players_search))
        }
    }
}

@Composable
private fun NearbyPlayerCard(
    player: NearbyPlayer,
    creatingChat: Boolean,
    onMessage: () -> Unit
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = player.displayName,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AssistChip(
                    onClick = {},
                    label = { Text(distanceBandLabel(player.distanceBand)) }
                )
                player.preferredPosition?.let {
                    AssistChip(onClick = {}, label = { Text(it) })
                }
                if (player.isFollowing) {
                    AssistChip(
                        onClick = {},
                        label = { Text(stringResource(R.string.nearby_players_following)) }
                    )
                }
            }
            Button(
                onClick = onMessage,
                enabled = !creatingChat,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (creatingChat) {
                    CircularProgressIndicator(modifier = Modifier.height(18.dp), strokeWidth = 2.dp)
                } else {
                    Icon(Icons.Default.Message, contentDescription = null)
                }
                Spacer(modifier = Modifier.padding(horizontal = 4.dp))
                Text(stringResource(R.string.direct_messages_message))
            }
        }
    }
}

@Composable
private fun distanceBandLabel(distanceBand: String): String = when (distanceBand) {
    "under_1km" -> stringResource(R.string.nearby_players_band_under_1km)
    "under_5km" -> stringResource(R.string.nearby_players_band_under_5km)
    "under_10km" -> stringResource(R.string.nearby_players_band_under_10km)
    else -> stringResource(R.string.nearby_players_band_under_25km)
}

private fun hasLocationPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACCESS_FINE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

@SuppressLint("MissingPermission")
private suspend fun currentLocation(context: Context): CurrentLocation {
    val client = LocationServices.getFusedLocationProviderClient(context)
    val location = client.lastLocation.await()
        ?: throw IllegalStateException("Localização indisponível")
    return CurrentLocation(location.latitude, location.longitude)
}
