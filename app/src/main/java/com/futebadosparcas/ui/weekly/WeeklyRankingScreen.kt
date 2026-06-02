package com.futebadosparcas.ui.weekly

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.ui.components.states.LoadingState
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WeeklyRankingScreen(
    viewModel: WeeklyRankingViewModel = koinViewModel(),
    onPlayerClick: (String) -> Unit,
    onBackClick: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.weekly_ranking)) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back))
                    }
                }
            )
        }
    ) { padding ->
        when (val state = uiState) {
            is WeeklyRankingUiState.Loading -> LoadingState()
            is WeeklyRankingUiState.Error -> ErrorState(
                message = state.message,
                onRetry = { viewModel.load() }
            )
            is WeeklyRankingUiState.Empty -> EmptyState(
                type = EmptyStateType.NoData(
                    title = stringResource(R.string.weekly_ranking_empty),
                    description = stringResource(R.string.weekly_ranking_empty_desc)
                )
            )
            is WeeklyRankingUiState.Success -> {
                Column(modifier = Modifier.padding(padding)) {
                    Text(
                        text = stringResource(R.string.weekly_ranking_round, state.weekKey),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                    )
                    LazyColumn(
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        itemsIndexed(state.players) { index, player ->
                            WeeklyRankingItem(
                                position = index + 1,
                                player = player,
                                onClick = { onPlayerClick(player.userId) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun WeeklyRankingItem(
    position: Int,
    player: WeeklyPlayer,
    onClick: () -> Unit
) {
    val medals = listOf("🥇", "🥈", "🥉")
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = if (position == 1)
            CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f))
        else CardDefaults.cardColors()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = if (position <= 3) medals[position - 1] else "$position",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.width(32.dp)
            )

            CachedProfileImage(
                photoUrl = player.userPhoto,
                userName = player.userName,
                size = 44.dp
            )

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = player.userName,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (player.goals > 0) Text("⚽${player.goals}", style = MaterialTheme.typography.labelSmall)
                    if (player.assists > 0) Text("👟${player.assists}", style = MaterialTheme.typography.labelSmall)
                    if (player.mvp > 0) Text("⭐${player.mvp}", style = MaterialTheme.typography.labelSmall)
                    if (player.wins > 0) Text("🏅${player.wins}V", style = MaterialTheme.typography.labelSmall)
                    if (player.bolaMurcha > 0) Text(
                        "💨${player.bolaMurcha}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }

            Text(
                text = "${player.points}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}
