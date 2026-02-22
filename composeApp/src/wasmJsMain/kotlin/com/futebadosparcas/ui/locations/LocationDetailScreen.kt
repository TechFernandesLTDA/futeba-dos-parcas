package com.futebadosparcas.ui.locations

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.firebase.FirebaseManager
import kotlinx.coroutines.launch

private sealed class LocationDetailUiState {
    object Loading : LocationDetailUiState()
    data class Success(val location: WebLocation) : LocationDetailUiState()
    data class Error(val message: String) : LocationDetailUiState()
}

data class WebLocation(
    val id: String,
    val name: String,
    val description: String = "",
    val address: String = "",
    val neighborhood: String = "",
    val city: String = "",
    val state: String = "",
    val phone: String? = null,
    val instagram: String? = null,
    val rating: Double = 0.0,
    val ratingCount: Int = 0,
    val photoUrls: List<String> = emptyList(),
    val primaryFieldType: String = "Society",
    val fieldCount: Int = 1,
    val amenities: List<String> = emptyList(),
    val fields: List<WebField> = emptyList(),
    val reviews: List<WebReview> = emptyList(),
    val latitude: Double? = null,
    val longitude: Double? = null,
    val priceRange: Double = 0.0,
    val isCovered: Boolean = false,
    val hasParking: Boolean = false,
    val hasLockerRoom: Boolean = false
)

data class WebField(
    val id: String,
    val name: String,
    val type: String,
    val surface: String,
    val isCovered: Boolean,
    val hourlyPrice: Double,
    val isActive: Boolean
)

