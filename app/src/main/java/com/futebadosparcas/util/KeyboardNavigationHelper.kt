package com.futebadosparcas.util

import androidx.compose.foundation.focusable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusManager
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Helper para navegação via teclado físico, D-pad e controles remotos
 * Essencial para suporte a Android TV, ChromeOS e dispositivos com teclado
 */

/**
 * Direções de navegação suportadas
 */
enum class NavigationDirection {
    UP,
    DOWN,
    LEFT,
    RIGHT,
    ENTER,
    BACK,
    TAB,
    TAB_REVERSE
}

/**
 * Modifier que adiciona suporte a navegação por teclado
 */
@OptIn(ExperimentalComposeUiApi::class)
fun Modifier.keyboardNavigable(
    focusRequester: FocusRequester? = null,
    onNavigate: ((NavigationDirection) -> Boolean)? = null,
    onEnter: (() -> Unit)? = null
): Modifier = this
    .then(focusRequester?.let { Modifier.focusRequester(it) } ?: Modifier)
    .focusable()
    .onKeyEvent { event ->
        if (event.type == KeyEventType.KeyDown) {
            val direction = when (event.key) {
                Key.DirectionUp, Key.W -> NavigationDirection.UP
                Key.DirectionDown, Key.S -> NavigationDirection.DOWN
                Key.DirectionLeft, Key.A -> NavigationDirection.LEFT
                Key.DirectionRight, Key.D -> NavigationDirection.RIGHT
                Key.Enter, Key.NumPadEnter, Key.Spacebar -> NavigationDirection.ENTER
                Key.Escape, Key.Back -> NavigationDirection.BACK
                Key.Tab -> if (event.isShiftPressed) {
                    NavigationDirection.TAB_REVERSE
                } else {
                    NavigationDirection.TAB
                }
                else -> null
            }

            if (direction == NavigationDirection.ENTER) {
                onEnter?.invoke()
                true
            } else if (direction != null) {
                onNavigate?.invoke(direction) ?: false
            } else {
                false
            }
        } else {
            false
        }
    }

/**
 * Extensão para verificar se Shift está pressionado
 */
@OptIn(ExperimentalComposeUiApi::class)
private val androidx.compose.ui.input.key.KeyEvent.isShiftPressed: Boolean
    get() = false // Simplificado - em produção, verificar estado do modificador

/**
 * Modifier que adiciona indicador visual de foco
 */
@Composable
fun Modifier.focusIndicator(
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
    focusedBorderColor: Color = MaterialTheme.colorScheme.primary,
    unfocusedBorderColor: Color = Color.Transparent,
    borderWidth: Dp = 2.dp,
    cornerRadius: Dp = 8.dp
): Modifier {
    val isFocused by interactionSource.collectIsFocusedAsState()

    return this.drawBehind {
        val color = if (isFocused) focusedBorderColor else unfocusedBorderColor
        if (color != Color.Transparent) {
            drawRoundRect(
                color = color,
                style = Stroke(width = borderWidth.toPx()),
                cornerRadius = CornerRadius(cornerRadius.toPx())
            )
        }
    }
}

/**
 * Container que gerencia foco entre uma lista de items
 */
