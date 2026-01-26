package com.futebadosparcas.ui.profile

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import com.futebadosparcas.R
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.futebadosparcas.BuildConfig
import com.futebadosparcas.data.model.*
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.model.PlayerRatingRole
import com.futebadosparcas.domain.model.FieldType
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.components.ShimmerBox
import com.futebadosparcas.ui.theme.GamificationColors
import com.futebadosparcas.util.LevelBadgeHelper
import com.futebadosparcas.util.LevelHelper
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.widget.Toast
import androidx.compose.ui.platform.LocalContext
import java.util.Locale

/**
 * Tela principal do Perfil do usuário em Jetpack Compose
 *
 * OTIMIZADO PARA SCROLL SUAVE (ESTILO INSTAGRAM/FACEBOOK):
 * - SEM animações durante scroll
 * - Valores estáveis com remember
 * - Keys estáveis em todos os itens
 * - LazyColumn com configurações nativas
 *
 * Features:
 * - Header com avatar, nome, nível e XP
 * - Estatísticas resumidas
 * - Badges recentes
 * - Ratings por posição (SEM animação)
 * - Preferências de campo
 * - Seção administrativa (Admin/Field Owner)
 * - Estados: Loading (Shimmer), Success, Error
 */
@Composable
fun ProfileScreen(
    viewModel: ProfileViewModel,
    onEditProfileClick: () -> Unit,
    onSettingsClick: () -> Unit,
    onNotificationsClick: () -> Unit,
    onAboutClick: () -> Unit,
    onSchedulesClick: () -> Unit,
    onLevelJourneyClick: () -> Unit,
    onUserManagementClick: () -> Unit,
    onMyLocationsClick: () -> Unit,
    onManageLocationsClick: () -> Unit,
    onGamificationSettingsClick: () -> Unit,
    onDeveloperMenuClick: () -> Unit,
    onLogoutClick: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val myLocations by viewModel.myLocations.collectAsStateWithLifecycle()

    // Carregar dados do perfil quando a tela for aberta
    LaunchedEffect(Unit) {
        viewModel.loadProfile()
    }

    // Estado para controle de cliques secretos no avatar
    var avatarClickCount by remember { mutableStateOf(0) }
    var lastAvatarClickTime by remember { mutableStateOf(0L) }

    // Scaffold removido - o padding já é gerenciado pelo MainActivityCompose
    when (val state = uiState) {
        is ProfileUiState.Loading -> {
            ProfileLoadingShimmer()
        }
        is ProfileUiState.Success -> {
            ProfileContent(
                user = state.user,
                badges = state.badges,
                statistics = state.statistics,
                isDevMode = state.isDevMode,
                myLocationsCount = myLocations.size,
                onEditProfileClick = onEditProfileClick,
                onSettingsClick = onSettingsClick,
                onNotificationsClick = onNotificationsClick,
                onAboutClick = onAboutClick,
                onSchedulesClick = onSchedulesClick,
                onLevelJourneyClick = onLevelJourneyClick,
                onUserManagementClick = onUserManagementClick,
                onMyLocationsClick = onMyLocationsClick,
                onManageLocationsClick = onManageLocationsClick,
                onGamificationSettingsClick = onGamificationSettingsClick,
                onDeveloperMenuClick = onDeveloperMenuClick,
                onLogoutClick = onLogoutClick,
                onAvatarClick = {
                    val currentTime = System.currentTimeMillis()
                    if (currentTime - lastAvatarClickTime > 1000) {
                        avatarClickCount = 0
                    }
                    lastAvatarClickTime = currentTime
                    avatarClickCount++

                    if (avatarClickCount == 7) {
                        viewModel.enableDevMode()
                        avatarClickCount = 0
                    }
                }
            )
        }
        is ProfileUiState.ProfileUpdateSuccess -> {
            // Tratar ProfileUpdateSuccess da mesma forma que Success
            // para exibir os dados atualizados após edição
            ProfileContent(
                user = state.user,
                badges = state.badges,
                statistics = state.statistics,
                isDevMode = state.isDevMode,
                myLocationsCount = myLocations.size,
                onEditProfileClick = onEditProfileClick,
                onSettingsClick = onSettingsClick,
                onNotificationsClick = onNotificationsClick,
                onAboutClick = onAboutClick,
                onSchedulesClick = onSchedulesClick,
                onLevelJourneyClick = onLevelJourneyClick,
                onUserManagementClick = onUserManagementClick,
                onMyLocationsClick = onMyLocationsClick,
                onManageLocationsClick = onManageLocationsClick,
                onGamificationSettingsClick = onGamificationSettingsClick,
                onDeveloperMenuClick = onDeveloperMenuClick,
                onLogoutClick = onLogoutClick,
                onAvatarClick = {
                    val currentTime = System.currentTimeMillis()
                    if (currentTime - lastAvatarClickTime > 1000) {
                        avatarClickCount = 0
                    }
                    lastAvatarClickTime = currentTime
                    avatarClickCount++

                    if (avatarClickCount == 7) {
                        viewModel.enableDevMode()
                        avatarClickCount = 0
                    }
                }
            )
        }
        is ProfileUiState.Error -> {
            ErrorState(
                message = state.message,
                onRetry = { viewModel.loadProfile() }
            )
        }
        else -> {
            // LoggedOut ou outros estados são tratados pelo Fragment
        }
    }
}

