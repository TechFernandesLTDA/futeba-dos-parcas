package com.futebadosparcas.ui.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Leaderboard
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.PermanentDrawerSheet
import androidx.compose.material3.PermanentNavigationDrawer
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R

/**
 * Sistema de navegação adaptativa para diferentes tamanhos de tela.
 *
 * - Celular (compact): Bottom Navigation Bar
 * - Tablet/Foldable (medium): Navigation Rail
 * - Desktop/TV (expanded): Permanent Navigation Drawer
 */

// ==================== Models ====================

/**
 * Tipo de navegação baseado no tamanho da tela.
 */
enum class NavigationType {
    /**
     * Bottom Navigation Bar para telas pequenas (celulares).
     */
    BOTTOM_NAVIGATION,

    /**
     * Navigation Rail para telas médias (tablets, foldables).
     */
    NAVIGATION_RAIL,

    /**
     * Permanent Navigation Drawer para telas grandes (desktop, TV).
     */
    PERMANENT_DRAWER
}

/**
 * Destinos de navegação do app.
 */
sealed class NavigationDestination(
    val route: String,
    val icon: ImageVector,
    val labelResId: Int
) {
    data object Home : NavigationDestination(
        route = "home",
        icon = Icons.Default.Home,
        labelResId = R.string.nav_home
    )

    data object Games : NavigationDestination(
        route = "games",
        icon = Icons.Default.CalendarMonth,
        labelResId = R.string.nav_games
    )

    data object Groups : NavigationDestination(
        route = "groups",
        icon = Icons.Default.Groups,
        labelResId = R.string.nav_groups
    )

    data object Rankings : NavigationDestination(
        route = "rankings",
        icon = Icons.Default.Leaderboard,
        labelResId = R.string.nav_rankings
    )

    data object Profile : NavigationDestination(
        route = "profile",
        icon = Icons.Default.Person,
        labelResId = R.string.nav_profile
    )
}

/**
 * Lista de destinos principais da navegação.
 */
val mainNavigationDestinations = listOf(
    NavigationDestination.Home,
    NavigationDestination.Games,
    NavigationDestination.Groups,
    NavigationDestination.Rankings,
    NavigationDestination.Profile
)

// ==================== Helper Functions ====================

/**
 * Determina o tipo de navegação baseado na largura da tela.
 */
@Composable
fun determineNavigationType(): NavigationType {
    val configuration = LocalConfiguration.current
    val screenWidthDp = configuration.screenWidthDp

    return when {
        screenWidthDp < 600 -> NavigationType.BOTTOM_NAVIGATION
        screenWidthDp < 840 -> NavigationType.NAVIGATION_RAIL
        else -> NavigationType.PERMANENT_DRAWER
    }
}

// ==================== Main Composables ====================

/**
 * Container de navegação adaptativa.
 * Automaticamente escolhe Bottom Nav, Rail ou Drawer baseado no tamanho da tela.
 */
@Composable
fun AdaptiveNavigationContainer(
    selectedDestination: String,
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    val navigationType = determineNavigationType()

    when (navigationType) {
        NavigationType.BOTTOM_NAVIGATION -> {
            // Celulares: Bottom Navigation
            Box(modifier = modifier.fillMaxSize()) {
                Box(modifier = Modifier.padding(bottom = 80.dp)) {
                    content()
                }
                Box(modifier = Modifier.fillMaxSize()) {
                    AdaptiveBottomNavigation(
                        selectedDestination = selectedDestination,
                        onNavigate = onNavigate,
                        modifier = Modifier.align(androidx.compose.ui.Alignment.BottomCenter)
                    )
                }
            }
        }

        NavigationType.NAVIGATION_RAIL -> {
            // Tablets: Navigation Rail à esquerda
            Row(modifier = modifier.fillMaxSize()) {
                AdaptiveNavigationRail(
                    selectedDestination = selectedDestination,
                    onNavigate = onNavigate
                )
                Box(modifier = Modifier.weight(1f)) {
                    content()
                }
            }
        }

        NavigationType.PERMANENT_DRAWER -> {
            // Desktop/TV: Permanent Drawer
            AdaptivePermanentDrawer(
                selectedDestination = selectedDestination,
                onNavigate = onNavigate,
                content = content
            )
        }
    }
}

