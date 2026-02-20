package com.futebadosparcas.ui.locations

import android.net.Uri
import android.widget.Toast
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.domain.model.FieldType
import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.ui.components.FieldImage
import com.futebadosparcas.ui.components.LocationHeaderImage
import com.futebadosparcas.ui.components.design.AppTopBar
import com.futebadosparcas.ui.components.input.CepVisualTransformation
import com.futebadosparcas.ui.components.states.LoadingState
import com.futebadosparcas.ui.components.states.LoadingItemType
import com.futebadosparcas.ui.navigation.components.SecondaryTopBar
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
fun LocationDetailScreen(
    viewModel: LocationDetailViewModel,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val fieldOwners by viewModel.fieldOwners.collectAsStateWithLifecycle()
    val context = LocalContext.current

    // Form States
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var instagram by remember { mutableStateOf("") }
    var isActive by remember { mutableStateOf(true) }

    // Owner Selection
    var selectedOwner by remember { mutableStateOf<User?>(null) }
    var ownerDropdownExpanded by remember { mutableStateOf(false) }
    
    // Missing Fields Restored
    var openingTime by remember { mutableStateOf("08:00") }
    var closingTime by remember { mutableStateOf("23:00") }
    var minDuration by remember { mutableStateOf("60") }
    var region by remember { mutableStateOf("") }
    
    // Amenities State
    val availableAmenities = listOf(
        stringResource(R.string.location_detail_locker_room),
        stringResource(R.string.location_detail_bar),
        stringResource(R.string.location_detail_barbecue),
        stringResource(R.string.location_detail_parking),
        stringResource(R.string.location_detail_wifi),
        stringResource(R.string.location_detail_bleachers)
    )
    val selectedAmenities = remember { mutableStateListOf<String>() }

    // Address States
    var cep by remember { mutableStateOf("") }
    var street by remember { mutableStateOf("") }
    var number by remember { mutableStateOf("") }
    var complement by remember { mutableStateOf("") }
    var neighborhood by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var state by remember { mutableStateOf("") }
    var country by remember { mutableStateOf("Brasil") }
    var latitude by remember { mutableDoubleStateOf(0.0) }
    var longitude by remember { mutableDoubleStateOf(0.0) }
    
    // Dialog States
    var showFieldDialog by remember { mutableStateOf(false) }
    var selectedField by remember { mutableStateOf<Field?>(null) }

    // Flag para controlar inicialização (só atualiza campos no carregamento inicial)
    var isInitialized by remember { mutableStateOf(false) }

    // Logic to sync state from backend - APENAS no carregamento inicial
    LaunchedEffect(uiState, fieldOwners) {
        if (uiState is LocationDetailUiState.Success) {
            val loc = (uiState as LocationDetailUiState.Success).location

            // Se o location tem ID (está carregando um existente) e não foi inicializado ainda
            // OU se está vazio e precisamos preencher campos padrão
            if (!isInitialized) {
                name = loc.name
                description = loc.description
                phone = loc.phone ?: ""
                instagram = loc.instagram ?: ""
                isActive = loc.isActive
                openingTime = loc.openingTime
                closingTime = loc.closingTime
                minDuration = loc.minGameDurationMinutes.toString()
                region = loc.region

                selectedAmenities.clear()
                selectedAmenities.addAll(loc.amenities)

                cep = loc.cep
                street = loc.street
                number = loc.number
                complement = loc.complement
                neighborhood = loc.neighborhood
                city = loc.city
                state = loc.state
                country = loc.country
                latitude = loc.latitude ?: 0.0
                longitude = loc.longitude ?: 0.0

                // Seleciona o owner atual se existir
                if (loc.ownerId.isNotEmpty() && fieldOwners.isNotEmpty()) {
                    selectedOwner = fieldOwners.find { it.id == loc.ownerId }
                }

                isInitialized = true
            } else {
                // Atualiza APENAS campos que vêm de operações específicas (CEP, coordenadas)
                // Preserva o resto do formulário
                if (loc.cep.isNotEmpty() && loc.cep != cep) {
                    // Atualização veio de busca de CEP
                    cep = loc.cep
                    street = loc.street
                    neighborhood = loc.neighborhood
                    city = loc.city
                    state = loc.state
                    country = loc.country
                }

                // Atualiza coordenadas se mudaram
                if (loc.latitude != null && loc.latitude != latitude) {
                    latitude = loc.latitude ?: 0.0
                    longitude = loc.longitude ?: 0.0
                }
            }
        }
        if (uiState is LocationDetailUiState.Error) {
             Toast.makeText(context, (uiState as LocationDetailUiState.Error).message, Toast.LENGTH_LONG).show()
        }
    }

    Scaffold(
        topBar = {
            // CMD-16: TopBar padronizada usando AppTopBar
            AppTopBar(
                title = { Text(stringResource(R.string.location_detail_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back))
                    }
                },
                actions = {
                    IconButton(onClick = {
                        val currentLoc = (uiState as? LocationDetailUiState.Success)?.location
                        val minDurInt = minDuration.toIntOrNull() ?: 60

                        if (currentLoc != null && currentLoc.id.isNotEmpty()) {
                            viewModel.updateLocation(
                                name, currentLoc.address, phone,
                                openingTime, closingTime, minDurInt,
                                region, neighborhood, description, selectedAmenities.toList(), isActive, instagram,
                                cep, street, number, complement, city, state, country,
                                selectedOwnerId = selectedOwner?.id
                            )
                        } else {
                            viewModel.createLocation(
                                name, "${street}, ${number} - ${city}", phone,
                                openingTime, closingTime, minDurInt, region, neighborhood, description, selectedAmenities.toList(), isActive, instagram,
                                cep, street, number, complement, city, state, country,
                                selectedOwnerId = selectedOwner?.id
                            )
                        }
                    }) {
                        Icon(Icons.Default.Save, contentDescription = stringResource(R.string.cd_save))
                    }
                }
            )
        },
        floatingActionButton = {
            if (uiState is LocationDetailUiState.Success) {
                 FloatingActionButton(onClick = {
                     selectedField = null
                     showFieldDialog = true
                 }) {
                     Icon(Icons.Default.Add, contentDescription = stringResource(R.string.location_detail_add_field))
                 }
            }
        }
    ) { paddingValues ->

        if (uiState is LocationDetailUiState.Loading) {
            LoadingState(shimmerCount = 4, itemType = LoadingItemType.LOCATION_CARD)
        } else {
            Column(
                modifier = Modifier
                    .padding(paddingValues)
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // --- Basic Info ---
                Text(stringResource(R.string.location_detail_basic_info), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(stringResource(R.string.location_detail_name_label)) },
                    modifier = Modifier.fillMaxWidth()
                )

                // Owner Selection Dropdown
                if (fieldOwners.isNotEmpty()) {
                    Box(Modifier.fillMaxWidth()) {
                        OutlinedTextField(
                            value = selectedOwner?.getDisplayName() ?: stringResource(R.string.location_detail_no_owner),
                            onValueChange = {},
                            label = { Text(stringResource(R.string.location_detail_owner_label)) },
                            readOnly = true,
                            enabled = false,
                            trailingIcon = {
                                IconButton(onClick = { ownerDropdownExpanded = true }) {
                                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_dropdown), Modifier.rotate(270f))
                                }
                            },
                            modifier = Modifier
                                .clickable { ownerDropdownExpanded = true }
                                .fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                disabledTextColor = MaterialTheme.colorScheme.onSurface,
                                disabledBorderColor = MaterialTheme.colorScheme.outline,
                                disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                disabledTrailingIconColor = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        )
                        DropdownMenu(
                            expanded = ownerDropdownExpanded,
                            onDismissRequest = { ownerDropdownExpanded = false }
                        ) {
                            // Opção para remover seleção
                            DropdownMenuItem(
                                text = { Text(stringResource(R.string.location_detail_no_owner_option), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline) },
                                onClick = {
                                    selectedOwner = null
                                    ownerDropdownExpanded = false
                                }
                            )
                            HorizontalDivider()
                            // Lista de donos de quadra
                            fieldOwners.forEach { owner ->
                                DropdownMenuItem(
                                    text = {
                                        Column {
                                            Text(owner.getDisplayName(), style = MaterialTheme.typography.bodyMedium)
                                            Text(owner.email, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
                                        }
                                    },
                                    onClick = {
                                        selectedOwner = owner
                                        ownerDropdownExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text(stringResource(R.string.location_detail_description_label)) },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2
                )

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = phone,
                        onValueChange = { phone = it },
                        label = { Text(stringResource(R.string.location_detail_phone_label)) },
                        modifier = Modifier.weight(1f),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
                    )
                    OutlinedTextField(
                        value = instagram,
                        onValueChange = { instagram = it },
                        label = { Text(stringResource(R.string.location_detail_instagram_label)) },
                        modifier = Modifier.weight(1f)
                    )
                }

                // --- Operational ---
                Text(stringResource(R.string.location_detail_operation), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = openingTime,
                        onValueChange = { openingTime = it },
                        label = { Text(stringResource(R.string.location_detail_opens)) },
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = closingTime,
                        onValueChange = { closingTime = it },
                        label = { Text(stringResource(R.string.location_detail_closes)) },
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = minDuration,
                        onValueChange = { minDuration = it },
                        label = { Text(stringResource(R.string.location_detail_min_duration)) },
                        modifier = Modifier.weight(1f),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(stringResource(R.string.location_detail_active))
                    Spacer(Modifier.width(8.dp))
                    Switch(checked = isActive, onCheckedChange = { isActive = it })
                }

                // --- Address ---
                HorizontalDivider()
                Text(stringResource(R.string.location_detail_address), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = cep,
                        onValueChange = { newValue ->
                            // Filtra apenas dígitos e limita a 8 caracteres
                            cep = newValue.filter { it.isDigit() }.take(8)
                        },
                        label = { Text(stringResource(R.string.location_detail_cep)) },
                        modifier = Modifier.weight(1f),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        visualTransformation = CepVisualTransformation.Instance
                    )
                    Button(onClick = { viewModel.searchCep(cep) }) {
                        Icon(Icons.Default.Search, contentDescription = stringResource(R.string.cd_search_cep))
                        Text(stringResource(R.string.search))
                    }
                }

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = street,
                        onValueChange = { street = it },
                        label = { Text(stringResource(R.string.location_detail_street)) },
                        modifier = Modifier.weight(2f)
                    )
                    OutlinedTextField(
                        value = number,
                        onValueChange = { number = it },
                        label = { Text(stringResource(R.string.location_detail_number)) },
                        modifier = Modifier.weight(1f),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                }

                OutlinedTextField(
                    value = complement,
                    onValueChange = { complement = it },
                    label = { Text(stringResource(R.string.location_detail_complement)) },
                    modifier = Modifier.fillMaxWidth()
                )

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = neighborhood,
                        onValueChange = { neighborhood = it },
                        label = { Text(stringResource(R.string.location_detail_neighborhood)) },
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = city,
                        onValueChange = { city = it },
                        label = { Text(stringResource(R.string.location_detail_city)) },
                        modifier = Modifier.weight(1f)
                    )
                }

                 Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = region,
                        onValueChange = { region = it },
                        label = { Text(stringResource(R.string.location_detail_region)) },
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = state,
                        onValueChange = { state = it },
                        label = { Text(stringResource(R.string.location_detail_state)) },
                        modifier = Modifier.weight(0.5f)
                    )
                }

                // Coordinates
                Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                    Column(Modifier.padding(16.dp)) {
                        Text(stringResource(R.string.location_detail_geolocation), style = MaterialTheme.typography.titleSmall)
                        Spacer(Modifier.height(4.dp))
                        Text(stringResource(R.string.location_detail_coordinates, latitude.toString(), longitude.toString()), style = MaterialTheme.typography.bodySmall)
                        Spacer(Modifier.height(8.dp))
                        Button(
                            onClick = { viewModel.updateCoordinates("$street, $number - $city") },
                            modifier = Modifier.align(Alignment.End)
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.cd_update_coordinates))
                            Spacer(Modifier.width(4.dp))
                            Text(stringResource(R.string.location_detail_update_coords))
                        }
                    }
                }

                // --- Amenities ---
                 Text(stringResource(R.string.location_detail_amenities), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                 FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                     availableAmenities.forEach { amenity ->
                         AnimatedAmenityChip(
                             amenity = amenity,
                             isSelected = selectedAmenities.contains(amenity),
                             onToggle = {
                                 if (selectedAmenities.contains(amenity)) {
                                     selectedAmenities.remove(amenity)
                                 } else {
                                     selectedAmenities.add(amenity)
                                 }
                             }
                         )
                     }
                 }

                HorizontalDivider()

                Text(stringResource(R.string.location_detail_fields), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)

                // List Fields (Quadras)
                if (uiState is LocationDetailUiState.Success) {
                    val fields = (uiState as LocationDetailUiState.Success).fields
                    if (fields.isEmpty()) {
                        Text(stringResource(R.string.location_detail_no_fields), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
                    } else {
                        fields.forEach { field ->
                            FieldItem(field) {
                                selectedField = field
                                showFieldDialog = true
                            }
                        }
                    }
                }
                
                Spacer(Modifier.height(80.dp)) // Space for Fab
            }
        }
        
        if (showFieldDialog) {
            FieldDialog(
                field = selectedField,
                onDismiss = { showFieldDialog = false },
                onConfirm = { name, type, price, surface, covered, active ->
                    val field = selectedField
                    if (field == null) {
                        viewModel.addField(name, type, price, active, null, surface, covered, null)
                    } else {
                        viewModel.updateField(field.id, name, type, price, active, null, surface, covered, null)
                    }
                    showFieldDialog = false
                }
            )
        }
    }
}