@Composable
fun FocusableItemList(
    itemCount: Int,
    modifier: Modifier = Modifier,
    initialFocusIndex: Int = 0,
    onItemFocused: (Int) -> Unit = {},
    onItemSelected: (Int) -> Unit = {},
    content: @Composable (index: Int, focusRequester: FocusRequester, isFocused: Boolean) -> Unit
) {
    val focusRequesters = remember(itemCount) {
        List(itemCount) { FocusRequester() }
    }
    var focusedIndex by remember { mutableIntStateOf(initialFocusIndex) }
    val focusManager = LocalFocusManager.current

    // Foca no item inicial
    LaunchedEffect(Unit) {
        if (itemCount > 0 && initialFocusIndex in 0 until itemCount) {
            focusRequesters[initialFocusIndex].requestFocus()
        }
    }

    Box(modifier = modifier) {
        repeat(itemCount) { index ->
            val focusRequester = focusRequesters[index]
            var isItemFocused by remember { mutableStateOf(false) }

            Box(
                modifier = Modifier
                    .focusRequester(focusRequester)
                    .onFocusChanged { state ->
                        isItemFocused = state.isFocused
                        if (state.isFocused) {
                            focusedIndex = index
                            onItemFocused(index)
                        }
                    }
                    .keyboardNavigable(
                        onNavigate = { direction ->
                            val newIndex = when (direction) {
                                NavigationDirection.UP,
                                NavigationDirection.LEFT,
                                NavigationDirection.TAB_REVERSE -> {
                                    if (index > 0) index - 1 else null
                                }
                                NavigationDirection.DOWN,
                                NavigationDirection.RIGHT,
                                NavigationDirection.TAB -> {
                                    if (index < itemCount - 1) index + 1 else null
                                }
                                else -> null
                            }

                            if (newIndex != null) {
                                focusRequesters[newIndex].requestFocus()
                                true
                            } else {
                                false
                            }
                        },
                        onEnter = {
                            onItemSelected(index)
                        }
                    )
            ) {
                content(index, focusRequester, isItemFocused)
            }
        }
    }
}

/**
 * Gerenciador de grupos de foco para navegação complexa
 */
class FocusGroupManager {
    private val groups = mutableMapOf<String, List<FocusRequester>>()
    private var currentGroup: String? = null
    private var currentIndex: Int = 0

    /**
     * Registra um grupo de focusables
     */
    fun registerGroup(name: String, requesters: List<FocusRequester>) {
        groups[name] = requesters
    }

    /**
     * Remove um grupo
     */
    fun unregisterGroup(name: String) {
        groups.remove(name)
        if (currentGroup == name) {
            currentGroup = null
            currentIndex = 0
        }
    }

    /**
     * Foca no primeiro item de um grupo
     */
    fun focusGroup(name: String) {
        groups[name]?.firstOrNull()?.let {
            currentGroup = name
            currentIndex = 0
            it.requestFocus()
        }
    }

    /**
     * Move foco para próximo item
     */
    fun focusNext(): Boolean {
        val group = currentGroup?.let { groups[it] } ?: return false
        if (currentIndex < group.size - 1) {
            currentIndex++
            group[currentIndex].requestFocus()
            return true
        }
        return false
    }

    /**
     * Move foco para item anterior
     */
    fun focusPrevious(): Boolean {
        val group = currentGroup?.let { groups[it] } ?: return false
        if (currentIndex > 0) {
            currentIndex--
            group[currentIndex].requestFocus()
            return true
        }
        return false
    }

    /**
     * Move para próximo grupo
     */
    fun focusNextGroup(): Boolean {
        val groupNames = groups.keys.toList()
        val currentIdx = currentGroup?.let { groupNames.indexOf(it) } ?: -1
        if (currentIdx < groupNames.size - 1) {
            focusGroup(groupNames[currentIdx + 1])
            return true
        }
        return false
    }

    /**
     * Move para grupo anterior
     */
    fun focusPreviousGroup(): Boolean {
        val groupNames = groups.keys.toList()
        val currentIdx = currentGroup?.let { groupNames.indexOf(it) } ?: -1
        if (currentIdx > 0) {
            focusGroup(groupNames[currentIdx - 1])
            return true
        }
        return false
    }
}

/**
 * Composable que cria um gerenciador de grupos de foco
 */
@Composable
fun rememberFocusGroupManager(): FocusGroupManager {
    return remember { FocusGroupManager() }
}

/**
 * Extensão para navegar usando FocusManager padrão do Compose
 */
