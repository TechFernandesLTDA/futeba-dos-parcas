package com.futebadosparcas.ui.groups

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import coil3.compose.AsyncImage
import com.futebadosparcas.R
import com.futebadosparcas.data.repository.GroupWallMediaFile
import com.futebadosparcas.data.repository.GroupWallMediaValidationException
import com.futebadosparcas.data.repository.GroupWallMediaValidationReason
import com.futebadosparcas.data.repository.inspectGroupWallMedia
import com.futebadosparcas.util.AppLogger
import java.util.Locale

private const val TAG = "WallPostComposer"
private const val MAX_TEXT_LENGTH = 500

@Composable
fun WallPostComposer(
    sending: Boolean,
    initialText: String = "",
    clearDraftSignal: Int = 0,
    uploadProgress: Int = 0,
    processing: Boolean = false,
    mediaEnabled: Boolean = true,
    onSubmit: (String, Uri?) -> Unit,
    onImageError: ((String) -> Unit)? = null,
    onCancel: (() -> Unit)? = null,
    onCancelUpload: (() -> Unit)? = null
) {
    val context = LocalContext.current
    var text by rememberSaveable { mutableStateOf(initialText) }
    var selectedMediaUri by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedMedia by remember { mutableStateOf<GroupWallMediaFile?>(null) }
    var preparingMedia by remember { mutableStateOf(false) }

    LaunchedEffect(clearDraftSignal) {
        if (clearDraftSignal > 0) {
            text = ""
            selectedMediaUri = null
            selectedMedia = null
            preparingMedia = false
        }
    }

    LaunchedEffect(selectedMediaUri) {
        val uriValue = selectedMediaUri ?: return@LaunchedEffect
        if (selectedMedia?.uri?.toString() == uriValue) return@LaunchedEffect
        preparingMedia = true
        try {
            selectedMedia = inspectGroupWallMedia(context, uriValue.toUri())
        } catch (error: Exception) {
            selectedMediaUri = null
            selectedMedia = null
            onImageError?.invoke(mediaValidationMessage(context, error))
        } finally {
            preparingMedia = false
        }
    }

    val mediaPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        runCatching {
            context.contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
        }.onFailure { error ->
            AppLogger.w(TAG) {
                "Provedor ${uri.authority ?: "desconhecido"} não concedeu acesso persistente; " +
                    "o envio continuará com a permissão temporária (${error.javaClass.simpleName})."
            }
        }
        preparingMedia = true
        selectedMediaUri = uri.toString()
    }

    val cleanText = text.trim()
    val mediaPending = preparingMedia || (selectedMediaUri != null && selectedMedia == null)
    val isValid = cleanText.length <= MAX_TEXT_LENGTH &&
        (cleanText.isNotEmpty() || selectedMedia != null) &&
        !mediaPending

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        OutlinedTextField(
            value = text,
            onValueChange = { if (it.length <= MAX_TEXT_LENGTH) text = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text(stringResource(R.string.group_wall_input_hint)) },
            minLines = 2,
            maxLines = 5,
            enabled = !sending
        )

        selectedMedia?.let { media ->
            SelectedWallMediaPreview(
                media = media,
                removeEnabled = !sending,
                onRemove = {
                    selectedMediaUri = null
                    selectedMedia = null
                }
            )
        }

        if (mediaPending) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.group_wall_preparing_media),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        if (sending && selectedMedia != null) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                LinearProgressIndicator(
                    progress = { uploadProgress.coerceIn(0, 100) / 100f },
                    modifier = Modifier.fillMaxWidth()
                )
                Text(
                    text = if (processing) {
                        stringResource(R.string.group_wall_processing_media)
                    } else {
                        stringResource(R.string.group_wall_upload_progress, uploadProgress.coerceIn(0, 100))
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "${text.length}/$MAX_TEXT_LENGTH",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (mediaEnabled) {
                    IconButton(
                        onClick = {
                            mediaPicker.launch(
                                PickVisualMediaRequest(
                                    ActivityResultContracts.PickVisualMedia.ImageAndVideo
                                )
                            )
                        },
                        enabled = !sending && !mediaPending
                    ) {
                        Icon(
                            imageVector = Icons.Default.Image,
                            contentDescription = stringResource(R.string.group_wall_add_media)
                        )
                    }
                }
                if (sending && onCancelUpload != null) {
                    IconButton(onClick = onCancelUpload) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = stringResource(R.string.group_wall_cancel_upload)
                        )
                    }
                } else if (onCancel != null) {
                    IconButton(onClick = onCancel, enabled = !sending) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = stringResource(R.string.cancel)
                        )
                    }
                }
                IconButton(
                    onClick = { onSubmit(cleanText, selectedMedia?.uri) },
                    enabled = isValid && !sending
                ) {
                    if (sending) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp))
                    } else {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.Send,
                            contentDescription = stringResource(R.string.group_wall_send)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SelectedWallMediaPreview(
    media: GroupWallMediaFile,
    removeEnabled: Boolean,
    onRemove: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxWidth(),
        contentAlignment = Alignment.TopEnd
    ) {
        if (media.isVideo) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(104.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(40.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = media.fileName,
                        style = MaterialTheme.typography.titleSmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = stringResource(
                            R.string.group_wall_video_summary,
                            formatDuration(media.durationMs),
                            formatMegabytes(media.sizeBytes)
                        ),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            AsyncImage(
                model = media.uri,
                contentDescription = stringResource(R.string.group_wall_media_preview),
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(140.dp)
                    .clip(RoundedCornerShape(8.dp))
            )
        }

        IconButton(
            onClick = onRemove,
            enabled = removeEnabled
        ) {
            Icon(
                imageVector = Icons.Default.Close,
                contentDescription = stringResource(R.string.group_wall_remove_media),
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

private fun formatDuration(durationMs: Long?): String {
    val totalSeconds = ((durationMs ?: 0L) / 1_000L).coerceAtLeast(0L)
    return String.format(Locale.getDefault(), "%d:%02d", totalSeconds / 60L, totalSeconds % 60L)
}

private fun formatMegabytes(sizeBytes: Long): String =
    String.format(Locale.getDefault(), "%.1f MB", sizeBytes / (1024.0 * 1024.0))

private fun mediaValidationMessage(context: Context, error: Exception): String {
    val validationError = error as? GroupWallMediaValidationException
        ?: return context.getString(R.string.group_wall_media_invalid)
    val resource = when (validationError.reason) {
        GroupWallMediaValidationReason.EMPTY_FILE -> R.string.group_wall_media_invalid
        GroupWallMediaValidationReason.UNSUPPORTED_TYPE -> R.string.group_wall_media_supported_types
        GroupWallMediaValidationReason.MIME_MISMATCH -> R.string.group_wall_media_mime_mismatch
        GroupWallMediaValidationReason.IMAGE_TOO_LARGE -> R.string.group_wall_image_too_large
        GroupWallMediaValidationReason.VIDEO_TOO_LARGE -> R.string.group_wall_video_too_large
        GroupWallMediaValidationReason.INVALID_VIDEO_DURATION -> R.string.group_wall_video_duration_invalid
        GroupWallMediaValidationReason.VIDEO_TOO_LONG -> R.string.group_wall_video_too_long
    }
    return context.getString(resource)
}
