# Exemplos de Uso - Compose Dialogs

Este documento mostra exemplos práticos de como usar os novos Compose dialogs em suas Screens.

---

## Exemplo 1: EditScheduleDialog em uma Screen

### Implementação em ViewModel

```kotlin
// SchedulesViewModel.kt
@HiltViewModel
class SchedulesViewModel @Inject constructor(
    private val repository: ScheduleRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<ScheduleUiState>(ScheduleUiState.Loading)
    val uiState: StateFlow<ScheduleUiState> = _uiState.asStateFlow()

    private val _scheduleToEdit = MutableStateFlow<Schedule?>(null)
    val scheduleToEdit: StateFlow<Schedule?> = _scheduleToEdit.asStateFlow()

    fun openScheduleEditor(schedule: Schedule) {
        _scheduleToEdit.value = schedule
    }

    fun closeScheduleEditor() {
        _scheduleToEdit.value = null
    }

    fun saveSchedule(schedule: Schedule) {
        viewModelScope.launch {
            try {
                repository.updateSchedule(schedule)
                closeScheduleEditor()
            } catch (e: Exception) {
                AppLogger.e("SchedulesViewModel", "Erro ao salvar agendamento", e)
            }
        }
    }

    fun showTimePicker(schedule: Schedule, onTimeSelected: (String) -> Unit) {
        // This would be called from the Compose side
        // The actual MaterialTimePicker is shown from Fragment context
    }
}
```

### Implementação em Screen

```kotlin
// SchedulesScreen.kt
@Composable
fun SchedulesScreen(
    viewModel: SchedulesViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val scheduleToEdit by viewModel.scheduleToEdit.collectAsState()
    val context = LocalContext.current

    // Content
    Column {
        // List of schedules
        when (uiState) {
            is ScheduleUiState.Loading -> LoadingScreen()
            is ScheduleUiState.Success -> SchedulesList(
                schedules = (uiState as ScheduleUiState.Success).schedules,
                onEditClick = { schedule ->
                    viewModel.openScheduleEditor(schedule)
                }
            )
            is ScheduleUiState.Error -> ErrorScreen()
        }
    }

    // Dialog
    scheduleToEdit?.let { schedule ->
        EditScheduleDialog(
            schedule = schedule,
            onDismiss = { viewModel.closeScheduleEditor() },
            onSave = { updatedSchedule ->
                viewModel.saveSchedule(updatedSchedule)
            },
            onTimePickerClick = { currentTime ->
                // This must be called from a Fragment context that has access to supportFragmentManager
                // Best practice: move this logic to the Fragment/Activity level
                showTimePickerDialog(currentTime, context as? AppCompatActivity) { newTime ->
                    // Update time in the dialog state
                }
            }
        )
    }
}

@Composable
private fun SchedulesList(
    schedules: List<Schedule>,
    onEditClick: (Schedule) -> Unit
) {
    LazyColumn {
        items(schedules) { schedule ->
            ScheduleItem(
                schedule = schedule,
                onEdit = { onEditClick(schedule) }
            )
        }
    }
}

@Composable
private fun ScheduleItem(
    schedule: Schedule,
    onEdit: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(8.dp)
            .clickable { onEdit() }
    ) {
        Column(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth()
        ) {
            Text(
                text = schedule.name,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "${getDayName(schedule.dayOfWeek)} às ${schedule.time}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = getRecurrenceLabel(schedule.recurrenceType),
                style = MaterialTheme.typography.labelSmall
            )
        }
    }
}

private fun getDayName(dayOfWeek: Int): String {
    return arrayOf(
        "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
        "Quinta-feira", "Sexta-feira", "Sábado"
    ).getOrNull(dayOfWeek) ?: "Domingo"
}

private fun getRecurrenceLabel(type: RecurrenceType): String {
    return when (type) {
        RecurrenceType.weekly -> "Semanal"
        RecurrenceType.biweekly -> "Quinzenal"
        RecurrenceType.monthly -> "Mensal"
    }
}
```

### Helper Function para MaterialTimePicker

```kotlin
// ScheduleUtils.kt
fun showTimePickerDialog(
    currentTime: String,
    activity: AppCompatActivity?,
    onTimeSelected: (String) -> Unit
) {
    activity?.let {
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
            val formattedTime = String.format(
                Locale.getDefault(),
                "%02d:%02d",
                picker.hour,
                picker.minute
            )
            onTimeSelected(formattedTime)
        }

        picker.show(it.supportFragmentManager, "TIME_PICKER")
    }
}
```

---

## Exemplo 2: FieldEditDialog em ManageLocationsScreen

### Implementação em ViewModel