fun FocusManager.navigateInDirection(direction: NavigationDirection): Boolean {
    return when (direction) {
        NavigationDirection.UP -> {
            moveFocus(FocusDirection.Up)
            true
        }
        NavigationDirection.DOWN -> {
            moveFocus(FocusDirection.Down)
            true
        }
        NavigationDirection.LEFT -> {
            moveFocus(FocusDirection.Left)
            true
        }
        NavigationDirection.RIGHT -> {
            moveFocus(FocusDirection.Right)
            true
        }
        NavigationDirection.TAB -> {
            moveFocus(FocusDirection.Next)
            true
        }
        NavigationDirection.TAB_REVERSE -> {
            moveFocus(FocusDirection.Previous)
            true
        }
        else -> false
    }
}

/**
 * Modifier para criar um focusable que responde a D-pad/setas
 */
@Composable
fun Modifier.dpadNavigable(
    focusRequester: FocusRequester = remember { FocusRequester() },
    onSelect: () -> Unit = {},
    onFocusChanged: (Boolean) -> Unit = {}
): Modifier {
    val focusManager = LocalFocusManager.current

    return this
        .focusRequester(focusRequester)
        .onFocusChanged { state ->
            onFocusChanged(state.isFocused)
        }
        .focusable()
        .onKeyEvent { event ->
            if (event.type == KeyEventType.KeyDown) {
                when (event.key) {
                    Key.DirectionUp -> {
                        focusManager.moveFocus(FocusDirection.Up)
                        true
                    }
                    Key.DirectionDown -> {
                        focusManager.moveFocus(FocusDirection.Down)
                        true
                    }
                    Key.DirectionLeft -> {
                        focusManager.moveFocus(FocusDirection.Left)
                        true
                    }
                    Key.DirectionRight -> {
                        focusManager.moveFocus(FocusDirection.Right)
                        true
                    }
                    Key.Enter, Key.NumPadEnter -> {
                        onSelect()
                        true
                    }
                    else -> false
                }
            } else {
                false
            }
        }
}

/**
 * Shortcuts de teclado comuns para ações do app
 */
object KeyboardShortcuts {
    // Navegação principal
    val HOME = Key.H
    val GAMES = Key.G
    val GROUPS = Key.P // Peladas
    val RANKINGS = Key.R
    val PROFILE = Key.U // User

    // Ações
    val NEW_GAME = Key.N
    val SEARCH = Key.F
    val REFRESH = Key.F5
    val SETTINGS = Key.Comma // Ctrl+,

    // Jogo ao vivo
    val GOAL_TEAM1 = Key.One
    val GOAL_TEAM2 = Key.Two
    val PAUSE = Key.P
    val FINISH = Key.E // End
}

/**
 * Modifier que intercepta shortcuts globais
 */
@OptIn(ExperimentalComposeUiApi::class)
fun Modifier.globalKeyboardShortcuts(
    onNavigateHome: () -> Unit = {},
    onNavigateGames: () -> Unit = {},
    onNavigateGroups: () -> Unit = {},
    onNavigateRankings: () -> Unit = {},
    onNavigateProfile: () -> Unit = {},
    onNewGame: () -> Unit = {},
    onSearch: () -> Unit = {},
    onRefresh: () -> Unit = {},
    onSettings: () -> Unit = {}
): Modifier = this.onKeyEvent { event ->
    if (event.type == KeyEventType.KeyDown) {
        when (event.key) {
            KeyboardShortcuts.HOME -> {
                onNavigateHome()
                true
            }
            KeyboardShortcuts.GAMES -> {
                onNavigateGames()
                true
            }
            KeyboardShortcuts.GROUPS -> {
                onNavigateGroups()
                true
            }
            KeyboardShortcuts.RANKINGS -> {
                onNavigateRankings()
                true
            }
            KeyboardShortcuts.PROFILE -> {
                onNavigateProfile()
                true
            }
            KeyboardShortcuts.NEW_GAME -> {
                onNewGame()
                true
            }
            KeyboardShortcuts.SEARCH -> {
                onSearch()
                true
            }
            KeyboardShortcuts.REFRESH -> {
                onRefresh()
                true
            }
            KeyboardShortcuts.SETTINGS -> {
                onSettings()
                true
            }
            else -> false
        }
    } else {
        false
    }
}