/**
 * Conteúdo principal do perfil
 *
 * OTIMIZADO PARA SCROLL PERFEITO:
 * - SEM animações que rodam durante scroll
 * - Todos os valores estabilizados com remember
 * - Keys estáveis para evitar recomposições
 * - LazyColumn sem fling customizado (usa nativo)
 */
@Composable
private fun ProfileContent(
    user: User,
    badges: List<UserBadge>,
    statistics: UserStatistics?,
    isDevMode: Boolean,
    myLocationsCount: Int,
    onEditProfileClick: () -> Unit,
    onSettingsClick: () -> Unit,
    onNotificationsClick: () -> Unit,
    onAboutClick: () -> Unit,
    onSchedulesClick: () -> Unit,
    onLevelJourneyClick: () -> Unit,
    onUserManagementClick: () -> Unit,
    onMyLocationsClick: () -> Unit,
    onManageLocationsClick: () -> Unit,
    onGamificationSettingsClick: () -> Unit,
    onDeveloperMenuClick: () -> Unit,
    onLogoutClick: () -> Unit,
    onAvatarClick: () -> Unit
) {
    // Estabilizar valores que não mudam durante scroll - CRÍTICO para scroll suave
    // Usa user.id como chave única para evitar recálculos durante scroll
    val stableUser = remember(user.id, user.experiencePoints, user.level) { user }
    // Usa tamanho da lista + primeiro item como chave (mais leve que map)
    val stableBadges = remember(badges.size, badges.firstOrNull()?.badgeId) { badges }
    val stableStatistics = remember(statistics?.totalGames) { statistics }

    // Calcular valores estáticos uma vez (SEM animação)
    val xpPercentage = remember(stableUser.id) {
        LevelHelper.getProgressPercentage(stableUser.experiencePoints)
    }
    val currentXP = remember(stableUser.id) {
        LevelHelper.getProgressInCurrentLevel(stableUser.experiencePoints).first
    }
    val levelTitle = remember(stableUser.level) {
        LevelHelper.getLevelTitle(stableUser.level)
    }
    val motivationalMessage = remember(stableUser.experiencePoints) {
        LevelHelper.getMotivationalMessage(stableUser.experiencePoints)
    }

    // Ratings calculados uma vez, SEM animação
    val ratings = remember(stableUser.id) {
        listOf(
            RatingData("Atacante", stableUser.getEffectiveRating(PlayerRatingRole.STRIKER), Icons.Default.SportsSoccer),
            RatingData("Meio-Campo", stableUser.getEffectiveRating(PlayerRatingRole.MID), Icons.AutoMirrored.Filled.DirectionsRun),
            RatingData("Defensor", stableUser.getEffectiveRating(PlayerRatingRole.DEFENDER), Icons.Default.Shield),
            RatingData("Goleiro", stableUser.getEffectiveRating(PlayerRatingRole.GOALKEEPER), Icons.Default.SportsKabaddi)
        )
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Header: Avatar, Nome, Role
        item(key = "header") {
            ProfileHeader(
                user = stableUser,
                onAvatarClick = onAvatarClick
            )
        }

        // Card de Nível e XP - SEM ANIMAÇÃO, valores estáticos
        item(key = "level") {
            StaticLevelCard(
                level = stableUser.level,
                currentXP = currentXP,
                xpPercentage = xpPercentage,
                levelTitle = levelTitle,
                motivationalMessage = motivationalMessage,
                onClick = onLevelJourneyClick
            )
        }

        // Preferências de Campo
        item(key = "field_prefs") {
            FieldPreferencesCard(preferredTypes = stableUser.preferredFieldTypes)
        }

        // Ratings por Posição - SEM ANIMAÇÃO
        item(key = "ratings") {
            StaticRatingsCard(ratings = ratings)
        }

        // Estatísticas Resumidas
        item(key = "statistics") {
            StatisticsCard(statistics = stableStatistics)
        }

        // Badges Recentes
        if (stableBadges.isNotEmpty()) {
            item(key = "badges") {
                BadgesSection(badges = stableBadges)
            }
        }

        // Botões de Ação
        item(key = "actions") {
            ActionButtonsSection(
                onEditProfileClick = onEditProfileClick,
                onLogoutClick = onLogoutClick
            )
        }

        // Seção de Configurações
        item(key = "settings") {
            SettingsSection(
                onNotificationsClick = onNotificationsClick,
                onSettingsClick = onSettingsClick,
                onSchedulesClick = onSchedulesClick,
                onAboutClick = onAboutClick
            )
        }

        // Seção de Feedback
        item(key = "feedback") {
            FeedbackSection()
        }

        // Seção Administrativa
        val isAdmin = stableUser.isAdmin()
        val isFieldOwner = stableUser.isFieldOwner()

        if (isAdmin || isFieldOwner) {
            item(key = "admin") {
                AdminSection(
                    isAdmin = isAdmin,
                    isFieldOwner = isFieldOwner,
                    myLocationsCount = myLocationsCount,
                    onUserManagementClick = onUserManagementClick,
                    onMyLocationsClick = onMyLocationsClick,
                    onManageLocationsClick = onManageLocationsClick,
                    onGamificationSettingsClick = onGamificationSettingsClick
                )
            }
        }

        // Developer Menu (se ativado)
        if (isDevMode) {
            item(key = "developer") {
                DeveloperMenuCard(onClick = onDeveloperMenuClick)
            }
        }

        // Espaçamento antes da versão
        item(key = "bottom_spacer") {
            Spacer(modifier = Modifier.height(24.dp))
        }

        // Versão do App
        item(key = "version") {
            Text(
                text = stringResource(R.string.version_format, BuildConfig.VERSION_NAME),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                textAlign = TextAlign.Center
            )
        }
    }
}

