package com.futebadosparcas.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.futebadosparcas.firebase.FirebaseManager
import com.futebadosparcas.ui.theme.GamificationColors
import com.futebadosparcas.ui.components.WebIcons
import com.futebadosparcas.ui.components.WebIcon
import com.futebadosparcas.ui.components.WebIconBadge
import kotlinx.coroutines.launch

private data class UserProfile(
    val id: String = "",
    val email: String = "",
    val name: String = "",
    val nickname: String? = null,
    val role: String = "PLAYER",
    val level: Int = 1,
    val experiencePoints: Long = 0L,
    val strikerRating: Double = 0.0,
    val midRating: Double = 0.0,
    val defenderRating: Double = 0.0,
    val gkRating: Double = 0.0,
    val preferredFieldTypes: List<String> = emptyList(),
    val preferredPosition: String? = null,
    val totalGames: Int = 0,
    val totalGoals: Int = 0,
    val totalAssists: Int = 0,
    val totalWins: Int = 0,
    val totalDraws: Int = 0,
    val totalSaves: Int = 0,
    val mvpCount: Int = 0,
    val yellowCards: Int = 0,
    val redCards: Int = 0
)

private data class Badge(
    val badgeId: String,
    val unlockedAt: Long,
    val count: Int
)

private sealed class ProfileUiState {
    object Loading : ProfileUiState()
    data class Success(val profile: UserProfile, val badges: List<Badge>) : ProfileUiState()
    data class Error(val message: String) : ProfileUiState()
}

@Composable
fun ProfileTab(
    onLogoutClick: () -> Unit = {},
    onNavigateToLevelJourney: () -> Unit = {},
    onNavigateToBadges: () -> Unit = {},
    onNavigateToXpHistory: () -> Unit = {},
    onNavigateToSettings: () -> Unit = {},
    onNavigateToDeveloperTools: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    var uiState by remember { mutableStateOf<ProfileUiState>(ProfileUiState.Loading) }

    LaunchedEffect(Unit) {
        scope.launch {
            try {
                val profileData = FirebaseManager.getCurrentUserProfile()
                val badgesData = FirebaseManager.getUserBadges()

                if (profileData != null) {
                    val profile = UserProfile(
                        id = profileData["id"] as? String ?: "",
                        email = profileData["email"] as? String ?: "",
                        name = profileData["name"] as? String ?: "",
                        nickname = profileData["nickname"] as? String,
                        role = profileData["role"] as? String ?: "PLAYER",
                        level = (profileData["level"] as? Number)?.toInt() ?: 1,
                        experiencePoints = (profileData["experiencePoints"] as? Number)?.toLong() ?: 0L,
                        strikerRating = (profileData["strikerRating"] as? Number)?.toDouble() ?: 0.0,
                        midRating = (profileData["midRating"] as? Number)?.toDouble() ?: 0.0,
                        defenderRating = (profileData["defenderRating"] as? Number)?.toDouble() ?: 0.0,
                        gkRating = (profileData["gkRating"] as? Number)?.toDouble() ?: 0.0,
                        preferredFieldTypes = (profileData["preferredFieldTypes"] as? List<*>)?.filterIsInstance<String>() ?: emptyList(),
                        preferredPosition = profileData["preferredPosition"] as? String,
                        totalGames = (profileData["totalGames"] as? Number)?.toInt() ?: 0,
                        totalGoals = (profileData["totalGoals"] as? Number)?.toInt() ?: 0,
                        totalAssists = (profileData["totalAssists"] as? Number)?.toInt() ?: 0,
                        totalWins = (profileData["totalWins"] as? Number)?.toInt() ?: 0,
                        totalDraws = (profileData["totalDraws"] as? Number)?.toInt() ?: 0,
                        totalSaves = (profileData["totalSaves"] as? Number)?.toInt() ?: 0,
                        mvpCount = (profileData["mvpCount"] as? Number)?.toInt() ?: 0,
                        yellowCards = (profileData["yellowCards"] as? Number)?.toInt() ?: 0,
                        redCards = (profileData["redCards"] as? Number)?.toInt() ?: 0
                    )

                    val badges = badgesData.map { data ->
                        Badge(
                            badgeId = data["badgeId"] as? String ?: "",
                            unlockedAt = data["unlockedAt"] as? Long ?: 0L,
                            count = data["count"] as? Int ?: 1
                        )
                    }

                    uiState = ProfileUiState.Success(profile, badges)
                } else {
                    uiState = ProfileUiState.Error("Não foi possível carregar o perfil")
                }
            } catch (e: Exception) {
                uiState = ProfileUiState.Error(e.message ?: "Erro ao carregar perfil")
            }
        }
    }

    when (val state = uiState) {
        is ProfileUiState.Loading -> ProfileLoadingShimmer()
        is ProfileUiState.Success -> ProfileContent(
            profile = state.profile,
            badges = state.badges,
            onLogoutClick = onLogoutClick,
            onNavigateToLevelJourney = onNavigateToLevelJourney,
            onNavigateToBadges = onNavigateToBadges,
            onNavigateToXpHistory = onNavigateToXpHistory,
            onNavigateToSettings = onNavigateToSettings,
            onNavigateToDeveloperTools = onNavigateToDeveloperTools
        )
        is ProfileUiState.Error -> ProfileErrorState(
            message = state.message,
            onRetry = { uiState = ProfileUiState.Loading }
        )
    }
}

