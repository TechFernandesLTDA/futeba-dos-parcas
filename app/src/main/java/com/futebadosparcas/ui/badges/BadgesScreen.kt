package com.futebadosparcas.ui.badges

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.tween
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Badge
import com.futebadosparcas.data.model.BadgeRarity
import com.futebadosparcas.data.model.BadgeType
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.theme.GamificationColors
import java.text.SimpleDateFormat
import java.util.*

/**
 * Tela principal de Badges/Conquistas em Jetpack Compose
 *
 * Features:
 * - Grid responsivo com badges
 * - Header com progresso total
 * - Filtros por categoria
 * - Estados: Loading (Shimmer), Empty, Success, Error
 * - Dialog de detalhes ao clicar
 * - Animações de desbloqueio
 * - Material3 com cores temáticas
 */
@Composable
fun BadgesScreen(
    viewModel: BadgesViewModel = hiltViewModel(),
    onBackClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        modifier = modifier.fillMaxSize(),
        topBar = {
            BadgesTopBar(onBackClick = onBackClick)
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is BadgesUiState.Loading -> {
                    BadgesLoadingState()
                }
                is BadgesUiState.Error -> {
                    BadgesErrorState(
                        message = state.message,
                        onRetry = { viewModel.loadBadges() }
                    )
                }
                is BadgesUiState.Empty -> {
                    com.futebadosparcas.ui.components.modern.EmptyState(
                        icon = Icons.Default.EmojiEvents,
                        title = "Nenhuma conquista ainda",
                        message = "Jogue partidas para desbloquear conquistas e badges!"
                    )
                }
                is BadgesUiState.Success -> {
                    BadgesSuccessContent(
                        state = state,
                        onCategorySelected = { category ->
                            viewModel.filterByCategory(category)
                        }
                    )
                }
            }
        }
    }
}

/**
 * Top bar com título e botão de voltar
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BadgesTopBar(
    onBackClick: (() -> Unit)?
) {
    TopAppBar(
        title = {
            Text(
                text = stringResource(R.string.badges_title),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
        },
        navigationIcon = {
            if (onBackClick != null) {
                IconButton(onClick = onBackClick) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = stringResource(R.string.back)
                    )
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface,
            titleContentColor = MaterialTheme.colorScheme.onSurface
        )
    )
}

/**
 * Conteúdo de sucesso com badges
 */
@Composable
private fun BadgesSuccessContent(
    state: BadgesUiState.Success,
    onCategorySelected: (BadgeCategory?) -> Unit
) {
    var selectedBadge by remember { mutableStateOf<BadgeWithData?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Header com progresso
        BadgeProgressHeader(
            totalUnlocked = state.totalUnlocked,
            totalAvailable = 11 // Total de BadgeType disponíveis
        )

        // Filtros por categoria
        BadgeCategoryTabs(
            selectedCategory = state.selectedCategory,
            onCategorySelected = onCategorySelected
        )

        // Grid de badges
        if (state.filteredBadges.isEmpty()) {
            // Empty state
            EmptyState(
                type = EmptyStateType.NoData(
                    title = stringResource(R.string.badges_no_badges),
                    description = if (state.selectedCategory != null) {
                        stringResource(R.string.badges_no_badges_category)
                    } else {
                        stringResource(R.string.badges_no_badges_general)
                    },
                    icon = Icons.Default.EmojiEvents
                ),
                modifier = Modifier.fillMaxSize()
            )
        } else {
            BadgesGrid(
                badges = state.filteredBadges,
                onBadgeClick = { badge ->
                    selectedBadge = badge
                }
            )
        }
    }

    // Dialog de detalhes
    selectedBadge?.let { badge ->
        BadgeDetailDialog(
            badgeWithData = badge,
            onDismiss = { selectedBadge = null }
        )
    }
}

/**
 * Header com progresso total de badges
 */