/**
 * Header do perfil com avatar, nome e role badge
 */
@Composable
private fun ProfileHeader(
    user: User,
    onAvatarClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
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
            // Avatar com badge de nível
            Box(
                modifier = Modifier
                    .size(120.dp)
                    .clickable(onClick = onAvatarClick),
                contentAlignment = Alignment.Center
            ) {
                // Avatar circular
                if (user.photoUrl != null) {
                    val photoUrl = remember(user.photoUrl) { user.photoUrl }
                    AsyncImage(
                        model = photoUrl,
                        contentDescription = "Foto de perfil",
                        modifier = Modifier
                            .size(120.dp)
                            .clip(CircleShape),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    // Iniciais
                    Box(
                        modifier = Modifier
                            .size(120.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primary),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = getInitials(user.name),
                            style = MaterialTheme.typography.headlineLarge,
                            color = MaterialTheme.colorScheme.onPrimary,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Badge de nível sobreposto
                Image(
                    painter = painterResource(id = LevelBadgeHelper.getBadgeForLevel(user.level)),
                    contentDescription = "Badge de nível",
                    modifier = Modifier
                        .size(40.dp)
                        .align(Alignment.BottomEnd)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Nome
            Text(
                text = user.name,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Email
            Text(
                text = user.email,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Role Badge
            if (user.isAdmin() || user.isFieldOwner()) {
                Spacer(modifier = Modifier.height(8.dp))
                AssistChip(
                    onClick = { },
                    label = {
                        Text(
                            text = when {
                                user.isAdmin() -> stringResource(R.string.profile_role_admin)
                                user.isFieldOwner() -> stringResource(R.string.profile_role_organizer)
                                else -> ""
                            }
                        )
                    },
                    colors = AssistChipDefaults.assistChipColors(
                        containerColor = if (user.isAdmin()) {
                            MaterialTheme.colorScheme.error
                        } else {
                            MaterialTheme.colorScheme.secondary
                        }
                    )
                )
            }
        }
    }
}

/**
 * Card de Nível e XP - VERSÃO ESTÁTICA (SEM ANIMAÇÃO)
 *
 * Scroll suave requer zero animações durante a rolagem.
 * Valores são pré-calculados e passados como parâmetros.
 */
@Composable
private fun StaticLevelCard(
    level: Int,
    currentXP: Long,
    xpPercentage: Int,
    levelTitle: String,
    motivationalMessage: String,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.profile_level, level),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        text = levelTitle,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    )
                }

                Image(
                    painter = painterResource(id = LevelBadgeHelper.getBadgeForLevel(level)),
                    contentDescription = stringResource(R.string.level_badge),
                    modifier = Modifier.size(48.dp)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Barra de progresso ESTÁTICA
            LinearProgressIndicator(
                progress = { xpPercentage / 100f },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
                color = GamificationColors.XpGreen,
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "$currentXP XP",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Text(
                    text = "$xpPercentage%",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Mensagem motivacional
            Text(
                text = motivationalMessage,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f),
                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
            )
        }
    }
}

/**
 * Card de preferências de campo
 */
@Composable
private fun FieldPreferencesCard(preferredTypes: List<FieldType>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)  // Sem sombra para scroll suave
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = stringResource(R.string.field_preferences),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                FieldTypeIcon(
                    type = FieldType.SOCIETY,
                    isEnabled = preferredTypes.contains(FieldType.SOCIETY),
                    label = stringResource(R.string.field_type_society_short)
                )
                FieldTypeIcon(
                    type = FieldType.FUTSAL,
                    isEnabled = preferredTypes.contains(FieldType.FUTSAL),
                    label = stringResource(R.string.field_type_futsal_short)
                )
                FieldTypeIcon(
                    type = FieldType.CAMPO,
                    isEnabled = preferredTypes.contains(FieldType.CAMPO),
                    label = stringResource(R.string.field_type_field_short)
                )
            }
        }
    }
}