data class WebReview(
    val id: String,
    val userName: String,
    val userPhoto: String?,
    val rating: Int,
    val comment: String,
    val date: String
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationDetailScreen(
    locationId: String,
    onBackClick: () -> Unit,
    onCreateGameClick: ((String) -> Unit)? = null
) {
    var uiState by remember { mutableStateOf<LocationDetailUiState>(LocationDetailUiState.Loading) }
    var currentPhotoIndex by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    fun loadLocation() {
        scope.launch {
            uiState = LocationDetailUiState.Loading
            try {
                val locations = FirebaseManager.getLocations()
                val locationMap = locations.find { it["id"] as? String == locationId }
                if (locationMap != null) {
                    uiState = LocationDetailUiState.Success(mapToWebLocation(locationMap))
                } else {
                    uiState = LocationDetailUiState.Error("Local não encontrado")
                }
            } catch (e: Exception) {
                uiState = LocationDetailUiState.Error(e.message ?: "Erro ao carregar local")
            }
        }
    }

    LaunchedEffect(locationId) {
        loadLocation()
    }

    Scaffold(
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { paddingValues ->
        when (val state = uiState) {
            is LocationDetailUiState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            is LocationDetailUiState.Error -> {
                Column(
                    modifier = Modifier.fillMaxSize().padding(paddingValues).padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text("❌", style = MaterialTheme.typography.displayLarge)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Erro ao carregar local", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(state.message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = { loadLocation() }) { Text("🔄 Tentar novamente") }
                }
            }

            is LocationDetailUiState.Success -> {
                val location = state.location
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    item {
                        PhotoCarousel(
                            photos = location.photoUrls,
                            currentIndex = currentPhotoIndex,
                            onIndexChange = { currentPhotoIndex = it },
                            locationName = location.name,
                            onBackClick = onBackClick
                        )
                    }

                    item {
                        LocationHeader(location = location)
                    }

                    item {
                        LocationInfoCard(location = location)
                    }

                    item {
                        AmenitiesSection(amenities = location.amenities)
                    }

                    if (location.fields.isNotEmpty()) {
                        item {
                            FieldsSection(fields = location.fields)
                        }
                    }

                    item {
                        MapSection(
                            address = location.address,
                            latitude = location.latitude,
                            longitude = location.longitude
                        )
                    }

                    item {
                        ReviewsSection(reviews = location.reviews)
                    }

                    item {
                        ActionButtons(
                            location = location,
                            onCreateGameClick = onCreateGameClick
                        )
                    }

                    item {
                        Spacer(modifier = Modifier.height(16.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun PhotoCarousel(
    photos: List<String>,
    currentIndex: Int,
    onIndexChange: (Int) -> Unit,
    locationName: String,
    onBackClick: () -> Unit
) {
    val gradientColors = listOf(
        MaterialTheme.colorScheme.primary.copy(alpha = 0.7f),
        MaterialTheme.colorScheme.tertiary.copy(alpha = 0.7f)
    )
    val photoEmojis = listOf("🏟️", "🥅", "⚽", "🧿", "🏆")

    Box(
        modifier = Modifier.fillMaxWidth().height(280.dp)
    ) {
        Card(
            modifier = Modifier.fillMaxSize(),
            shape = RoundedCornerShape(bottomStart = 24.dp, bottomEnd = 24.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Box(
                modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(bottomStart = 24.dp, bottomEnd = 24.dp))
                    .background(Brush.linearGradient(gradientColors)),
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
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = locationName,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }
        }

        FilledIconButton(
            onClick = onBackClick,
            modifier = Modifier.align(Alignment.TopStart).padding(16.dp),
            colors = IconButtonDefaults.filledIconButtonColors(
                containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.9f)
            )
        ) {
            Text("←", style = MaterialTheme.typography.titleLarge)
        }

        if (photos.size > 1) {
            Row(
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                photos.indices.forEach { index ->
                    Surface(
                        modifier = Modifier.padding(2.dp),
                        shape = RoundedCornerShape(50),
                        color = if (index == currentIndex) Color.White else Color.White.copy(alpha = 0.4f),
                        onClick = { onIndexChange(index) }
                    ) {
                        Box(modifier = Modifier.size(if (index == currentIndex) 12.dp else 8.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun LocationHeader(location: WebLocation) {
    Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = location.name,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = locationFieldTypeColor(location.primaryFieldType)
            ) {
                Text(
                    text = " ${getFieldTypeEmoji(location.primaryFieldType)} ${location.primaryFieldType} ",
                    style = MaterialTheme.typography.labelMedium,
                    color = Color.White,
                    fontWeight = FontWeight.Medium
                )
            }
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("⭐", style = MaterialTheme.typography.titleMedium)
                Text(
                    text = " ${formatRating(location.rating)}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                if (location.ratingCount > 0) {
                    Text(
                        text = " (${location.ratingCount} avaliações)",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (location.priceRange > 0) {
                Text(
                    text = "💰 R$ ${location.priceRange.toInt()}/h",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        if (location.address.isNotEmpty()) {
            Text(
                text = "📍 ${location.address}",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            if (location.neighborhood.isNotEmpty()) {
                Text(
                    text = "   ${location.neighborhood}, ${location.city} - ${location.state}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun LocationInfoCard(location: WebLocation) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "📋 Informações",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            if (location.description.isNotEmpty()) {
                Text(
                    text = location.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                LocationInfoItem(
                    emoji = "🏟️",
                    label = "Quadras",
                    value = "${location.fieldCount}"
                )
                LocationInfoItem(
                    emoji = if (location.isCovered) "🏠" else "🌤️",
                    label = if (location.isCovered) "Coberto" else "Aberto",
                    value = ""
                )
                if (location.hasLockerRoom) {
                    LocationInfoItem(emoji = "🚿", label = "Vestiário", value = "")
                }
                if (location.hasParking) {
                    LocationInfoItem(emoji = "🅿️", label = "Estacionamento", value = "")
                }
            }

            if (location.phone != null) {
                HorizontalDivider()
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("📞 ", style = MaterialTheme.typography.bodyLarge)
                    Text(location.phone, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                }
            }

            if (location.instagram != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("📸 ", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        text = "@${location.instagram.removePrefix("@")}",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }
}

@Composable
private fun LocationInfoItem(emoji: String, label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(emoji, style = MaterialTheme.typography.headlineSmall)
        Spacer(modifier = Modifier.height(4.dp))
        if (value.isNotEmpty()) {
            Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun AmenitiesSection(amenities: List<String>) {
    if (amenities.isEmpty()) return

    Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "✨ Comodidades",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )

        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(amenities) { amenity ->
                SuggestionChip(
                    onClick = {},
                    label = { Text(amenity, style = MaterialTheme.typography.labelMedium) },
                    colors = SuggestionChipDefaults.suggestionChipColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f)
                    )
                )
            }
        }
    }
}

@Composable
private fun FieldsSection(fields: List<WebField>) {
    Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "⚽ Campos Disponíveis",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )

        fields.forEach { field ->
            FieldCard(field = field)
        }
    }
}

@Composable
private fun FieldCard(field: WebField) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (field.isActive) MaterialTheme.colorScheme.surfaceContainerHigh
            else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = field.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    if (!field.isActive) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = MaterialTheme.colorScheme.outline
                        ) {
                            Text(
                                text = " Inativo ",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White
                            )
                        }
                    }
                }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "${getFieldTypeEmoji(field.type)} ${field.type}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = "• ${field.surface}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (field.isCovered) {
                        Text(
                            text = "• 🏠 Coberto",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            if (field.hourlyPrice > 0) {
                Text(
                    text = "R$ ${field.hourlyPrice.toInt()}/h",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
private fun MapSection(address: String, latitude: Double?, longitude: Double?) {
    Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "🗺️ Localização",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )

        Card(
            modifier = Modifier.fillMaxWidth().height(180.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            shape = RoundedCornerShape(16.dp)
        ) {
            Box(
                modifier = Modifier.fillMaxSize().background(
                    Brush.linearGradient(
                        listOf(
                            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f),
                            MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.3f)
                        )
                    )
                ),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text("🗺️", style = MaterialTheme.typography.displayMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Mapa não disponível",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    FilledTonalButton(onClick = { openMapsUrl(address, latitude, longitude) }) {
                        Text("🔗 Ver no Google Maps")
                    }
                }
            }
        }
    }
}

@Composable
private fun ReviewsSection(reviews: List<WebReview>) {
    Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "💬 Avaliações",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            TextButton(onClick = {}) {
                Text("+ Avaliar")
            }
        }

        if (reviews.isEmpty()) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("📝", style = MaterialTheme.typography.headlineMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Nenhuma avaliação ainda",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Seja o primeiro a avaliar!",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            reviews.forEach { review ->
                ReviewCard(review = review)
            }
        }
    }
}

@Composable
private fun ReviewCard(review: WebReview) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                        modifier = Modifier.size(36.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = review.userName.firstOrNull()?.uppercase() ?: "?",
                                style = MaterialTheme.typography.titleSmall,
                                color = MaterialTheme.colorScheme.primary,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = review.userName,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = review.date,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    repeat(5) { index ->
                        Text(
                            text = if (index < review.rating) "⭐" else "☆",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }

            if (review.comment.isNotEmpty()) {
                Text(
                    text = review.comment,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun ActionButtons(
    location: WebLocation,
    onCreateGameClick: ((String) -> Unit)?
) {
    Column(
        modifier = Modifier.padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (location.phone != null) {
                Button(
                    onClick = { openPhoneUrl(location.phone) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("📞 Ligar")
                }
            }

            OutlinedButton(
                onClick = { openMapsUrl(location.address, location.latitude, location.longitude) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("🗺️ Ver no Maps")
            }
        }

        if (onCreateGameClick != null) {
            FilledTonalButton(
                onClick = { onCreateGameClick(location.id) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.filledTonalButtonColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            ) {
                Text("⚽ Criar Jogo Aqui", style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}

private fun mapToWebLocation(map: Map<String, Any?>): WebLocation {
    @Suppress("UNCHECKED_CAST")
    val amenities = (map["amenities"] as? List<String>) ?: emptyList()

    @Suppress("UNCHECKED_CAST")
    val fieldsMap = (map["fields"] as? List<Map<String, Any?>>) ?: emptyList()
    val fields = fieldsMap.map { f ->
        WebField(
            id = f["id"] as? String ?: "",
            name = f["name"] as? String ?: "Quadra",
            type = f["type"] as? String ?: "Society",
            surface = f["surface"] as? String ?: "Grama Sintética",
            isCovered = f["isCovered"] as? Boolean ?: false,
            hourlyPrice = (f["hourlyPrice"] as? Number)?.toDouble() ?: 0.0,
            isActive = f["isActive"] as? Boolean ?: true
        )
    }

    @Suppress("UNCHECKED_CAST")
    val reviewsMap = (map["reviews"] as? List<Map<String, Any?>>) ?: emptyList()
    val reviews = reviewsMap.map { r ->
        WebReview(
            id = r["id"] as? String ?: "",
            userName = r["userName"] as? String ?: "Anônimo",
            userPhoto = r["userPhoto"] as? String,
            rating = (r["rating"] as? Number)?.toInt() ?: 5,
            comment = r["comment"] as? String ?: "",
            date = r["date"] as? String ?: ""
        )
    }

    @Suppress("UNCHECKED_CAST")
    val photoUrls = (map["photoUrls"] as? List<String>) ?: listOfNotNull(map["photoUrl"] as? String)

    return WebLocation(
        id = map["id"] as? String ?: "",
        name = map["name"] as? String ?: "Local",
        description = map["description"] as? String ?: "",
        address = map["address"] as? String ?: "",
        neighborhood = map["neighborhood"] as? String ?: "",
        city = map["city"] as? String ?: "",
        state = map["state"] as? String ?: "",
        phone = map["phone"] as? String,
        instagram = map["instagram"] as? String,
        rating = (map["rating"] as? Number)?.toDouble() ?: 0.0,
        ratingCount = (map["ratingCount"] as? Number)?.toInt() ?: 0,
        photoUrls = photoUrls,
        primaryFieldType = map["primaryFieldType"] as? String ?: "Society",
        fieldCount = (map["fieldCount"] as? Number)?.toInt() ?: fields.size.takeIf { it > 0 } ?: 1,
        amenities = amenities,
        fields = fields,
        reviews = reviews,
        latitude = (map["latitude"] as? Number)?.toDouble(),
        longitude = (map["longitude"] as? Number)?.toDouble(),
        priceRange = (map["priceRange"] as? Number)?.toDouble() ?: 0.0,
        isCovered = map["isCovered"] as? Boolean ?: false,
        hasParking = amenities.any { it.contains("Estacionamento", ignoreCase = true) || it.contains("Parking", ignoreCase = true) },
        hasLockerRoom = amenities.any { it.contains("Vestiário", ignoreCase = true) || it.contains("Locker", ignoreCase = true) }
    )
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

private fun openMapsUrl(address: String, latitude: Double?, longitude: Double?) {
    val url = if (latitude != null && longitude != null) {
        "https://www.google.com/maps/search/?api=1&query=$latitude,$longitude"
    } else {
        val encodedAddress = jsEncodeURIComponent(address)
        "https://www.google.com/maps/search/?api=1&query=$encodedAddress"
    }
    kotlinx.browser.window.open(url, "_blank")
}

private fun openPhoneUrl(phone: String) {
    val cleanPhone = phone.filter { it.isDigit() || it == '+' }
    kotlinx.browser.window.open("tel:$cleanPhone", "_self")
}

private external fun jsEncodeURIComponent(str: String): String
