package com.futebadosparcas.ui.locations

import android.content.Intent
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.res.stringResource
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.ui.components.FieldImage
import com.futebadosparcas.ui.components.LocationImage
import com.futebadosparcas.ui.components.dialogs.ConfirmationDialog
import com.futebadosparcas.ui.components.dialogs.ConfirmationDialogType
import com.futebadosparcas.ui.components.dialogs.DeleteConfirmationDialog
import com.futebadosparcas.ui.components.dialogs.LocationExportDialog
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.ui.components.LocationListSkeleton
import com.futebadosparcas.ui.locations.components.WelcomeLocationEmptyState

/**
 * ManageLocationsScreen - Gerencia locais (campos de futebol)
 *
 * Permite:
 * - Listar todos os locais com seus campos
 * - Buscar por nome ou endereço
 * - Criar novo local (FAB)
 * - Editar local (navega para detalhe)
 * - Deletar local com confirmação
 * - Deletar campo com confirmação
 * - Seed database com 52 locais padrão
 * - Remover locais duplicados
 *
 * Features:
 * - Busca em tempo real com debounce
 * - SwipeRefresh
 * - Estados: Loading, Success, Error, Empty
 * - Menu toolbar com ações
 * - Diálogos de confirmação
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ManageLocationsScreen(
    viewModel: ManageLocationsViewModel,
    onLocationClick: (locationId: String) -> Unit = {},
    onCreateLocationClick: () -> Unit = {},
    onNavigateBack: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    var searchQuery by remember { mutableStateOf("") }
    var showDeleteLocationDialog by remember { mutableStateOf(false) }
    var showDeleteFieldDialog by remember { mutableStateOf(false) }
    var selectedLocationToDelete by remember { mutableStateOf<LocationWithFieldsData?>(null) }
    var selectedFieldToDelete by remember { mutableStateOf<com.futebadosparcas.data.model.Field?>(null) }
    var showSeedDialog by remember { mutableStateOf(false) }
    var showDeduplicateDialog by remember { mutableStateOf(false) }
    var isRefreshing by remember { mutableStateOf(false) }

    val scrollBehavior = TopAppBarDefaults.enterAlwaysScrollBehavior()

    // Atualizar busca com debounce
    LaunchedEffect(searchQuery) {
        viewModel.onSearchQueryChanged(searchQuery)
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.manage_locations)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                    }
                },
                actions = {
                    // Menu com ações
                    var expanded by remember { mutableStateOf(false) }

                    Box(modifier = Modifier.wrapContentSize(Alignment.TopEnd)) {
                        IconButton(onClick = { expanded = true }) {
                            Icon(
                                Icons.Default.MoreVert,
                                contentDescription = stringResource(R.string.location_menu_more_options_description)
                            )
                        }

                        DropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text(stringResource(R.string.locations_populate_db)) },
                                onClick = {
                                    expanded = false
                                    showSeedDialog = true
                                },
                                leadingIcon = {
                                    Icon(Icons.Default.Upload, contentDescription = null)
                                }
                            )

                            DropdownMenuItem(
                                text = { Text(stringResource(R.string.locations_remove_duplicates)) },
                                onClick = {
                                    expanded = false
                                    showDeduplicateDialog = true
                                },
                                leadingIcon = {
                                    Icon(Icons.Default.DeleteSweep, contentDescription = null)
                                }
                            )
                        }
                    }
                },
                scrollBehavior = scrollBehavior
            )
        },
        floatingActionButton = {
            val fabDescription = stringResource(R.string.location_fab_add_description)
            FloatingActionButton(
                onClick = onCreateLocationClick,
                containerColor = MaterialTheme.colorScheme.primary,
                modifier = Modifier.semantics {
                    contentDescription = fabDescription
                }
            ) {
                Icon(Icons.Default.Add, contentDescription = fabDescription)
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(MaterialTheme.colorScheme.background)
        ) {
            Column(
                modifier = Modifier.fillMaxSize()
            ) {
                // Barra de busca
                SearchBar(
                    query = searchQuery,
                    onQueryChange = { searchQuery = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp)
                )

                // Conteúdo
                when (uiState) {
                    is ManageLocationsUiState.Loading -> {
                        LocationListSkeleton(
                            itemCount = 4,
                            staggerDelayMs = 100,
                            showFieldRows = true
                        )
                    }
                    is ManageLocationsUiState.Success -> {
                        val state = uiState as ManageLocationsUiState.Success
                        if (state.locations.isEmpty()) {
                            ManageLocationsEmptyState(
                                onCreateClick = onCreateLocationClick
                            )
                        } else {
                            ManageLocationsContent(
                                locations = state.locations,
                                isRefreshing = isRefreshing,
                                onLocationClick = onLocationClick,
                                onRefresh = {
                                    isRefreshing = true
                                    viewModel.loadAllLocations()
                                    isRefreshing = false
                                },
                                onDeleteLocation = { location ->
                                    selectedLocationToDelete = location
                                    showDeleteLocationDialog = true
                                },
                                onDeleteField = { field ->
                                    selectedFieldToDelete = field
                                    showDeleteFieldDialog = true
                                }
                            )
                        }
                    }
                    is ManageLocationsUiState.Error -> {
                        val state = uiState as ManageLocationsUiState.Error
                        ErrorState(
                            message = state.message,
                            onRetry = { viewModel.loadAllLocations() }
                        )
                    }
                }
            }
        }
    }

    // Diálogos
    if (showDeleteLocationDialog && selectedLocationToDelete != null) {
        DeleteLocationDialog(
            locationName = selectedLocationToDelete!!.location.name,
            onConfirm = {
                viewModel.deleteLocation(selectedLocationToDelete!!.location.id)
                showDeleteLocationDialog = false
                selectedLocationToDelete = null
            },
            onDismiss = {
                showDeleteLocationDialog = false
                selectedLocationToDelete = null
            }
        )
    }

    if (showDeleteFieldDialog && selectedFieldToDelete != null) {
        DeleteFieldDialog(
            fieldName = selectedFieldToDelete!!.name,
            onConfirm = {
                viewModel.deleteField(selectedFieldToDelete!!.id)
                showDeleteFieldDialog = false
                selectedFieldToDelete = null
            },
            onDismiss = {
                showDeleteFieldDialog = false
                selectedFieldToDelete = null
            }
        )
    }

    if (showSeedDialog) {
        SeedDatabaseDialog(
            onConfirm = {
                viewModel.seedDatabase()
                showSeedDialog = false
            },
            onDismiss = { showSeedDialog = false }
        )
    }

    if (showDeduplicateDialog) {
        DeduplicateDialog(
            onConfirm = {
                viewModel.removeDuplicates()
                showDeduplicateDialog = false
            },
            onDismiss = { showDeduplicateDialog = false }
        )
    }
}

/**
 * Barra de busca com suporte a acessibilidade
 */
