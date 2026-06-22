package com.futebadosparcas.ui.components.team

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.futebadosparcas.domain.model.FavoriteTeam
import com.futebadosparcas.domain.repository.TeamsRepository
import com.futebadosparcas.ui.theme.ExpressiveShapeTokens
import org.koin.compose.koinInject

@Composable
fun TeamBadge(
    team: FavoriteTeam?,
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
                .clip(ExpressiveShapeTokens.TeamBadge),
            contentScale = ContentScale.Fit
        )
    } else {
        Box(
            modifier = modifier
                .size(iconSize.dp)
                .clip(ExpressiveShapeTokens.TeamBadge)
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

@Composable
fun TeamBadgeById(
    teamId: String?,
    modifier: Modifier = Modifier,
    iconSize: Int = 24
) {
    if (teamId.isNullOrBlank()) return

    val teamsRepository: TeamsRepository = koinInject()
    var team by remember { mutableStateOf<FavoriteTeam?>(null) }

    LaunchedEffect(teamId) {
        teamsRepository.getTeamById(teamId).fold(
            onSuccess = { team = it },
            onFailure = { team = null }
        )
    }

    TeamBadge(team = team, modifier = modifier, iconSize = iconSize)
}
