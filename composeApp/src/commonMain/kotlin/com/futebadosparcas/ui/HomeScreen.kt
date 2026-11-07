package com.futebadosparcas.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Group as FilledGroup
import androidx.compose.material.icons.filled.Home as FilledHome
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.NewReleases
import androidx.compose.material.icons.filled.Person as FilledPerson
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.SportsSoccer as FilledSportsSoccer
import androidx.compose.material.icons.outlined.Group as OutlinedGroup
import androidx.compose.material.icons.outlined.Home as OutlinedHome
import androidx.compose.material.icons.outlined.Person as OutlinedPerson
import androidx.compose.material.icons.outlined.SportsSoccer as OutlinedSportsSoccer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.app_name
import com.futebadosparcas.compose.resources.cd_whats_new
import com.futebadosparcas.compose.resources.home_action_games
import com.futebadosparcas.compose.resources.home_action_groups
import com.futebadosparcas.compose.resources.home_action_profile
import com.futebadosparcas.compose.resources.home_action_whats_new
import com.futebadosparcas.compose.resources.home_matchday_body
import com.futebadosparcas.compose.resources.home_matchday_content_description
import com.futebadosparcas.compose.resources.home_matchday_title
import com.futebadosparcas.compose.resources.home_section_matchday
import com.futebadosparcas.compose.resources.home_section_quick_actions
import com.futebadosparcas.compose.resources.home_section_tools
import com.futebadosparcas.compose.resources.home_status_live
import com.futebadosparcas.compose.resources.home_status_personal
import com.futebadosparcas.compose.resources.home_status_updated
import com.futebadosparcas.compose.resources.home_subtitle
import com.futebadosparcas.compose.resources.home_tools_games_body
import com.futebadosparcas.compose.resources.home_tools_games_title
import com.futebadosparcas.compose.resources.home_tools_groups_body
import com.futebadosparcas.compose.resources.home_tools_groups_title
import com.futebadosparcas.compose.resources.home_tools_profile_body
import com.futebadosparcas.compose.resources.home_tools_profile_title
import com.futebadosparcas.compose.resources.home_tool_summary_content_description
import com.futebadosparcas.compose.resources.home_welcome
import com.futebadosparcas.compose.resources.home_nav_games
import com.futebadosparcas.compose.resources.home_nav_groups
import com.futebadosparcas.compose.resources.home_nav_home
import com.futebadosparcas.compose.resources.home_nav_profile
import com.futebadosparcas.ui.adaptive.AdaptiveNavItem
import com.futebadosparcas.ui.adaptive.AdaptiveTabBar
import com.futebadosparcas.ui.adaptive.AdaptiveTopBar
import org.jetbrains.compose.resources.stringResource

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onOpenWhatsNew: () -> Unit = {},
    onNavigateToGames: () -> Unit = {},
    onNavigateToGroups: () -> Unit = {},
    onNavigateToProfile: () -> Unit = {},
    onOpenProfileSetup: () -> Unit = {},
    onNavigateToRanking: () -> Unit = {},
    onNavigateToBadges: () -> Unit = {},
    onNavigateToLocations: () -> Unit = {},
) {
    val appName = stringResource(Res.string.app_name)
    val whatsNewContentDescription = stringResource(Res.string.cd_whats_new)
    val navHome = stringResource(Res.string.home_nav_home)
    val navGames = stringResource(Res.string.home_nav_games)
    val navGroups = stringResource(Res.string.home_nav_groups)
    val navProfile = stringResource(Res.string.home_nav_profile)

    Scaffold(
        topBar = {
            AdaptiveTopBar(
                title = appName,
                actions = {
                    IconButton(onClick = onOpenWhatsNew) {
                        Icon(
                            imageVector = Icons.Default.NewReleases,
                            contentDescription = whatsNewContentDescription,
                        )
                    }
                },
                containerColor = MaterialTheme.colorScheme.primaryContainer,
                contentColor = MaterialTheme.colorScheme.onPrimaryContainer
            )
        },
        bottomBar = {
            AdaptiveTabBar(
                items = listOf(
                    AdaptiveNavItem(
                        label = navHome,
                        selectedIcon = Icons.Filled.FilledHome,
                        unselectedIcon = Icons.Outlined.OutlinedHome,
                        contentDescription = navHome,
                        selected = true,
                        onClick = {}
                    ),
                    AdaptiveNavItem(
                        label = navGames,
                        selectedIcon = Icons.Filled.FilledSportsSoccer,
                        unselectedIcon = Icons.Outlined.OutlinedSportsSoccer,
                        contentDescription = navGames,
                        selected = false,
                        onClick = onNavigateToGames
                    ),
                    AdaptiveNavItem(
                        label = navGroups,
                        selectedIcon = Icons.Filled.FilledGroup,
                        unselectedIcon = Icons.Outlined.OutlinedGroup,
                        contentDescription = navGroups,
                        selected = false,
                        onClick = onNavigateToGroups
                    ),
                    AdaptiveNavItem(
                        label = navProfile,
                        selectedIcon = Icons.Filled.FilledPerson,
                        unselectedIcon = Icons.Outlined.OutlinedPerson,
                        contentDescription = navProfile,
                        selected = false,
                        onClick = onNavigateToProfile
                    )
                )
            )
        }
    ) { paddingValues ->
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            val expandedLayout = maxWidth >= 840.dp
            val compactButtons = maxWidth < 460.dp
            val contentMaxWidth = if (expandedLayout) 1120.dp else 680.dp

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = if (expandedLayout) 28.dp else 20.dp, vertical = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                if (expandedLayout) {
                    Row(
                        modifier = Modifier.widthIn(max = contentMaxWidth),
                        horizontalArrangement = Arrangement.spacedBy(20.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Column(
                            modifier = Modifier.weight(1.12f),
                            verticalArrangement = Arrangement.spacedBy(20.dp)
                        ) {
                            HomeHeroCard(
                                stackActions = false,
                                onNavigateToGames = onNavigateToGames,
                                onOpenWhatsNew = onOpenWhatsNew
                            )
                            HomeQuickActionsRow(
                                onNavigateToGames = onNavigateToGames,
                                onNavigateToGroups = onNavigateToGroups,
                                onOpenProfileSetup = onOpenProfileSetup
                            )
                        }
                        Column(
                            modifier = Modifier.weight(0.88f),
                            verticalArrangement = Arrangement.spacedBy(20.dp)
                        ) {
                            HomeInsightCard()
                            HomeToolsSection(
                                onNavigateToGames = onNavigateToGames,
                                onNavigateToGroups = onNavigateToGroups,
                                onNavigateToProfile = onNavigateToProfile,
                                onNavigateToRanking = onNavigateToRanking,
                                onNavigateToBadges = onNavigateToBadges,
                                onNavigateToLocations = onNavigateToLocations
                            )
                        }
                    }
                } else {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .widthIn(max = contentMaxWidth),
                        verticalArrangement = Arrangement.spacedBy(20.dp)
                    ) {
                        HomeHeroCard(
                            stackActions = compactButtons,
                            onNavigateToGames = onNavigateToGames,
                            onOpenWhatsNew = onOpenWhatsNew
                        )
                        HomeQuickActionsRow(
                            onNavigateToGames = onNavigateToGames,
                            onNavigateToGroups = onNavigateToGroups,
                            onOpenProfileSetup = onOpenProfileSetup
                        )
                        HomeInsightCard()
                        HomeToolsSection(
                            onNavigateToGames = onNavigateToGames,
                            onNavigateToGroups = onNavigateToGroups,
                            onNavigateToProfile = onNavigateToProfile,
                            onNavigateToRanking = onNavigateToRanking,
                            onNavigateToBadges = onNavigateToBadges,
                            onNavigateToLocations = onNavigateToLocations
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun HomeHeroCard(
    stackActions: Boolean,
    onNavigateToGames: () -> Unit,
    onOpenWhatsNew: () -> Unit
) {
    ElevatedCard {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Surface(
                shape = MaterialTheme.shapes.small,
                color = MaterialTheme.colorScheme.primaryContainer
            ) {
                Text(
                    text = stringResource(Res.string.home_status_live),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                )
            }
            Text(
                text = stringResource(Res.string.home_welcome),
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.semantics { heading() }
            )
            Text(
                text = stringResource(Res.string.home_subtitle),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            if (stackActions) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    HomePrimaryActionButton(
                        onClick = onNavigateToGames,
                        modifier = Modifier.fillMaxWidth()
                    )
                    HomeWhatsNewButton(
                        onClick = onOpenWhatsNew,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    HomePrimaryActionButton(
                        onClick = onNavigateToGames,
                        modifier = Modifier.weight(1f)
                    )
                    HomeWhatsNewButton(
                        onClick = onOpenWhatsNew,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}

@Composable
private fun HomePrimaryActionButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Button(
        onClick = onClick,
        modifier = modifier
    ) {
        Icon(
            imageVector = Icons.Filled.FilledSportsSoccer,
            contentDescription = null,
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(stringResource(Res.string.home_action_games))
    }
}

@Composable
private fun HomeWhatsNewButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier
    ) {
        Icon(
            imageVector = Icons.Default.NewReleases,
            contentDescription = null,
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(stringResource(Res.string.home_action_whats_new))
    }
}

@Composable
private fun HomeQuickActionsRow(
    onNavigateToGames: () -> Unit,
    onNavigateToGroups: () -> Unit,
    onOpenProfileSetup: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = stringResource(Res.string.home_section_quick_actions),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.semantics { heading() }
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            QuickActionCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Filled.FilledSportsSoccer,
                label = stringResource(Res.string.home_action_games),
                onClick = onNavigateToGames
            )
            QuickActionCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Filled.FilledGroup,
                label = stringResource(Res.string.home_action_groups),
                onClick = onNavigateToGroups
            )
            QuickActionCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Filled.FilledPerson,
                label = stringResource(Res.string.home_action_profile),
                onClick = onOpenProfileSetup
            )
        }
    }
}

@Composable
private fun QuickActionCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    ElevatedCard(
        onClick = onClick,
        modifier = modifier.semantics(mergeDescendants = true) {
            contentDescription = label
            role = Role.Button
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge
            )
        }
    }
}

@Composable
private fun HomeInsightCard() {
    val matchdayTitle = stringResource(Res.string.home_matchday_title)
    val matchdayBody = stringResource(Res.string.home_matchday_body)
    val updatedLabel = stringResource(Res.string.home_status_updated)
    val personalLabel = stringResource(Res.string.home_status_personal)
    val matchdayContentDescription = stringResource(
        Res.string.home_matchday_content_description,
        matchdayTitle,
        matchdayBody,
        updatedLabel,
        personalLabel
    )

    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = stringResource(Res.string.home_section_matchday),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.semantics { heading() }
        )
        ElevatedCard(
            modifier = Modifier.semantics(mergeDescendants = true) {
                contentDescription = matchdayContentDescription
            }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Schedule,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = matchdayTitle,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Text(
                    text = matchdayBody,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    StatusPill(
                        label = updatedLabel,
                        containerColor = MaterialTheme.colorScheme.secondaryContainer,
                        contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                    StatusPill(
                        label = personalLabel,
                        containerColor = MaterialTheme.colorScheme.tertiaryContainer,
                        contentColor = MaterialTheme.colorScheme.onTertiaryContainer
                    )
                }
            }
        }
    }
}

