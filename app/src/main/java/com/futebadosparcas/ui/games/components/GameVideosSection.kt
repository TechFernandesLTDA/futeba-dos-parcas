package com.futebadosparcas.ui.games.components

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.OpenableColumns
import android.view.ViewGroup
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.futebadosparcas.R
import com.futebadosparcas.data.repository.GameVideo
import com.futebadosparcas.ui.components.reactions.SocialReactionBar
import com.futebadosparcas.ui.games.GameVideosUiState
import com.futebadosparcas.ui.games.GameVideosViewModel
import org.koin.compose.viewmodel.koinViewModel
import java.util.UUID

private const val MAX_VIDEO_SIZE_BYTES = 25L * 1024L * 1024L
private const val MAX_VIDEO_DURATION_MS = 30_000L
private const val MAX_CAPTION_LENGTH = 200
private const val MAX_VIDEOS_PER_GAME = 10
private const val MAX_VIDEOS_PER_USER_PER_GAME = 3

@Composable
fun GameVideosSection(
    gameId: String,
    canUpload: Boolean,
    currentUserId: String?,
    canManage: Boolean,
    modifier: Modifier = Modifier,
    viewModel: GameVideosViewModel = koinViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val uploading by viewModel.uploading.collectAsState()
    var caption by remember { mutableStateOf("") }
    var feedback by remember { mutableStateOf<String?>(null) }
    val videos = (uiState as? GameVideosUiState.Success)?.videos.orEmpty()
    val activeVideoCount = remember(videos) { videos.count { it.status != "REJECTED" } }
    val userVideoCount = remember(videos, currentUserId) {
        videos.count { it.uploadedBy == currentUserId && it.status != "REJECTED" }
    }
    val hasReachedGameLimit = activeVideoCount >= MAX_VIDEOS_PER_GAME
    val hasReachedUserLimit = userVideoCount >= MAX_VIDEOS_PER_USER_PER_GAME
    val canUploadNow = canUpload && !hasReachedGameLimit && !hasReachedUserLimit

    LaunchedEffect(gameId) {
        viewModel.observe(gameId)
    }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val validation = validateVideo(context, uri)
        if (validation is VideoValidation.Invalid) {
            feedback = validation.message
            return@rememberLauncherForActivityResult
        }

        val fileName = "${System.currentTimeMillis()}-${UUID.randomUUID()}.mp4"
        viewModel.upload(
            gameId = gameId,
            uri = uri,
            fileName = fileName,
            caption = caption.trim(),
            sizeBytes = (validation as VideoValidation.Valid).sizeBytes,
        ) { ok ->
            feedback = context.getString(
                if (ok) R.string.game_videos_upload_success else R.string.game_videos_upload_error
            )
            if (ok) caption = ""
        }
    }

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
        tonalElevation = 0.dp
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Filled.Movie,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.game_videos_title),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = stringResource(R.string.game_videos_description),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            when (val state = uiState) {
                is GameVideosUiState.Loading -> Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(28.dp))
                }

                is GameVideosUiState.Empty -> EmptyVideos()

                is GameVideosUiState.Error -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = state.message,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall
                    )
                    TextButton(onClick = { viewModel.observe(gameId) }) {
                        Text(stringResource(R.string.game_videos_retry))
                    }
                }

                is GameVideosUiState.Success -> VideosList(
                    videos = state.videos,
                    currentUserId = currentUserId,
                    canManage = canManage,
                    onDelete = { video ->
                        viewModel.delete(video) { ok ->
                            feedback = context.getString(
                                if (ok) R.string.game_videos_delete_success else R.string.game_videos_delete_error
                            )
                        }
                    },
                    onToggleReaction = { video, emoji ->
                        viewModel.toggleReaction(video, emoji) { ok ->
                            if (!ok) feedback = context.getString(R.string.reactions_update_error)
                        }
                    }
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (canUploadNow) {
                OutlinedTextField(
                    value = caption,
                    onValueChange = { caption = it.take(MAX_CAPTION_LENGTH) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(stringResource(R.string.game_videos_caption_hint)) },
                    supportingText = { Text("${caption.length}/$MAX_CAPTION_LENGTH") },
                    maxLines = 2,
                    enabled = !uploading
                )
                Spacer(modifier = Modifier.height(8.dp))
                Button(
                    onClick = {
                        feedback = null
                        picker.launch("video/mp4")
                    },
                    enabled = !uploading,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (uploading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                    } else {
                        Icon(Icons.Filled.Upload, contentDescription = null)
                    }
                    Spacer(modifier = Modifier.size(8.dp))
                    Text(stringResource(R.string.game_videos_upload))
                }
            } else if (canUpload && (hasReachedGameLimit || hasReachedUserLimit)) {
                Text(
                    text = stringResource(
                        if (hasReachedGameLimit) {
                            R.string.game_videos_game_limit_reached
                        } else {
                            R.string.game_videos_user_limit_reached
                        }
                    ),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                Text(
                    text = stringResource(R.string.game_videos_must_finish),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            feedback?.let { message ->
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun EmptyVideos() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Filled.Movie,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
            modifier = Modifier.size(40.dp)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.game_videos_empty_title),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = stringResource(R.string.game_videos_empty_desc),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun VideosList(
    videos: List<GameVideo>,
    currentUserId: String?,
    canManage: Boolean,
    onDelete: (GameVideo) -> Unit,
    onToggleReaction: (GameVideo, String) -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = 520.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(items = videos, key = { it.id }) { video ->
            VideoCard(
                video = video,
                currentUserId = currentUserId,
                canDelete = canManage || video.uploadedBy == currentUserId,
                onDelete = { onDelete(video) },
                onToggleReaction = { emoji -> onToggleReaction(video, emoji) }
            )
        }
    }
}

@Composable
private fun VideoCard(
    video: GameVideo,
    currentUserId: String?,
    canDelete: Boolean,
    onDelete: () -> Unit,
    onToggleReaction: (String) -> Unit
) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = video.uploadedByName,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    video.caption?.takeIf { it.isNotBlank() }?.let {
                        Text(text = it, style = MaterialTheme.typography.bodySmall)
                    }
                }
                VideoStatusChip(video.status)
                if (canDelete) {
                    IconButton(onClick = onDelete) {
                        Icon(
                            imageVector = Icons.Filled.DeleteOutline,
                            contentDescription = stringResource(R.string.game_videos_delete)
                        )
                    }
                }
            }

            if (video.status == "READY") {
                VideoPlayer(url = video.url)
            } else if (video.status == "REJECTED") {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Filled.ErrorOutline,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error
                    )
                    Text(
                        text = stringResource(R.string.game_videos_rejected_desc),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            } else {
                Text(
                    text = stringResource(R.string.game_videos_processing_desc),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            SocialReactionBar(
                reactions = video.reactions,
                currentUserId = currentUserId,
                enabled = currentUserId != null && video.status != "REJECTED",
                onToggleReaction = onToggleReaction
            )
        }
    }
}