@Composable
private fun BadgeProgressHeader(
    totalUnlocked: Int,
    totalAvailable: Int
) {
    val percentage = if (totalAvailable > 0) {
        (totalUnlocked.toFloat() / totalAvailable * 100).toInt()
    } else 0

    // Valor estático pré-calculado para otimização de scroll
    val staticProgress = if (totalAvailable > 0) {
        totalUnlocked.toFloat() / totalAvailable
    } else 0f

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = stringResource(R.string.badges_progress),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Progresso circular
            Box(
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(
                    progress = { staticProgress },
                    modifier = Modifier.size(120.dp),
                    strokeWidth = 8.dp,
                    color = MaterialTheme.colorScheme.primary,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                )

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "$totalUnlocked/$totalAvailable",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "$percentage%",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = stringResource(R.string.badges_unlocked),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
            )
        }
    }
}

/**
 * Tabs de filtro por categoria
 */
@Composable
private fun BadgeCategoryTabs(
    selectedCategory: BadgeCategory?,
    onCategorySelected: (BadgeCategory?) -> Unit
) {
    ScrollableTabRow(
        selectedTabIndex = when (selectedCategory) {
            null -> 0
            BadgeCategory.PERFORMANCE -> 1
            BadgeCategory.PRESENCA -> 2
            BadgeCategory.COMUNIDADE -> 3
            BadgeCategory.NIVEL -> 4
        },
        modifier = Modifier.fillMaxWidth(),
        containerColor = MaterialTheme.colorScheme.surface,
        contentColor = MaterialTheme.colorScheme.primary,
        edgePadding = 16.dp,
        divider = {}
    ) {
        Tab(
            selected = selectedCategory == null,
            onClick = { onCategorySelected(null) },
            text = { Text(stringResource(R.string.badges_all)) }
        )
        BadgeCategory.entries.forEach { category ->
            Tab(
                selected = selectedCategory == category,
                onClick = { onCategorySelected(category) },
                text = { Text(getCategoryEmoji(category) + " " + category.displayName) }
            )
        }
    }

    HorizontalDivider(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.outlineVariant
    )
}

/**
 * Grid de badges
 */
@Composable
private fun BadgesGrid(
    badges: List<BadgeWithData>,
    onBadgeClick: (BadgeWithData) -> Unit
) {
    // Grid adaptativo: 2 colunas em telefone, 3 em tablet, 4 em landscape grande
    val configuration = androidx.compose.ui.platform.LocalConfiguration.current
    val columns = when {
        configuration.screenWidthDp >= 840 -> 4
        configuration.screenWidthDp >= 600 -> 3
        else -> 2
    }

    LazyVerticalGrid(
        columns = GridCells.Fixed(columns),
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(badges, key = { it.badge.id }) { badgeWithData ->
            BadgeCard(
                badgeWithData = badgeWithData,
                onClick = { onBadgeClick(badgeWithData) }
            )
        }
    }
}

/**
 * Card de badge individual
 */
