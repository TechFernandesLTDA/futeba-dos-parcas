# Snippets de Integração - Prontos para Copiar e Colar

Códigos prontos para integrar os novos Compose dialogs em suas Screens existentes.

---

## 1. EditScheduleDialog em SchedulesScreen

### Passo 1: Adicionar ao ViewModel

```kotlin
// SchedulesViewModel.kt
private val _scheduleToEdit = MutableStateFlow<Schedule?>(null)
val scheduleToEdit: StateFlow<Schedule?> = _scheduleToEdit.asStateFlow()

fun editSchedule(schedule: Schedule) {
    _scheduleToEdit.value = schedule
}

fun closeEditor() {
    _scheduleToEdit.value = null
}

fun saveSchedule(schedule: Schedule) {
    viewModelScope.launch {
        try {
            repository.updateSchedule(schedule)
            closeEditor()
        } catch (e: Exception) {
            AppLogger.e("SchedulesViewModel", "Erro ao salvar", e)
        }
    }
}
```

### Passo 2: Adicionar à Screen

```kotlin
// SchedulesScreen.kt
@Composable
fun SchedulesScreen(
    viewModel: SchedulesViewModel = hiltViewModel(),
    fragmentManager: FragmentManager? = null
) {
    val scheduleToEdit by viewModel.scheduleToEdit.collectAsState()

    // ... existing content ...

    // Dialog
    scheduleToEdit?.let { schedule ->
        EditScheduleDialog(
            schedule = schedule,
            onDismiss = { viewModel.closeEditor() },
            onSave = { updatedSchedule ->
                viewModel.saveSchedule(updatedSchedule)
            },
            onTimePickerClick = { currentTime ->
                fragmentManager?.let { fm ->
                    showTimePickerDialog(currentTime, fm) { newTime ->
                        // Update the time in the dialog
                        // This requires a way to communicate back
                        // Best: use a mutable state in the Compose scope
                    }
                }
            }
        )
    }
}

// Helper function
private fun showTimePickerDialog(
    currentTime: String,
    fragmentManager: FragmentManager,
    onTimeSelected: (String) -> Unit
) {
    val timeParts = currentTime.split(":")
    val hour = timeParts.getOrNull(0)?.toIntOrNull() ?: 19
    val minute = timeParts.getOrNull(1)?.toIntOrNull() ?: 0

    val picker = MaterialTimePicker.Builder()
        .setTimeFormat(TimeFormat.CLOCK_24H)
        .setHour(hour)
        .setMinute(minute)
        .setTitleText("Selecione o Horário")
        .build()

    picker.addOnPositiveButtonClickListener {
        val formattedTime = String.format(Locale.getDefault(), "%02d:%02d", picker.hour, picker.minute)
        onTimeSelected(formattedTime)
    }

    picker.show(fragmentManager, "TIME_PICKER")
}
```

### Passo 3: No Item/Button

```kotlin
// Em SchedulesFragment ou Screen
Button(
    onClick = { viewModel.editSchedule(schedule) }
) {
    Text("Editar")
}
```

---

## 2. FieldEditDialog em ManageLocationsScreen

### Passo 1: Adicionar ao ViewModel

```kotlin
// ManageLocationsViewModel.kt
private val _fieldToEdit = MutableStateFlow<Field?>(null)
val fieldToEdit: StateFlow<Field?> = _fieldToEdit.asStateFlow()

fun editField(field: Field?) {
    _fieldToEdit.value = field
}

fun closeFieldEditor() {
    _fieldToEdit.value = null
}

fun saveField(
    name: String,
    type: FieldType,
    price: Double,
    isActive: Boolean,
    photoUri: Uri?,
    surface: String?,
    isCovered: Boolean,
    dimensions: String?
) {
    viewModelScope.launch {
        try {
            val currentField = _fieldToEdit.value
            val locationId = getSelectedLocationId()

            val field = if (currentField != null) {
                // Update
                currentField.copy(
                    name = name,
                    type = type.name,
                    hourlyPrice = price,
                    isActive = isActive,
                    surface = surface,
                    isCovered = isCovered,
                    dimensions = dimensions
                )
            } else {
                // Create
                Field(
                    locationId = locationId,
                    name = name,
                    type = type.name,
                    hourlyPrice = price,
                    isActive = isActive,
                    surface = surface,
                    isCovered = isCovered,
                    dimensions = dimensions
                )
            }

            // Upload photo if provided
            if (photoUri != null) {
                try {
                    val photoUrl = repository.uploadFieldPhoto(locationId, photoUri)
                    field.photos = listOf(photoUrl)
                } catch (e: Exception) {
                    AppLogger.e("ManageLocationsViewModel", "Erro ao fazer upload de foto", e)
                }
            }

            if (currentField != null) {
                repository.updateField(field)
            } else {
                repository.createField(field)
            }

            closeFieldEditor()
        } catch (e: Exception) {
            AppLogger.e("ManageLocationsViewModel", "Erro ao salvar quadra", e)
        }
    }
}

private fun getSelectedLocationId(): String {
    // Get from current UI state
    return ""
}
```