@Composable
private fun ProfileContent(
    profile: UserProfile,
    badges: List<Badge>,
    onLogoutClick: () -> Unit,
    onNavigateToLevelJourney: () -> Unit,
    onNavigateToBadges: () -> Unit,
    onNavigateToXpHistory: () -> Unit,
    onNavigateToSettings: () -> Unit,
    onNavigateToDeveloperTools: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item(key = "header") {
            ProfileHeader(profile = profile)
        }

        item(key = "level") {
            LevelCard(
                level = profile.level,
                experiencePoints = profile.experiencePoints,
                onClick = onNavigateToLevelJourney
            )
        }

        item(key = "gamification_actions") {
            GamificationActionsSection(
                onXpHistoryClick = onNavigateToXpHistory,
                onBadgesClick = onNavigateToBadges
            )
        }

        item(key = "field_prefs") {
            FieldPreferencesCard(preferredTypes = profile.preferredFieldTypes)
        }

        item(key = "ratings") {
            RatingsCard(profile = profile)
        }

        item(key = "statistics") {
            StatisticsCard(profile = profile)
        }

        if (badges.isNotEmpty()) {
            item(key = "badges") {
                BadgesSection(
                    badges = badges,
                    onClick = onNavigateToBadges
                )
            }
        }

        item(key = "actions") {
            ActionButtonsSection(onLogoutClick = onLogoutClick)
        }

        item(key = "settings") {
            SettingsSection(
                onSettingsClick = onNavigateToSettings,
                onDeveloperToolsClick = onNavigateToDeveloperTools
            )
        }

        item(key = "spacer") {
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun ProfileHeader(profile: UserProfile) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(8.dp, RoundedCornerShape(24.dp)),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f),
                            MaterialTheme.colorScheme.surface
                        ),
                        start = Offset(0f, 0f),
                        end = Offset(0f, 400f)
                    )
                )
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            AnimatedVisibility(
                visible = true,
                enter = fadeIn(animationSpec = tween(500)) + scaleIn(
                    animationSpec = spring(stiffness = Spring.StiffnessMediumLow),
                    initialScale = 0.8f
                )
            ) {
                Box(
                    modifier = Modifier.size(130.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(130.dp)
                            .shadow(12.dp, CircleShape)
                            .background(
                                Brush.linearGradient(
                                    colors = listOf(
                                        MaterialTheme.colorScheme.primary,
                                        MaterialTheme.colorScheme.secondary.copy(alpha = 0.7f)
                                    ),
                                    start = Offset(0f, 0f),
                                    end = Offset(130f, 130f)
                                ),
                                CircleShape
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = getInitials(profile.name),
                            style = MaterialTheme.typography.headlineLarge,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 42.sp
                        )
                    }

                    Surface(
                        modifier = Modifier.align(Alignment.BottomEnd),
                        shape = CircleShape,
                        shadowElevation = 4.dp,
                        tonalElevation = 0.dp,
                        color = getLevelColor(profile.level)
                    ) {
                        Box(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "${profile.level}",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            Text(
                text = profile.name,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            profile.nickname?.let { nick ->
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "\"$nick\"",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                WebIcon(
                    icon = WebIcons.Email,
                    size = 16.dp,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = profile.email,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            if (profile.role == "ADMIN" || profile.role == "FIELD_OWNER") {
                Spacer(modifier = Modifier.height(12.dp))
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = if (profile.role == "ADMIN") {
                        GamificationColors.LevelUpGold
                    } else {
                        MaterialTheme.colorScheme.secondary
                    },
                    shadowElevation = 4.dp
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (profile.role == "ADMIN") WebIcons.Star else WebIcons.Trophy,
                            fontSize = 18.sp,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (profile.role == "ADMIN") "Administrador" else "Organizador",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun LevelCard(level: Int, experiencePoints: Long, onClick: () -> Unit = {}) {
    val xpForLevel = level * 200L
    val currentLevelXP = experiencePoints % 200
    val progress = if (xpForLevel > 0) (currentLevelXP.toFloat() / 200f) else 0f
    val levelTitle = getLevelTitle(level)
    val levelColor = getLevelColor(level)

    Card(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .shadow(6.dp, RoundedCornerShape(20.dp)),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            levelColor.copy(alpha = 0.15f),
                            MaterialTheme.colorScheme.surface
                        ),
                        start = Offset(0f, 0f),
                        end = Offset(0f, 200f)
                    )
                )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = levelColor,
                                modifier = Modifier.size(48.dp)
                            ) {
                                Box(
                                    contentAlignment = Alignment.Center,
                                    modifier = Modifier.fillMaxSize()
                                ) {
                                    Text(
                                        text = "$level",
                                        style = MaterialTheme.typography.titleLarge,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = "Nível $level",
                                        style = MaterialTheme.typography.titleLarge,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    WebIcon(
                                        icon = WebIcons.ChevronRight,
                                        size = 20.dp,
                                        tint = levelColor.copy(alpha = 0.6f)
                                    )
                                }
                                Text(
                                    text = levelTitle,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Medium,
                                    color = levelColor
                                )
                            }
                        }
                    }

                    Text(
                        text = getLevelEmoji(level),
                        style = MaterialTheme.typography.displayMedium,
                        fontSize = 40.sp
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                LinearProgressIndicator(
                    progress = { progress.coerceIn(0f, 1f) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(10.dp)
                        .clip(RoundedCornerShape(5.dp)),
                    color = levelColor,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                )

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "$currentLevelXP / 200 XP",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = "${(progress * 100).toInt()}%",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        color = levelColor
                    )
                }
            }
        }
    }
}

@Composable
private fun GamificationActionsSection(
    onXpHistoryClick: () -> Unit,
    onBadgesClick: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        GamificationActionCard(
            modifier = Modifier.weight(1f),
            emoji = "📊",
            title = "Histórico XP",
            onClick = onXpHistoryClick,
            accentColor = MaterialTheme.colorScheme.primary
        )
        GamificationActionCard(
            modifier = Modifier.weight(1f),
            emoji = "🏅",
            title = "Badges",
            onClick = onBadgesClick,
            accentColor = GamificationColors.Gold
        )
    }
}