/**
 * Ícone de tipo de campo
 */
@Composable
private fun FieldTypeIcon(
    type: FieldType,
    isEnabled: Boolean,
    label: String
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.alpha(if (isEnabled) 1f else 0.3f)
    ) {
        Icon(
            imageVector = when (type) {
                FieldType.SOCIETY -> Icons.Default.Sports
                FieldType.FUTSAL -> Icons.Default.SportsSoccer
                FieldType.CAMPO -> Icons.Default.Grass
                FieldType.AREIA -> Icons.Default.BeachAccess
                FieldType.OUTROS -> Icons.Default.SportsSoccer
            },
            contentDescription = label,
            modifier = Modifier.size(40.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

/**
 * Card de ratings por posição - VERSÃO ESTÁTICA (SEM ANIMAÇÃO)
 *
 * Ratings são pré-calculados e exibidos diretamente sem animação.
 */
@Composable
private fun StaticRatingsCard(ratings: List<RatingData>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)  // Sem sombra para scroll suave
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = stringResource(R.string.position_ratings),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(16.dp))

            ratings.forEachIndexed { index, ratingData ->
                if (index > 0) Spacer(modifier = Modifier.height(12.dp))
                StaticRatingItem(
                    label = ratingData.label,
                    rating = ratingData.rating,
                    icon = ratingData.icon
                )
            }
        }
    }
}

