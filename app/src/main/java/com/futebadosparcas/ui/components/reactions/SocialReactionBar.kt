package com.futebadosparcas.ui.components.reactions

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R

val SocialReactionEmojis = listOf("🔥", "😂", "👏", "😡", "💀", "🤡", "👑", "⚽")

data class SocialReactionSummary(
    val emoji: String,
    val count: Int,
    val selected: Boolean
)

fun summarizeSocialReactions(
    reactions: Map<String, List<String>>?,
    currentUserId: String?
): List<SocialReactionSummary> {
    return SocialReactionEmojis
        .map { emoji ->
            val users = reactions?.get(emoji).orEmpty()
            SocialReactionSummary(
                emoji = emoji,
                count = users.size,
                selected = currentUserId != null && users.contains(currentUserId)
            )
        }
        .filter { it.count > 0 }
        .sortedWith(
            compareByDescending<SocialReactionSummary> { it.count }
                .thenBy { SocialReactionEmojis.indexOf(it.emoji) }
        )
}

@Composable
fun SocialReactionBar(
    reactions: Map<String, List<String>>?,
    currentUserId: String?,
    onToggleReaction: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    var menuOpen by remember { mutableStateOf(false) }
    val topReactions = remember(reactions, currentUserId) {
        summarizeSocialReactions(reactions, currentUserId).take(3)
    }

    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        topReactions.forEach { reaction ->
            val description = stringResource(
                R.string.reactions_toggle_emoji,
                reaction.emoji,
                reaction.count
            )
            FilterChip(
                selected = reaction.selected,
                enabled = enabled,
                onClick = { onToggleReaction(reaction.emoji) },
                label = { Text("${reaction.emoji} ${reaction.count}") },
                modifier = Modifier
                    .heightIn(min = 48.dp)
                    .semantics { contentDescription = description },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                    selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }

        IconButton(
            enabled = enabled,
            onClick = { menuOpen = true },
            modifier = Modifier.heightIn(min = 48.dp)
        ) {
            Icon(
                imageVector = Icons.Default.AddCircle,
                contentDescription = stringResource(R.string.reactions_add)
            )
        }

        DropdownMenu(
            expanded = menuOpen,
            onDismissRequest = { menuOpen = false }
        ) {
            SocialReactionEmojis.forEach { emoji ->
                DropdownMenuItem(
                    text = { Text(emoji) },
                    onClick = {
                        menuOpen = false
                        onToggleReaction(emoji)
                    }
                )
            }
        }
    }
}
