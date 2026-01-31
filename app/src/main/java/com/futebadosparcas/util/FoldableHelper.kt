package com.futebadosparcas.util

import android.app.Activity
import android.content.res.Configuration
import android.graphics.Rect
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp

/**
 * Helper para layouts adaptativos em dispositivos de tela grande e dobráveis.
 * Versão simplificada que funciona sem a biblioteca androidx.window.
 *
 * Para suporte completo a dobráveis, adicione a dependência:
 * implementation("androidx.window:window:1.2.0")
 */

// ==================== Models ====================

/**
 * Estado do dispositivo dobrável (simplificado).
 */
sealed class FoldableState {
    /**
     * Dispositivo não é dobrável ou não tem informação de fold.
     */
    data object Normal : FoldableState()

    /**
     * Dispositivo está completamente aberto (flat).
     */
    data object Flat : FoldableState()

    /**
     * Dispositivo está semi-aberto (half-opened).
     */
    data class HalfOpened(
        val orientation: FoldOrientation,
        val hingeBounds: Rect
    ) : FoldableState()

    /**
     * Dispositivo está em modo livro (book mode).
     */
    data class BookMode(val hingeBounds: Rect) : FoldableState()
}

/**
 * Orientação do fold.
 */
enum class FoldOrientation {
    HORIZONTAL,
    VERTICAL
}

/**
 * Postura do dispositivo.
 */
enum class DevicePosture {
    NORMAL,        // Dispositivo não dobrável ou totalmente aberto
    HALF_OPENED,   // Semi-aberto em modo paisagem
    BOOK_MODE,     // Semi-aberto em modo retrato (como um livro)
    TABLETOP_MODE  // Semi-aberto com tela para cima (como laptop)
}

/**
 * Informação completa sobre o estado do fold.
 */
data class FoldInfo(
    val state: FoldableState,
    val posture: DevicePosture,
    val hingeBounds: Rect?,
    val isSeparating: Boolean
)

// ==================== Helper Object ====================

/**
 * Objeto helper para trabalhar com dispositivos grandes/dobráveis.
 */
object FoldableHelper {

    /**
     * Verifica se o dispositivo tem tela grande (tablet/foldable aberto).
     */
    fun isLargeScreen(configuration: Configuration): Boolean {
        val screenWidthDp = configuration.screenWidthDp
        return screenWidthDp >= 600
    }

    /**
     * Verifica se é um tablet em modo paisagem.
     */
    fun isTabletLandscape(configuration: Configuration): Boolean {
        return isLargeScreen(configuration) &&
            configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
    }

    /**
     * Retorna FoldInfo padrão (sem suporte a foldable).
     */
    fun getDefaultFoldInfo(): FoldInfo {
        return FoldInfo(
            state = FoldableState.Normal,
            posture = DevicePosture.NORMAL,
            hingeBounds = null,
            isSeparating = false
        )
    }
}

// ==================== Composables ====================

/**
 * Remembers o estado do dispositivo (versão simplificada).
 */
@Composable
fun rememberFoldableState(): State<FoldInfo> {
    // Versão simplificada que não detecta dobráveis reais
    // mas funciona para layouts adaptativos em tablets
    val foldInfo = remember {
        mutableStateOf(FoldableHelper.getDefaultFoldInfo())
    }

    return foldInfo
}

/**
 * Verifica se a tela atual é grande (tablet ou foldable aberto).
 */
@Composable
fun isLargeScreen(): Boolean {
    val configuration = LocalConfiguration.current
    return FoldableHelper.isLargeScreen(configuration)
}

/**
 * Verifica se está em modo paisagem em tela grande.
 */
@Composable
fun isTabletLandscape(): Boolean {
    val configuration = LocalConfiguration.current
    return FoldableHelper.isTabletLandscape(configuration)
}

/**
 * Layout adaptativo que usa duas colunas em telas grandes.
 */
