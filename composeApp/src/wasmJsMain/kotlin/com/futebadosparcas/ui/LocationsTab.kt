package com.futebadosparcas.ui

import androidx.compose.foundation.background
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.horizontalScroll
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.layout.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.lazy.LazyColumn
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.lazy.items
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.rememberScrollState
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.shape.RoundedCornerShape
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.material3.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.runtime.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.Alignment
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.Modifier
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.draw.clip
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.graphics.Brush
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.graphics.Color
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.text.font.FontWeight
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.text.style.TextOverflow
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.window.Dialog
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.firebase.FirebaseManager
import com.futebadosparcas.ui.components.states.ErrorState
import kotlinx.coroutines.launch
import com.futebadosparcas.ui.components.states.ErrorState

private sealed class LocationsUiState {
    object Loading : LocationsUiState()
    object Empty : LocationsUiState()
    data class Success(val locations: List<Map<String, Any?>>) : LocationsUiState()
    data class Error(val message: String) : LocationsUiState()
}

enum class FieldTypeFilter(val label: String, val emoji: String) {
    ALL("Todos", "📍"),
    SOCIETY("Society", "🏟️"),
    FUTSAL("Futsal", "🥅"),
    CAMPO("Campo", "🌿")
}

enum class PriceFilter(val label: String, val emoji: String, val maxValue: Double?) {
    ALL("Todos", "💰", null),
    LOW("Até R$100", "💵", 100.0),
    MEDIUM("Até R$200", "💰", 200.0),
    HIGH("Acima R$200", "💎", null)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationsTab(
    onLocationClick: ((String) -> Unit)? = null
) {
    var uiState by remember { mutableStateOf<LocationsUiState>(LocationsUiState.Loading) }
    var searchQuery by remember { mutableStateOf("") }
    var selectedFieldType by remember { mutableStateOf(FieldTypeFilter.ALL) }
    var selectedPrice by remember { mutableStateOf(PriceFilter.ALL) }
    var showCreateDialog by remember { mutableStateOf(false) }
    var selectedLocation by remember { mutableStateOf<Map<String, Any?>?>(null) }
    val scope = rememberCoroutineScope()
    var allLocations by remember { mutableStateOf<List<Map<String, Any?>>>(emptyList()) }

    fun loadLocations() {
        scope.launch {
            uiState = LocationsUiState.Loading
            try {
                allLocations = FirebaseManager.getLocations()
                uiState = if (allLocations.isEmpty()) LocationsUiState.Empty else LocationsUiState.Success(allLocations)
            } catch (e: Exception) {
                uiState = LocationsUiState.Error(e.message ?: "Erro ao carregar locais")
            }
        }
    }

    LaunchedEffect(Unit) {
        loadLocations()
    }

    val filteredLocations = remember(allLocations, searchQuery, selectedFieldType, selectedPrice) {
        var filtered = allLocations

        if (searchQuery.isNotEmpty()) {
            filtered = filtered.filter {
                val name = (it["name"] as? String ?: "").lowercase()
                val address = (it["address"] as? String ?: "").lowercase()
                val neighborhood = (it["neighborhood"] as? String ?: "").lowercase()
                name.contains(searchQuery.lowercase()) ||
                address.contains(searchQuery.lowercase()) ||
                neighborhood.contains(searchQuery.lowercase())
            }
        }

        if (selectedFieldType != FieldTypeFilter.ALL) {
            filtered = filtered.filter {
                val type = it["primaryFieldType"] as? String ?: ""
                type.equals(selectedFieldType.name, ignoreCase = true)
            }
        }

        if (selectedPrice != PriceFilter.ALL) {
            filtered = filtered.filter {
                val price = (it["priceRange"] as? Number)?.toDouble() ?: 0.0
                when (selectedPrice) {
                    PriceFilter.LOW -> price <= 100.0
                    PriceFilter.MEDIUM -> price <= 200.0
                    PriceFilter.HIGH -> price > 200.0
                    else -> true
                }
            }
        }

        filtered.sortedByDescending { it["rating"] as? Double ?: 0.0 }
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showCreateDialog = true },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary
            ) {
                Text("+", style = MaterialTheme.typography.headlineMedium)
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            Text(
                text = "📍 Campos e Quadras",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            SearchBar(
                query = searchQuery,
                onQueryChange = { searchQuery = it },
                modifier = Modifier.padding(bottom = 12.dp)
            )

            FilterChips(
                selectedFieldType = selectedFieldType,
                selectedPrice = selectedPrice,
                onFieldTypeChange = { selectedFieldType = it },
                onPriceChange = { selectedPrice = it }
            )

            Spacer(modifier = Modifier.height(12.dp))

            when (val state = uiState) {
                is LocationsUiState.Loading -> LocationsLoadingState()
                is LocationsUiState.Empty -> LocationsEmptyState(onCreateClick = { showCreateDialog = true })
                is LocationsUiState.Error -> LocationsErrorState(message = state.message, onRetry = { loadLocations() })
                is LocationsUiState.Success -> {
                    if (filteredLocations.isEmpty()) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text("Nenhum local encontrado", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    } else {
                        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(filteredLocations, key = { it["id"] as? String ?: "" }) { location ->
                                LocationCard(
                                    location = location,
                                    onClick = {
                                        if (onLocationClick != null) {
                                            onLocationClick(location["id"] as? String ?: "")
                                        } else {
                                            selectedLocation = location
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showCreateDialog) {
        CreateLocationDialog(
            onDismiss = { showCreateDialog = false },
            onCreate = {
                showCreateDialog = false
                loadLocations()
            }
        )
    }

    selectedLocation?.let { location ->
        LocationDetailDialog(
            location = location,
            onDismiss = { selectedLocation = null }
        )
    }
}

@Composable
private fun SearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = modifier.fillMaxWidth(),
        placeholder = { Text("🔍 Buscar por nome ou endereço...") },
        singleLine = true,
        shape = RoundedCornerShape(12.dp),
        trailingIcon = {
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQueryChange("") }) {
                    Text("✕")
                }
            }
        }
    )
}

@Composable
private fun FilterChips(
    selectedFieldType: FieldTypeFilter,
    selectedPrice: PriceFilter,
    onFieldTypeChange: (FieldTypeFilter) -> Unit,
    onPriceChange: (PriceFilter) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text("Tipo:", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(end = 4.dp).align(Alignment.CenterVertically))
            FieldTypeFilter.entries.forEach { filter ->
                FilterChip(
                    selected = selectedFieldType == filter,
                    onClick = { onFieldTypeChange(filter) },
                    label = { Text("${filter.emoji} ${filter.label}") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primaryContainer
                    )
                )
            }
        }

        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text("Preço:", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(end = 4.dp).align(Alignment.CenterVertically))
            PriceFilter.entries.forEach { filter ->
                FilterChip(
                    selected = selectedPrice == filter,
                    onClick = { onPriceChange(filter) },
                    label = { Text("${filter.emoji} ${filter.label}") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.secondaryContainer
                    )
                )
            }
        }
    }
}