@Composable
private fun GamificationActionCard(
    modifier: Modifier = Modifier,
    emoji: String,
    title: String,
    onClick: () -> Unit,
    accentColor: Color
) {
    Card(
        onClick = onClick,
        modifier = modifier.shadow(4.dp, RoundedCornerShape(16.dp)),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            accentColor.copy(alpha = 0.1f),
                            MaterialTheme.colorScheme.surface
                        )
                    )
                )
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = accentColor.copy(alpha = 0.15f),
                    modifier = Modifier.size(40.dp)
                ) {
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier.size(40.dp)
                    ) {
                        Text(
                            text = emoji,
                            style = MaterialTheme.typography.titleMedium,
                            fontSize = 20.sp
                        )
                    }
                }
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.width(4.dp))
                WebIcon(
                    icon = WebIcons.ChevronRight,
                    size = 18.dp,
                    tint = accentColor.copy(alpha = 0.6f)
                )
            }
        }
    }
}

@Composable
private fun FieldPreferencesCard(preferredTypes: List<String>) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(4.dp, RoundedCornerShape(20.dp)),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                WebIconBadge(
                    icon = WebIcons.SportsSoccer,
                    size = 36.dp,
                    iconSize = 20.dp,
                    backgroundColor = GamificationColors.XpGreen.copy(alpha = 0.15f),
                    iconTint = GamificationColors.XpGreen
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = "Preferências de Campo",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                FieldTypeIcon(
                    type = "SOCIETY",
                    isEnabled = preferredTypes.contains("SOCIETY"),
                    emoji = "⚽",
                    label = "Society"
                )
                FieldTypeIcon(
                    type = "FUTSAL",
                    isEnabled = preferredTypes.contains("FUTSAL"),
                    emoji = "🥅",
                    label = "Futsal"
                )
                FieldTypeIcon(
                    type = "CAMPO",
                    isEnabled = preferredTypes.contains("CAMPO"),
                    emoji = "🌿",
                    label = "Campo"
                )
            }
        }
    }
}

