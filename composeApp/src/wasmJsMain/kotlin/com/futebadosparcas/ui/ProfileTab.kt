package com.futebadosparcas.ui

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.futebadosparcas.firebase.FirebaseManager
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
            Box(
                modifier = Modifier.size(120.dp),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(120.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = getInitials(profile.name),
                        style = MaterialTheme.typography.headlineLarge,
                        color = MaterialTheme.colorScheme.onPrimary,
                        fontWeight = FontWeight.Bold
                    )
                }

                Surface(
                    modifier = Modifier.align(Alignment.BottomEnd),
                    shape = CircleShape,
                    color = getLevelColor(profile.level)
                ) {
                    Text(
                        text = "${profile.level}",
                        modifier = Modifier.padding(8.dp),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = profile.name,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            profile.nickname?.let { nick ->
                Text(
                    text = "\"$nick\"",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = profile.email,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            if (profile.role == "ADMIN" || profile.role == "FIELD_OWNER") {
                Spacer(modifier = Modifier.height(8.dp))
                Surface(
                    shape = MaterialTheme.shapes.small,
                    color = if (profile.role == "ADMIN") {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.secondary
                    }
                ) {
                    Text(
                        text = if (profile.role == "ADMIN") "Administrador" else "Organizador",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        style = MaterialTheme.typography.labelMedium,
                        color = if (profile.role == "ADMIN") {
                            MaterialTheme.colorScheme.onError
                        } else {
                            MaterialTheme.colorScheme.onSecondary
                        }
                    )
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

    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
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
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "Nível $level",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "›",
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.5f)
                        )
                    }
                    Text(
                        text = levelTitle,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    )
                }

                Text(
                    text = getLevelEmoji(level),
                    style = MaterialTheme.typography.displayMedium
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            LinearProgressIndicator(
                progress = { progress.coerceIn(0f, 1f) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
                color = Color(0xFF4CAF50),
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "$currentLevelXP / 200 XP",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Text(
                    text = "${(progress * 100).toInt()}%",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
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
            onClick = onXpHistoryClick
        )
        GamificationActionCard(
            modifier = Modifier.weight(1f),
            emoji = "🏅",
            title = "Badges",
            onClick = onBadgesClick
        )
    }
}

@Composable
private fun GamificationActionCard(
    modifier: Modifier = Modifier,
    emoji: String,
    title: String,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Text(
                text = emoji,
                style = MaterialTheme.typography.headlineSmall
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSecondaryContainer
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = "›",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.5f)
            )
        }
    }
}

@Composable
private fun FieldPreferencesCard(preferredTypes: List<String>) {
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
                text = "Preferências de Campo",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

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
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.alpha(if (isEnabled) 1f else 0.3f)
    ) {
        Text(
            text = emoji,
            style = MaterialTheme.typography.displaySmall
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

@Composable
private fun RatingsCard(profile: UserProfile) {
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
                text = "Ratings por Posição",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(16.dp))

            RatingItem("⚽ Atacante", profile.strikerRating)
            Spacer(modifier = Modifier.height(12.dp))
            RatingItem("🏃 Meia", profile.midRating)
            Spacer(modifier = Modifier.height(12.dp))
            RatingItem("🛡️ Zagueiro", profile.defenderRating)
            Spacer(modifier = Modifier.height(12.dp))
            RatingItem("🧤 Goleiro", profile.gkRating)
        }
    }
}

