package com.futebadosparcas.ui.locations

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.ui.components.states.LoadingState
import com.futebadosparcas.ui.components.states.LoadingItemType
import com.futebadosparcas.ui.theme.systemBarsPadding

/**
 * FieldOwnerDashboardScreen - Dashboard do dono de quadra
 *
 * Screen Compose para donos de quadra gerenciarem seus locais.
 * Lista todos os locais cadastrados pelo usuário com opção de adicionar novos.
 */
@Composable
fun FieldOwnerDashboardScreen(
    viewModel: FieldOwnerDashboardViewModel,
    onNavigateBack: () -> Unit = {},
    onNavigateToLocation: (locationId: String) -> Unit = {},
    onNavigateToAddLocation: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.loadLocations()
    }

    Scaffold(
        topBar = {
            FieldOwnerDashboardTopBar(
                onNavigateBack = onNavigateBack
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onNavigateToAddLocation,
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(Icons.Default.Add, contentDescription = stringResource(R.string.cd_add_location))
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is FieldOwnerDashboardUiState.Loading -> {
                    LoadingState(
                        shimmerCount = 6,
                        itemType = LoadingItemType.CARD
                    )
                }
                is FieldOwnerDashboardUiState.Success -> {
                    if (state.locations.isEmpty()) {
                        EmptyLocationsState(
                            onAddLocation = onNavigateToAddLocation
                        )
                    } else {
                        LocationsList(
                            locations = state.locations,
                            onLocationClick = onNavigateToLocation
                        )
                    }
                }
                is FieldOwnerDashboardUiState.Error -> {
                    ErrorState(
                        message = state.message,
                        onRetry = { viewModel.loadLocations() }
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FieldOwnerDashboardTopBar(
    onNavigateBack: () -> Unit
) {
    TopAppBar(
        title = { Text(stringResource(R.string.profile_menu_my_locations)) },
        navigationIcon = {
            IconButton(onClick = onNavigateBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.back))
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    )
}

@Composable
private fun LocationsList(
    locations: List<Location>,
    onLocationClick: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(locations, key = { it.id }) { location ->
            LocationDashboardCard(
                location = location,
                onClick = { onLocationClick(location.id) }
            )
        }
    }
}

@Composable
private fun LocationDashboardCard(
    location: Location,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Ícone do local
            Icon(
                imageVector = Icons.Default.Stadium,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.primary
            )

            // Informações do local
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = location.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    // Badge de verificado
                    if (location.isVerified) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = MaterialTheme.colorScheme.primaryContainer
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Verified,
                                    contentDescription = null,
                                    modifier = Modifier.size(12.dp),
                                    tint = MaterialTheme.colorScheme.primary
                                )
                                Text(
                                    text = stringResource(R.string.field_owner_verified),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.primary,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                // Endereço
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Place,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = location.address,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Número de quadras
                if (location.fieldCount > 0) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Stadium,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Text(
                            text = if (location.fieldCount == 1) "1 quadra" else "${location.fieldCount} quadras",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            // Seta para detalhes
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun EmptyLocationsState(
    onAddLocation: () -> Unit
) {
    EmptyState(
        type = com.futebadosparcas.ui.components.EmptyStateType.NoData(
            title = stringResource(R.string.field_owner_empty_title),
            description = stringResource(R.string.field_owner_empty_description),
            icon = Icons.Default.Stadium,
            actionLabel = stringResource(R.string.field_owner_empty_action),
            onAction = onAddLocation
        )
    )
}