```kotlin
// ManageLocationsViewModel.kt
@HiltViewModel
class ManageLocationsViewModel @Inject constructor(
    private val locationRepository: LocationRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<LocationUiState>(LocationUiState.Loading)
    val uiState: StateFlow<LocationUiState> = _uiState.asStateFlow()

    private val _fieldToEdit = MutableStateFlow<Field?>(null)
    val fieldToEdit: StateFlow<Field?> = _fieldToEdit.asStateFlow()

    fun openFieldEditor(field: Field?) {
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
                val field = _fieldToEdit.value
                if (field != null) {
                    // Editar existente
                    val updatedField = field.copy(
                        name = name,
                        type = type.name,
                        hourlyPrice = price,
                        isActive = isActive,
                        surface = surface,
                        isCovered = isCovered,
                        dimensions = dimensions
                    )
                    // Upload photo if new
                    if (photoUri != null) {
                        val photoUrl = locationRepository.uploadFieldPhoto(field.locationId, photoUri)
                        updatedField.photos = listOf(photoUrl)
                    }
                    locationRepository.updateField(updatedField)
                } else {
                    // Criar novo
                    val newField = Field(
                        locationId = getCurrentLocationId(),
                        name = name,
                        type = type.name,
                        hourlyPrice = price,
                        isActive = isActive,
                        surface = surface,
                        isCovered = isCovered,
                        dimensions = dimensions
                    )
                    if (photoUri != null) {
                        val photoUrl = locationRepository.uploadFieldPhoto(
                            getCurrentLocationId(),
                            photoUri
                        )
                        newField.photos = listOf(photoUrl)
                    }
                    locationRepository.createField(newField)
                }
                closeFieldEditor()
            } catch (e: Exception) {
                AppLogger.e("ManageLocationsViewModel", "Erro ao salvar quadra", e)
            }
        }
    }

    private fun getCurrentLocationId(): String {
        // Get from current state
        return (uiState.value as? LocationUiState.Success)?.location?.id ?: ""
    }
}
```

### Implementação em Screen

```kotlin
// ManageLocationsScreen.kt
@Composable
fun ManageLocationsScreen(
    viewModel: ManageLocationsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val fieldToEdit by viewModel.fieldToEdit.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        when (uiState) {
            is LocationUiState.Loading -> LoadingScreen()
            is LocationUiState.Success -> {
                val location = (uiState as LocationUiState.Success).location
                val fields = (uiState as LocationUiState.Success).fields

                FieldsList(
                    fields = fields,
                    onEditField = { field ->
                        viewModel.openFieldEditor(field)
                    },
                    onAddField = {
                        viewModel.openFieldEditor(null)
                    }
                )
            }
            is LocationUiState.Error -> ErrorScreen()
        }
    }

    // Dialog
    if (fieldToEdit != null) {
        FieldEditDialog(
            field = fieldToEdit,
            defaultType = FieldType.SOCIETY,
            onDismiss = {
                viewModel.closeFieldEditor()
            },
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

@Composable
private fun FieldsList(
    fields: List<Field>,
    onEditField: (Field) -> Unit,
    onAddField: () -> Unit
) {
    Column {
        Button(
            onClick = onAddField,
            modifier = Modifier
                .align(Alignment.End)
                .padding(bottom = 16.dp)
        ) {
            Icon(Icons.Default.Add, null)
            Spacer(Modifier.width(8.dp))
            Text("Nova Quadra")
        }

        LazyColumn {
            items(fields) { field ->
                FieldItem(
                    field = field,
                    onEdit = { onEditField(field) }
                )
            }
        }
    }
}

@Composable
private fun FieldItem(
    field: Field,
    onEdit: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
            .clickable { onEdit() }
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = field.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = field.getTypeEnum().displayName,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (field.surface != null) {
                    Text(
                        text = "Superfície: ${field.surface}",
                        style = MaterialTheme.typography.labelSmall
                    )
                }
                Text(
                    text = "R$ ${field.hourlyPrice}/hora",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            if (field.photos.isNotEmpty()) {
                AsyncImage(
                    model = field.photos[0],
                    contentDescription = null,
                    modifier = Modifier
                        .size(60.dp)
                        .clip(RoundedCornerShape(8.dp)),
                    contentScale = ContentScale.Crop
                )
            }
        }
    }
}
```

---

## Exemplo 3: AddCashboxEntryDialog em CashboxScreen

### Implementação em ViewModel

