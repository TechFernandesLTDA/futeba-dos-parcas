package com.futebadosparcas.ui.profile

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.*
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringArrayResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import coil.compose.AsyncImage
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.FieldType
import com.futebadosparcas.util.PreferencesManager
import java.text.SimpleDateFormat
import java.util.*

/**
 * EditProfileScreen - Tela de edição de perfil em Compose
 *
 * Features:
 * - Upload de foto (com validação de tamanho)
 * - Formulário completo de perfil
 * - Sliders de rating por posição
 * - Dev mode easter egg (5 cliques na foto em 2s)
 * - Animação de upload de foto
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditProfileScreen(
    viewModel: ProfileViewModel,
    preferencesManager: PreferencesManager,
    onBackClick: () -> Unit = {},
    onProfileUpdated: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    var selectedImageUri by remember { mutableStateOf<Uri?>(null) }
    var devModeClickCount by remember { mutableIntStateOf(0) }
    var firstPhotoClickTime by remember { mutableLongStateOf(0L) }

    // Handle profile update success
    LaunchedEffect(uiState) {
        if (uiState is ProfileUiState.ProfileUpdateSuccess) {
            Toast.makeText(context, "Perfil atualizado com sucesso!", Toast.LENGTH_SHORT).show()
            onProfileUpdated()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Editar Perfil") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Voltar"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface,
                    navigationIconContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        }
    ) { paddingValues ->
        when (val state = uiState) {
            is ProfileUiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            is ProfileUiState.Success, is ProfileUiState.ProfileUpdateSuccess -> {
                val user = when (state) {
                    is ProfileUiState.Success -> state.user
                    is ProfileUiState.ProfileUpdateSuccess -> state.user
                    else -> return@Scaffold
                }

                EditProfileContent(
                    user = user,
                    statistics = (state as? ProfileUiState.Success)?.statistics,
                    selectedImageUri = selectedImageUri,
                    onImageSelected = { uri -> selectedImageUri = uri },
                    onPhotoClick = {
                        val currentTime = System.currentTimeMillis()

                        // Reset if more than 2 seconds since first click
                        if (currentTime - firstPhotoClickTime > 2000) {
                            devModeClickCount = 0
                        }

                        // If first click, mark the time
                        if (devModeClickCount == 0) {
                            firstPhotoClickTime = currentTime
                        }

                        devModeClickCount++

                        // If 5 clicks in 2 seconds, enable dev mode
                        if (devModeClickCount >= 5) {
                            preferencesManager.setDevModeEnabled(true)
                            Toast.makeText(
                                context,
                                "Opções de desenvolvedor ativadas",
                                Toast.LENGTH_SHORT
                            ).show()
                            devModeClickCount = 0
                            firstPhotoClickTime = 0
                        }
                    },
                    onSaveClick = { formData ->
                        viewModel.updateProfile(
                            name = formData.name,
                            nickname = formData.nickname,
                            preferredFieldTypes = formData.preferredFieldTypes.map {
                                com.futebadosparcas.data.model.FieldType.valueOf(it.name)
                            },
                            photoUri = selectedImageUri,
                            strikerRating = formData.strikerRating,
                            midRating = formData.midRating,
                            defenderRating = formData.defenderRating,
                            gkRating = formData.gkRating,
                            birthDate = formData.birthDate,
                            gender = formData.gender,
                            heightCm = formData.heightCm,
                            weightKg = formData.weightKg,
                            dominantFoot = formData.dominantFoot,
                            primaryPosition = formData.primaryPosition,
                            secondaryPosition = formData.secondaryPosition,
                            playStyle = formData.playStyle,
                            experienceYears = formData.experienceYears
                        )
                    },
                    modifier = Modifier.padding(paddingValues)
                )
            }
            is ProfileUiState.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "Erro ao carregar perfil",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.error
                        )
                        Text(text = state.message)
                        Button(onClick = { viewModel.loadProfile() }) {
                            Text("Tentar Novamente")
                        }
                    }
                }
            }
            else -> {}
        }
    }
}

@Composable
private fun EditProfileContent(
    user: com.futebadosparcas.domain.model.User,
    statistics: com.futebadosparcas.data.model.UserStatistics?,
    selectedImageUri: Uri?,
    onImageSelected: (Uri?) -> Unit,
    onPhotoClick: () -> Unit,
    onSaveClick: (ProfileFormData) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scrollState = rememberScrollState()

    // Form state
    var name by remember { mutableStateOf(user.name) }
    var nickname by remember { mutableStateOf(user.nickname ?: "") }
    var birthDate by remember { mutableStateOf<Date?>(user.birthDate?.let { Date(it) }) }
    var gender by remember { mutableStateOf(user.gender ?: "") }
    var heightCm by remember { mutableStateOf(user.heightCm?.toString() ?: "") }
    var weightKg by remember { mutableStateOf(user.weightKg?.toString() ?: "") }
    var dominantFoot by remember { mutableStateOf(user.dominantFoot ?: "") }
    var primaryPosition by remember { mutableStateOf(user.primaryPosition ?: "") }
    var secondaryPosition by remember { mutableStateOf(user.secondaryPosition ?: "") }
    var playStyle by remember { mutableStateOf(user.playStyle ?: "") }
    var experienceYears by remember { mutableStateOf(user.experienceYears?.toString() ?: "") }

    var societyChecked by remember { mutableStateOf(user.preferredFieldTypes.contains(FieldType.SOCIETY)) }
    var futsalChecked by remember { mutableStateOf(user.preferredFieldTypes.contains(FieldType.FUTSAL)) }
    var fieldChecked by remember { mutableStateOf(user.preferredFieldTypes.contains(FieldType.CAMPO)) }

    var strikerRating by remember { mutableFloatStateOf(user.strikerRating.toFloat()) }
    var midRating by remember { mutableFloatStateOf(user.midRating.toFloat()) }
    var defRating by remember { mutableFloatStateOf(user.defenderRating.toFloat()) }
    var gkRating by remember { mutableFloatStateOf(user.gkRating.toFloat()) }

    // Image picker launcher
    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let {
            // Validate image size (max 10MB)
            if (isImageSizeValid(context, it)) {
                onImageSelected(it)
                Toast.makeText(context, "Imagem selecionada com sucesso", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(
                    context,
                    "Imagem muito grande. Tamanho máximo: 10 MB",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Photo Section
        PhotoSection(
            photoUrl = user.photoUrl,
            selectedImageUri = selectedImageUri,
            onPhotoClick = {
                onPhotoClick()
                imagePickerLauncher.launch("image/*")
            }
        )

        // Basic Info
        BasicInfoSection(
            name = name,
            onNameChange = { name = it },
            nickname = nickname,
            onNicknameChange = { nickname = it },
            birthDate = birthDate,
            onBirthDateChange = { birthDate = it }
        )

        // Physical Info
        PhysicalInfoSection(
            gender = gender,
            onGenderChange = { gender = it },
            heightCm = heightCm,
            onHeightChange = { heightCm = it },
            weightKg = weightKg,
            onWeightChange = { weightKg = it },
            dominantFoot = dominantFoot,
            onDominantFootChange = { dominantFoot = it }
        )

        // Field Preferences
        FieldPreferencesSection(
            societyChecked = societyChecked,
            onSocietyChange = { societyChecked = it },
            futsalChecked = futsalChecked,
            onFutsalChange = { futsalChecked = it },
            fieldChecked = fieldChecked,
            onFieldChange = { fieldChecked = it }
        )

        // Position & Play Style
        PositionSection(
            primaryPosition = primaryPosition,
            onPrimaryPositionChange = { primaryPosition = it },
            secondaryPosition = secondaryPosition,
            onSecondaryPositionChange = { secondaryPosition = it },
            playStyle = playStyle,
            onPlayStyleChange = { playStyle = it },
            experienceYears = experienceYears,
            onExperienceYearsChange = { experienceYears = it }
        )

        // Position Ratings
        PositionRatingsSection(
            strikerRating = strikerRating,
            onStrikerChange = { strikerRating = it },
            midRating = midRating,
            onMidChange = { midRating = it },
            defRating = defRating,
            onDefChange = { defRating = it },
            gkRating = gkRating,
            onGkChange = { gkRating = it },
            statistics = statistics
        )

        // Save Button
        Button(
            onClick = {
                val preferredFieldTypes = mutableListOf<FieldType>()
                if (societyChecked) preferredFieldTypes.add(FieldType.SOCIETY)
                if (futsalChecked) preferredFieldTypes.add(FieldType.FUTSAL)
                if (fieldChecked) preferredFieldTypes.add(FieldType.CAMPO)

                if (name.isBlank() || preferredFieldTypes.isEmpty()) {
                    Toast.makeText(
                        context,
                        "Preencha o nome e selecione ao menos um tipo de campo",
                        Toast.LENGTH_SHORT
                    ).show()
                    return@Button
                }

                onSaveClick(
                    ProfileFormData(
                        name = name,
                        nickname = nickname.takeIf { it.isNotBlank() },
                        preferredFieldTypes = preferredFieldTypes,
                        strikerRating = strikerRating.toDouble(),
                        midRating = midRating.toDouble(),
                        defenderRating = defRating.toDouble(),
                        gkRating = gkRating.toDouble(),
                        birthDate = birthDate,
                        gender = gender.takeIf { it.isNotBlank() },
                        heightCm = heightCm.toIntOrNull(),
                        weightKg = weightKg.toIntOrNull(),
                        dominantFoot = dominantFoot.takeIf { it.isNotBlank() },
                        primaryPosition = primaryPosition.takeIf { it.isNotBlank() },
                        secondaryPosition = secondaryPosition.takeIf { it.isNotBlank() },
                        playStyle = playStyle.takeIf { it.isNotBlank() },
                        experienceYears = experienceYears.toIntOrNull()
                    )
                )
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text("Salvar Alterações", style = MaterialTheme.typography.titleMedium)
        }

        Spacer(modifier = Modifier.height(32.dp))
    }
}

@Composable
private fun PhotoSection(
    photoUrl: String?,
    selectedImageUri: Uri?,
    onPhotoClick: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Card(
            modifier = Modifier
                .size(120.dp)
                .clickable(onClick = onPhotoClick),
            shape = CircleShape,
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
        ) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                AsyncImage(
                    model = selectedImageUri ?: photoUrl,
                    contentDescription = "Foto de perfil",
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
            }
        }

        Text(
            text = "Toque para alterar a foto",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.primary
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BasicInfoSection(
    name: String,
    onNameChange: (String) -> Unit,
    nickname: String,
    onNicknameChange: (String) -> Unit,
    birthDate: Date?,
    onBirthDateChange: (Date?) -> Unit
) {
    val dateFormatter = remember { SimpleDateFormat("dd/MM/yyyy", Locale("pt", "BR")) }
    var showDatePicker by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = "Informações Básicas",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        OutlinedTextField(
            value = name,
            onValueChange = onNameChange,
            label = { Text("Nome Completo *") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            shape = RoundedCornerShape(12.dp)
        )

        OutlinedTextField(
            value = nickname,
            onValueChange = onNicknameChange,
            label = { Text("Apelido") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            shape = RoundedCornerShape(12.dp)
        )

        OutlinedTextField(
            value = birthDate?.let { dateFormatter.format(it) } ?: "",
            onValueChange = {},
            label = { Text("Data de Nascimento") },
            modifier = Modifier.fillMaxWidth(),
            readOnly = true,
            trailingIcon = {
                IconButton(onClick = { showDatePicker = true }) {
                    Icon(Icons.Default.CalendarToday, "Selecionar data")
                }
            },
            shape = RoundedCornerShape(12.dp)
        )
    }

    if (showDatePicker) {
        val calendar = Calendar.getInstance()
        birthDate?.let { calendar.time = it } ?: calendar.add(Calendar.YEAR, -18)

        DatePickerDialog(
            onBirthDateChange,
            calendar,
            onDismiss = { showDatePicker = false }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DatePickerDialog(
    onDateSelected: (Date?) -> Unit,
    initialCalendar: Calendar,
    onDismiss: () -> Unit
) {
    val datePickerState = rememberDatePickerState(
        initialSelectedDateMillis = initialCalendar.timeInMillis
    )

    androidx.compose.material3.DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                datePickerState.selectedDateMillis?.let {
                    onDateSelected(Date(it))
                }
                onDismiss()
            }) {
                Text("OK")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    ) {
        DatePicker(state = datePickerState)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PhysicalInfoSection(
    gender: String,
    onGenderChange: (String) -> Unit,
    heightCm: String,
    onHeightChange: (String) -> Unit,
    weightKg: String,
    onWeightChange: (String) -> Unit,
    dominantFoot: String,
    onDominantFootChange: (String) -> Unit
) {
    val context = LocalContext.current
    val genderEntries = stringArrayResource(R.array.gender_entries)
    val genderValues = stringArrayResource(R.array.gender_values)
    val footEntries = stringArrayResource(R.array.dominant_foot_entries)
    val footValues = stringArrayResource(R.array.dominant_foot_values)

    var genderExpanded by remember { mutableStateOf(false) }
    var footExpanded by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = "Informações Físicas",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        // Gender Dropdown
        ExposedDropdownMenuBox(
            expanded = genderExpanded,
            onExpandedChange = { genderExpanded = it }
        ) {
            OutlinedTextField(
                value = mapValueToEntry(gender, genderValues.toList(), genderEntries.toList()),
                onValueChange = {},
                readOnly = true,
                label = { Text("Gênero") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = genderExpanded) },
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(),
                shape = RoundedCornerShape(12.dp)
            )
            ExposedDropdownMenu(
                expanded = genderExpanded,
                onDismissRequest = { genderExpanded = false }
            ) {
                genderEntries.forEachIndexed { index, entry ->
                    DropdownMenuItem(
                        text = { Text(entry) },
                        onClick = {
                            onGenderChange(genderValues[index])
                            genderExpanded = false
                        }
                    )
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = heightCm,
                onValueChange = { if (it.all { char -> char.isDigit() }) onHeightChange(it) },
                label = { Text("Altura (cm)") },
                modifier = Modifier.weight(1f),
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Number,
                    imeAction = ImeAction.Next
                ),
                shape = RoundedCornerShape(12.dp)
            )

            OutlinedTextField(
                value = weightKg,
                onValueChange = { if (it.all { char -> char.isDigit() }) onWeightChange(it) },
                label = { Text("Peso (kg)") },
                modifier = Modifier.weight(1f),
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Number,
                    imeAction = ImeAction.Done
                ),
                shape = RoundedCornerShape(12.dp)
            )
        }

        // Dominant Foot Dropdown
        ExposedDropdownMenuBox(
            expanded = footExpanded,
            onExpandedChange = { footExpanded = it }
        ) {
            OutlinedTextField(
                value = mapValueToEntry(dominantFoot, footValues.toList(), footEntries.toList()),
                onValueChange = {},
                readOnly = true,
                label = { Text("Pé Dominante") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = footExpanded) },
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(),
                shape = RoundedCornerShape(12.dp)
            )
            ExposedDropdownMenu(
                expanded = footExpanded,
                onDismissRequest = { footExpanded = false }
            ) {
                footEntries.forEachIndexed { index, entry ->
                    DropdownMenuItem(
                        text = { Text(entry) },
                        onClick = {
                            onDominantFootChange(footValues[index])
                            footExpanded = false
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun FieldPreferencesSection(
    societyChecked: Boolean,
    onSocietyChange: (Boolean) -> Unit,
    futsalChecked: Boolean,
    onFutsalChange: (Boolean) -> Unit,
    fieldChecked: Boolean,
    onFieldChange: (Boolean) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = "Tipos de Campo Preferidos *",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onSocietyChange(!societyChecked) }
                .padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Checkbox(
                checked = societyChecked,
                onCheckedChange = null // Handled by Row click
            )
            Text("Society")
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onFutsalChange(!futsalChecked) }
                .padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Checkbox(
                checked = futsalChecked,
                onCheckedChange = null // Handled by Row click
            )
            Text("Futsal")
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onFieldChange(!fieldChecked) }
                .padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Checkbox(
                checked = fieldChecked,
                onCheckedChange = null // Handled by Row click
            )
            Text("Campo/Grama")
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PositionSection(
    primaryPosition: String,
    onPrimaryPositionChange: (String) -> Unit,
    secondaryPosition: String,
    onSecondaryPositionChange: (String) -> Unit,
    playStyle: String,
    onPlayStyleChange: (String) -> Unit,
    experienceYears: String,
    onExperienceYearsChange: (String) -> Unit
) {
    val positionEntries = stringArrayResource(R.array.position_entries)
    val positionValues = stringArrayResource(R.array.position_values)
    val playStyleEntries = stringArrayResource(R.array.play_style_entries)
    val playStyleValues = stringArrayResource(R.array.play_style_values)

    var primaryExpanded by remember { mutableStateOf(false) }
    var secondaryExpanded by remember { mutableStateOf(false) }
    var playStyleExpanded by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = "Posição e Estilo",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        // Primary Position
        ExposedDropdownMenuBox(
            expanded = primaryExpanded,
            onExpandedChange = { primaryExpanded = it }
        ) {
            OutlinedTextField(
                value = mapValueToEntry(primaryPosition, positionValues.toList(), positionEntries.toList()),
                onValueChange = {},
                readOnly = true,
                label = { Text("Posição Principal") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = primaryExpanded) },
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(),
                shape = RoundedCornerShape(12.dp)
            )
            ExposedDropdownMenu(
                expanded = primaryExpanded,
                onDismissRequest = { primaryExpanded = false }
            ) {
                positionEntries.forEachIndexed { index, entry ->
                    DropdownMenuItem(
                        text = { Text(entry) },
                        onClick = {
                            onPrimaryPositionChange(positionValues[index])
                            primaryExpanded = false
                        }
                    )
                }
            }
        }

        // Secondary Position
        ExposedDropdownMenuBox(
            expanded = secondaryExpanded,
            onExpandedChange = { secondaryExpanded = it }
        ) {
            OutlinedTextField(
                value = mapValueToEntry(secondaryPosition, positionValues.toList(), positionEntries.toList()),
                onValueChange = {},
                readOnly = true,
                label = { Text("Posição Secundária") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = secondaryExpanded) },
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(),
                shape = RoundedCornerShape(12.dp)
            )
            ExposedDropdownMenu(
                expanded = secondaryExpanded,
                onDismissRequest = { secondaryExpanded = false }
            ) {
                positionEntries.forEachIndexed { index, entry ->
                    DropdownMenuItem(
                        text = { Text(entry) },
                        onClick = {
                            onSecondaryPositionChange(positionValues[index])
                            secondaryExpanded = false
                        }
                    )
                }
            }
        }

        // Play Style
        ExposedDropdownMenuBox(
            expanded = playStyleExpanded,
            onExpandedChange = { playStyleExpanded = it }
        ) {
            OutlinedTextField(
                value = mapValueToEntry(playStyle, playStyleValues.toList(), playStyleEntries.toList()),
                onValueChange = {},
                readOnly = true,
                label = { Text("Estilo de Jogo") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = playStyleExpanded) },
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(),
                shape = RoundedCornerShape(12.dp)
            )
            ExposedDropdownMenu(
                expanded = playStyleExpanded,
                onDismissRequest = { playStyleExpanded = false }
            ) {
                playStyleEntries.forEachIndexed { index, entry ->
                    DropdownMenuItem(
                        text = { Text(entry) },
                        onClick = {
                            onPlayStyleChange(playStyleValues[index])
                            playStyleExpanded = false
                        }
                    )
                }
            }
        }

        OutlinedTextField(
            value = experienceYears,
            onValueChange = { if (it.all { char -> char.isDigit() }) onExperienceYearsChange(it) },
            label = { Text("Anos de Experiência") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Number,
                imeAction = ImeAction.Done
            ),
            shape = RoundedCornerShape(12.dp)
        )
    }
}

@Composable
private fun PositionRatingsSection(
    strikerRating: Float,
    onStrikerChange: (Float) -> Unit,
    midRating: Float,
    onMidChange: (Float) -> Unit,
    defRating: Float,
    onDefChange: (Float) -> Unit,
    gkRating: Float,
    onGkChange: (Float) -> Unit,
    statistics: com.futebadosparcas.data.model.UserStatistics?
) {
    // Calculate auto ratings from statistics
    val autoRatings = statistics?.let {
        com.futebadosparcas.data.model.PerformanceRatingCalculator.fromStats(it)
    }
    val sampleSize = autoRatings?.sampleSize ?: 0

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = "Avaliações por Posição",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        if (autoRatings != null && sampleSize > 0) {
            Text(
                text = "Baseado em $sampleSize jogos",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        PositionRatingSlider(
            label = "Atacante",
            value = strikerRating,
            onValueChange = onStrikerChange,
            autoRating = autoRatings?.striker
        )

        PositionRatingSlider(
            label = "Meio-Campo",
            value = midRating,
            onValueChange = onMidChange,
            autoRating = autoRatings?.mid
        )

        PositionRatingSlider(
            label = "Defensor",
            value = defRating,
            onValueChange = onDefChange,
            autoRating = autoRatings?.defender
        )

        PositionRatingSlider(
            label = "Goleiro",
            value = gkRating,
            onValueChange = onGkChange,
            autoRating = autoRatings?.gk
        )
    }
}

@Composable
private fun PositionRatingSlider(
    label: String,
    value: Float,
    onValueChange: (Float) -> Unit,
    autoRating: Double?
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (autoRating != null && autoRating > 0) {
                    Text(
                        text = "Auto: ${formatRating(autoRating)}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Text(
                    text = value.toInt().toString(),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }

        Slider(
            value = value,
            onValueChange = onValueChange,
            valueRange = 0f..100f,
            steps = 99,
            colors = SliderDefaults.colors(
                thumbColor = MaterialTheme.colorScheme.primary,
                activeTrackColor = MaterialTheme.colorScheme.primary
            )
        )
    }
}

// Helper functions
private fun mapValueToEntry(value: String, values: List<String>, entries: List<String>): String {
    if (value.isBlank()) return ""
    val index = values.indexOf(value)
    return if (index >= 0 && index < entries.size) entries[index] else value
}

private fun formatRating(value: Double): String {
    if (value <= 0.0) return "-"
    return String.format(Locale.getDefault(), "%.1f", value)
}

private fun isImageSizeValid(context: android.content.Context, uri: Uri): Boolean {
    return try {
        val cursor = context.contentResolver.query(uri, null, null, null, null)
        cursor?.use {
            val sizeIndex = it.getColumnIndex(android.provider.OpenableColumns.SIZE)
            it.moveToFirst()
            val sizeInBytes = it.getLong(sizeIndex)
            val sizeInMB = sizeInBytes / (1024 * 1024)
            sizeInMB <= 10 // Max 10 MB
        } ?: false
    } catch (e: Exception) {
        true // If can't get size, allow upload
    }
}

// Data class for form state
data class ProfileFormData(
    val name: String,
    val nickname: String?,
    val preferredFieldTypes: List<FieldType>,
    val strikerRating: Double,
    val midRating: Double,
    val defenderRating: Double,
    val gkRating: Double,
    val birthDate: Date?,
    val gender: String?,
    val heightCm: Int?,
    val weightKg: Int?,
    val dominantFoot: String?,
    val primaryPosition: String?,
    val secondaryPosition: String?,
    val playStyle: String?,
    val experienceYears: Int?
)
