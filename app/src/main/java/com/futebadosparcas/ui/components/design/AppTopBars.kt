package com.futebadosparcas.ui.components.design

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.offset
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Badge
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarColors
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.TopAppBarScrollBehavior
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource
/**
 * Componentes de TopAppBar padronizados do Futeba dos Parcas.
 *
 * Este object centraliza todas as variacoes de TopBar do aplicativo,
 * garantindo consistencia visual e facilitando a manutencao.
 *
 * ## Variantes disponiveis:
 * - [Root] - TopBar principal com suporte a badges de notificacao e icones de acao
 * - [Secondary] - TopBar para telas secundarias com botao voltar
 * - [Simple] - TopBar simples apenas com titulo
 *
 * ## Padrao de cores:
 * Todas as TopBars usam Surface como cor de fundo para um visual clean:
 * - containerColor: surface
 * - titleContentColor: onSurface
 * - navigationIconContentColor: onSurface
 * - actionIconContentColor: onSurface
 *
 * ## Exemplo de uso:
 * ```kotlin
 * // TopBar principal (Home, etc)
 * AppTopBar.Root(
 *     unreadCount = 5,
 *     onNavigateNotifications = { /* ... */ },
 *     onNavigateGroups = { /* ... */ },
 *     onNavigateMap = { /* ... */ }
 * )
 *
 * // TopBar secundaria (Detalhes, etc)
 * AppTopBar.Secondary(
 *     title = "Detalhes do Jogo",
 *     onNavigateBack = { navController.popBackStack() }
 * )
 *
 * // TopBar simples
 * AppTopBar.Simple(title = "Configuracoes")
 * ```
 */
object AppTopBar {

    /**
     * Cores padrao para TopAppBar com visual Surface (clean).
     *
     * Padroniza as cores usando Surface do tema Material para garantir
     * consistencia visual em todo o aplicativo.
     */
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun surfaceColors(): TopAppBarColors = TopAppBarDefaults.topAppBarColors(
        containerColor = MaterialTheme.colorScheme.surface,
        titleContentColor = MaterialTheme.colorScheme.onSurface,
        navigationIconContentColor = MaterialTheme.colorScheme.onSurface,
        actionIconContentColor = MaterialTheme.colorScheme.onSurface,
        scrolledContainerColor = MaterialTheme.colorScheme.surface
    )

    /**
     * Cores padrao para CenterAlignedTopAppBar com visual Surface (clean).
     */
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun centerAlignedSurfaceColors(): TopAppBarColors = TopAppBarDefaults.centerAlignedTopAppBarColors(
        containerColor = MaterialTheme.colorScheme.surface,
        titleContentColor = MaterialTheme.colorScheme.onSurface,
        navigationIconContentColor = MaterialTheme.colorScheme.onSurface,
        actionIconContentColor = MaterialTheme.colorScheme.onSurface,
        scrolledContainerColor = MaterialTheme.colorScheme.surface
    )

    /**
     * TopBar principal do aplicativo (Root).
     *
     * Exibe o titulo do app com suporte a:
     * - Badge de notificacoes nao lidas
     * - Icone de grupos
     * - Icone de mapa/localizacao
     *
     * Utilizada nas telas principais (Home, etc).
     *
     * @param unreadCount Numero de notificacoes nao lidas (0 oculta o badge)
     * @param onNavigateNotifications Callback ao clicar no icone de notificacoes
     * @param onNavigateGroups Callback ao clicar no icone de grupos
     * @param onNavigateMap Callback ao clicar no icone de mapa
     * @param modifier Modificador opcional
     * @param scrollBehavior Comportamento ao rolar (opcional)
     */
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun Root(
        unreadCount: Int,
        onNavigateNotifications: () -> Unit,
        onNavigateGroups: () -> Unit,
        onNavigateMap: () -> Unit,
        modifier: Modifier = Modifier
    ) {
        TopAppBar(
            title = {
                Text(
                    text = stringResource(R.string.app_name),
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            },
            actions = {
                // Icone de Notificacoes com Badge
                NotificationIconWithBadge(
                    unreadCount = unreadCount,
                    onClick = onNavigateNotifications
                )

                // Icone de Grupos
                IconButton(onClick = onNavigateGroups) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_group),
                        contentDescription = stringResource(R.string.cd_groups),
                        tint = MaterialTheme.colorScheme.primary
                    )
                }

                // Icone de Mapa/Localizacao
                IconButton(onClick = onNavigateMap) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_map),
                        contentDescription = stringResource(R.string.cd_map),
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            },
            colors = surfaceColors(),
            modifier = modifier
        )
    }

    /**
     * TopBar para telas secundarias com botao de voltar.
     *
     * Centraliza o titulo e exibe um botao de navegacao para voltar.
     * Suporta acoes adicionais a direita.
     *
     * @param title Titulo da tela (String)
     * @param onNavigateBack Callback ao clicar no botao voltar
     * @param modifier Modificador opcional
     * @param actions Acoes adicionais na direita (opcional)
     * @param scrollBehavior Comportamento ao rolar (opcional)
     */
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun Secondary(
        title: String,
        onNavigateBack: () -> Unit,
        modifier: Modifier = Modifier,
        actions: @Composable (RowScope.() -> Unit)? = null,
        scrollBehavior: TopAppBarScrollBehavior? = null
    ) {
        CenterAlignedTopAppBar(
            title = {
                Text(
                    text = title,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            },
            navigationIcon = {
                IconButton(onClick = onNavigateBack) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = stringResource(R.string.back_button_content_description)
                    )
                }
            },
            actions = actions ?: {},
            colors = centerAlignedSurfaceColors(),
            scrollBehavior = scrollBehavior,
            modifier = modifier
        )
    }

    /**
     * TopBar para telas secundarias com botao de voltar (usando resource ID).
     *
     * Versao alternativa que aceita um resource ID para o titulo,
     * garantindo uso de strings.xml.
     *
     * @param titleResId Resource ID do titulo (R.string.xxx)
     * @param onNavigateBack Callback ao clicar no botao voltar
     * @param modifier Modificador opcional
     * @param actions Acoes adicionais na direita (opcional)
     * @param scrollBehavior Comportamento ao rolar (opcional)
     */
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun Secondary(
        titleResId: Int,
        onNavigateBack: () -> Unit,
        modifier: Modifier = Modifier,
        actions: @Composable (RowScope.() -> Unit)? = null,
        scrollBehavior: TopAppBarScrollBehavior? = null
    ) {
        Secondary(
            title = stringResource(titleResId),
            onNavigateBack = onNavigateBack,
            modifier = modifier,
            actions = actions,
            scrollBehavior = scrollBehavior
        )
    }

    /**
     * TopBar simples apenas com titulo.
     *
     * Utilizada em telas que nao precisam de navegacao ou acoes.
     * Pode opcionalmente incluir acoes a direita.
     *
     * @param title Titulo da tela
     * @param modifier Modificador opcional
     * @param actions Acoes adicionais na direita (opcional)
     * @param scrollBehavior Comportamento ao rolar (opcional)
     */
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun Simple(
        title: String,
        modifier: Modifier = Modifier,
        actions: @Composable (RowScope.() -> Unit)? = null,
        scrollBehavior: TopAppBarScrollBehavior? = null
    ) {
        TopAppBar(
            title = {
                Text(
                    text = title,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            },
            actions = actions ?: {},
            colors = surfaceColors(),
            scrollBehavior = scrollBehavior,
            modifier = modifier
        )
    }

    /**
     * TopBar simples usando resource ID.
     *
     * @param titleResId Resource ID do titulo (R.string.xxx)
     * @param modifier Modificador opcional
     * @param actions Acoes adicionais na direita (opcional)
     * @param scrollBehavior Comportamento ao rolar (opcional)
     */
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun Simple(
        titleResId: Int,
        modifier: Modifier = Modifier,
        actions: @Composable (RowScope.() -> Unit)? = null,
        scrollBehavior: TopAppBarScrollBehavior? = null
    ) {
        Simple(
            title = stringResource(titleResId),
            modifier = modifier,
            actions = actions,
            scrollBehavior = scrollBehavior
        )
    }

    /**
     * TopBar com icone de configuracoes.
     *
     * Variante da TopBar simples com um icone de configuracoes
     * pre-configurado como acao principal.
     *
     * @param title Titulo da tela
     * @param onSettingsClick Callback ao clicar no icone de configuracoes
     * @param modifier Modificador opcional
     * @param scrollBehavior Comportamento ao rolar (opcional)
     */
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun WithSettings(
        title: String,
        onSettingsClick: () -> Unit,
        modifier: Modifier = Modifier,
        scrollBehavior: TopAppBarScrollBehavior? = null
    ) {
        Simple(
            title = title,
            modifier = modifier,
            actions = {
                IconButton(onClick = onSettingsClick) {
                    Icon(
                        imageVector = Icons.Default.Settings,
                        contentDescription = stringResource(R.string.settings)
                    )
                }
            },
            scrollBehavior = scrollBehavior
        )
    }

    /**
     * TopBar com menu overflow (tres pontinhos).
     *
     * Variante da TopBar simples com um icone de menu overflow
     * para acoes secundarias.
     *
     * @param title Titulo da tela
     * @param onMenuClick Callback ao clicar no icone de menu
     * @param modifier Modificador opcional
     * @param navigationIcon Icone de navegacao opcional (voltar, etc)
     * @param scrollBehavior Comportamento ao rolar (opcional)
     */
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun WithMenu(
        title: String,
        onMenuClick: () -> Unit,
        modifier: Modifier = Modifier,
        navigationIcon: (@Composable () -> Unit)? = null,
        scrollBehavior: TopAppBarScrollBehavior? = null
    ) {
        TopAppBar(
            title = {
                Text(
                    text = title,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            },
            navigationIcon = { navigationIcon?.invoke() },
            actions = {
                IconButton(onClick = onMenuClick) {
                    Icon(
                        imageVector = Icons.Default.MoreVert,
                        contentDescription = stringResource(R.string.cd_menu)
                    )
                }
            },
            colors = surfaceColors(),
            scrollBehavior = scrollBehavior,
            modifier = modifier
        )
    }
}

// ============================================================================
// Componentes auxiliares internos
// ============================================================================

/** Teto exibido no badge de notificacoes (mesmo clamp de DirectMessagesScreen). */
private const val MAX_BADGE_COUNT = 99

/** Tag de teste do slot de 48dp (botao + badge) de notificacoes da [AppTopBar.Root]. */
internal const val NOTIFICATION_SLOT_TEST_TAG = "app_top_bar_notification_slot"

/** Tag de teste do badge de contagem de notificacoes da [AppTopBar.Root]. */
internal const val NOTIFICATION_BADGE_TEST_TAG = "app_top_bar_notification_badge"

/**
 * Icone de notificacao com badge de contagem.
 *
 * Usa o [Badge] do Material 3, que se dimensiona ao conteudo (labelSmall em sp) e
 * vira "pilula" quando o rotulo cresce — em vez do circulo fixo de 16dp que
 * recortava "9+" a partir de fontScale 1,287 (#4108).
 *
 * Por que NAO `IconButton { BadgedBox { ... } }`: o IconButton do M3 (1.4.0) aplica
 * `clip(CircleShape)` num container de 40dp e o BadgedBox posiciona o badge a 12dp
 * do fim do icone — um badge de 2 digitos ja passa da borda desse container em
 * fontScale 1,0 e fica quase todo recortado em 2,0. E com `BadgedBox { IconButton }`
 * a ancora vira o alvo de 48dp e o badge invade a acao vizinha (Grupos).
 * Por isso o badge fica num [Box] (que nao recorta) alinhado ao topo/fim do alvo
 * de 48dp: cresce para DENTRO dele, sem vazar para a TopAppBar nem para o lado.
 *
 * Acessibilidade: o alvo de toque continua 48dp (o [Badge] nao consome toques) e a
 * contagem entra no no do proprio botao via `stateDescription` (TalkBack:
 * "Notificacoes, 15, botao"); o badge visual sai da arvore semantica para nao ser
 * anunciado duas vezes.
 *
 * @param unreadCount Numero de notificacoes nao lidas (0 oculta o badge)
 * @param onClick Callback ao clicar no icone
 * @param modifier Modificador opcional
 */
@Composable
private fun NotificationIconWithBadge(
    unreadCount: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    // Acima do teto mostra "99+": exibir "99" para 150 notificacoes seria
    // informacao errada, a mesma classe de defeito que o #4108 corrige.
    val badgeLabel = if (unreadCount > MAX_BADGE_COUNT) "$MAX_BADGE_COUNT+" else unreadCount.toString()

    Box(modifier = modifier.testTag(NOTIFICATION_SLOT_TEST_TAG)) {
        IconButton(
            onClick = onClick,
            modifier = Modifier.semantics {
                if (unreadCount > 0) stateDescription = badgeLabel
            }
        ) {
            Icon(
                painter = painterResource(id = R.drawable.ic_notifications),
                contentDescription = stringResource(R.string.cd_notifications),
                tint = MaterialTheme.colorScheme.primary
            )
        }

        // Badge de contagem (visivel apenas quando > 0)
        if (unreadCount > 0) {
            Badge(
                containerColor = MaterialTheme.colorScheme.error,
                contentColor = MaterialTheme.colorScheme.onError,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = (-4).dp, y = 4.dp)
                    // testTag ANTES do clear: sobrevive para os testes; o Text interno sai da arvore.
                    .testTag(NOTIFICATION_BADGE_TEST_TAG)
                    .clearAndSetSemantics {}
            ) {
                Text(
                    text = badgeLabel,
                    maxLines = 1,
                    softWrap = false
                )
            }
        }
    }
}

// ============================================================================
// Funcoes de conveniencia para acoes comuns
// ============================================================================

/**
 * Cria um IconButton de voltar padronizado.
 *
 * Util para adicionar em TopBars customizadas.
 *
 * @param onClick Callback ao clicar
 */
@Composable
fun BackIconButton(onClick: () -> Unit) {
    IconButton(onClick = onClick) {
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
            contentDescription = stringResource(R.string.back_button_content_description)
        )
    }
}

/**
 * Cria um IconButton de configuracoes padronizado.
 *
 * @param onClick Callback ao clicar
 */
@Composable
fun SettingsIconButton(onClick: () -> Unit) {
    IconButton(onClick = onClick) {
        Icon(
            imageVector = Icons.Default.Settings,
            contentDescription = stringResource(R.string.settings)
        )
    }
}

/**
 * Cria um IconButton de menu (tres pontinhos) padronizado.
 *
 * @param onClick Callback ao clicar
 * @param contentDescription Descricao de acessibilidade (padrao: "Menu")
 */
@Composable
fun MenuIconButton(
    onClick: () -> Unit,
    contentDescription: String = "Menu"
) {
    IconButton(onClick = onClick) {
        Icon(
            imageVector = Icons.Default.MoreVert,
            contentDescription = contentDescription
        )
    }
}
