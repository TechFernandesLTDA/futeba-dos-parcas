package com.futebadosparcas.ui.components.team

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.futebadosparcas.domain.model.Team

@Composable
fun TeamBadge(
    team: Team?,
    modifier: Modifier = Modifier,
    iconSize: Int = 24
) {
    if (team == null) return

    if (team.badgeUrl != null) {
        AsyncImage(
            model = team.badgeUrl,
            contentDescription = "Torcedor do ${team.name}",
            modifier = modifier
                .size(iconSize.dp)
                .clip(RoundedCornerShape(4.dp)),
            contentScale = ContentScale.Fit
        )
    } else {
        Box(
            modifier = modifier
                .size(iconSize.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = team.shortName ?: team.name.take(3).uppercase(),
                style = MaterialTheme.typography.labelSmall,
                fontSize = (iconSize * 0.45).sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
        }
    }
}