@Composable
private fun SearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val searchDescription = stringResource(R.string.location_search_description)
    val clearDescription = stringResource(R.string.location_search_clear_description)

    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = modifier
            .fillMaxWidth()
            .semantics {
                contentDescription = searchDescription
            },
        placeholder = { Text(stringResource(R.string.search_locations)) },
        leadingIcon = {
            Icon(
                Icons.Default.Search,
                contentDescription = searchDescription
            )
        },
        trailingIcon = {
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQueryChange("") }) {
                    Icon(
                        Icons.Default.Clear,
                        contentDescription = clearDescription
                    )
                }
            }
        },
        shape = RoundedCornerShape(12.dp),
        singleLine = true
    )
}

/**
 * Conteúdo com lista de locais
 */
@Composable
private fun ManageLocationsContent(
    locations: List<LocationWithFieldsData>,
    isRefreshing: Boolean,
    onLocationClick: (locationId: String) -> Unit,
    onRefresh: () -> Unit,
    onDeleteLocation: (LocationWithFieldsData) -> Unit,
    onDeleteField: (com.futebadosparcas.data.model.Field) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(locations, key = { it.location.id }) { locationWithFields ->
            LocationCard(
                locationWithFields = locationWithFields,
                onLocationClick = { onLocationClick(locationWithFields.location.id) },
                onDeleteLocation = { onDeleteLocation(locationWithFields) },
                onDeleteField = onDeleteField
            )
        }
    }
}

/**
 * Card de local com seus campos e suporte a acessibilidade
 */
