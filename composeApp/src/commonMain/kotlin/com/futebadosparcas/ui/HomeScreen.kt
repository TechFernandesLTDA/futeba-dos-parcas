package com.futebadosparcas.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.NewReleases
import androidx.compose.material.icons.filled.Person
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
) {
    var selectedTab by remember { mutableStateOf(0) }

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
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 }
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.SportsSoccer, contentDescription = UiStrings.NAV_GAMES) },
                    label = { Text(UiStrings.NAV_GAMES) },
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1; onNavigateToGames() }
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Group, contentDescription = UiStrings.NAV_GROUPS) },
                    label = { Text(UiStrings.NAV_GROUPS) },
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2; onNavigateToGroups() }
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Person, contentDescription = UiStrings.NAV_PROFILE) },
                    label = { Text(UiStrings.NAV_PROFILE) },
                    selected = selectedTab == 3,
                    onClick = { selectedTab = 3; onNavigateToProfile() }
                )
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentAlignment = Alignment.Center
        ) {
            when (selectedTab) {
                0 -> HomeTab()
                1 -> PlaceholderTab("Jogos")
                2 -> PlaceholderTab("Grupos")
                3 -> PlaceholderTab("Perfil")
            }
        }
    }
}

@Composable
private fun HomeTab() {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.Top)
    ) {
        Icon(
            imageVector = Icons.Default.SportsSoccer,
            contentDescription = null,
            modifier = Modifier.size(72.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Text(
            text = UiStrings.HOME_WELCOME,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "Organize partidas, acompanhe estatísticas e suba de nível!",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(24.dp))
        Card(
            modifier = Modifier.fillMaxWidth(0.85f)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Funcionalidades",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text("Navegação funcional")
                Text("UI Responsiva")
                Text("Material Design 3")
                Text("Autenticação integrada")
                Text("Jogos e grupos")
            }
        }
    }
}

@Composable
private fun PlaceholderTab(tabName: String) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        val icon = when (tabName) {
            "Jogos" -> Icons.Default.SportsSoccer
            "Grupos" -> Icons.Default.Group
            "Perfil" -> Icons.Default.Person
            else -> Icons.Default.Home
        }
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Tela $tabName",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "Redirecionando...",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
