package com.futebadosparcas.ui.components.modern

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffold
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteType
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Destino de navegação
 */
data class NavDestination(
    val route: String,
    val label: String,
    val icon: ImageVector,
    val contentDescription: String
)

/**
 * Navegação adaptativa Material 3
 *
 * Automaticamente escolhe o tipo de navegação baseado no tamanho da tela:
 * - Compacto (celular): Bottom Navigation Bar
 * - Médio (tablet portrait): Navigation Rail
 * - Expandido (tablet landscape/desktop): Navigation Drawer
 *
 * Segue Material 3 Adaptive Navigation guidelines
 *
 * @param selectedDestination Rota atual selecionada
 * @param onNavigate Callback ao navegar
 * @param destinations Lista de destinos de navegação
 * @param content Conteúdo principal da tela
 */
@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
fun AdaptiveNavigationScaffold(
    selectedDestination: String,
    onNavigate: (String) -> Unit,
    destinations: List<NavDestination>,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    NavigationSuiteScaffold(
        navigationSuiteItems = {
            destinations.forEach { destination ->
                item(
                    selected = selectedDestination == destination.route,
                    onClick = { onNavigate(destination.route) },
                    icon = {
                        Icon(
                            imageVector = destination.icon,
                            contentDescription = destination.contentDescription
                        )
                    },
                    label = { Text(destination.label) }
                )
            }
        },
        modifier = modifier
    ) {
        content()
    }
}

/**
 * Exemplo de uso com destinos padrão do app
 */
object AppDestinations {
    val Home = NavDestination(
        route = "home",
        label = "Início",
        icon = Icons.Default.Home,
        contentDescription = "Tela inicial com próximos jogos"
    )

    val Games = NavDestination(
        route = "games",
        label = "Jogos",
        icon = Icons.Default.SportsFootball,
        contentDescription = "Lista de todos os jogos"
    )

    val League = NavDestination(
        route = "league",
        label = "Liga",
        icon = Icons.Default.EmojiEvents,
        contentDescription = "Ranking e classificação da liga"
    )

    val Profile = NavDestination(
        route = "profile",
        label = "Perfil",
        icon = Icons.Default.Person,
        contentDescription = "Perfil do usuário e estatísticas"
    )

    val all = listOf(Home, Games, League, Profile)
}

/**
 * Navegação manual (para customização completa)
 */
@Composable
fun ManualAdaptiveNavigation(
    selectedDestination: String,
    onNavigate: (String) -> Unit,
    destinations: List<NavDestination>,
    layoutType: NavigationSuiteType,
    modifier: Modifier = Modifier
) {
    when (layoutType) {
        NavigationSuiteType.NavigationBar -> {
            NavigationBar(modifier = modifier) {
                destinations.forEach { destination ->
                    NavigationBarItem(
                        selected = selectedDestination == destination.route,
                        onClick = { onNavigate(destination.route) },
                        icon = {
                            Icon(
                                imageVector = destination.icon,
                                contentDescription = destination.contentDescription
                            )
                        },
                        label = { Text(destination.label) }
                    )
                }
            }
        }

        NavigationSuiteType.NavigationRail -> {
            NavigationRail(modifier = modifier) {
                destinations.forEach { destination ->
                    NavigationRailItem(
                        selected = selectedDestination == destination.route,
                        onClick = { onNavigate(destination.route) },
                        icon = {
                            Icon(
                                imageVector = destination.icon,
                                contentDescription = destination.contentDescription
                            )
                        },
                        label = { Text(destination.label) }
                    )
                }
            }
        }

        NavigationSuiteType.NavigationDrawer -> {
            PermanentNavigationDrawer(
                drawerContent = {
                    PermanentDrawerSheet(modifier = modifier) {
                        Spacer(modifier = Modifier.height(12.dp))
                        destinations.forEach { destination ->
                            NavigationDrawerItem(
                                selected = selectedDestination == destination.route,
                                onClick = { onNavigate(destination.route) },
                                icon = {
                                    Icon(
                                        imageVector = destination.icon,
                                        contentDescription = destination.contentDescription
                                    )
                                },
                                label = { Text(destination.label) }
                            )
                        }
                    }
                },
                content = {}
            )
        }

        else -> {
            // Fallback para bottom navigation
            NavigationBar(modifier = modifier) {
                destinations.forEach { destination ->
                    NavigationBarItem(
                        selected = selectedDestination == destination.route,
                        onClick = { onNavigate(destination.route) },
                        icon = {
                            Icon(
                                imageVector = destination.icon,
                                contentDescription = destination.contentDescription
                            )
                        },
                        label = { Text(destination.label) }
                    )
                }
            }
        }
    }
}