@Composable
private fun LocationCard(
    locationWithFields: LocationWithFieldsData,
    onLocationClick: () -> Unit,
    onDeleteLocation: () -> Unit,
    onDeleteField: (com.futebadosparcas.data.model.Field) -> Unit
) {
    val location = locationWithFields.location
    val fieldCount = locationWithFields.fields.size

    // Descricao de acessibilidade para o card completo
    val cardDescription = if (fieldCount > 0) {
        stringResource(
            R.string.location_card_description,
            location.name,
            location.address.ifEmpty { location.neighborhood },
            location.rating,
            fieldCount
        )
    } else {
        stringResource(
            R.string.location_card_description_no_fields,
            location.name,
            location.address.ifEmpty { location.neighborhood },
            location.rating
        )
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .semantics {
                contentDescription = cardDescription
            }
            .clickable(onClick = onLocationClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Header com imagem, nome e ações
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Imagem do local com carregamento progressivo
                LocationImage(
                    imageUrl = locationWithFields.location.photoUrl,
                    contentDescription = "Foto de ${locationWithFields.location.name}",
                    modifier = Modifier.size(64.dp),
                    thumbnailSize = 32
                )

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = locationWithFields.location.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    if (locationWithFields.location.address.isNotEmpty()) {
                        Text(
                            text = locationWithFields.location.address,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                // Botões de ação
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    IconButton(
                        onClick = onLocationClick,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            Icons.Default.Edit,
                            contentDescription = stringResource(R.string.locations_edit),
                            modifier = Modifier.size(18.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }

                    IconButton(
                        onClick = onDeleteLocation,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            Icons.Default.Delete,
                            contentDescription = stringResource(R.string.locations_delete),
                            modifier = Modifier.size(18.dp),
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }

            // Lista de campos
            if (locationWithFields.fields.isNotEmpty()) {
                HorizontalDivider()

                Text(
                    text = stringResource(R.string.locations_fields_count, locationWithFields.fields.size),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Column(
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    locationWithFields.fields.forEach { field ->
                        FieldRow(
                            field = field,
                            onDelete = { onDeleteField(field) }
                        )
                    }
                }
            } else {
                Text(
                    text = stringResource(R.string.locations_no_fields),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}

/**
 * Linha de campo dentro do LocationCard com imagem lazy loading
 */
@Composable
private fun FieldRow(
    field: com.futebadosparcas.data.model.Field,
    onDelete: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                color = MaterialTheme.colorScheme.background.copy(alpha = 0.5f),
                shape = RoundedCornerShape(6.dp)
            )
            .padding(8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Imagem do campo com carregamento progressivo
        FieldImage(
            imageUrl = field.photoUrl,
            contentDescription = "Foto de ${field.name}",
            width = 48.dp,
            height = 36.dp,
            thumbnailSize = 24,
            cornerRadius = 4.dp
        )

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = field.name,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onBackground
            )

            if (field.type.isNotEmpty()) {
                Text(
                    text = field.type,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        IconButton(
            onClick = onDelete,
            modifier = Modifier.size(28.dp)
        ) {
            Icon(
                Icons.Default.Close,
                contentDescription = stringResource(R.string.locations_delete_field),
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.error
            )
        }
    }
}

/**
 * Estado vazio
 */
@Composable
private fun ManageLocationsEmptyState(
    onCreateClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.LocationOn,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = stringResource(R.string.no_locations),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onBackground
        )

        Text(
            text = stringResource(R.string.no_locations_description),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp)
        )

        Button(
            onClick = onCreateClick,
            modifier = Modifier.padding(top = 16.dp)
        ) {
            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text(stringResource(R.string.add_location))
        }
    }
}

// Diálogos de Confirmação

// Dialogs using shared components
@Composable
private fun DeleteLocationDialog(
    locationName: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    ConfirmationDialog(
        visible = true,
        title = stringResource(R.string.locations_delete_location_title),
        message = stringResource(R.string.locations_delete_location_message, locationName),
        confirmText = stringResource(R.string.locations_delete),
        type = ConfirmationDialogType.DESTRUCTIVE,
        icon = Icons.Default.Delete,
        onConfirm = onConfirm,
        onDismiss = onDismiss
    )
}

@Composable
private fun DeleteFieldDialog(
    fieldName: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    ConfirmationDialog(
        visible = true,
        title = stringResource(R.string.locations_delete_field_title),
        message = stringResource(R.string.locations_delete_field_message, fieldName),
        confirmText = stringResource(R.string.locations_delete),
        type = ConfirmationDialogType.DESTRUCTIVE,
        icon = Icons.Default.Delete,
        onConfirm = onConfirm,
        onDismiss = onDismiss
    )
}

@Composable
private fun SeedDatabaseDialog(
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    ConfirmationDialog(
        visible = true,
        title = stringResource(R.string.locations_populate_db),
        message = stringResource(R.string.locations_populate_db_message),
        confirmText = stringResource(R.string.action_yes),
        type = ConfirmationDialogType.NORMAL,
        icon = Icons.Default.CloudDownload,
        onConfirm = onConfirm,
        onDismiss = onDismiss
    )
}

@Composable
private fun DeduplicateDialog(
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    ConfirmationDialog(
        visible = true,
        title = stringResource(R.string.locations_remove_duplicates),
        message = stringResource(R.string.locations_remove_duplicates_message),
        confirmText = stringResource(R.string.action_yes),
        type = ConfirmationDialogType.WARNING,
        icon = Icons.Default.CleaningServices,
        onConfirm = onConfirm,
        onDismiss = onDismiss
    )
}