@Composable
private fun LocationsLoadingState() {
    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        repeat(4) {
            Card(
                modifier = Modifier.fillMaxWidth().height(120.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
            ) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                }
            }
        }
    }
}

@Composable
private fun LocationsEmptyState(onCreateClick: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("📍", style = MaterialTheme.typography.displayLarge)
        Spacer(modifier = Modifier.height(16.dp))
        Text("Nenhum local cadastrado", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Seja o primeiro a adicionar um campo!", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.height(24.dp))
        FilledTonalButton(onClick = onCreateClick) { Text("+ Adicionar Local") }
    }
}

@Composable
private fun LocationsErrorState(message: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("❌", style = MaterialTheme.typography.displayLarge)
        Spacer(modifier = Modifier.height(16.dp))
        Text("Erro ao carregar locais", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.error)
        Spacer(modifier = Modifier.height(8.dp))
        Text(message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onRetry) { Text("🔄 Tentar novamente") }
    }
}

@Composable
private fun LocationCard(
    location: Map<String, Any?>,
    onClick: () -> Unit
) {
    val name = location["name"] as? String ?: "Local sem nome"
    val address = location["address"] as? String ?: ""
    val neighborhood = location["neighborhood"] as? String ?: ""
    val rating = (location["rating"] as? Number)?.toDouble() ?: 0.0
    val ratingCount = (location["ratingCount"] as? Number)?.toInt() ?: 0
    val photoUrl = location["photoUrl"] as? String
    val fieldType = location["primaryFieldType"] as? String ?: "Society"
    val fieldCount = (location["fieldCount"] as? Number)?.toInt() ?: 1
    val priceRange = (location["priceRange"] as? Number)?.toDouble() ?: 0.0

    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            LocationImage(
                photoUrl = photoUrl,
                fieldType = fieldType,
                modifier = Modifier.size(90.dp)
            )

            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                if (address.isNotEmpty()) {
                    Text(
                        text = "📍 $address",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = locationFieldTypeColor(fieldType)
                    ) {
                        Text(
                            text = " ${getFieldTypeEmoji(fieldType)} $fieldType ",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color.White,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    Text(
                        text = "🏟️ $fieldCount ${if (fieldCount == 1) "quadra" else "quadras"}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("⭐", style = MaterialTheme.typography.bodySmall)
                        Text(
                            text = " ${formatRating(rating)}",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold
                        )
                        if (ratingCount > 0) {
                            Text(
                                text = " ($ratingCount)",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    if (priceRange > 0) {
                        Text(
                            text = "💰 R$ ${priceRange.toInt()}/h",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            Text(
                text = "›",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.align(Alignment.CenterVertically)
            )
        }
    }
}

@Composable
private fun LocationImage(
    photoUrl: String?,
    fieldType: String = "SOCIETY",
    modifier: Modifier = Modifier
) {
    val gradientColors = listOf(
        MaterialTheme.colorScheme.primary.copy(alpha = 0.8f),
        MaterialTheme.colorScheme.tertiary.copy(alpha = 0.8f)
    )

    Card(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Box(
            modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(8.dp)).background(Brush.linearGradient(gradientColors)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = getFieldTypeEmoji(fieldType),
                style = MaterialTheme.typography.headlineLarge
            )
        }
    }
}

private fun locationFieldTypeColor(fieldType: String): Color = when (fieldType.uppercase()) {
    "SOCIETY" -> Color(0xFF4CAF50)
    "FUTSAL" -> Color(0xFF2196F3)
    "CAMPO" -> Color(0xFF8BC34A)
    else -> Color(0xFF9E9E9E)
}

fun getFieldTypeEmoji(fieldType: String): String = when (fieldType.uppercase()) {
    "SOCIETY" -> "🏟️"
    "FUTSAL" -> "🥅"
    "CAMPO" -> "🌿"
    else -> "📍"
}

private fun formatRating(rating: Double): String {
    val intPart = rating.toInt()
    val decimalPart = ((rating - intPart) * 10).toInt()
    return "$intPart.$decimalPart"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LocationDetailDialog(
    location: Map<String, Any?>,
    onDismiss: () -> Unit
) {
    val name = location["name"] as? String ?: "Local"
    val address = location["address"] as? String ?: ""
    val phone = location["phone"] as? String
    val rating = (location["rating"] as? Number)?.toDouble() ?: 0.0
    val ratingCount = (location["ratingCount"] as? Number)?.toInt() ?: 0
    val photoUrl = location["photoUrl"] as? String
    val fieldType = location["primaryFieldType"] as? String ?: "Society"
    val fieldCount = (location["fieldCount"] as? Number)?.toInt() ?: 1
    val amenities = (location["amenities"] as? List<String>) ?: emptyList()
    val neighborhood = location["neighborhood"] as? String ?: ""
    val city = location["city"] as? String ?: ""
    val state = location["state"] as? String ?: ""

    var currentPhotoIndex by remember { mutableStateOf(0) }
    val photos = listOfNotNull(photoUrl, "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400")

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth().heightIn(max = 650.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("📍 $name", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    TextButton(onClick = onDismiss) { Text("✕") }
                }

                HorizontalDivider()

                Column(
                    modifier = Modifier.weight(1f, fill = false).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Carousel(
                        photos = photos,
                        currentIndex = currentPhotoIndex,
                        onIndexChange = { currentPhotoIndex = it },
                        locationName = name
                    )

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("⭐", style = MaterialTheme.typography.titleMedium)
                            Text(
                                text = formatRating(rating),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            if (ratingCount > 0) {
                                Text(
                                    text = "($ratingCount avaliações)",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        if (address.isNotEmpty()) {
                            Text("📍 $address", style = MaterialTheme.typography.bodyMedium)
                            if (neighborhood.isNotEmpty()) {
                                Text("   $neighborhood, $city - $state", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }

                        if (phone != null) {
                            Text("📞 $phone", style = MaterialTheme.typography.bodyMedium)
                        }
                    }

                    HorizontalDivider()

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Características", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Surface(shape = RoundedCornerShape(4.dp), color = locationFieldTypeColor(fieldType)) {
                                Text(
                                    text = " ${getFieldTypeEmoji(fieldType)} $fieldType ",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color.White,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                            Text("🏟️ $fieldCount ${if (fieldCount == 1) "quadra" else "quadras"}", style = MaterialTheme.typography.bodySmall)
                        }

                        if (amenities.isNotEmpty()) {
                            Text("Comodidades:", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Row(
                                modifier = Modifier.horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                amenities.forEach { amenity ->
                                    SuggestionChip(
                                        onClick = {},
                                        label = { Text(amenity, style = MaterialTheme.typography.labelSmall) },
                                        modifier = Modifier.padding(2.dp)
                                    )
                                }
                            }
                        }
                    }

                    HorizontalDivider()

                    MapPlaceholder(
                        address = address,
                        modifier = Modifier.fillMaxWidth().height(120.dp)
                    )
                }

                HorizontalDivider()

                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = { openMapsUrl(address) },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("🗺️ Maps")
                    }

                    if (phone != null) {
                        Button(
                            onClick = { },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("📞 Ligar")
                        }
                    }

                    FilledTonalButton(
                        onClick = { },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("⚽ Criar Jogo")
                    }
                }
            }
        }
    }
}

@Composable
private fun Carousel(
    photos: List<String>,
    currentIndex: Int,
    onIndexChange: (Int) -> Unit,
    locationName: String = ""
) {
    val gradientColors = listOf(
        MaterialTheme.colorScheme.primary.copy(alpha = 0.6f),
        MaterialTheme.colorScheme.tertiary.copy(alpha = 0.6f)
    )

    val photoEmojis = listOf("🏟️", "🥅", "⚽", "🧿")

    Column {
        Card(
            modifier = Modifier.fillMaxWidth().height(180.dp),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Box(
                modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(12.dp)).background(Brush.linearGradient(gradientColors)),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = photoEmojis.getOrElse(currentIndex) { "🏟️" },
                        style = MaterialTheme.typography.displayLarge
                    )
                    if (locationName.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = locationName,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
            }
        }

        if (photos.size > 1) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                photos.indices.forEach { index ->
                    val isSelected = index == currentIndex
                    Surface(
                        modifier = Modifier.padding(2.dp),
                        shape = RoundedCornerShape(50),
                        color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
                        onClick = { onIndexChange(index) }
                    ) {
                        Box(modifier = Modifier.size(if (isSelected) 10.dp else 8.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun MapPlaceholder(
    address: String,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text("🗺️", style = MaterialTheme.typography.headlineLarge)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Mapa não disponível",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                TextButton(onClick = { openMapsUrl(address) }) {
                    Text("Ver no Google Maps")
                }
            }
        }
    }
}

private fun openMapsUrl(address: String) {
    val encodedAddress = jsEncodeURIComponent(address)
    kotlinx.browser.window.open("https://www.google.com/maps/search/?api=1&query=$encodedAddress", "_blank")
}

private external fun jsEncodeURIComponent(str: String): String