@Composable
private fun BadgeCard(
    badgeWithData: BadgeWithData,
    onClick: () -> Unit
) {
    val badge = badgeWithData.badge
    val rarityColor = getRarityColor(badge.rarity)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(0.85f)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Rarity label
            BadgeRarityLabel(rarity = badge.rarity)

            Spacer(modifier = Modifier.height(8.dp))

            // Badge icon/emoji com borda colorida
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .border(
                        width = 3.dp,
                        color = rarityColor,
                        shape = CircleShape
                    )
                    .background(
                        color = rarityColor.copy(alpha = 0.1f),
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = getBadgeEmoji(badge.type),
                    style = MaterialTheme.typography.displayMedium,
                    textAlign = TextAlign.Center
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Nome da badge
            Text(
                text = badge.name,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            // Descrição
            Text(
                text = badge.description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.height(36.dp)
            )

            // Count (se > 1)
            if (badgeWithData.userBadge.count > 1) {
                BadgeCountChip(count = badgeWithData.userBadge.count)
            } else {
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

/**
 * Label de raridade da badge
 */
@Composable
private fun BadgeRarityLabel(rarity: BadgeRarity) {
    val rarityText = when (rarity) {
        BadgeRarity.COMUM -> stringResource(R.string.badges_rarity_comum)
        BadgeRarity.RARO -> stringResource(R.string.badges_rarity_raro)
        BadgeRarity.EPICO -> stringResource(R.string.badges_rarity_epico)
        BadgeRarity.LENDARIO -> stringResource(R.string.badges_rarity_lendario)
    }

    val rarityColor = getRarityColor(rarity)

    Surface(
        shape = RoundedCornerShape(8.dp),
        color = rarityColor.copy(alpha = 0.15f),
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            text = "🏆 $rarityText",
            style = MaterialTheme.typography.labelSmall,
            color = rarityColor,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(vertical = 4.dp)
        )
    }
}

/**
 * Chip com contador de badges
 */
@Composable
private fun BadgeCountChip(count: Int) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.tertiaryContainer,
        modifier = Modifier.height(24.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Text(
                text = "×",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onTertiaryContainer,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = count.toString(),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onTertiaryContainer,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

/**
 * Dialog com detalhes da badge
 */
@Composable
private fun BadgeDetailDialog(
    badgeWithData: BadgeWithData,
    onDismiss: () -> Unit
) {
    val badge = badgeWithData.badge
    val userBadge = badgeWithData.userBadge
    val rarityColor = getRarityColor(badge.rarity)

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Header
                Text(
                    text = stringResource(R.string.badges_unlocked_title),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Badge icon grande com animação
                Box(
                    modifier = Modifier
                        .size(120.dp)
                        .border(
                            width = 4.dp,
                            brush = Brush.linearGradient(
                                colors = listOf(
                                    rarityColor.copy(alpha = 0.5f),
                                    rarityColor,
                                    rarityColor.copy(alpha = 0.5f)
                                )
                            ),
                            shape = CircleShape
                        )
                        .background(
                            color = rarityColor.copy(alpha = 0.1f),
                            shape = CircleShape
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = getBadgeEmoji(badge.type),
                        style = MaterialTheme.typography.displayLarge,
                        textAlign = TextAlign.Center
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Nome da badge
                Text(
                    text = badge.name,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Descrição
                Text(
                    text = badge.description,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Raridade
                BadgeRarityLabel(rarity = badge.rarity)

                Spacer(modifier = Modifier.height(16.dp))

                // XP Reward
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = GamificationColors.XpGreen.copy(alpha = 0.15f)
                ) {
                    Text(
                        text = "+${badge.xpReward} XP",
                        style = MaterialTheme.typography.titleMedium,
                        color = GamificationColors.XpGreen,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Data de desbloqueio
                userBadge.unlockedAt?.let { date ->
                    val dateFormat = SimpleDateFormat("dd/MM/yyyy", Locale("pt", "BR"))
                    Text(
                        text = stringResource(R.string.badge_unlocked_at, dateFormat.format(date)),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Contador (se > 1)
                if (userBadge.count > 1) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = stringResource(R.string.badge_count_times, userBadge.count),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.tertiary,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Botão de fechar
                FilledTonalButton(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(stringResource(R.string.badges_continue))
                }
            }
        }
    }
}

/**
 * Estado de loading com shimmer
 */
@Composable
private fun BadgesLoadingState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Header shimmer
        BadgeProgressHeaderShimmer()

        // Tabs shimmer
        Spacer(modifier = Modifier.height(8.dp))

        // Grid shimmer
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(6, key = { "shimmer_$it" }) {
                BadgeCardShimmer()
            }
        }
    }
}

/**
 * Shimmer do header de progresso
 */
@Composable
private fun BadgeProgressHeaderShimmer() {
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
        start = Offset(translateAnim.value - 1000f, translateAnim.value - 1000f),
        end = Offset(translateAnim.value, translateAnim.value)
    )

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp)
                .background(brush)
        )
    }
}

/**
 * Shimmer do card de badge
 */
@Composable
private fun BadgeCardShimmer() {
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
        start = Offset(translateAnim.value - 1000f, translateAnim.value - 1000f),
        end = Offset(translateAnim.value, translateAnim.value)
    )

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(0.85f),
        shape = RoundedCornerShape(16.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(brush)
        )
    }
}

/**
 * Estado de erro
 */
@Composable
private fun BadgesErrorState(
    message: String,
    onRetry: () -> Unit
) {
    EmptyState(
        type = EmptyStateType.Error(
            title = stringResource(R.string.badges_error_title),
            description = message,
            onRetry = onRetry
        ),
        modifier = Modifier.fillMaxSize()
    )
}

// ==================== UTILS ====================

/**
 * Retorna o emoji para cada tipo de badge
 */
private fun getBadgeEmoji(type: BadgeType): String {
    return when (type) {
        BadgeType.HAT_TRICK -> "⚽"
        BadgeType.PAREDAO -> "🧤"
        BadgeType.ARTILHEIRO_MES -> "👑"
        BadgeType.FOMINHA -> "🔥"
        BadgeType.STREAK_7 -> "📅"
        BadgeType.STREAK_30 -> "🗓️"
        BadgeType.ORGANIZADOR_MASTER -> "📋"
        BadgeType.INFLUENCER -> "✨"
        BadgeType.LENDA -> "🏆"
        BadgeType.FAIXA_PRETA -> "🥋"
        BadgeType.MITO -> "💎"
    }
}

/**
 * Retorna o emoji para cada categoria
 */
private fun getCategoryEmoji(category: BadgeCategory): String {
    return when (category) {
        BadgeCategory.PERFORMANCE -> "⚽"
        BadgeCategory.PRESENCA -> "📅"
        BadgeCategory.COMUNIDADE -> "👥"
        BadgeCategory.NIVEL -> "🏆"
    }
}

/**
 * Retorna a cor para cada raridade
 */
@Composable
private fun getRarityColor(rarity: BadgeRarity): Color {
    return when (rarity) {
        BadgeRarity.COMUM -> com.futebadosparcas.ui.theme.BadgeRarityColors.Common
        BadgeRarity.RARO -> com.futebadosparcas.ui.theme.BadgeRarityColors.Rare
        BadgeRarity.EPICO -> com.futebadosparcas.ui.theme.BadgeRarityColors.Epic
        BadgeRarity.LENDARIO -> com.futebadosparcas.ui.theme.BadgeRarityColors.Legendary
    }
}

// ==================== PREVIEWS ====================

/**
 * Preview do header de progresso
 */
@androidx.compose.ui.tooling.preview.Preview(showBackground = true)
@Composable
private fun BadgeProgressHeaderPreview() {
    com.futebadosparcas.ui.theme.FutebaTheme {
        BadgeProgressHeader(totalUnlocked = 5, totalAvailable = 11)
    }
}

/**
 * Preview de um badge card
 */
@androidx.compose.ui.tooling.preview.Preview(showBackground = true)
@Composable
private fun BadgeCardPreview() {
    com.futebadosparcas.ui.theme.FutebaTheme {
        val sampleBadge = BadgeWithData(
            userBadge = com.futebadosparcas.data.model.UserBadge(
                id = "1",
                userId = "user1",
                badgeId = "badge1",
                count = 3,
                unlockedAt = Date()
            ),
            badge = Badge(
                id = "badge1",
                type = BadgeType.HAT_TRICK,
                name = "Hat-Trick",
                description = "Marque 3+ gols em uma partida",
                iconUrl = "",
                xpReward = 100,
                rarity = BadgeRarity.EPICO
            )
        )

        Box(modifier = Modifier.padding(16.dp).width(180.dp)) {
            BadgeCard(badgeWithData = sampleBadge, onClick = {})
        }
    }
}

/**
 * Preview do estado de loading
 */
@androidx.compose.ui.tooling.preview.Preview(showBackground = true)
@Composable
private fun BadgesLoadingStatePreview() {
    com.futebadosparcas.ui.theme.FutebaTheme {
        BadgesLoadingState()
    }
}
