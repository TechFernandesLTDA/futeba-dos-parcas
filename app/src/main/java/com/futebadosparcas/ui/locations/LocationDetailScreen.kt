package com.futebadosparcas.ui.locations

import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.data.model.Location

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
fun LocationDetailScreen(
    viewModel: LocationDetailViewModel,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    
    // Form States
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var instagram by remember { mutableStateOf("") }
    var isActive by remember { mutableStateOf(true) }
    
    // Missing Fields Restored
    var openingTime by remember { mutableStateOf("08:00") }
    var closingTime by remember { mutableStateOf("23:00") }
    var minDuration by remember { mutableStateOf("60") }
    var region by remember { mutableStateOf("") }
    
    // Amenities State
    val availableAmenities = listOf("Vestiário", "Bar", "Churrasqueira", "Estacionamento", "Wi-Fi", "Arquibancada")
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
    var latitude by remember { mutableStateOf(0.0) }
    var longitude by remember { mutableStateOf(0.0) }

    // Logic to sync state from backend
    LaunchedEffect(uiState) {
        if (uiState is LocationDetailUiState.Success) {
            val loc = (uiState as LocationDetailUiState.Success).location
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
        }
        if (uiState is LocationDetailUiState.Error) {
             Toast.makeText(context, (uiState as LocationDetailUiState.Error).message, Toast.LENGTH_LONG).show()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Detalhes do Local") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Voltar")
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
                                cep, street, number, complement, city, state, country
                            )
                        } else {
                            viewModel.createLocation(
                                name, "${street}, ${number} - ${city}", phone,
                                openingTime, closingTime, minDurInt, region, neighborhood, description, selectedAmenities.toList(), isActive, instagram,
                                cep, street, number, complement, city, state, country
                            )
                        }
                    }) {
                        Icon(Icons.Default.Save, contentDescription = "Salvar")
                    }
                }
            )
        },
        floatingActionButton = {
            if (uiState is LocationDetailUiState.Success) {
                 FloatingActionButton(onClick = { 
                     // TODO: Open Dialog/Screen for Field
                     // This would require a callback or another composable state for dialog
                 }) {
                     Icon(Icons.Default.Add, contentDescription = "Adicionar Quadra")
                 }
            }
        }
    ) { paddingValues ->
        
        if (uiState is LocationDetailUiState.Loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
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
                Text("Informações Básicas", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nome do Local *") },
                    modifier = Modifier.fillMaxWidth()
                )
                
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Descrição") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2
                )

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = phone,
                        onValueChange = { phone = it },
                        label = { Text("Telefone/WhatsApp") },
                        modifier = Modifier.weight(1f),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
                    )
                    OutlinedTextField(
                        value = instagram,
                        onValueChange = { instagram = it },
                        label = { Text("Instagram") },
                        modifier = Modifier.weight(1f)
                    )
                }

                // --- Operational ---
                Text("Funcionamento", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = openingTime,
                        onValueChange = { openingTime = it },
                        label = { Text("Abre") }, // Consider TimePicker later
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = closingTime,
                        onValueChange = { closingTime = it },
                        label = { Text("Fecha") },
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = minDuration,
                        onValueChange = { minDuration = it },
                        label = { Text("Min (min)") },
                        modifier = Modifier.weight(1f),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                }
                
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Ativo?")
                    Spacer(Modifier.width(8.dp))
                    Switch(checked = isActive, onCheckedChange = { isActive = it })
                }

                // --- Address ---
                HorizontalDivider()
                Text("Endereço", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = cep,
                        onValueChange = { cep = it },
                        label = { Text("CEP") },
                        modifier = Modifier.weight(1f),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                    Button(onClick = { viewModel.searchCep(cep) }) {
                        Icon(Icons.Default.Search, contentDescription = null)
                        Text("Buscar")
                    }
                }

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = street,
                        onValueChange = { street = it },
                        label = { Text("Logradouro") },
                        modifier = Modifier.weight(2f)
                    )
                    OutlinedTextField(
                        value = number,
                        onValueChange = { number = it },
                        label = { Text("Nº") },
                        modifier = Modifier.weight(1f),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                }

                OutlinedTextField(
                    value = complement,
                    onValueChange = { complement = it },
                    label = { Text("Complemento") },
                    modifier = Modifier.fillMaxWidth()
                )

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = neighborhood,
                        onValueChange = { neighborhood = it },
                        label = { Text("Bairro") },
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = city,
                        onValueChange = { city = it },
                        label = { Text("Cidade") },
                        modifier = Modifier.weight(1f)
                    )
                }
                
                 Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = region,
                        onValueChange = { region = it },
                        label = { Text("Região (Zonal)") },
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = state,
                        onValueChange = { state = it },
                        label = { Text("UF") },
                        modifier = Modifier.weight(0.5f)
                    )
                }

                // Coordinates
                Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Geolocalização", style = MaterialTheme.typography.titleSmall)
                        Spacer(Modifier.height(4.dp))
                        Text("Lat: $latitude / Lng: $longitude", style = MaterialTheme.typography.bodySmall)
                        Spacer(Modifier.height(8.dp))
                        Button(
                            onClick = { viewModel.updateCoordinates("$street, $number - $city") },
                            modifier = Modifier.align(Alignment.End)
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null)
                            Spacer(Modifier.width(4.dp))
                            Text("Atualizar Coordenadas")
                        }
                    }
                }
                
                // --- Amenities ---
                 Text("Comodidades", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                 FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                     availableAmenities.forEach { amenity ->
                         FilterChip(
                             selected = selectedAmenities.contains(amenity),
                             onClick = {
                                 if (selectedAmenities.contains(amenity)) {
                                     selectedAmenities.remove(amenity)
                                 } else {
                                     selectedAmenities.add(amenity)
                                 }
                             },
                             label = { Text(amenity) }
                         )
                     }
                 }

                HorizontalDivider()
                
                Text("Quadras", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                
                // List Fields (Quadras)
                if (uiState is LocationDetailUiState.Success) {
                    val fields = (uiState as LocationDetailUiState.Success).fields
                    if (fields.isEmpty()) {
                        Text("Nenhuma quadra cadastrada.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
                    } else {
                        fields.forEach { field ->
                            FieldItem(field)
                        }
                    }
                }
                
                Spacer(Modifier.height(80.dp)) // Space for Fab
            }
        }
    }
}

@Composable
fun FieldItem(field: Field) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(field.name, style = MaterialTheme.typography.bodyLarge)
            Text("${field.type} - R$ ${field.hourlyPrice}/h", style = MaterialTheme.typography.bodyMedium)
        }
    }
}