```kotlin
// CashboxViewModel.kt
@HiltViewModel
class CashboxViewModel @Inject constructor(
    private val cashboxRepository: CashboxRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<CashboxUiState>(CashboxUiState.Loading)
    val uiState: StateFlow<CashboxUiState> = _uiState.asStateFlow()

    private val _showAddEntryDialog = MutableStateFlow<CashboxEntryType?>(null)
    val showAddEntryDialog: StateFlow<CashboxEntryType?> = _showAddEntryDialog.asStateFlow()

    fun openAddEntryDialog(type: CashboxEntryType) {
        _showAddEntryDialog.value = type
    }

    fun closeAddEntryDialog() {
        _showAddEntryDialog.value = null
    }

    fun addEntry(
        description: String,
        amount: Double,
        category: CashboxCategory,
        receiptUri: Uri?
    ) {
        viewModelScope.launch {
            try {
                val entry = CashboxEntry(
                    description = description,
                    amount = amount,
                    category = category.name,
                    type = _showAddEntryDialog.value?.name ?: "INCOME",
                    createdAt = System.currentTimeMillis()
                )

                var receiptUrl: String? = null
                if (receiptUri != null) {
                    receiptUrl = cashboxRepository.uploadReceipt(receiptUri)
                    entry.receiptUrl = receiptUrl
                }

                cashboxRepository.addEntry(entry)
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
                val entries = cashboxRepository.getEntries()
                _uiState.value = CashboxUiState.Success(entries)
            } catch (e: Exception) {
                _uiState.value = CashboxUiState.Error(e.message ?: "Erro desconhecido")
            }
        }
    }
}
```

### Implementação em Screen

```kotlin
// CashboxScreen.kt
@Composable
fun CashboxScreen(
    viewModel: CashboxViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val showAddEntryDialog by viewModel.showAddEntryDialog.collectAsState()

    Column(
        modifier = Modifier.fillMaxSize()
    ) {
        // Header com botões
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = { viewModel.openAddEntryDialog(CashboxEntryType.INCOME) },
                modifier = Modifier.weight(1f)
            ) {
                Icon(Icons.Default.Add, null)
                Spacer(Modifier.width(8.dp))
                Text("Entrada")
            }

            Button(
                onClick = { viewModel.openAddEntryDialog(CashboxEntryType.EXPENSE) },
                modifier = Modifier.weight(1f)
            ) {
                Icon(Icons.Default.Remove, null)
                Spacer(Modifier.width(8.dp))
                Text("Saída")
            }
        }

        // Content
        when (uiState) {
            is CashboxUiState.Loading -> LoadingScreen()
            is CashboxUiState.Success -> CashboxList(
                entries = (uiState as CashboxUiState.Success).entries
            )
            is CashboxUiState.Error -> ErrorScreen(
                message = (uiState as CashboxUiState.Error).message
            )
        }
    }

    // Dialog
    showAddEntryDialog?.let { type ->
        AddCashboxEntryDialog(
            type = type,
            onDismiss = { viewModel.closeAddEntryDialog() },
            onSave = { description, amount, category, receiptUri ->
                viewModel.addEntry(description, amount, category, receiptUri)
            }
        )
    }
}

@Composable
private fun CashboxList(entries: List<CashboxEntry>) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(entries) { entry ->
            CashboxEntryItem(entry)
        }
    }
}

@Composable
private fun CashboxEntryItem(entry: CashboxEntry) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = entry.description.ifEmpty { entry.category },
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = entry.category,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Text(
                text = String.format("R$ %.2f", entry.amount),
                style = MaterialTheme.typography.titleMedium,
                color = if (entry.type == "INCOME") {
                    Color(0xFF58CC02) // Green
                } else {
                    Color.Red
                },
                fontWeight = FontWeight.Bold
            )
        }
    }
}
```

---

## State Management Pattern

Todos os exemplos seguem este padrão:

```
Screen compone Composable
    ↓
Coletar estado do ViewModel
    ↓
Renderizar conteúdo
    ↓
Se dialog aberto, mostrar Compose Dialog
    ↓
Dialog chama callbacks do ViewModel
    ↓
ViewModel atualiza estado
    ↓
Screen se re-compõe
```

---

## Boas Práticas

1. **ViewModel como Single Source of Truth**: Sempre manter o estado no ViewModel
2. **Callbacks Explícitos**: Usar callbacks para comunicação Screen → ViewModel
3. **StateFlow para UI State**: Usar para gerenciar estado observável
4. **LazyColumn para Listas**: Sempre usar LazyColumn/LazyRow para listas grandes
5. **Validação Inline**: Mostrar erros enquanto usuário digita
6. **Loading States**: Sempre tratar Loading e Error states

---

## Testes

Para testar os dialogs, use esta composição de preview:

```kotlin
@Preview
@Composable
fun EditScheduleDialogPreview() {
    FutebaDosParçasTheme {
        EditScheduleDialog(
            schedule = Schedule(
                name = "Pelada Quinta",
                time = "19:00",
                dayOfWeek = 4,
                recurrenceType = RecurrenceType.weekly
            ),
            onDismiss = {},
            onSave = {},
            onTimePickerClick = {}
        )
    }
}
```

---

## Troubleshooting

### MaterialTimePicker não aparece
- Certifique-se de que tem acesso a `supportFragmentManager`
- Chame a função helper `showTimePickerDialog()` do contexto correto

### Foto não carrega
- Verifique permissão `READ_EXTERNAL_STORAGE`
- Verifique se `FileProvider` está configurado em `AndroidManifest.xml`

### Validação não funciona
- Confirmador estado do `remember` está correto
- Verifique `isError` e `supportingText` no TextField

---
