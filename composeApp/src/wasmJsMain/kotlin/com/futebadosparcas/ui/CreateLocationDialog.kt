package com.futebadosparcas.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.futebadosparcas.firebase.FirebaseManager
import kotlinx.coroutines.launch

private val AVAILABLE_AMENITIES = listOf(
    "Estacionamento" to "🅿️",
    "Vestiário" to "🚿",
    "Churrasqueira" to "🍖",
    "Bar" to "🍺",
    "Arquibancada" to "🏟️",
    "Wi-Fi" to "📶",
    "Coberto" to "🏠",
    "Iluminação" to "💡",
    "Lanchonete" to "🌭"
)

private val FIELD_TYPES = listOf("SOCIETY", "FUTSAL", "CAMPO")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateLocationDialog(
    onDismiss: () -> Unit,
    onCreate: (locationId: String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var state by remember { mutableStateOf("") }
    var neighborhood by remember { mutableStateOf("") }
    var fieldType by remember { mutableStateOf("SOCIETY") }
    var phone by remember { mutableStateOf("") }
    var selectedAmenities by remember { mutableStateOf(setOf<String>()) }

    var nameError by remember { mutableStateOf<String?>(null) }
    var addressError by remember { mutableStateOf<String?>(null) }
    var cityError by remember { mutableStateOf<String?>(null) }

    var isLoading by remember { mutableStateOf(false) }
    var showFieldTypeDropdown by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()

    fun validate(): Boolean {
        var isValid = true

        if (name.trim().length < 3) {
            nameError = "Nome deve ter pelo menos 3 caracteres"
            isValid = false
        } else {
            nameError = null
        }

        if (address.trim().length < 5) {
            addressError = "Endereço muito curto"
            isValid = false
        } else {
            addressError = null
        }

        if (city.trim().isEmpty()) {
            cityError = "Informe a cidade"
            isValid = false
        } else {
            cityError = null
        }

        return isValid
    }

    fun handleCreate() {
        if (!validate()) return

        scope.launch {
            isLoading = true
            try {
                val locationId = FirebaseManager.createLocation(
                    name = name.trim(),
                    address = address.trim(),
                    city = city.trim(),
                    state = state.trim().ifEmpty { "SP" },
                    neighborhood = neighborhood.trim(),
                    fieldType = fieldType,
                    phone = phone.trim().ifEmpty { null },
                    amenities = selectedAmenities.toList()
                )
                if (locationId != null) {
                    onCreate(locationId)
                }
            } finally {
                isLoading = false
            }
        }
    }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth().heightIn(max = 700.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("📍 Adicionar Local", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    TextButton(onClick = onDismiss) { Text("✕") }
                }

                HorizontalDivider()

                Column(
                    modifier = Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("📝 Informações Básicas", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)

                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it; nameError = null },
                        label = { Text("Nome do local *") },
                        placeholder = { Text("Ex: Arena Futebol Society") },
                        isError = nameError != null,
                        supportingText = nameError?.let { { Text(it) } },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = address,
                        onValueChange = { address = it; addressError = null },
                        label = { Text("Endereço *") },
                        placeholder = { Text("Ex: Av. Brasil, 1500") },
                        isError = addressError != null,
                        supportingText = addressError?.let { { Text(it) } },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = neighborhood,
                            onValueChange = { neighborhood = it },
                            label = { Text("Bairro") },
                            placeholder = { Text("Ex: Jardim América") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )

                        OutlinedTextField(
                            value = city,
                            onValueChange = { city = it; cityError = null },
                            label = { Text("Cidade *") },
                            placeholder = { Text("Ex: São Paulo") },
                            isError = cityError != null,
                            supportingText = cityError?.let { { Text(it) } },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )

                        OutlinedTextField(
                            value = state,
                            onValueChange = { state = it },
                            label = { Text("UF") },
                            placeholder = { Text("SP") },
                            modifier = Modifier.width(70.dp),
                            singleLine = true
                        )
                    }

                    OutlinedTextField(
                        value = phone,
                        onValueChange = { phone = it },
                        label = { Text("Telefone") },
                        placeholder = { Text("Ex: (11) 99999-9999") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                    Text("🏟️ Tipo de Campo", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)

                    ExposedDropdownMenuBox(
                        expanded = showFieldTypeDropdown,
                        onExpandedChange = { showFieldTypeDropdown = it }
                    ) {
                        OutlinedTextField(
                            value = "${getFieldTypeEmoji(fieldType)} $fieldType",
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Tipo principal") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = showFieldTypeDropdown) },
                            modifier = Modifier.fillMaxWidth().menuAnchor()
                        )

                        ExposedDropdownMenu(
                            expanded = showFieldTypeDropdown,
                            onDismissRequest = { showFieldTypeDropdown = false }
                        ) {
                            FIELD_TYPES.forEach { type ->
                                DropdownMenuItem(
                                    text = { Text("${getFieldTypeEmoji(type)} $type") },
                                    onClick = { fieldType = type; showFieldTypeDropdown = false }
                                )
                            }
                        }
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                    Text("🔧 Comodidades", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)

                    Text(
                        "Selecione as comodidades disponíveis:",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        AVAILABLE_AMENITIES.chunked(3).forEach { row ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                row.forEach { (amenity, emoji) ->
                                    FilterChip(
                                        selected = selectedAmenities.contains(amenity),
                                        onClick = {
                                            selectedAmenities = if (selectedAmenities.contains(amenity)) {
                                                selectedAmenities - amenity
                                            } else {
                                                selectedAmenities + amenity
                                            }
                                        },
                                        label = { Text("$emoji $amenity", style = MaterialTheme.typography.labelSmall) },
                                        modifier = Modifier.weight(1f),
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer
                                        )
                                    )
                                }
                                repeat(3 - row.size) {
                                    Spacer(modifier = Modifier.weight(1f))
                                }
                            }
                        }
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("📷", style = MaterialTheme.typography.titleMedium)
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text("Adicionar foto", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                                Text("Upload de imagem em breve", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }

                HorizontalDivider()

                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        enabled = !isLoading
                    ) {
                        Text("Cancelar")
                    }

                    Button(
                        onClick = { handleCreate() },
                        modifier = Modifier.weight(1f),
                        enabled = !isLoading
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                color = MaterialTheme.colorScheme.onPrimary,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text("+ Adicionar")
                        }
                    }
                }
            }
        }
    }
}