/**
 * Bottom Navigation para celulares.
 */
@Composable
fun AdaptiveBottomNavigation(
    selectedDestination: String,
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    NavigationBar(
        modifier = modifier,
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        mainNavigationDestinations.forEach { destination ->
            NavigationBarItem(
                selected = selectedDestination == destination.route,
                onClick = { onNavigate(destination.route) },
                icon = {
                    Icon(
                        imageVector = destination.icon,
                        contentDescription = stringResource(destination.labelResId)
                    )
                },
                label = {
                    Text(text = stringResource(destination.labelResId))
                }
            )
        }
    }
}

/**
 * Navigation Rail para tablets.
 */
@Composable
fun AdaptiveNavigationRail(
    selectedDestination: String,
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    NavigationRail(
        modifier = modifier.fillMaxHeight(),
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        mainNavigationDestinations.forEach { destination ->
            NavigationRailItem(
                selected = selectedDestination == destination.route,
                onClick = { onNavigate(destination.route) },
                icon = {
                    Icon(
                        imageVector = destination.icon,
                        contentDescription = stringResource(destination.labelResId)
                    )
                },
                label = {
                    Text(text = stringResource(destination.labelResId))
                }
            )
        }
    }
}

/**
 * Permanent Navigation Drawer para desktop/TV.
 */
@Composable
fun AdaptivePermanentDrawer(
    selectedDestination: String,
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    PermanentNavigationDrawer(
        modifier = modifier,
        drawerContent = {
            PermanentDrawerSheet(
                modifier = Modifier.width(280.dp)
            ) {
                // Header do drawer
                Text(
                    text = stringResource(R.string.app_name),
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(16.dp)
                )

                HorizontalDivider()

                // Items de navegação
                mainNavigationDestinations.forEach { destination ->
                    NavigationDrawerItem(
                        selected = selectedDestination == destination.route,
                        onClick = { onNavigate(destination.route) },
                        icon = {
                            Icon(
                                imageVector = destination.icon,
                                contentDescription = null
                            )
                        },
                        label = {
                            Text(text = stringResource(destination.labelResId))
                        },
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                    )
                }

                // Spacer
                Box(modifier = Modifier.weight(1f))

                HorizontalDivider()

                // Configurações
                NavigationDrawerItem(
                    selected = selectedDestination == "settings",
                    onClick = { onNavigate("settings") },
                    icon = {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = null
                        )
                    },
                    label = {
                        Text(text = stringResource(R.string.settings_title))
                    },
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                )
            }
        },
        content = content
    )
}

// ==================== Utility Composables ====================

/**
 * Helper para determinar se deve mostrar Navigation Rail.
 */
@Composable
fun shouldShowNavigationRail(): Boolean {
    val configuration = LocalConfiguration.current
    return configuration.screenWidthDp >= 600
}

/**
 * Helper para determinar se é uma tela grande (expanded).
 */
@Composable
fun isExpandedScreen(): Boolean {
    val configuration = LocalConfiguration.current
    return configuration.screenWidthDp >= 840
}

/**
 * Helper para determinar se é uma tela compacta (phone).
 */
@Composable
fun isCompactScreen(): Boolean {
    val configuration = LocalConfiguration.current
    return configuration.screenWidthDp < 600
}

/**
 * Helper para determinar se é uma tela média (tablet).
 */
@Composable
fun isMediumScreen(): Boolean {
    val configuration = LocalConfiguration.current
    val width = configuration.screenWidthDp
    return width >= 600 && width < 840
}

/**
 * Retorna a largura da tela em dp.
 */
@Composable
fun getScreenWidthDp(): Int {
    return LocalConfiguration.current.screenWidthDp
}

/**
 * Retorna a altura da tela em dp.
 */
@Composable
fun getScreenHeightDp(): Int {
    return LocalConfiguration.current.screenHeightDp
}
