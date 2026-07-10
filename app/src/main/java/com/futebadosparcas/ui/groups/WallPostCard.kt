package com.futebadosparcas.ui.groups

import android.view.ViewGroup
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil3.compose.AsyncImage
import com.futebadosparcas.R
import com.futebadosparcas.data.model.GroupWallPost
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.components.reactions.SocialReactionBar
import com.futebadosparcas.util.DataConverter

@Composable
fun WallPostCard(
    post: GroupWallPost,
    isOwn: Boolean,
    canManage: Boolean,
    currentUserId: String?,
    onEdit: (() -> Unit)? = null,
    onDelete: (() -> Unit)? = null,
    onTogglePin: (() -> Unit)? = null,
    onToggleReaction: ((String) -> Unit)? = null,
    onImageClick: ((String) -> Unit)? = null,
    originLabel: String? = null,
    onOriginClick: (() -> Unit)? = null,
    onHide: (() -> Unit)? = null,
    onReport: (() -> Unit)? = null
) {
    var showMenu by remember { mutableStateOf(false) }
    val pinnedColor = if (post.pinned) {
        MaterialTheme.colorScheme.primaryContainer
    } else {
        CardDefaults.cardColors().containerColor
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = pinnedColor)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                CachedProfileImage(
                    photoUrl = post.authorPhotoUrl,
                    userName = post.authorName,
                    size = 40.dp
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = post.authorName,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = if (post.createdAt != null) DataConverter().formatRelativeTime(post.createdAt!!) else "",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        if (post.editedAt != null) {
                            Text(
                                text = " (${stringResource(R.string.group_wall_edited)})",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    if (!originLabel.isNullOrBlank()) {
                        AssistChip(
                            onClick = { onOriginClick?.invoke() },
                            label = { Text(originLabel) },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.Groups,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        )
                    }
                }

                if (isOwn || canManage || onHide != null || onReport != null) {
                    Box {
                        IconButton(onClick = { showMenu = true }) {
                            Icon(
                                imageVector = Icons.Default.MoreVert,
                                contentDescription = stringResource(R.string.group_wall_post_options)
                            )
                        }
                        DropdownMenu(
                            expanded = showMenu,
                            onDismissRequest = { showMenu = false }
                        ) {
                            if (canManage && onTogglePin != null) {
                                DropdownMenuItem(
                                    text = {
                                        Text(
                                            if (post.pinned) stringResource(R.string.group_wall_unpin)
                                            else stringResource(R.string.group_wall_pin)
                                        )
                                    },
                                    onClick = {
                                        showMenu = false
                                        onTogglePin()
                                    },
                                    leadingIcon = {
                                        Icon(
                                            imageVector = Icons.Default.PushPin,
                                            contentDescription = null
                                        )
                                    }
                                )
                            }
                            if (isOwn && onEdit != null) {
                                DropdownMenuItem(
                                    text = { Text(stringResource(R.string.edit)) },
                                    onClick = {
                                        showMenu = false
                                        onEdit()
                                    },
                                    leadingIcon = {
                                        Icon(
                                            imageVector = Icons.Default.Edit,
                                            contentDescription = null
                                        )
                                    }
                                )
                            }
                            if (onDelete != null) {
                                DropdownMenuItem(
                                    text = { Text(stringResource(R.string.delete)) },
                                    onClick = {
                                        showMenu = false
                                        onDelete()
                                    },
                                    leadingIcon = {
                                        Icon(
                                            imageVector = Icons.Default.Delete,
                                            contentDescription = null
                                        )
                                    }
                                )
                            }
                            if (onHide != null) {
                                DropdownMenuItem(
                                    text = { Text(stringResource(R.string.social_feed_hide_post)) },
                                    onClick = {
                                        showMenu = false
                                        onHide()
                                    },
                                    leadingIcon = {
                                        Icon(
                                            imageVector = Icons.Default.VisibilityOff,
                                            contentDescription = null
                                        )
                                    }
                                )
                            }
                            if (onReport != null) {
                                DropdownMenuItem(
                                    text = { Text(stringResource(R.string.social_feed_report_post)) },
                                    onClick = {
                                        showMenu = false
                                        onReport()
                                    },
                                    leadingIcon = {
                                        Icon(
                                            imageVector = Icons.Default.Flag,
                                            contentDescription = null
                                        )
                                    }
                                )
                            }
                        }
                    }
                }
            }

            if (post.text.isNotBlank()) {
                Text(
                    text = post.text,
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            val mediaUrl = post.mediaUrl
            if (!mediaUrl.isNullOrBlank()) {
                when (resolveWallMediaKind(post.mediaType, mediaUrl)) {
                    WallMediaKind.VIDEO -> WallPostVideoPlayer(mediaUrl)
                    WallMediaKind.IMAGE -> AsyncImage(
                        model = mediaUrl,
                        contentDescription = stringResource(R.string.group_wall_image_alt, post.authorName),
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .clickable(enabled = onImageClick != null) {
                                onImageClick?.invoke(mediaUrl)
                            }
                    )
                    WallMediaKind.UNSUPPORTED -> UnsupportedWallMedia()
                }
            }

            if (onToggleReaction != null && !post.isDeleted()) {
                SocialReactionBar(
                    reactions = post.reactions,
                    currentUserId = currentUserId,
                    onToggleReaction = onToggleReaction
                )
            }
        }
    }
}

internal enum class WallMediaKind {
    IMAGE,
    VIDEO,
    UNSUPPORTED
}

internal fun resolveWallMediaKind(mediaType: String?, mediaUrl: String): WallMediaKind {
    val normalizedType = mediaType?.trim()?.lowercase().orEmpty()
    val normalizedUrl = mediaUrl.substringBefore('?').substringBefore('#').lowercase()
    return when {
        normalizedType.startsWith("video/") -> WallMediaKind.VIDEO
        normalizedType.startsWith("image/") -> WallMediaKind.IMAGE
        normalizedType.isBlank() && normalizedUrl.endsWith(".mp4") -> WallMediaKind.VIDEO
        normalizedType.isBlank() -> WallMediaKind.IMAGE
        else -> WallMediaKind.UNSUPPORTED
    }
}

@OptIn(UnstableApi::class)
@Composable
private fun WallPostVideoPlayer(url: String) {
    val context = LocalContext.current
    var retryKey by remember(url) { mutableIntStateOf(0) }
    var playbackFailed by remember(url, retryKey) { mutableStateOf(false) }
    val player = remember(url, retryKey) {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(url))
            playWhenReady = false
        }
    }

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onPlayerError(error: PlaybackException) {
                playbackFailed = true
            }
        }
        player.addListener(listener)
        player.prepare()
        onDispose {
            player.removeListener(listener)
            player.release()
        }
    }

    if (playbackFailed) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = stringResource(R.string.error_loading_data),
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            TextButton(
                onClick = {
                    playbackFailed = false
                    retryKey++
                }
            ) {
                Text(stringResource(R.string.retry))
            }
        }
    } else {
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
            update = { it.player = player },
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp)
                .clip(RoundedCornerShape(8.dp))
        )
    }
}

@Composable
private fun UnsupportedWallMedia() {
    Text(
        text = stringResource(R.string.error_loading_data),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(vertical = 12.dp)
    )
}
