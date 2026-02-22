package com.futebadosparcas.ui.gamification

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.futebadosparcas.ui.theme.GamificationColors

private data class BadgeDefinition(
    val id: String,
    val name: String,
    val description: String,
    val emoji: String,
    val category: String
)

private data class UserBadge(
    val badgeId: String,
    val unlockedAt: Long,
    val count: Int
)

private sealed class BadgeFilter {
    object All : BadgeFilter()
    object Unlocked : BadgeFilter()
    object Locked : BadgeFilter()
}

private val allBadges = listOf(
    BadgeDefinition("FIRST_GOAL", "Primeiro Gol", "Marque seu primeiro gol em uma pelada", "⚽", "goals"),
    BadgeDefinition("FIRST_ASSIST", "Primeira Assistência", "Dê sua primeira assistência", "👟", "assists"),
    BadgeDefinition("FIRST_MVP", "Primeiro MVP", "Seja eleito MVP pela primeira vez", "🏆", "mvp"),
    BadgeDefinition("FIRST_WIN", "Primeira Vitória", "Vença sua primeira partida", "🎉", "wins"),
    BadgeDefinition("FIRST_SAVE", "Primeira Defesa", "Faça sua primeira defesa como goleiro", "🧤", "saves"),
    BadgeDefinition("HAT_TRICK", "Hat-Trick", "Marque 3 gols na mesma partida", "🎩", "goals"),
    BadgeDefinition("POKER", "Poker", "Marque 4 gols na mesma partida", "🃏", "goals"),
    BadgeDefinition("MAN_OF_THE_MATCH", "Rei da Pelada", "Marque 5+ gols em uma partida", "👑", "goals"),
    BadgeDefinition("STREAK_3", "Sequência 3", "Jogue 3 partidas consecutivas", "🔥", "streak"),
    BadgeDefinition("STREAK_7", "Semana Perfeita", "Jogue 7 dias consecutivos", "📅", "streak"),
    BadgeDefinition("STREAK_30", "Mês Incansável", "Jogue 30 dias consecutivos", "💪", "streak"),
    BadgeDefinition("MVP_5", "5x MVP", "Seja eleito MVP 5 vezes", "🌟", "mvp"),
    BadgeDefinition("MVP_10", "10x MVP", "Seja eleito MVP 10 vezes", "💫", "mvp"),
    BadgeDefinition("MVP_25", "25x MVP", "Seja eleito MVP 25 vezes", "⭐", "mvp"),
    BadgeDefinition("GOALS_10", "Artilheiro Iniciante", "Marque 10 gols no total", "🥅", "goals"),
    BadgeDefinition("GOALS_50", "Artilheiro", "Marque 50 gols no total", "🎯", "goals"),
    BadgeDefinition("GOALS_100", "Goleador", "Marque 100 gols no total", "🏅", "goals"),
    BadgeDefinition("ASSISTS_10", "Garçom Iniciante", "Dê 10 assistências no total", "🍽️", "assists"),
    BadgeDefinition("ASSISTS_50", "Garçom", "Dê 50 assistências no total", "🥄", "assists"),
    BadgeDefinition("WINS_10", "Vencedor", "Vença 10 partidas", "🥇", "wins"),
    BadgeDefinition("WINS_50", "Campeão", "Vença 50 partidas", "🎖️", "wins"),
    BadgeDefinition("GAMES_10", "Peladeiro", "Participe de 10 peladas", "👟", "games"),
    BadgeDefinition("GAMES_50", "Veterano", "Participe de 50 peladas", "👴", "games"),
    BadgeDefinition("GAMES_100", "Lenda", "Participe de 100 peladas", "🎭", "games"),
    BadgeDefinition("PAREDAO", "Paredão", "Defenda 5 penalties na mesma partida", "🧱", "saves"),
    BadgeDefinition("CLEAN_SHEET", "Goleiro Perfeito", "Não sofra gols em uma partida", "🧹", "saves"),
    BadgeDefinition("EARLY_BIRD", "Madrugador", "Jogue antes das 7h da manhã", "🐔", "special"),
    BadgeDefinition("NIGHT_OWL", "Coruja", "Jogue depois das 23h", "🦉", "special"),
    BadgeDefinition("LEVEL_5", "Nível 5", "Alcance o nível 5", "✨", "level"),
    BadgeDefinition("LEVEL_10", "Nível 10", "Alcance o nível 10", "🌟", "level"),
    BadgeDefinition("LEVEL_20", "Nível 20", "Alcance o nível 20", "💫", "level"),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BadgesScreen(
    unlockedBadges: List<Map<String, Any?>>,
    onNavigateBack: () -> Unit
) {
    var selectedFilter by remember { mutableStateOf<BadgeFilter>(BadgeFilter.All) }
    var selectedBadge by remember { mutableStateOf<BadgeDefinition?>(null) }

    val userBadges = remember(unlockedBadges) {
        unlockedBadges.map { data ->
            UserBadge(
                badgeId = data["badgeId"] as? String ?: "",
                unlockedAt = (data["unlockedAt"] as? Number)?.toLong() ?: 0L,
                count = (data["count"] as? Number)?.toInt() ?: 1
            )
        }
    }

    val unlockedIds = userBadges.map { it.badgeId }.toSet()

    val filteredBadges = remember(selectedFilter, unlockedIds) {
        when (selectedFilter) {
            BadgeFilter.All -> allBadges
            BadgeFilter.Unlocked -> allBadges.filter { it.id in unlockedIds }
            BadgeFilter.Locked -> allBadges.filter { it.id !in unlockedIds }
        }
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        text = "Badges",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Text("←", style = MaterialTheme.typography.titleLarge)
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = selectedFilter is BadgeFilter.All,
                    onClick = { selectedFilter = BadgeFilter.All },
                    label = { Text("Todas") },
                    modifier = Modifier.weight(1f)
                )
                FilterChip(
                    selected = selectedFilter is BadgeFilter.Unlocked,
                    onClick = { selectedFilter = BadgeFilter.Unlocked },
                    label = { Text("Conquistadas (${unlockedIds.size})") },
                    modifier = Modifier.weight(1f)
                )
                FilterChip(
                    selected = selectedFilter is BadgeFilter.Locked,
                    onClick = { selectedFilter = BadgeFilter.Locked },
                    label = { Text("Bloqueadas") },
                    modifier = Modifier.weight(1f)
                )
            }

            if (filteredBadges.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "🏅",
                            style = MaterialTheme.typography.displayLarge
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = when (selectedFilter) {
                                BadgeFilter.Unlocked -> "Nenhuma badge conquistada ainda"
                                BadgeFilter.Locked -> "Todas as badges foram conquistadas!"
                                else -> "Nenhuma badge encontrada"
                            },
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Adaptive(minSize = 120.dp),
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(filteredBadges, key = { it.id }) { badge ->
                        val isUnlocked = badge.id in unlockedIds
                        val userBadge = userBadges.find { it.badgeId == badge.id }

                        BadgeGridItem(
                            badge = badge,
                            isUnlocked = isUnlocked,
                            count = userBadge?.count ?: 0,
                            onClick = { selectedBadge = badge }
                        )
                    }
                }
            }
        }
    }

    selectedBadge?.let { badge ->
        BadgeDetailDialog(
            badge = badge,
            isUnlocked = badge.id in unlockedIds,
            userBadge = userBadges.find { it.badgeId == badge.id },
            onDismiss = { selectedBadge = null }
        )
    }
}