@Composable
private fun RatingItem(label: String, rating: Double) {
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
                text = "${(rating * 10).toInt() / 10.0}", // Formato manual para wasmJs
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

@Composable
private fun StatisticsCard(profile: UserProfile) {
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
                text = "Estatísticas",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(16.dp))

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    StatItem(value = profile.totalGames.toString(), label = "Jogos")
                    StatItem(value = profile.totalGoals.toString(), label = "Gols")
                    StatItem(value = profile.totalWins.toString(), label = "Vitórias")
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    StatItem(value = profile.totalAssists.toString(), label = "Assists")
                    StatItem(value = profile.totalDraws.toString(), label = "Empates")
                    StatItem(value = profile.mvpCount.toString(), label = "MVPs")
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    StatItem(value = profile.totalSaves.toString(), label = "Defesas")
                    StatItem(value = "${profile.yellowCards + profile.redCards}", label = "Cartões")
                    StatItem(
                        value = if (profile.totalGames > 0) {
                            val avg = profile.totalGoals.toDouble() / profile.totalGames
                            "${(avg * 10).toInt() / 10.0}" // Formato manual para wasmJs
                        } else "0.0",
                        label = "Média Gols"
                    )
                }
            }
        }
    }
}

@Composable
private fun RowScope.StatItem(value: String, label: String) {
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

@Composable
private fun BadgesSection(badges: List<Badge>, onClick: () -> Unit = {}) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
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
                Text(
                    text = "Badges Recentes",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Ver todas ›",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

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
        "FIRST_GOAL" -> "⚽" to Color(0xFFFFD700)
        "STREAK_7" -> "🔥" to MaterialTheme.colorScheme.secondary
        "MVP_5" -> "🏆" to Color(0xFFFFD700)
        "HAT_TRICK" -> "🎩" to Color(0xFFFFD700)
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
                .size(60.dp)
                .clip(CircleShape)
                .background(bgColor.copy(alpha = 0.2f))
        ) {
            Text(
                text = emoji,
                style = MaterialTheme.typography.headlineMedium
            )

            if (badge.count > 1) {
                Surface(
                    modifier = Modifier.align(Alignment.TopEnd),
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.error
                ) {
                    Text(
                        text = badge.count.toString(),
                        modifier = Modifier.padding(4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onError,
                        fontSize = 10.sp
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = badge.badgeId.replace("_", " ").lowercase().replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.labelSmall,
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
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text("✏️")
            Spacer(modifier = Modifier.width(8.dp))
            Text("Editar Perfil")
        }

        OutlinedButton(
            onClick = onLogoutClick,
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text("🚪")
            Spacer(modifier = Modifier.width(8.dp))
            Text("Sair")
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
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            SettingsMenuItem(emoji = "🔔", title = "Notificações", onClick = {})
            HorizontalDivider()
            SettingsMenuItem(emoji = "⚙️", title = "Configurações", onClick = onSettingsClick)
            HorizontalDivider()
            SettingsMenuItem(emoji = "📅", title = "Agenda", onClick = {})
            HorizontalDivider()
            SettingsMenuItem(emoji = "ℹ️", title = "Sobre", onClick = {})
            
            if (devModeEnabled) {
                HorizontalDivider()
                SettingsMenuItem(
                    emoji = "🔧", 
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
    emoji: String, 
    title: String, 
    onClick: () -> Unit,
    titleColor: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onSurface
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = emoji,
            style = MaterialTheme.typography.titleMedium
        )
        Spacer(modifier = Modifier.width(16.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.bodyLarge,
            color = titleColor,
            modifier = Modifier.weight(1f)
        )
        Text(
            text = "›",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
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
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
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
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Box(
                        modifier = Modifier
                            .width(200.dp)
                            .height(24.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Box(
                        modifier = Modifier
                            .width(150.dp)
                            .height(16.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                    )
                }
            }
        }

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
                    Box(
                        modifier = Modifier
                            .width(150.dp)
                            .height(20.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(80.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
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
        Text(
            text = "❌",
            style = MaterialTheme.typography.displayLarge
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
            Text("🔄")
            Spacer(modifier = Modifier.width(8.dp))
            Text("Tentar novamente")
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
        level >= 50 -> Color(0xFFFFD700)
        level >= 30 -> Color(0xFF9C27B0)
        level >= 20 -> Color(0xFF2196F3)
        level >= 10 -> Color(0xFF4CAF50)
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