@Composable
fun FieldDialog(
    field: Field? = null,
    onDismiss: () -> Unit,
    onConfirm: (String, FieldType, Double, String, Boolean, Boolean) -> Unit
) {
    var name by remember { mutableStateOf(field?.name ?: "") }
    var type by remember { mutableStateOf(field?.getTypeEnum() ?: FieldType.SOCIETY) }
    var price by remember { mutableStateOf(field?.hourlyPrice?.toString() ?: "0.0") }
    var surface by remember { mutableStateOf(field?.surface ?: "Grama Sintética") }
    var isCovered by remember { mutableStateOf(field?.isCovered ?: true) }
    var isActive by remember { mutableStateOf(field?.isActive ?: true) }

    // Dropdown state
    var expanded by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (field == null) stringResource(R.string.location_detail_add_field_title) else stringResource(R.string.location_detail_edit_field_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(stringResource(R.string.location_detail_field_name)) },
                    modifier = Modifier.fillMaxWidth()
                )

                // Tipo Dropdown
                Box(Modifier.fillMaxWidth()) {
                    OutlinedTextField(
                        value = type.displayName,
                        onValueChange = {},
                        label = { Text(stringResource(R.string.location_detail_field_type)) },
                        readOnly = true,
                        trailingIcon = {
                             IconButton(onClick = { expanded = true }) {
                                 Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_dropdown), Modifier.rotate(270f))
                             }
                        },
                        modifier = Modifier.fillMaxWidth()
                    )
                    DropdownMenu(
                        expanded = expanded,
                        onDismissRequest = { expanded = false }
                    ) {
                        FieldType.values().forEach { t ->
                            DropdownMenuItem(
                                text = { Text(t.displayName) },
                                onClick = {
                                    type = t
                                    expanded = false
                                }
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = price,
                    onValueChange = { price = it },
                    label = { Text(stringResource(R.string.location_detail_field_price)) },
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                )

                OutlinedTextField(
                    value = surface,
                    onValueChange = { surface = it },
                    label = { Text(stringResource(R.string.location_detail_field_surface)) },
                    modifier = Modifier.fillMaxWidth()
                )

                 Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(stringResource(R.string.location_detail_field_covered))
                    Spacer(Modifier.width(8.dp))
                    Switch(checked = isCovered, onCheckedChange = { isCovered = it })
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(stringResource(R.string.location_detail_field_active))
                    Spacer(Modifier.width(8.dp))
                    Switch(
                        checked = isActive,
                        onCheckedChange = { isActive = it }
                    )
                }
                if (field != null && isActive != field.isActive) {
                     Text(stringResource(R.string.location_detail_field_admin_only), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                val p = price.toDoubleOrNull() ?: 0.0
                onConfirm(name, type, p, surface, isCovered, isActive)
            }) {
                Text(if (field == null) stringResource(R.string.location_detail_add_button) else stringResource(R.string.location_detail_save_button))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.location_detail_cancel_button))
            }
        }
    )
}