/**
 * Dados de rating para estabilização
 */
private data class RatingData(
    val label: String,
    val rating: Double,
    val icon: ImageVector
)

/**
 * Item de rating ESTÁTICO (SEM ANIMAÇÃO)
 *
 * Exibe diretamente o valor sem animação para scroll perfeito.
 */
@Composable
private fun StaticRatingItem(
    label: String,
    rating: Double,
    icon: ImageVector
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = label,
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            Text(
                text = String.format(Locale.getDefault(), "%.1f", rating),
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
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp)),
            color = MaterialTheme.colorScheme.primary,
            trackColor = MaterialTheme.colorScheme.surfaceVariant,
        )
    }
}

/**
 * Card de estatísticas
 */
@Composable
private fun StatisticsCard(statistics: UserStatistics?) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)  // Sem sombra para scroll suave
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = stringResource(R.string.statistics_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(16.dp))

            if (statistics != null) {
                // Grid de estatísticas 3x3
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        StatItem(label = "Jogos", value = statistics.totalGames.toString())
                        StatItem(label = "Gols", value = statistics.totalGoals.toString())
                        StatItem(label = "Vitórias", value = statistics.gamesWon.toString())
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        StatItem(label = "Assistências", value = statistics.totalAssists.toString())
                        StatItem(label = "Empates", value = statistics.gamesDraw.toString())
                        StatItem(label = "MVPs", value = statistics.bestPlayerCount.toString())
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        StatItem(label = "Defesas", value = statistics.totalSaves.toString())
                        StatItem(label = "Cartões", value = statistics.totalCards.toString())
                        StatItem(
                            label = "Média Gols",
                            value = String.format(Locale.getDefault(), "%.1f", statistics.avgGoalsPerGame ?: 0.0)
                        )
                    }
                }
            } else {
                Text(
                    text = stringResource(R.string.no_stats_available),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                )
            }
        }
    }
}

/**
 * Item individual de estatística
 */
@Composable
private fun RowScope.StatItem(label: String, value: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.weight(1f)
    ) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

/**
 * Seção de badges recentes
 */
@Composable
private fun BadgesSection(badges: List<UserBadge>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)  // Sem sombra para scroll suave
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = stringResource(R.string.recent_badges),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(
                    items = badges.take(5),
                    key = { it.id.ifEmpty { "${it.badgeId}_${it.unlockedAt}" } }  // Key única por instância de badge
                ) { badge ->
                    BadgeItem(badge = badge)
                }
            }
        }
    }
}

/**
 * Item de badge individual
 */
@Composable
private fun BadgeItem(badge: UserBadge) {
    // 🔧 OTIMIZADO: Memoizar parsing de BadgeType para evitar recomposição desnecessária
    val badgeType = remember(badge.badgeId) {
        try {
            BadgeType.valueOf(badge.badgeId)
        } catch (e: Exception) {
            null
        }
    }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(80.dp)
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(60.dp)
                .clip(CircleShape)
                .background(
                    when (badgeType) {
                        BadgeType.HAT_TRICK, BadgeType.PAREDAO -> GamificationColors.Gold
                        BadgeType.ARTILHEIRO_MES, BadgeType.MITO -> MaterialTheme.colorScheme.primary
                        BadgeType.STREAK_7, BadgeType.STREAK_30 -> MaterialTheme.colorScheme.secondary
                        else -> MaterialTheme.colorScheme.surfaceVariant
                    }.copy(alpha = 0.2f)
                )
        ) {
            Icon(
                imageVector = Icons.Default.EmojiEvents,
                contentDescription = badge.badgeId,
                modifier = Modifier.size(32.dp),
                tint = when (badgeType) {
                    BadgeType.HAT_TRICK, BadgeType.PAREDAO -> GamificationColors.Gold
                    BadgeType.ARTILHEIRO_MES, BadgeType.MITO -> MaterialTheme.colorScheme.primary
                    BadgeType.STREAK_7, BadgeType.STREAK_30 -> MaterialTheme.colorScheme.secondary
                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                }
            )

            if (badge.count > 1) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .size(20.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.error),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = badge.count.toString(),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onError,
                        fontSize = 10.sp
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = badgeType?.name ?: badge.badgeId,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}

