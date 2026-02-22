package com.futebadosparcas.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.firebase.FirebaseManager
import kotlinx.coroutines.launch

private sealed class PlayerDetailUiState {
    object Loading : PlayerDetailUiState()
    data class Success(
        val player: Map<String, Any?>,
        val statistics: Map<String, Any?>,
        val badges: List<Map<String, Any?>>,
        val commonGroups: List<Map<String, Any?>>
    ) : PlayerDetailUiState()
    data class Error(val message: String) : PlayerDetailUiState()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayerDetailScreen(
    playerId: String,
    onBackClick: () -> Unit
) {
    var uiState by remember { mutableStateOf<PlayerDetailUiState>(PlayerDetailUiState.Loading) }
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    fun loadPlayer() {
        scope.launch {
            uiState = PlayerDetailUiState.Loading
            try {
                val player = FirebaseManager.getPlayerById(playerId)
                if (player != null) {
                    val statistics = FirebaseManager.getUserStatistics(playerId)
                    val badges = FirebaseManager.getUserBadges()
                    val commonGroups = FirebaseManager.getCommonGroups(playerId)
                    uiState = PlayerDetailUiState.Success(player, statistics, badges, commonGroups)
                } else {
                    uiState = PlayerDetailUiState.Error("Jogador não encontrado")
                }
            } catch (e: Exception) {
                uiState = PlayerDetailUiState.Error(e.message ?: "Erro ao carregar jogador")
            }
        }
    }

    LaunchedEffect(playerId) {
        loadPlayer()
    }

    val player = (uiState as? PlayerDetailUiState.Success)?.player

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = player?.let { it["nickname"] as? String ?: it["userName"] as? String ?: "Jogador" } ?: "Jogador",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Text("←", style = MaterialTheme.typography.titleLarge)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState)
        }
    ) { paddingValues ->
        when (val state = uiState) {
            is PlayerDetailUiState.Loading -> PlayerDetailLoadingContent(paddingValues)

            is PlayerDetailUiState.Success -> PlayerDetailContent(
                player = state.player,
                statistics = state.statistics,
                badges = state.badges,
                commonGroups = state.commonGroups,
                paddingValues = paddingValues,
                onInviteClick = {
                    scope.launch {
                        snackbarHostState.showSnackbar("Convite enviado!")
                    }
                }
            )

            is PlayerDetailUiState.Error -> ErrorState(
                message = state.message,
                onRetry = { loadPlayer() }
            )
        }
    }
}

@Composable
private fun PlayerDetailContent(
    player: Map<String, Any?>,
    statistics: Map<String, Any?>,
    badges: List<Map<String, Any?>>,
    commonGroups: List<Map<String, Any?>>,
    paddingValues: PaddingValues,
    onInviteClick: () -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            PlayerHeader(player = player)
        }

        item {
            PlayerStatsSummary(statistics = statistics)
        }

        item {
            PlayerRatingsCard(player = player)
        }

        if (badges.isNotEmpty()) {
            item {
                PlayerBadgesSection(badges = badges)
            }
        }

        if (commonGroups.isNotEmpty()) {
            item {
                CommonGroupsSection(groups = commonGroups)
            }
        }

        item {
            InviteButton(onClick = onInviteClick)
        }

        item {
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun PlayerHeader(player: Map<String, Any?>) {
    val name = player["userName"] as? String ?: "Jogador"
    val nickname = player["nickname"] as? String
    val level = (player["level"] as? Number)?.toInt() ?: 1
    val xp = (player["experiencePoints"] as? Long)?.toInt() ?: 0
    val position = player["preferredPosition"] as? String

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            PlayerAvatar(
                name = name,
                level = level,
                modifier = Modifier.size(100.dp)
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = nickname ?: name,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )

            if (nickname != null) {
                Text(
                    text = name,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.primaryContainer
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text("⭐", style = MaterialTheme.typography.titleMedium)
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "Nível $level",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "$xp XP",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                            )
                        }
                    }
                }

                if (position != null) {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = MaterialTheme.colorScheme.secondaryContainer
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text("⚽", style = MaterialTheme.typography.titleMedium)
                            Text(
                                text = position,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            val levelTitle = getLevelTitle(level)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = getLevelEmoji(level) + " $levelTitle",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
private fun PlayerStatsSummary(statistics: Map<String, Any?>) {
    val totalGames = (statistics["totalGames"] as? Number)?.toInt() ?: 0
    val totalGoals = (statistics["totalGoals"] as? Number)?.toInt() ?: 0
    val totalAssists = (statistics["totalAssists"] as? Number)?.toInt() ?: 0
    val totalWins = (statistics["totalWins"] as? Number)?.toInt() ?: 0
    val mvpCount = (statistics["mvpCount"] as? Number)?.toInt() ?: 0
    val winRate = (statistics["winRate"] as? Number)?.toDouble() ?: 0.0

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = "📊 Estatísticas",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatItem(value = totalGames.toString(), label = "Jogos", emoji = "🎮")
                StatItem(value = totalGoals.toString(), label = "Gols", emoji = "⚽")
                StatItem(value = totalAssists.toString(), label = "Assists", emoji = "🎯")
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatItem(value = totalWins.toString(), label = "Vitórias", emoji = "🏆")
                StatItem(value = mvpCount.toString(), label = "MVPs", emoji = "👑")
                StatItem(
                    value = "${(winRate * 100).toInt()}%",
                    label = "Win Rate",
                    emoji = "📈"
                )
            }
        }
    }
}

