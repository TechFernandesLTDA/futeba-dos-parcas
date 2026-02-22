package com.futebadosparcas.ui.groups

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource as androidStringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.theme.FutebaTheme
import java.io.File
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * Tela moderna de criação de grupo em Jetpack Compose
 *
 * Features:
 * - Material Design 3
 * - Image picker para câmera/galeria
 * - Validação inline em tempo real
 * - Upload progress indicator
 * - Animações fluidas
 * - Preparado para KMP (lógica no ViewModel)
 * - Acessibilidade completa
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateGroupScreen(
    viewModel: GroupsViewModel,
    onNavigateBack: () -> Unit,
    onGroupCreated: (groupId: String) -> Unit,
    modifier: Modifier = Modifier
) {
    val createGroupState by viewModel.createGroupState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    // Estados locais da UI
    var groupName by remember { mutableStateOf("") }
    var groupDescription by remember { mutableStateOf("") }
    var selectedPhotoUri by remember { mutableStateOf<Uri?>(null) }
    var showPhotoOptionsDialog by remember { mutableStateOf(false) }
    var nameError by remember { mutableStateOf<String?>(null) }

    // Validação inline do nome
    LaunchedEffect(groupName) {
        nameError = when {
            groupName.isEmpty() -> null
            groupName.length < 3 -> context.getString(R.string.create_group_error_name_min)
            groupName.length > 50 -> context.getString(R.string.create_group_error_name_max)
            !groupName.matches(Regex("^[\\p{L}\\p{N}\\s\\-_']+$")) ->
                context.getString(R.string.create_group_error_name_invalid)
            else -> null
        }
    }

    // Botão habilitado apenas se nome válido
    val isCreateButtonEnabled = groupName.length >= 3 &&
                                groupName.length <= 50 &&
                                nameError == null &&
                                createGroupState !is CreateGroupUiState.Loading

    // Launcher para galeria
    val pickImageLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        selectedPhotoUri = uri
    }

    // Launcher para câmera
    val tempCameraUri = remember { mutableStateOf<Uri?>(null) }
    val takePictureLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success ->
        if (success) {
            selectedPhotoUri = tempCameraUri.value
        }
    }

    // Observa estado de criação
    LaunchedEffect(createGroupState) {
        when (val state = createGroupState) {
            is CreateGroupUiState.Success -> {
                // Navega para detalhes do grupo criado
                onGroupCreated(state.group.id)
                viewModel.resetCreateGroupState()
            }
            is CreateGroupUiState.Error -> {
                // Erro já é mostrado na UI
            }
            else -> {}
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.create_group_title)) },
                navigationIcon = {
                    IconButton(
                        onClick = onNavigateBack,
                        modifier = Modifier.semantics {
                            contentDescription = context.getString(R.string.create_group_cd_close)
                        }
                    ) {
                        Icon(Icons.Default.Close, contentDescription = null)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Seção de foto do grupo
            GroupPhotoSection(
                photoUri = selectedPhotoUri,
                onPhotoClick = { showPhotoOptionsDialog = true },
                modifier = Modifier.padding(bottom = 24.dp)
            )

            // Campo de nome
            OutlinedTextField(
                value = groupName,
                onValueChange = { groupName = it },
                label = { Text(stringResource(R.string.fragment_create_group_hint_2)) },
                isError = nameError != null,
                supportingText = nameError?.let { { Text(it) } },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline
                )
            )

            // Contador de caracteres
            Text(
                text = "${groupName.length}/50",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .align(Alignment.End)
                    .padding(bottom = 16.dp)
            )

            // Campo de descrição
            OutlinedTextField(
                value = groupDescription,
                onValueChange = {
                    if (it.length <= 200) groupDescription = it
                },
                label = { Text(stringResource(R.string.fragment_create_group_hint_3)) },
                minLines = 3,
                maxLines = 5,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline
                )
            )

            // Contador de caracteres descrição
            Text(
                text = "${groupDescription.length}/200",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .align(Alignment.End)
                    .padding(bottom = 24.dp)
            )

            // Dica informativa
            Text(
                text = stringResource(R.string.fragment_create_group_text_4),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 24.dp)
            )

            // Indicador de upload
            AnimatedVisibility(
                visible = createGroupState is CreateGroupUiState.Loading,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(bottom = 16.dp)
                ) {
                    LinearProgressIndicator(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 8.dp)
                    )
                    Text(
                        text = if (selectedPhotoUri != null) {
                            stringResource(R.string.create_group_uploading)
                        } else {
                            stringResource(R.string.create_group_creating)
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }

            // Mensagem de erro
            AnimatedVisibility(
                visible = createGroupState is CreateGroupUiState.Error,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp)
                ) {
                    Text(
                        text = (createGroupState as? CreateGroupUiState.Error)?.message ?: "",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.padding(16.dp)
                    )
                }
            }

            // Botão de criar
            Button(
                onClick = {
                    viewModel.createGroup(
                        name = groupName.trim(),
                        description = groupDescription.trim(),
                        photoUri = selectedPhotoUri
                    )
                },
                enabled = isCreateButtonEnabled,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
            ) {
                if (createGroupState is CreateGroupUiState.Loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        text = stringResource(R.string.fragment_create_group_text_5),
                        style = MaterialTheme.typography.titleMedium
                    )
                }
            }
        }
    }

    // Dialog de opções de foto
    if (showPhotoOptionsDialog) {
        PhotoOptionsDialog(
            onDismiss = { showPhotoOptionsDialog = false },
            onCameraClick = {
                showPhotoOptionsDialog = false
                try {
                    val photoFile = File.createTempFile(
                        "group_photo_",
                        ".jpg",
                        context.cacheDir
                    )
                    val uri = FileProvider.getUriForFile(
                        context,
                        "${context.packageName}.fileprovider",
                        photoFile
                    )
                    tempCameraUri.value = uri
                    takePictureLauncher.launch(uri)
                } catch (e: Exception) {
                    // Erro será tratado pelo launcher
                }
            },
            onGalleryClick = {
                showPhotoOptionsDialog = false
                pickImageLauncher.launch("image/*")
            }
        )
    }
}

