package com.futebadosparcas.ui.groups

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.futebadosparcas.R

private const val MAX_TEXT_LENGTH = 500
private const val MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024L

private fun getUriSizeBytes(context: Context, uri: Uri): Long {
    return try {
        val descriptorSize = context.contentResolver
            .openFileDescriptor(uri, "r")
            ?.use { it.statSize } ?: -1L
        if (descriptorSize >= 0L) {
            return descriptorSize
        }

        context.contentResolver
            .query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)
            ?.use { cursor ->
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                if (sizeIndex >= 0 && cursor.moveToFirst() && !cursor.isNull(sizeIndex)) {
                    cursor.getLong(sizeIndex)
                } else {
                    Long.MAX_VALUE
                }
            } ?: Long.MAX_VALUE
    } catch (_: Exception) {
        Long.MAX_VALUE
    }
}

@Composable
fun WallPostComposer(
    sending: Boolean,
    initialText: String = "",
    onSubmit: (String, Uri?) -> Unit,
    onImageError: ((String) -> Unit)? = null,
    onCancel: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val imageTooLargeMessage = stringResource(R.string.group_wall_image_too_large)
    val textRequiredForPhotoMessage = stringResource(R.string.group_wall_text_required_for_photo)
    var text by remember { mutableStateOf(initialText) }
    var imageUri by remember { mutableStateOf<Uri?>(null) }
    val imagePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri == null) {
            return@rememberLauncherForActivityResult
        }
        if (getUriSizeBytes(context, uri) > MAX_IMAGE_SIZE_BYTES) {
            onImageError?.invoke(imageTooLargeMessage)
            return@rememberLauncherForActivityResult
        }
        imageUri = uri
    }

    val requiresTextForImage = imageUri != null && text.trim().isEmpty()
    val isValid = text.trim().length <= MAX_TEXT_LENGTH && text.trim().isNotEmpty()

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp)
    ) {
        OutlinedTextField(
            value = text,
            onValueChange = { if (it.length <= MAX_TEXT_LENGTH) text = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text(stringResource(R.string.group_wall_input_hint)) },
            minLines = 2,
            maxLines = 5,
            enabled = !sending,
            isError = requiresTextForImage,
            supportingText = {
                if (requiresTextForImage) {
                    Text(textRequiredForPhotoMessage)
                }
            }
        )

        if (imageUri != null) {
            Box(
                modifier = Modifier.fillMaxWidth(0.5f),
                contentAlignment = Alignment.TopEnd
            ) {
                AsyncImage(
                    model = imageUri,
                    contentDescription = stringResource(R.string.group_wall_image_preview),
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp)
                        .clip(RoundedCornerShape(8.dp))
                )
                IconButton(
                    onClick = { imageUri = null },
                    modifier = Modifier.size(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = stringResource(R.string.group_wall_remove_photo)
                    )
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = androidx.compose.foundation.layout.Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "${text.length}/$MAX_TEXT_LENGTH",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Row {
                IconButton(
                    onClick = { imagePicker.launch("image/*") },
                    enabled = !sending
                ) {
                    Icon(
                        imageVector = Icons.Default.Image,
                        contentDescription = stringResource(R.string.group_wall_add_photo)
                    )
                }
                if (onCancel != null) {
                    IconButton(
                        onClick = onCancel,
                        enabled = !sending
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = stringResource(R.string.cancel)
                        )
                    }
                }
                IconButton(
                    onClick = {
                        if (requiresTextForImage) {
                            onImageError?.invoke(textRequiredForPhotoMessage)
                            return@IconButton
                        }
                        onSubmit(text.trim(), imageUri)
                        text = ""
                        imageUri = null
                    },
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