@Composable
fun AdaptiveLayout(
    modifier: Modifier = Modifier,
    useTwoPanes: Boolean = isLargeScreen(),
    leftOrTopContent: @Composable () -> Unit,
    rightOrBottomContent: @Composable () -> Unit
) {
    if (useTwoPanes) {
        // Tela grande: lado a lado
        Row(modifier = modifier) {
            Box(modifier = Modifier.weight(1f)) {
                leftOrTopContent()
            }
            Spacer(modifier = Modifier.width(8.dp))
            Box(modifier = Modifier.weight(1f)) {
                rightOrBottomContent()
            }
        }
    } else {
        // Tela pequena: empilhado
        Column(modifier = modifier) {
            Box(modifier = Modifier.weight(1f)) {
                leftOrTopContent()
            }
            Spacer(modifier = Modifier.height(8.dp))
            Box(modifier = Modifier.weight(1f)) {
                rightOrBottomContent()
            }
        }
    }
}

/**
 * Layout adaptativo para dispositivos dobráveis.
 * Separa conteúdo automaticamente baseado na postura do dispositivo.
 */
@Composable
fun FoldableAwareLayout(
    modifier: Modifier = Modifier,
    foldInfo: FoldInfo = rememberFoldableState().value,
    topOrLeftContent: @Composable () -> Unit,
    bottomOrRightContent: @Composable () -> Unit
) {
    val isLarge = isLargeScreen()
    val density = LocalDensity.current

    when (foldInfo.posture) {
        DevicePosture.TABLETOP_MODE -> {
            // Modo tabletop: conteúdo acima/abaixo do hinge
            Column(modifier = modifier) {
                Box(modifier = Modifier.weight(1f)) {
                    topOrLeftContent()
                }

                // Espaço para o hinge
                foldInfo.hingeBounds?.let { bounds ->
                    val hingeHeight = with(density) { (bounds.bottom - bounds.top).toDp() }
                    Spacer(modifier = Modifier.height(hingeHeight))
                }

                Box(modifier = Modifier.weight(1f)) {
                    bottomOrRightContent()
                }
            }
        }
        DevicePosture.BOOK_MODE -> {
            // Modo livro: lista à esquerda, detalhes à direita
            Row(modifier = modifier) {
                Box(modifier = Modifier.weight(1f)) {
                    topOrLeftContent()
                }

                // Espaço para o hinge
                foldInfo.hingeBounds?.let { bounds ->
                    val hingeWidth = with(density) { (bounds.right - bounds.left).toDp() }
                    Spacer(modifier = Modifier.width(hingeWidth))
                }

                Box(modifier = Modifier.weight(1f)) {
                    bottomOrRightContent()
                }
            }
        }
        else -> {
            // Modo normal: usa layout adaptativo padrão
            AdaptiveLayout(
                modifier = modifier,
                useTwoPanes = isLarge,
                leftOrTopContent = topOrLeftContent,
                rightOrBottomContent = bottomOrRightContent
            )
        }
    }
}

/**
 * Verifica se o dispositivo está em modo semi-aberto (qualquer orientação).
 */
@Composable
fun isDeviceHalfOpened(): Boolean {
    val foldInfo = rememberFoldableState().value
    return foldInfo.posture == DevicePosture.HALF_OPENED ||
        foldInfo.posture == DevicePosture.TABLETOP_MODE ||
        foldInfo.posture == DevicePosture.BOOK_MODE
}

/**
 * Verifica se o dispositivo está em modo tabletop.
 */
@Composable
fun isTabletopMode(): Boolean {
    return rememberFoldableState().value.posture == DevicePosture.TABLETOP_MODE
}

/**
 * Verifica se o dispositivo está em modo livro.
 */
@Composable
fun isBookMode(): Boolean {
    return rememberFoldableState().value.posture == DevicePosture.BOOK_MODE
}

/**
 * Retorna os bounds do hinge se disponível.
 */
@Composable
fun getHingeBounds(): Rect? {
    return rememberFoldableState().value.hingeBounds
}