/**
 * Seção de foto do grupo com animação de borda ao selecionar
 */
@Composable
private fun GroupPhotoSection(
    photoUri: Uri?,
    onPhotoClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val hasPhoto = photoUri != null

    // Valores estáticos para otimização - sem animação
    val borderColor = if (hasPhoto)
        MaterialTheme.colorScheme.primary
    else
        MaterialTheme.colorScheme.outlineVariant

    val borderWidth = if (hasPhoto) 3.dp else 1.dp

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
    ) {
        // Preview da foto
        Box(
            modifier = Modifier
                .size(120.dp)
                .clip(CircleShape)
                .border(
                    width = borderWidth,
                    color = borderColor,
                    shape = CircleShape
                )
                .clickable(onClick = onPhotoClick)
                .semantics {
                    contentDescription = context.getString(R.string.create_group_cd_photo)
                },
            contentAlignment = Alignment.Center
        ) {
            if (photoUri != null) {
                CachedProfileImage(
                    photoUrl = photoUri.toString(),
                    userName = "Grupo",
                    size = 120.dp
                )
            } else {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = CircleShape
                ) {
                    Icon(
                        painter = painterResource(R.drawable.ic_groups),
                        contentDescription = null,
                        modifier = Modifier.padding(30.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        // Botão de adicionar/alterar foto
        TextButton(
            onClick = onPhotoClick,
            modifier = Modifier.padding(top = 8.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = stringResource(
                    if (hasPhoto)
                        R.string.create_group_change_photo
                    else
                        R.string.create_group_add_photo
                )
            )
        }
    }
}

/**
 * Dialog para escolher entre câmera ou galeria
 */
@Composable
private fun PhotoOptionsDialog(
    onDismiss: () -> Unit,
    onCameraClick: () -> Unit,
    onGalleryClick: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(stringResource(R.string.create_group_photo_dialog_title))
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Opção câmera
                OutlinedCard(
                    onClick = onCameraClick,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.CameraAlt,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(16.dp))
                        Text(
                            text = stringResource(R.string.create_group_photo_dialog_camera),
                            style = MaterialTheme.typography.bodyLarge
                        )
                    }
                }

                // Opção galeria
                OutlinedCard(
                    onClick = onGalleryClick,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.PhotoLibrary,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(16.dp))
                        Text(
                            text = stringResource(R.string.create_group_photo_dialog_gallery),
                            style = MaterialTheme.typography.bodyLarge
                        )
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_cancel))
            }
        }
    )
}