@Composable
private fun RowScope.StatItem(value: String, label: String, emoji: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.weight(1f)
    ) {
        Text(text = emoji, style = MaterialTheme.typography.titleLarge)
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun PlayerRatingsCard(player: Map<String, Any?>) {
    val strikerRating = (player["strikerRating"] as? Number)?.toDouble() ?: 0.0
    val midRating = (player["midRating"] as? Number)?.toDouble() ?: 0.0
    val defenderRating = (player["defenderRating"] as? Number)?.toDouble() ?: 0.0
    val gkRating = (player["gkRating"] as? Number)?.toDouble() ?: 0.0

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = "⭐ Ratings por Posição",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(16.dp))

            RatingBar(label = "⚽ Atacante", rating = strikerRating)
            Spacer(modifier = Modifier.height(12.dp))
            RatingBar(label = "🏃 Meia", rating = midRating)
            Spacer(modifier = Modifier.height(12.dp))
            RatingBar(label = "🛡️ Zagueiro", rating = defenderRating)
            Spacer(modifier = Modifier.height(12.dp))
            RatingBar(label = "🧤 Goleiro", rating = gkRating)
        }
    }
}

@Composable
private fun RatingBar(label: String, rating: Double) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium
            )

            Text(
                text = "${(rating * 10).toInt() / 10.0}",
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        }

        Spacer(modifier = Modifier.height(6.dp))

        LinearProgressIndicator(
            progress = { (rating.toFloat() / 5f).coerceIn(0f, 1f) },
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp)),
            color = getRatingColor(rating),
            trackColor = MaterialTheme.colorScheme.surfaceVariant,
        )
    }
}

private fun getRatingColor(rating: Double): Color {
    return when {
        rating >= 4.5 -> Color(0xFFFFD700)
        rating >= 4.0 -> Color(0xFF4CAF50)
        rating >= 3.0 -> Color(0xFF2196F3)
        rating >= 2.0 -> Color(0xFFFF9800)
        else -> Color(0xFF9E9E9E)
    }
}

@Composable
private fun PlayerBadgesSection(badges: List<Map<String, Any?>>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = "🏅 Badges Recentes",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(badges.take(5), key = { it["badgeId"] as? String ?: it.hashCode() }) { badge ->
                    BadgeItem(badge = badge)
                }
            }
        }
    }
}

@Composable
private fun BadgeItem(badge: Map<String, Any?>) {
    val badgeId = badge["badgeId"] as? String ?: ""
    val count = (badge["count"] as? Number)?.toInt() ?: 1

    val (emoji, bgColor) = when (badgeId) {
        "FIRST_GOAL" -> "⚽" to Color(0xFFFFD700)
        "STREAK_7" -> "🔥" to Color(0xFFF44336)
        "MVP_5" -> "🏆" to Color(0xFFFFD700)
        "HAT_TRICK" -> "🎩" to Color(0xFF9C27B0)
        "PAREDAO" -> "🧱" to Color(0xFF2196F3)
        "GOLEADOR" -> "🥅" to Color(0xFF4CAF50)
        else -> "🏅" to MaterialTheme.colorScheme.surfaceVariant
    }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(70.dp)
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(56.dp)
                .clip(CircleShape)
                .background(bgColor.copy(alpha = 0.2f))
        ) {
            Text(
                text = emoji,
                style = MaterialTheme.typography.headlineMedium
            )

            if (count > 1) {
                Surface(
                    modifier = Modifier.align(Alignment.TopEnd),
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.error
                ) {
                    Text(
                        text = count.toString(),
                        modifier = Modifier.padding(4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onError
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = badgeId.replace("_", " ").lowercase().replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun CommonGroupsSection(groups: List<Map<String, Any?>>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = "👥 Grupos em Comum",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

            groups.forEach { group ->
                val groupName = group["groupName"] as? String ?: group["name"] as? String ?: "Grupo"
                val memberCount = (group["memberCount"] as? Number)?.toInt() ?: (group["members"] as? Number)?.toInt() ?: 0

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    GroupPhoto(
                        groupName = groupName,
                        modifier = Modifier.size(40.dp)
                    )

                    Spacer(modifier = Modifier.width(12.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = groupName,
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = "👥 $memberCount membros",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                if (group != groups.last()) {
                    HorizontalDivider(
                        modifier = Modifier.padding(vertical = 4.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun InviteButton(onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary
        )
    ) {
        Text("✉️", style = MaterialTheme.typography.titleMedium)
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = "Convidar para Grupo",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun PlayerDetailLoadingContent(paddingValues: PaddingValues) {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim = transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate"
    )

    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = androidx.compose.ui.geometry.Offset(translateAnim.value - 1000f, 0f),
        end = androidx.compose.ui.geometry.Offset(translateAnim.value, 0f)
    )

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(100.dp)
                            .clip(CircleShape)
                            .background(brush)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Box(
                        modifier = Modifier
                            .width(180.dp)
                            .height(24.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(brush)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Box(
                        modifier = Modifier
                            .width(120.dp)
                            .height(16.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(brush)
                    )
                }
            }
        }

        items(3) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp)
                        .background(brush)
                )
            }
        }
    }
}

private fun getLevelTitle(level: Int): String {
    return when {
        level >= 50 -> "Lenda"
        level >= 40 -> "Mestre"
        level >= 30 -> "Expert"
        level >= 20 -> "Veterano"
        level >= 10 -> "Experiente"
        level >= 5 -> "Amador"
        else -> "Iniciante"
    }
}

private fun getLevelEmoji(level: Int): String {
    return when {
        level >= 50 -> "👑"
        level >= 40 -> "🏆"
        level >= 30 -> "⭐"
        level >= 20 -> "💫"
        level >= 10 -> "🌟"
        level >= 5 -> "✨"
        else -> "🌱"
    }
}