### Passo 2: Adicionar à Screen

```kotlin
// ManageLocationsScreen.kt
@Composable
fun ManageLocationsScreen(
    viewModel: ManageLocationsViewModel = hiltViewModel()
) {
    val fieldToEdit by viewModel.fieldToEdit.collectAsState()

    // ... existing content ...

    // Dialog
    if (fieldToEdit != null) {
        FieldEditDialog(
            field = fieldToEdit,
            defaultType = FieldType.SOCIETY,
            onDismiss = { viewModel.closeFieldEditor() },
            onSave = { name, type, price, isActive, photoUri, surface, isCovered, dimensions ->
                viewModel.saveField(
                    name = name,
                    type = type,
                    price = price,
                    isActive = isActive,
                    photoUri = photoUri,
                    surface = surface,
                    isCovered = isCovered,
                    dimensions = dimensions
                )
            }
        )
    }
}
```

### Passo 3: Botões para Abrir Dialog

```kotlin
// Novo
Button(
    onClick = { viewModel.editField(null) }
) {
    Icon(Icons.Default.Add, null)
    Spacer(Modifier.width(8.dp))
    Text("Nova Quadra")
}

// Editar
IconButton(
    onClick = { viewModel.editField(field) }
) {
    Icon(Icons.Default.Edit, null)
}
```

---

## 3. AddCashboxEntryDialog em CashboxScreen

### Passo 1: Adicionar ao ViewModel

```kotlin
// CashboxViewModel.kt
private val _showAddEntryDialog = MutableStateFlow<CashboxEntryType?>(null)
val showAddEntryDialog: StateFlow<CashboxEntryType?> = _showAddEntryDialog.asStateFlow()

fun openAddEntryDialog(type: CashboxEntryType) {
    _showAddEntryDialog.value = type
}

fun closeAddEntryDialog() {
    _showAddEntryDialog.value = null
}

fun saveEntry(
    description: String,
    amount: Double,
    category: CashboxCategory,
    receiptUri: Uri?
) {
    viewModelScope.launch {
        try {
            val entryType = _showAddEntryDialog.value ?: return@launch

            val entry = CashboxEntry(
                description = description,
                amount = amount,
                category = category.name,
                type = entryType.name,
                createdAt = System.currentTimeMillis()
            )

            if (receiptUri != null) {
                try {
                    val receiptUrl = repository.uploadReceipt(receiptUri)
                    entry.receiptUrl = receiptUrl
                } catch (e: Exception) {
                    AppLogger.e("CashboxViewModel", "Erro ao fazer upload do comprovante", e)
                }
            }

            repository.addEntry(entry)
            closeAddEntryDialog()
            loadEntries()
        } catch (e: Exception) {
            AppLogger.e("CashboxViewModel", "Erro ao adicionar entrada", e)
        }
    }
}

private fun loadEntries() {
    viewModelScope.launch {
        try {
            val entries = repository.getEntries()
            // Update UI state
        } catch (e: Exception) {
            AppLogger.e("CashboxViewModel", "Erro ao carregar entradas", e)
        }
    }
}
```

### Passo 2: Adicionar à Screen

```kotlin
// CashboxScreen.kt
@Composable
fun CashboxScreen(
    viewModel: CashboxViewModel = hiltViewModel()
) {
    val showAddEntryDialog by viewModel.showAddEntryDialog.collectAsState()

    // ... existing content ...

    // Dialog
    showAddEntryDialog?.let { type ->
        AddCashboxEntryDialog(
            type = type,
            onDismiss = { viewModel.closeAddEntryDialog() },
            onSave = { description, amount, category, receiptUri ->
                viewModel.saveEntry(description, amount, category, receiptUri)
            }
        )
    }
}
```

### Passo 3: Botões para Abrir Dialog

```kotlin
// Entrada
Button(
    onClick = { viewModel.openAddEntryDialog(CashboxEntryType.INCOME) }
) {
    Icon(Icons.Default.Add, null)
    Spacer(Modifier.width(8.dp))
    Text("Entrada")
}

// Saída
Button(
    onClick = { viewModel.openAddEntryDialog(CashboxEntryType.EXPENSE) }
) {
    Icon(Icons.Default.Remove, null)
    Spacer(Modifier.width(8.dp))
    Text("Saída")
}
```