@Composable
private fun BadgeGridItem(
    badge: BadgeDefinition,
    isUnlocked: Boolean,
    count: Int,
    onClick: () -> Unit
) {
    val backgroundColor = if (isUnlocked) {
        GamificationColors.Gold.copy(alpha = 0.15f)
    } else {
        MaterialTheme.colorScheme.surfaceVariant
    }

    val borderColor = if (isUnlocked) {
        GamificationColors.Gold.copy(alpha = 0.5f)
    } else {
        MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .border(2.dp, borderColor, RoundedCornerShape(16.dp)),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = backgroundColor),
        onClick = onClick
    ) {
        Box(
            modifier = Modifier.fillMaxSize()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(
                            if (isUnlocked) GamificationColors.Gold.copy(alpha = 0.3f)
                            else MaterialTheme.colorScheme.surfaceVariant
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = badge.emoji,
                        style = MaterialTheme.typography.headlineMedium,
                        modifier = Modifier.alpha(if (isUnlocked) 1f else 0.4f)
                    )

                    if (!isUnlocked) {
                        Text(
                            text = "🔒",
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.align(Alignment.BottomEnd)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = badge.name,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = if (isUnlocked) {
                        MaterialTheme.colorScheme.onSurface
                    } else {
                        MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                    },
                    textAlign = TextAlign.Center,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

            if (count > 1) {
                Surface(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp),
                    shape = RoundedCornerShape(8.dp),
                    color = GamificationColors.Gold
                ) {
                    Text(
                        text = "x$count",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.Black,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun BadgeDetailDialog(
    badge: BadgeDefinition,
    isUnlocked: Boolean,
    userBadge: UserBadge?,
    onDismiss: () -> Unit
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            dismissOnBackPress = true,
            dismissOnClickOutside = true,
            usePlatformDefaultWidth = false
        )
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surface
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(120.dp)
                        .clip(CircleShape)
                        .background(
                            if (isUnlocked) GamificationColors.Gold.copy(alpha = 0.3f)
                            else MaterialTheme.colorScheme.surfaceVariant
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = badge.emoji,
                        style = MaterialTheme.typography.displayLarge
                    )

                    if (!isUnlocked) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.5f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "🔒",
                                style = MaterialTheme.typography.displaySmall
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = badge.name,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    if (isUnlocked) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "⭐",
                            style = MaterialTheme.typography.headlineSmall
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = if (isUnlocked) {
                        GamificationColors.Gold.copy(alpha = 0.2f)
                    } else {
                        MaterialTheme.colorScheme.surfaceVariant
                    }
                ) {
                    Text(
                        text = badge.category.uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = if (isUnlocked) GamificationColors.Gold else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = badge.description,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )

                if (isUnlocked && userBadge != null) {
                    Spacer(modifier = Modifier.height(16.dp))

                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = GamificationColors.XpGreen.copy(alpha = 0.1f)
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = "✅ Conquistada!",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = GamificationColors.XpGreen
                            )

                            if (userBadge.count > 1) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Conquistada ${userBadge.count} vezes",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }

                            if (userBadge.unlockedAt > 0) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = formatDate(userBadge.unlockedAt),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                TextButton(onClick = onDismiss) {
                    Text("Fechar")
                }
            }
        }
    }
}

private fun formatDate(timestamp: Long): String {
    return try {
        jsFormatBadgeDate(timestamp)
    } catch (e: Exception) {
        ""
    }
}

private external fun jsFormatBadgeDate(timestamp: Long): String