/**
 * Seção de botões de ação
 */
@Composable
private fun ActionButtonsSection(
    onEditProfileClick: () -> Unit,
    onLogoutClick: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Button(
            onClick = onEditProfileClick,
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Edit,
                contentDescription = stringResource(R.string.edit_profile),
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(stringResource(R.string.edit_profile))
        }

        OutlinedButton(
            onClick = onLogoutClick,
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.Logout,
                contentDescription = stringResource(R.string.logout),
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(stringResource(R.string.logout))
        }
    }
}

/**
 * Seção de configurações
 */
@Composable
private fun SettingsSection(
    onNotificationsClick: () -> Unit,
    onSettingsClick: () -> Unit,
    onSchedulesClick: () -> Unit,
    onAboutClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)  // Sem sombra para scroll suave
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            SettingsMenuItem(
                icon = Icons.Default.Notifications,
                title = "Notificações",
                onClick = onNotificationsClick
            )
            HorizontalDivider()
            SettingsMenuItem(
                icon = Icons.Default.Settings,
                title = "Preferências",
                onClick = onSettingsClick
            )
            HorizontalDivider()
            SettingsMenuItem(
                icon = Icons.Default.Schedule,
                title = "Horários",
                onClick = onSchedulesClick
            )
            HorizontalDivider()
            SettingsMenuItem(
                icon = Icons.Default.Info,
                title = "Sobre",
                onClick = onAboutClick
            )
        }
    }
}

/**
 * Seção de Feedback para reportar problemas
 */
@Composable
private fun FeedbackSection() {
    val context = LocalContext.current

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)  // Sem sombra para scroll suave
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = stringResource(R.string.feedback_section),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )

            SettingsMenuItem(
                icon = Icons.Default.BugReport,
                title = stringResource(R.string.report_problem),
                onClick = {
                    val appVersion = BuildConfig.VERSION_NAME
                    val androidVersion = Build.VERSION.RELEASE
                    val deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}"

                    val subject = context.getString(R.string.report_problem_email_subject, appVersion)
                    val body = context.getString(
                        R.string.report_problem_email_body,
                        appVersion,
                        androidVersion,
                        deviceModel
                    )

                    val intent = Intent(Intent.ACTION_SENDTO).apply {
                        data = Uri.parse("mailto:")
                        putExtra(Intent.EXTRA_EMAIL, arrayOf("suporte@futebadosparcas.com"))
                        putExtra(Intent.EXTRA_SUBJECT, subject)
                        putExtra(Intent.EXTRA_TEXT, body)
                    }

                    try {
                        context.startActivity(Intent.createChooser(intent, context.getString(R.string.report_problem)))
                    } catch (e: Exception) {
                        Toast.makeText(
                            context,
                            context.getString(R.string.report_problem_no_email_app),
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            )
        }
    }
}

/**
 * Seção administrativa
 */
