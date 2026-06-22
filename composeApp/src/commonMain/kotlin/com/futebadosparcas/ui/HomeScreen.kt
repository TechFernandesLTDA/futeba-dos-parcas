package com.futebadosparcas.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Group as FilledGroup
import androidx.compose.material.icons.filled.Home as FilledHome
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
import com.futebadosparcas.ui.adaptive.AdaptiveNavItem
import com.futebadosparcas.ui.adaptive.AdaptiveTabBar
import com.futebadosparcas.ui.adaptive.AdaptiveTopBar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onOpenWhatsNew: () -> Unit = {},
    onNavigateToGames: () -> Unit = {},
    onNavigateToGroups: () -> Unit = {},
    onNavigateToProfile: () -> Unit = {},
    onOpenProfileSetup: () -> Unit = {},
) {
    Scaffold(
        topBar = {
            AdaptiveTopBar(
                title = UiStrings.APP_NAME,
                actions = {
                    IconButton(onClick = onOpenWhatsNew) {
                        Icon(
                            imageVector = Icons.Default.NewReleases,
                            contentDescription = UiStrings.CD_WHATS_NEW,
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
                        label = UiStrings.NAV_HOME,
                        selectedIcon = Icons.Filled.FilledHome,
                        unselectedIcon = Icons.Outlined.OutlinedHome,
                        contentDescription = UiStrings.NAV_HOME,
                        selected = true,
                        onClick = {}
                    ),
                    AdaptiveNavItem(
                        label = UiStrings.NAV_GAMES,
                        selectedIcon = Icons.Filled.FilledSportsSoccer,
                        unselectedIcon = Icons.Outlined.OutlinedSportsSoccer,
                        contentDescription = UiStrings.NAV_GAMES,
                        selected = false,
                        onClick = onNavigateToGames
                    ),
                    AdaptiveNavItem(
                        label = UiStrings.NAV_GROUPS,
                        selectedIcon = Icons.Filled.FilledGroup,
                        unselectedIcon = Icons.Outlined.OutlinedGroup,
                        contentDescription = UiStrings.NAV_GROUPS,
                        selected = false,
                        onClick = onNavigateToGroups
                    ),
                    AdaptiveNavItem(
                        label = UiStrings.NAV_PROFILE,
                        selectedIcon = Icons.Filled.FilledPerson,
                        unselectedIcon = Icons.Outlined.OutlinedPerson,
                        contentDescription = UiStrings.NAV_PROFILE,
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
                                onNavigateToProfile = onNavigateToProfile
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
                            onNavigateToProfile = onNavigateToProfile
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
                    text = UiStrings.HOME_STATUS_LIVE,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                )
            }
            Text(
                text = UiStrings.HOME_WELCOME,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.semantics { heading() }
            )
            Text(
                text = UiStrings.HOME_SUBTITLE,
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
        Text(UiStrings.HOME_ACTION_GAMES)
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
        Text(UiStrings.HOME_ACTION_WHATS_NEW)
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
            text = UiStrings.HOME_SECTION_QUICK_ACTIONS,
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
                label = UiStrings.HOME_ACTION_GAMES,
                onClick = onNavigateToGames
            )
            QuickActionCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Filled.FilledGroup,
                label = UiStrings.HOME_ACTION_GROUPS,
                onClick = onNavigateToGroups
            )
            QuickActionCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Filled.FilledPerson,
                label = UiStrings.HOME_ACTION_PROFILE,
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
    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = UiStrings.HOME_SECTION_MATCHDAY,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.semantics { heading() }
        )
        ElevatedCard(
            modifier = Modifier.semantics(mergeDescendants = true) {
                contentDescription = "${UiStrings.HOME_MATCHDAY_TITLE}. ${UiStrings.HOME_MATCHDAY_BODY}. ${UiStrings.HOME_STATUS_UPDATED}. ${UiStrings.HOME_STATUS_PERSONAL}."
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
                        text = UiStrings.HOME_MATCHDAY_TITLE,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Text(
                    text = UiStrings.HOME_MATCHDAY_BODY,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    StatusPill(
                        label = UiStrings.HOME_STATUS_UPDATED,
                        containerColor = MaterialTheme.colorScheme.secondaryContainer,
                        contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                    StatusPill(
                        label = UiStrings.HOME_STATUS_PERSONAL,
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
    onNavigateToProfile: () -> Unit
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = UiStrings.HOME_SECTION_TOOLS,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.semantics { heading() }
        )
        ToolSummaryCard(
            icon = Icons.Filled.FilledSportsSoccer,
            title = UiStrings.HOME_TOOLS_GAMES_TITLE,
            body = UiStrings.HOME_TOOLS_GAMES_BODY,
            onClick = onNavigateToGames
        )
        ToolSummaryCard(
            icon = Icons.Filled.FilledGroup,
            title = UiStrings.HOME_TOOLS_GROUPS_TITLE,
            body = UiStrings.HOME_TOOLS_GROUPS_BODY,
            onClick = onNavigateToGroups
        )
        ToolSummaryCard(
            icon = Icons.Filled.FilledPerson,
            title = UiStrings.HOME_TOOLS_PROFILE_TITLE,
            body = UiStrings.HOME_TOOLS_PROFILE_BODY,
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
    ElevatedCard(
        onClick = onClick,
        modifier = Modifier.semantics(mergeDescendants = true) {
            contentDescription = "$title. $body"
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