@Composable
private fun StatusPill(
    label: String,
    containerColor: androidx.compose.ui.graphics.Color,
    contentColor: androidx.compose.ui.graphics.Color
) {
    Surface(
        shape = MaterialTheme.shapes.small,
        color = containerColor
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = contentColor,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
        )
    }
}

@Composable
private fun HomeToolsSection(
    onNavigateToGames: () -> Unit,
    onNavigateToGroups: () -> Unit,
    onNavigateToProfile: () -> Unit,
    onNavigateToRanking: () -> Unit = {},
    onNavigateToBadges: () -> Unit = {},
    onNavigateToLocations: () -> Unit = {}
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = stringResource(Res.string.home_section_tools),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.semantics { heading() }
        )
        ToolSummaryCard(
            icon = Icons.Filled.FilledSportsSoccer,
            title = stringResource(Res.string.home_tools_games_title),
            body = stringResource(Res.string.home_tools_games_body),
            onClick = onNavigateToGames
        )
        ToolSummaryCard(
            icon = Icons.Filled.FilledGroup,
            title = stringResource(Res.string.home_tools_groups_title),
            body = stringResource(Res.string.home_tools_groups_body),
            onClick = onNavigateToGroups
        )
        ToolSummaryCard(
            icon = Icons.Filled.EmojiEvents,
            title = "Ranking",
            body = "Classificação da temporada, artilharia e pontuação XP",
            onClick = onNavigateToRanking
        )
        ToolSummaryCard(
            icon = Icons.Filled.MilitaryTech,
            title = "Conquistas",
            body = "Medalhas e marcos desbloqueados nas partidas",
            onClick = onNavigateToBadges
        )
        ToolSummaryCard(
            icon = Icons.Filled.LocationOn,
            title = "Locais",
            body = "Quadras e campos cadastrados para as peladas",
            onClick = onNavigateToLocations
        )
        ToolSummaryCard(
            icon = Icons.Filled.FilledPerson,
            title = stringResource(Res.string.home_tools_profile_title),
            body = stringResource(Res.string.home_tools_profile_body),
            onClick = onNavigateToProfile
        )
    }
}

@Composable
private fun ToolSummaryCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    body: String,
    onClick: () -> Unit
) {
    val summaryContentDescription = stringResource(
        Res.string.home_tool_summary_content_description,
        title,
        body
    )
    ElevatedCard(
        onClick = onClick,
        modifier = Modifier.semantics(mergeDescendants = true) {
            contentDescription = summaryContentDescription
            role = Role.Button
        }
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                shape = MaterialTheme.shapes.medium,
                color = MaterialTheme.colorScheme.primaryContainer
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.padding(12.dp)
                )
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = body,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