@Composable
fun FieldItem(field: Field, onClick: () -> Unit) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    // Animacao de elevacao ao pressionar
    val elevation by animateDpAsState(
        targetValue = if (isPressed) 1.dp else 2.dp,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy),
        label = "fieldItemElevation"
    )

    // Animacao de escala ao pressionar
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.98f else 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy),
        label = "fieldItemScale"
    )

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .scale(scale),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = elevation),
        onClick = onClick,
        interactionSource = interactionSource
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(field.name, style = MaterialTheme.typography.bodyLarge)
            Text(stringResource(R.string.location_detail_field_display, field.type, field.hourlyPrice.toString()), style = MaterialTheme.typography.bodyMedium)
        }
    }
}

/**
 * Chip de amenidade com animacao de escala ao selecionar
 * Micro-interacao para feedback visual ao usuario
 */
@Composable
fun AnimatedAmenityChip(
    amenity: String,
    isSelected: Boolean,
    onToggle: () -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }

    // Animacao de escala quando selecionado
    val scale by animateFloatAsState(
        targetValue = if (isSelected) 1.05f else 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMedium
        ),
        label = "amenityChipScale"
    )

    FilterChip(
        selected = isSelected,
        onClick = onToggle,
        label = { Text(amenity) },
        modifier = Modifier.scale(scale),
        interactionSource = interactionSource
    )
}