@Composable
private fun AdminSection(
    isAdmin: Boolean,
    isFieldOwner: Boolean,
    myLocationsCount: Int,
    onUserManagementClick: () -> Unit,
    onMyLocationsClick: () -> Unit,
    onManageLocationsClick: () -> Unit,
    onGamificationSettingsClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer
        )
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = stringResource(R.string.administration_section),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onErrorContainer,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )

            if (isAdmin) {
                AdminMenuItem(
                    icon = Icons.Default.People,
                    title = "Gerenciar Usuários",
                    onClick = onUserManagementClick
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.onErrorContainer.copy(alpha = 0.2f))
            }

            if (isFieldOwner) {
                AdminMenuItem(
                    icon = Icons.Default.Place,
                    title = "Meus Locais",
                    subtitle = when (myLocationsCount) {
                        0 -> "Nenhum local cadastrado"
                        1 -> "1 local cadastrado"
                        else -> "$myLocationsCount locais cadastrados"
                    },
                    onClick = onMyLocationsClick
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.onErrorContainer.copy(alpha = 0.2f))
            }

            if (isAdmin) {
                AdminMenuItem(
                    icon = Icons.Default.AdminPanelSettings,
                    title = "Configurações da Liga",
                    onClick = onGamificationSettingsClick
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.onErrorContainer.copy(alpha = 0.2f))

                AdminMenuItem(
                    icon = Icons.Default.LocationOn,
                    title = "Gerenciar Locais",
                    onClick = onManageLocationsClick
                )
            }
        }
    }
}

/**
 * Item de menu de configurações
 */
@Composable
private fun SettingsMenuItem(
    icon: ImageVector,
    title: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = title,
            modifier = Modifier.size(24.dp),
            tint = MaterialTheme.colorScheme.onSurface
        )
        Spacer(modifier = Modifier.width(16.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f)
        )
        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = "Acessar $title",
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Item de menu administrativo
 */
@Composable
private fun AdminMenuItem(
    icon: ImageVector,
    title: String,
    subtitle: String? = null,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = title,
            modifier = Modifier.size(24.dp),
            tint = MaterialTheme.colorScheme.onErrorContainer
        )
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onErrorContainer
            )
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onErrorContainer.copy(alpha = 0.7f)
                )
            }
        }
        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = "Acessar $title",
            tint = MaterialTheme.colorScheme.onErrorContainer
        )
    }
}

/**
 * Card do Developer Menu
 */
@Composable
private fun DeveloperMenuCard(onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.tertiaryContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Code,
                contentDescription = "Developer Menu",
                modifier = Modifier.size(24.dp),
                tint = MaterialTheme.colorScheme.onTertiaryContainer
            )
            Spacer(modifier = Modifier.width(16.dp))
            Text(
                text = stringResource(R.string.developer_menu),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onTertiaryContainer,
                modifier = Modifier.weight(1f)
            )
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = "Acessar Developer Menu",
                tint = MaterialTheme.colorScheme.onTertiaryContainer
            )
        }
    }
}

/**
 * Estado de erro
 */
@Composable
private fun ErrorState(
    message: String,
    onRetry: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Error,
            contentDescription = "Erro ao carregar perfil",
            modifier = Modifier.size(56.dp),
            tint = MaterialTheme.colorScheme.error
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onRetry) {
            Icon(
                imageVector = Icons.Default.Refresh,
                contentDescription = stringResource(R.string.retry),
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(stringResource(R.string.retry))
        }
    }
}

/**
 * Shimmer de loading
 */
@Composable
private fun ProfileLoadingShimmer() {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Header shimmer
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    ShimmerBox(
                        modifier = Modifier.size(120.dp),
                        cornerRadius = 60.dp
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    ShimmerBox(
                        modifier = Modifier
                            .width(200.dp)
                            .height(24.dp),
                        cornerRadius = 4.dp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    ShimmerBox(
                        modifier = Modifier
                            .width(150.dp)
                            .height(16.dp),
                        cornerRadius = 4.dp
                    )
                }
            }
        }

        // Card shimmers
        items(4) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    ShimmerBox(
                        modifier = Modifier
                            .width(150.dp)
                            .height(20.dp),
                        cornerRadius = 4.dp
                    )
                    ShimmerBox(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(80.dp),
                        cornerRadius = 8.dp
                    )
                }
            }
        }
    }
}

/**
 * Função auxiliar para obter iniciais do nome
 */
private fun getInitials(name: String): String {
    val parts = name.trim().split(" ")
    return when {
        parts.size >= 2 -> "${parts.first().first()}${parts.last().first()}".uppercase()
        parts.isNotEmpty() -> parts.first().take(2).uppercase()
        else -> "??"
    }
}