@Composable
private fun FieldTypeIcon(
    type: String,
    isEnabled: Boolean,
    emoji: String,
    label: String
) {
    val bgColor = if (isEnabled) {
        MaterialTheme.colorScheme.primaryContainer
    } else {
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
    }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.alpha(if (isEnabled) 1f else 0.4f)
    ) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = bgColor,
            modifier = Modifier.size(64.dp),
            shadowElevation = if (isEnabled) 4.dp else 0.dp
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.fillMaxSize()
            ) {
                Text(
                    text = emoji,
                    style = MaterialTheme.typography.headlineMedium,
                    fontSize = 28.sp
                )
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = if (isEnabled) FontWeight.SemiBold else FontWeight.Normal,
            color = if (isEnabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun RatingsCard(profile: UserProfile) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(4.dp, RoundedCornerShape(20.dp)),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                WebIconBadge(
                    icon = WebIcons.StarRate,
                    size = 36.dp,
                    iconSize = 20.dp,
                    backgroundColor = MaterialTheme.colorScheme.primaryContainer,
                    iconTint = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = "Ratings por Posição",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            RatingItem("⚽ Atacante", profile.strikerRating, GamificationColors.Gold)
            Spacer(modifier = Modifier.height(12.dp))
            RatingItem("🏃 Meia", profile.midRating, MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.height(12.dp))
            RatingItem("🛡️ Zagueiro", profile.defenderRating, MaterialTheme.colorScheme.secondary)
            Spacer(modifier = Modifier.height(12.dp))
            RatingItem("🧤 Goleiro", profile.gkRating, GamificationColors.Bronze)
        }
    }
}

@Composable
private fun RatingItem(label: String, rating: Double, accentColor: Color) {
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

            Surface(
                shape = RoundedCornerShape(8.dp),
                color = accentColor.copy(alpha = 0.15f)
            ) {
                Text(
                    text = "${(rating * 10).toInt() / 10.0}",
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = accentColor
                )
            }
        }

        Spacer(modifier = Modifier.height(6.dp))

        LinearProgressIndicator(
            progress = { (rating.toFloat() / 5f).coerceIn(0f, 1f) },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp)),
            color = accentColor,
            trackColor = MaterialTheme.colorScheme.surfaceVariant,
        )
    }
}

@Composable
private fun StatisticsCard(profile: UserProfile) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(4.dp, RoundedCornerShape(20.dp)),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                WebIconBadge(
                    icon = WebIcons.QueryStats,
                    size = 36.dp,
                    iconSize = 20.dp,
                    backgroundColor = MaterialTheme.colorScheme.secondaryContainer,
                    iconTint = MaterialTheme.colorScheme.secondary
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = "Estatísticas",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    StatItem(value = profile.totalGames.toString(), label = "Jogos", color = MaterialTheme.colorScheme.primary)
                    StatItem(value = profile.totalGoals.toString(), label = "Gols", color = GamificationColors.Gold)
                    StatItem(value = profile.totalWins.toString(), label = "Vitórias", color = GamificationColors.XpGreen)
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    StatItem(value = profile.totalAssists.toString(), label = "Assists", color = MaterialTheme.colorScheme.secondary)
                    StatItem(value = profile.totalDraws.toString(), label = "Empates", color = MaterialTheme.colorScheme.tertiary)
                    StatItem(value = profile.mvpCount.toString(), label = "MVPs", color = GamificationColors.Gold)
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    StatItem(value = profile.totalSaves.toString(), label = "Defesas", color = GamificationColors.Bronze)
                    StatItem(value = "${profile.yellowCards + profile.redCards}", label = "Cartões", color = MaterialTheme.colorScheme.error)
                    StatItem(
                        value = if (profile.totalGames > 0) {
                            val avg = profile.totalGoals.toDouble() / profile.totalGames
                            "${(avg * 10).toInt() / 10.0}"
                        } else "0.0",
                        label = "Média Gols",
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }
}