---

## 4. Imports Necessários

Copie estes imports para seus arquivos:

### Para EditScheduleDialog
```kotlin
import com.futebadosparcas.ui.schedules.EditScheduleDialog
import com.futebadosparcas.data.model.Schedule
import com.futebadosparcas.data.model.RecurrenceType
import com.google.android.material.timepicker.MaterialTimePicker
import com.google.android.material.timepicker.TimeFormat
import java.util.Locale
```

### Para FieldEditDialog
```kotlin
import com.futebadosparcas.ui.locations.FieldEditDialog
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.FieldType
import android.net.Uri
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Edit
```

### Para AddCashboxEntryDialog
```kotlin
import com.futebadosparcas.ui.groups.dialogs.AddCashboxEntryDialog
import com.futebadosparcas.data.model.CashboxEntryType
import com.futebadosparcas.data.model.CashboxCategory
import android.net.Uri
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
```

---

## 5. Estados Exemplo (Kotlin Data Classes)

```kotlin
// Para usar com os dialogs, crie/atualize estas data classes

data class CashboxEntry(
    val id: String = "",
    val description: String = "",
    val amount: Double = 0.0,
    val category: String = "",
    val type: String = "INCOME", // INCOME or EXPENSE
    val createdAt: Long = System.currentTimeMillis(),
    var receiptUrl: String? = null
)

data class CashboxCategory(
    val name: String,
    val displayName: String
) {
    companion object {
        fun getIncomeCategories(): List<CashboxCategory> = listOf(
            CashboxCategory("member_fee", "Taxa de Membro"),
            CashboxCategory("game_fee", "Taxa de Jogo"),
            CashboxCategory("sponsorship", "Patrocínio"),
            CashboxCategory("other", "Outros")
        )

        fun getExpenseCategories(): List<CashboxCategory> = listOf(
            CashboxCategory("field_rent", "Aluguel de Quadra"),
            CashboxCategory("equipment", "Equipamento"),
            CashboxCategory("maintenance", "Manutenção"),
            CashboxCategory("other", "Outros")
        )

        const val OTHER = "other"
    }
}
```

---

## 6. Checklist de Integração

Para cada dialog:

- [ ] Adicione imports no ViewModel
- [ ] Adicione imports na Screen
- [ ] Copie state variables ao ViewModel
- [ ] Copie funções de callback ao ViewModel
- [ ] Adicione dialog Composable à Screen
- [ ] Adicione botões para abrir dialog
- [ ] Teste seleção de fotos
- [ ] Teste validações
- [ ] Teste salvar e dismiss
- [ ] Verifique que dados são salvos no backend
- [ ] Remova references ao Fragment antigo (se houver)

---

## 7. Troubleshooting Rápido

### Dialog não aparece
```kotlin
// Certifique-se de que o estado está atualizado
scheduleToEdit?.let { schedule ->
    // O dialog só aparece se scheduleToEdit != null
}
```

### MaterialTimePicker não funciona
```kotlin
// Precisa de FragmentManager real
fragmentManager?.let { fm ->
    // Só funciona com fragmentManager válido
}
```

### Foto não carrega
```kotlin
// Verifique permissões em AndroidManifest.xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.CAMERA" />
```

### Validação não mostra erro
```kotlin
// Certifique-se de que setOnClickListener no botão verifica validação
if (name.isBlank()) {
    showNameError = true
    return@setOnClickListener // Não salva
}
```

---

## 8. Testing

Adicione testes simples:

```kotlin
@Test
fun testFieldEditDialogValidation() {
    composeTestRule.setContent {
        FutebaDosParçasTheme {
            FieldEditDialog(
                field = null,
                onDismiss = {},
                onSave = { name, _, _, _, _, _, _, _ ->
                    assert(name.isNotBlank())
                }
            )
        }
    }

    // Enter invalid field
    composeTestRule.onNodeWithTag("nameField").performTextInput("")
    composeTestRule.onNodeWithText("Salvar").performClick()

    // Should see error
    composeTestRule.onNodeWithText("Campo obrigatório").assertExists()
}
```

---

## Próximas Etapas

1. **Copie um snippet acima**
2. **Cole no seu ViewModel**
3. **Cole na sua Screen**
4. **Execute o app e teste**
5. **Consulte COMPOSE_DIALOG_EXAMPLES.md para exemplos mais completos**

---