@Composable
private fun VideoStatusChip(status: String) {
    val label = when (status) {
        "READY" -> R.string.game_videos_status_ready
        "REJECTED" -> R.string.game_videos_status_rejected
        else -> R.string.game_videos_status_processing
    }
    AssistChip(onClick = {}, label = { Text(stringResource(label)) })
}

@OptIn(UnstableApi::class)
@Composable
private fun VideoPlayer(url: String) {
    val context = LocalContext.current
    val player = remember(url) {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(url))
            volume = 0f
            playWhenReady = false
            prepare()
        }
    }

    DisposableEffect(player) {
        onDispose { player.release() }
    }

    AndroidView(
        factory = { viewContext ->
            PlayerView(viewContext).apply {
                this.player = player
                useController = true
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            }
        },
        modifier = Modifier
            .fillMaxWidth()
            .height(220.dp)
    )
}

private sealed class VideoValidation {
    data class Valid(val sizeBytes: Long) : VideoValidation()
    data class Invalid(val message: String) : VideoValidation()
}

private fun validateVideo(context: Context, uri: Uri): VideoValidation {
    val type = context.contentResolver.getType(uri)
    if (type != "video/mp4") {
        return VideoValidation.Invalid(context.getString(R.string.game_videos_invalid_type))
    }

    val size = querySizeBytes(context, uri)
    if (size <= 0L) {
        return VideoValidation.Invalid(context.getString(R.string.game_videos_invalid_file))
    }
    if (size > MAX_VIDEO_SIZE_BYTES) {
        return VideoValidation.Invalid(context.getString(R.string.game_videos_too_large))
    }

    val duration = queryDurationMs(context, uri)
    if (duration <= 0L) {
        return VideoValidation.Invalid(context.getString(R.string.game_videos_invalid_file))
    }
    if (duration > MAX_VIDEO_DURATION_MS) {
        return VideoValidation.Invalid(context.getString(R.string.game_videos_too_long))
    }

    return VideoValidation.Valid(size)
}

private fun querySizeBytes(context: Context, uri: Uri): Long {
    context.contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        val index = cursor.getColumnIndex(OpenableColumns.SIZE)
        if (index >= 0 && cursor.moveToFirst()) {
            return cursor.getLong(index)
        }
    }
    return context.contentResolver.openAssetFileDescriptor(uri, "r")?.use { it.length } ?: -1L
}

private fun queryDurationMs(context: Context, uri: Uri): Long {
    return runCatching {
        MediaMetadataRetriever().use { retriever ->
            retriever.setDataSource(context, uri)
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: -1L
        }
    }.getOrDefault(-1L)
}