@Composable
private fun RowScope.StatItem(value: String, label: String, color: Color = MaterialTheme.colorScheme.primary) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.weight(1f)
    ) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = color.copy(alpha = 0.12f)
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = color,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
            )
        }
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun BadgesSection(badges: List<Badge>, onClick: () -> Unit = {}) {
    Card(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .shadow(4.dp, RoundedCornerShape(20.dp)),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = GamificationColors.Gold.copy(alpha = 0.15f),
                        modifier = Modifier.size(36.dp)
                    ) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier.fillMaxSize()
                        ) {
                            Text(
                                text = "🏅",
                                fontSize = 18.sp
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = "Badges Recentes",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Ver todas",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.primary
                    )
                    WebIcon(
                        icon = WebIcons.ChevronRight,
                        size = 16.dp,
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(badges.take(5), key = { it.badgeId }) { badge ->
                    BadgeItem(badge = badge)
                }
            }
        }
    }
}

@Composable
private fun BadgeItem(badge: Badge) {
    val (emoji, bgColor) = when (badge.badgeId) {
        "FIRST_GOAL" -> "⚽" to GamificationColors.Gold
        "STREAK_7" -> "🔥" to MaterialTheme.colorScheme.secondary
        "MVP_5" -> "🏆" to GamificationColors.Gold
        "HAT_TRICK" -> "🎩" to GamificationColors.Purple
        "PAREDAO" -> "🧱" to MaterialTheme.colorScheme.primary
        else -> "🏅" to MaterialTheme.colorScheme.surfaceVariant
    }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(80.dp)
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(64.dp)
                .shadow(6.dp, CircleShape)
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            bgColor,
                            bgColor.copy(alpha = 0.7f)
                        )
                    ),
                    CircleShape
                )
        ) {
            Text(
                text = emoji,
                style = MaterialTheme.typography.headlineMedium,
                fontSize = 28.sp
            )

            if (badge.count > 1) {
                Surface(
                    modifier = Modifier.align(Alignment.TopEnd),
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.error,
                    shadowElevation = 2.dp
                ) {
                    Text(
                        text = badge.count.toString(),
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 10.sp
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = badge.badgeId.replace("_", " ").lowercase().replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun ActionButtonsSection(onLogoutClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Button(
            onClick = { },
            modifier = Modifier
                .weight(1f)
                .height(52.dp)
                .shadow(4.dp, RoundedCornerShape(16.dp)),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary
            )
        ) {
            WebIcon(
                icon = WebIcons.Edit,
                size = 20.dp,
                tint = MaterialTheme.colorScheme.onPrimary
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                "Editar Perfil",
                fontWeight = FontWeight.SemiBold
            )
        }

        OutlinedButton(
            onClick = onLogoutClick,
            modifier = Modifier
                .weight(1f)
                .height(52.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = MaterialTheme.colorScheme.error
            ),
            border = androidx.compose.foundation.BorderStroke(1.5.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.5f))
        ) {
            WebIcon(
                icon = WebIcons.Logout,
                size = 20.dp,
                tint = MaterialTheme.colorScheme.error
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                "Sair",
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
private fun SettingsSection(
    onSettingsClick: () -> Unit = {},
    onDeveloperToolsClick: () -> Unit = {}
) {
    val devModeEnabled = remember { jsGetDevModeEnabled() }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(4.dp, RoundedCornerShape(20.dp)),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            SettingsMenuItem(
                icon = WebIcons.Notifications,
                iconBgColor = MaterialTheme.colorScheme.errorContainer,
                iconTint = MaterialTheme.colorScheme.error,
                title = "Notificações",
                onClick = {}
            )
            HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
            SettingsMenuItem(
                icon = WebIcons.Settings,
                iconBgColor = MaterialTheme.colorScheme.primaryContainer,
                iconTint = MaterialTheme.colorScheme.primary,
                title = "Configurações",
                onClick = onSettingsClick
            )
            HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
            SettingsMenuItem(
                icon = WebIcons.CalendarMonth,
                iconBgColor = MaterialTheme.colorScheme.secondaryContainer,
                iconTint = MaterialTheme.colorScheme.secondary,
                title = "Agenda",
                onClick = {}
            )
            HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
            SettingsMenuItem(
                icon = WebIcons.Info,
                iconBgColor = MaterialTheme.colorScheme.tertiaryContainer,
                iconTint = MaterialTheme.colorScheme.tertiary,
                title = "Sobre",
                onClick = {}
            )

            if (devModeEnabled) {
                HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
                SettingsMenuItem(
                    icon = WebIcons.Build,
                    iconBgColor = MaterialTheme.colorScheme.errorContainer,
                    iconTint = MaterialTheme.colorScheme.error,
                    title = "Developer Tools",
                    onClick = onDeveloperToolsClick,
                    titleColor = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
private fun SettingsMenuItem(
    icon: String,
    iconBgColor: Color,
    iconTint: Color,
    title: String,
    onClick: () -> Unit,
    titleColor: Color = MaterialTheme.colorScheme.onSurface
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        WebIconBadge(
            icon = icon,
            size = 40.dp,
            iconSize = 22.dp,
            backgroundColor = iconBgColor,
            iconTint = iconTint
        )
        Spacer(modifier = Modifier.width(16.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Medium,
            color = titleColor,
            modifier = Modifier.weight(1f)
        )
        WebIcon(
            icon = WebIcons.ChevronRight,
            size = 20.dp,
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
        )
    }
}

@Composable
private fun ProfileLoadingShimmer() {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(4.dp, RoundedCornerShape(20.dp)),
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
                            .size(130.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.linearGradient(
                                    colors = listOf(
                                        MaterialTheme.colorScheme.surfaceVariant,
                                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                                    )
                                )
                            )
                    )
                    Spacer(modifier = Modifier.height(20.dp))
                    Box(
                        modifier = Modifier
                            .width(200.dp)
                            .height(28.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Box(
                        modifier = Modifier
                            .width(150.dp)
                            .height(18.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f))
                    )
                }
            }
        }

        items(4) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(4.dp, RoundedCornerShape(20.dp)),
                shape = RoundedCornerShape(20.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .width(150.dp)
                            .height(22.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(90.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                    )
                }
            }
        }
    }
}

@Composable
private fun ProfileErrorState(message: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.errorContainer,
            modifier = Modifier.size(100.dp)
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.size(100.dp)
            ) {
                WebIcon(
                    icon = WebIcons.ErrorOutline,
                    size = 48.dp,
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
        Spacer(modifier = Modifier.height(20.dp))
        Text(
            text = "Ops! Algo deu errado",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(28.dp))
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary
            ),
            modifier = Modifier
                .height(52.dp)
                .shadow(4.dp, RoundedCornerShape(16.dp))
        ) {
            WebIcon(
                icon = WebIcons.Refresh,
                size = 20.dp,
                tint = MaterialTheme.colorScheme.onPrimary
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                "Tentar novamente",
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

private fun getInitials(name: String): String {
    val parts = name.trim().split(" ")
    return when {
        parts.size >= 2 -> "${parts.first().first()}${parts.last().first()}".uppercase()
        parts.isNotEmpty() -> parts.first().take(2).uppercase()
        else -> "??"
    }
}

@Composable
private fun getLevelColor(level: Int): Color {
    return when {
        level >= 50 -> GamificationColors.Gold
        level >= 30 -> GamificationColors.Purple
        level >= 20 -> MaterialTheme.colorScheme.secondary
        level >= 10 -> GamificationColors.XpGreen
        else -> MaterialTheme.colorScheme.primary
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
