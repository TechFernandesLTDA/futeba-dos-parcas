package com.futebadosparcas.ui.locations

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.ui.components.ShimmerBox

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
                        Icon(Icons.Default.ArrowBack, contentDescription = null)
                    }
                },
                actions = {
                    // Menu com ações
                    var expanded by remember { mutableStateOf(false) }

                    Box(modifier = Modifier.wrapContentSize(Alignment.TopEnd)) {
                        IconButton(onClick = { expanded = true }) {
                            Icon(Icons.Default.MoreVert, contentDescription = null)
                        }

                        DropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("Popular Banco de Dados") },
                                onClick = {
                                    expanded = false
                                    showSeedDialog = true
                                },
                                leadingIcon = {
                                    Icon(Icons.Default.Upload, contentDescription = null)
                                }
                            )

                            DropdownMenuItem(
                                text = { Text("Remover Duplicatas") },
                                onClick = {
                                    expanded = false
                                    showDeduplicateDialog = true
                                },
                                leadingIcon = {
                                    Icon(Icons.Default.DeleteDuplicates, contentDescription = null)
                                }
                            )
                        }
                    }
                },
                scrollBehavior = scrollBehavior
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onCreateLocationClick,
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(Icons.Default.Add, contentDescription = stringResource(R.string.add))
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
                        ManageLocationsLoadingState()
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
                        ManageLocationsErrorState(
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
 * Barra de busca
 */
@Composable
private fun SearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = modifier
            .fillMaxWidth(),
        placeholder = { Text(stringResource(R.string.search_locations)) },
        leadingIcon = {
            Icon(Icons.Default.Search, contentDescription = null)
        },
        trailingIcon = {
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQueryChange("") }) {
                    Icon(Icons.Default.Clear, contentDescription = null)
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
 * Card de local com seus campos
 */
@Composable
private fun LocationCard(
    locationWithFields: LocationWithFieldsData,
    onLocationClick: () -> Unit,
    onDeleteLocation: () -> Unit,
    onDeleteField: (com.futebadosparcas.data.model.Field) -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
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
            // Header com nome e ações
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
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
                            contentDescription = "Editar",
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
                            contentDescription = "Deletar",
                            modifier = Modifier.size(18.dp),
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }

            // Lista de campos
            if (locationWithFields.fields.isNotEmpty()) {
                Divider()

                Text(
                    text = "Campos (${locationWithFields.fields.size})",
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
                    text = "Nenhum campo",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}

/**
 * Linha de campo dentro do LocationCard
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
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
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
                contentDescription = "Deletar campo",
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.error
            )
        }
    }
}

/**
 * Estado de loading
 */
@Composable
private fun ManageLocationsLoadingState() {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding()
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(5) {
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(150.dp)
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
            .systemBarsPadding()
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

/**
 * Estado de erro
 */
@Composable
private fun ManageLocationsErrorState(
    message: String,
    onRetry: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding()
            .padding(16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.ErrorOutline,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.error
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = stringResource(R.string.error),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.error
        )

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(vertical = 16.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )

        Button(onClick = onRetry) {
            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text(stringResource(R.string.retry))
        }
    }
}

// Diálogos de Confirmação

@Composable
private fun DeleteLocationDialog(
    locationName: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Deletar Local") },
        text = { Text("Tem certeza que deseja deletar \"$locationName\" e todos seus campos?") },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("Deletar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}

@Composable
private fun DeleteFieldDialog(
    fieldName: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Deletar Campo") },
        text = { Text("Tem certeza que deseja deletar \"$fieldName\"?") },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("Deletar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}

@Composable
private fun SeedDatabaseDialog(
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Popular Banco de Dados") },
        text = { Text("Deseja importar/atualizar os 52 locais padrão? Isso pode levar alguns segundos.") },
        confirmButton = {
            Button(onClick = onConfirm) {
                Text("Sim")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}

@Composable
private fun DeduplicateDialog(
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Remover Duplicatas") },
        text = { Text("Deseja analisar e remover locais duplicados? Será mantido o registro com dados mais completos.") },
        confirmButton = {
            Button(onClick = onConfirm) {
                Text("Sim")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}

private fun androidx.compose.foundation.Modifier.clickable(onClick: () -> Unit) =
    androidx.compose.foundation.clickable { onClick() }
