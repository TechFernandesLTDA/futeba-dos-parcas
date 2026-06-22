package com.futebadosparcas.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.NewReleases
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.SportsSoccer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

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
            TopAppBar(
                title = { Text(UiStrings.APP_NAME) },
                actions = {
                    IconButton(onClick = onOpenWhatsNew) {
                        Icon(
                            imageVector = Icons.Default.NewReleases,
                            contentDescription = UiStrings.CD_WHATS_NEW,
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Home, contentDescription = UiStrings.NAV_HOME) },
                    label = { Text(UiStrings.NAV_HOME) },
                    selected = true,
                    onClick = {}
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.SportsSoccer, contentDescription = UiStrings.NAV_GAMES) },
                    label = { Text(UiStrings.NAV_GAMES) },
                    selected = false,
                    onClick = onNavigateToGames
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Group, contentDescription = UiStrings.NAV_GROUPS) },
                    label = { Text(UiStrings.NAV_GROUPS) },
                    selected = false,
                    onClick = onNavigateToGroups
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Person, contentDescription = UiStrings.NAV_PROFILE) },
                    label = { Text(UiStrings.NAV_PROFILE) },
                    selected = false,
                    onClick = onNavigateToProfile
                )
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            HomeHeroCard(
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

@Composable
private fun HomeHeroCard(
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
                fontWeight = FontWeight.Bold
            )
            Text(
                text = UiStrings.HOME_SUBTITLE,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = onNavigateToGames,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.Default.SportsSoccer,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(UiStrings.HOME_ACTION_GAMES)
                }
                OutlinedButton(
                    onClick = onOpenWhatsNew,
                    modifier = Modifier.weight(1f)
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
        }
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
            fontWeight = FontWeight.SemiBold
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            QuickActionCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.SportsSoccer,
                label = UiStrings.HOME_ACTION_GAMES,
                onClick = onNavigateToGames
            )
            QuickActionCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.Group,
                label = UiStrings.HOME_ACTION_GROUPS,
                onClick = onNavigateToGroups
            )
            QuickActionCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.Person,
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
        modifier = modifier
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
            fontWeight = FontWeight.SemiBold
        )
        ElevatedCard {
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
            fontWeight = FontWeight.SemiBold
        )
        ToolSummaryCard(
            icon = Icons.Default.SportsSoccer,
            title = UiStrings.HOME_TOOLS_GAMES_TITLE,
            body = UiStrings.HOME_TOOLS_GAMES_BODY,
            onClick = onNavigateToGames
        )
        ToolSummaryCard(
            icon = Icons.Default.Group,
            title = UiStrings.HOME_TOOLS_GROUPS_TITLE,
            body = UiStrings.HOME_TOOLS_GROUPS_BODY,
            onClick = onNavigateToGroups
        )
        ToolSummaryCard(
            icon = Icons.Default.Person,
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
    ElevatedCard(onClick = onClick) {
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
