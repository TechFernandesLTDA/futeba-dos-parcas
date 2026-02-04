package com.futebadosparcas.ui.components.design

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// =============================================================================
// SHIMMER COMPONENTS - COMPONENTES CONSOLIDADOS DE EFEITO SHIMMER
// =============================================================================
//
// Este arquivo consolida todos os componentes de shimmer do projeto em um único
// local, facilitando manutenção e garantindo consistência visual.
//
// Estrutura:
// 1. Modifier.shimmerEffect() - Efeito base reutilizável
// 2. ShimmerType - Sealed class com tipos de shimmer
// 3. ShimmerContent() - Composable unificado para renderizar shimmer por tipo
// 4. Componentes primitivos (ShimmerBox, ShimmerCircle, etc.)
// 5. Componentes específicos (Game, Player, Ranking)
// 6. Utilitários para listas
//
// =============================================================================

// =============================================================================
// CONSTANTES DE ANIMACAO
// =============================================================================

/**
 * Configuracoes padrao da animacao shimmer.
 * Centralizadas para garantir consistencia em todo o app.
 *
 * Otimizado para performance:
 * - Duracao reduzida para 800ms (era 1200ms)
 * - Distancia reduzida para 600f (era 1000f)
 * - Usa LinearEasing para evitar calculos de easing complexos
 */
private object ShimmerDefaults {
    /** Duracao da animacao em milissegundos - reduzido para melhor performance */
    const val ANIMATION_DURATION_MS = 800

    /** Distancia percorrida pelo gradiente - reduzido para menos calculos */
    const val TRANSLATE_DISTANCE = 600f

    /** Corner radius padrao para boxes */
    val DEFAULT_CORNER_RADIUS = 8.dp

    /** Corner radius para cards */
    val CARD_CORNER_RADIUS = 16.dp
}

// =============================================================================
// MODIFIER SHIMMER EFFECT
// =============================================================================

/**
 * Efeito shimmer para estados de loading.
 * Aplica uma animacao de gradiente deslizante que simula o efeito de carregamento.
 *
 * Uso:
 * ```kotlin
 * Box(
 *     modifier = Modifier
 *         .size(100.dp)
 *         .shimmerEffect()
 * )
 * ```
 *
 * @return Modifier com efeito shimmer aplicado
 */
fun Modifier.shimmerEffect(): Modifier = composed {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim = transition.animateFloat(
        initialValue = 0f,
        targetValue = ShimmerDefaults.TRANSLATE_DISTANCE,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = ShimmerDefaults.ANIMATION_DURATION_MS,
                easing = LinearEasing
            ),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate"
    )

    val shimmerColorShades = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    background(
        brush = Brush.linearGradient(
            colors = shimmerColorShades,
            start = Offset(
                translateAnim.value - ShimmerDefaults.TRANSLATE_DISTANCE,
                translateAnim.value - ShimmerDefaults.TRANSLATE_DISTANCE
            ),
            end = Offset(translateAnim.value, translateAnim.value)
        )
    )
}

/**
 * Variante do shimmer com easing linear (movimento mais uniforme).
 * Util para listas longas onde FastOutSlowInEasing pode parecer irregular.
 */
fun Modifier.shimmerEffectLinear(): Modifier = composed {
    val transition = rememberInfiniteTransition(label = "shimmer_linear")
    val translateAnim = transition.animateFloat(
        initialValue = 0f,
        targetValue = ShimmerDefaults.TRANSLATE_DISTANCE,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = ShimmerDefaults.ANIMATION_DURATION_MS,
                easing = LinearEasing
            ),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate_linear"
    )

    val shimmerColorShades = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    background(
        brush = Brush.linearGradient(
            colors = shimmerColorShades,
            start = Offset(
                translateAnim.value - ShimmerDefaults.TRANSLATE_DISTANCE,
                translateAnim.value - ShimmerDefaults.TRANSLATE_DISTANCE
            ),
            end = Offset(translateAnim.value, translateAnim.value)
        )
    )
}

// =============================================================================
// SEALED CLASS - TIPOS DE SHIMMER
// =============================================================================

/**
 * Define os tipos de shimmer disponiveis no app.
 * Usado com [ShimmerContent] para renderizar o shimmer apropriado.
 *
 * @property count Numero de itens shimmer a serem exibidos (padrao: 1)
 */
sealed class ShimmerType(open val count: Int = 1) {

    /**
     * Shimmer para cards de jogos.
     * Exibe placeholder para data, local, jogadores e valor.
     *
     * @param count Numero de cards a exibir
     * @param showInCard Se true, envolve em Card com elevacao
     */
    data class Game(
        override val count: Int = 3,
        val showInCard: Boolean = true
    ) : ShimmerType(count)

    /**
     * Shimmer para cards de jogadores.
     * Exibe placeholder para avatar, nome, stats e nivel.
     *
     * @param count Numero de cards a exibir
     * @param style Estilo do card (Row ou Column)
     * @param showInCard Se true, envolve em Card com elevacao
     */
    data class Player(
        override val count: Int = 5,
        val style: PlayerShimmerStyle = PlayerShimmerStyle.ROW,
        val showInCard: Boolean = true
    ) : ShimmerType(count)

    /**
     * Shimmer para itens de ranking.
     * Exibe placeholder para posicao, avatar, nome, stats e pontuacao.
     *
     * @param count Numero de itens a exibir
     */
    data class Ranking(
        override val count: Int = 10
    ) : ShimmerType(count)

    /**
     * Shimmer generico configuravel.
     * Permite customizar altura e corner radius.
     *
     * @param count Numero de boxes a exibir
     * @param height Altura de cada box
     * @param cornerRadius Raio dos cantos
     * @param fillWidth Fracao da largura a preencher (0.0 a 1.0)
     */
    data class Generic(
        override val count: Int = 5,
        val height: Dp = 60.dp,
        val cornerRadius: Dp = 8.dp,
        val fillWidth: Float = 1f
    ) : ShimmerType(count)

    /**
     * Shimmer para listas com layout customizado.
     * Recebe um composable para definir o conteudo de cada item.
     *
     * @param count Numero de itens a exibir
     * @param contentPadding Padding do conteudo
     * @param verticalArrangement Espacamento vertical entre itens
     */
    data class List(
        override val count: Int = 5,
        val contentPadding: PaddingValues = PaddingValues(16.dp),
        val verticalArrangement: Arrangement.Vertical = Arrangement.spacedBy(12.dp)
    ) : ShimmerType(count)

    /**
     * Shimmer para itens de texto simples.
     * Exibe duas linhas de texto placeholder.
     *
     * @param count Numero de itens a exibir
     */
    data class Text(
        override val count: Int = 5
    ) : ShimmerType(count)
}

/**
 * Estilos disponiveis para shimmer de jogador.
 */
enum class PlayerShimmerStyle {
    /** Layout horizontal com avatar a esquerda */
    ROW,
    /** Layout vertical centralizado (grid) */
    COLUMN
}

// =============================================================================
// SHIMMER CONTENT - COMPOSABLE UNIFICADO
// =============================================================================

/**
 * Composable unificado para renderizar shimmer baseado no tipo.
 *
 * Uso:
 * ```kotlin
 * // Lista de jogos
 * ShimmerContent(type = ShimmerType.Game(count = 3))
 *
 * // Lista de jogadores em grid
 * ShimmerContent(
 *     type = ShimmerType.Player(
 *         count = 6,
 *         style = PlayerShimmerStyle.COLUMN
 *     )
 * )
 *
 * // Shimmer generico
 * ShimmerContent(
 *     type = ShimmerType.Generic(
 *         count = 4,
 *         height = 80.dp
 *     )
 * )
 * ```
 *
 * @param type Tipo de shimmer a ser renderizado
 * @param modifier Modifier a ser aplicado ao container
 */
@Composable
fun ShimmerContent(
    type: ShimmerType,
    modifier: Modifier = Modifier
) {
    when (type) {
        is ShimmerType.Game -> {
            ShimmerGameCardList(
                count = type.count,
                showInCard = type.showInCard,
                modifier = modifier
            )
        }

        is ShimmerType.Player -> {
            when (type.style) {
                PlayerShimmerStyle.ROW -> {
                    ShimmerPlayerCardList(
                        count = type.count,
                        showInCard = type.showInCard,
                        modifier = modifier
                    )
                }
                PlayerShimmerStyle.COLUMN -> {
                    ShimmerPlayerColumnList(
                        count = type.count,
                        modifier = modifier
                    )
                }
            }
        }

        is ShimmerType.Ranking -> {
            ShimmerRankingList(
                count = type.count,
                modifier = modifier
            )
        }

        is ShimmerType.Generic -> {
            ShimmerGenericList(
                count = type.count,
                height = type.height,
                cornerRadius = type.cornerRadius,
                fillWidth = type.fillWidth,
                modifier = modifier
            )
        }

        is ShimmerType.List -> {
            ShimmerListContent(
                count = type.count,
                contentPadding = type.contentPadding,
                verticalArrangement = type.verticalArrangement,
                modifier = modifier
            )
        }

        is ShimmerType.Text -> {
            ShimmerTextList(
                count = type.count,
                modifier = modifier
            )
        }
    }
}

// =============================================================================
// COMPONENTES PRIMITIVOS
// =============================================================================

/**
 * Box retangular com efeito shimmer.
 * Componente base para construir layouts de shimmer customizados.
 *
 * @param modifier Modifier para customizar tamanho e posicionamento
 * @param cornerRadius Raio dos cantos (padrao: 8.dp)
 * @param shape Shape customizado (sobrescreve cornerRadius se fornecido)
 */
@Composable
fun ShimmerBox(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = ShimmerDefaults.DEFAULT_CORNER_RADIUS,
    shape: Shape? = null
) {
    Box(
        modifier = modifier
            .clip(shape ?: RoundedCornerShape(cornerRadius))
            .shimmerEffect()
    )
}

/**
 * Circulo com efeito shimmer.
 * Util para placeholders de avatares e icones.
 *
 * @param modifier Modifier para customizar tamanho
 */
@Composable
fun ShimmerCircle(
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(CircleShape)
            .shimmerEffect()
    )
}

/**
 * Linha de texto com shimmer.
 * Util para placeholders de textos individuais.
 *
 * @param modifier Modifier para customizar
 * @param width Largura da linha (usar fillMaxWidth com fracao para responsivo)
 * @param height Altura da linha
 */
@Composable
fun ShimmerTextLine(
    modifier: Modifier = Modifier,
    width: Dp = 120.dp,
    height: Dp = 16.dp
) {
    ShimmerBox(
        modifier = modifier
            .width(width)
            .height(height),
        cornerRadius = 4.dp
    )
}

// =============================================================================
// COMPONENTES ESPECIFICOS - GAME
// =============================================================================

/**
 * Card de jogo com efeito shimmer.
 * Simula o layout do GameCard durante carregamento.
 *
 * @param modifier Modifier a ser aplicado
 * @param showInCard Se true, envolve em Card com elevacao
 */
@Composable
fun ShimmerGameCard(
    modifier: Modifier = Modifier,
    showInCard: Boolean = true
) {
    val content: @Composable () -> Unit = {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // Header - Data e Hora
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                ShimmerBox(
                    modifier = Modifier
                        .width(100.dp)
                        .height(20.dp),
                    cornerRadius = 4.dp
                )
                ShimmerBox(
                    modifier = Modifier
                        .width(60.dp)
                        .height(20.dp),
                    cornerRadius = 4.dp
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Local com icone
            Row(verticalAlignment = Alignment.CenterVertically) {
                ShimmerCircle(modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(8.dp))
                ShimmerBox(
                    modifier = Modifier
                        .width(180.dp)
                        .height(16.dp),
                    cornerRadius = 4.dp
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Footer - Jogadores e Valor
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    ShimmerCircle(modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    ShimmerBox(
                        modifier = Modifier
                            .width(80.dp)
                            .height(16.dp),
                        cornerRadius = 4.dp
                    )
                }

                ShimmerBox(
                    modifier = Modifier
                        .width(60.dp)
                        .height(24.dp),
                    cornerRadius = 12.dp
                )
            }
        }
    }

    if (showInCard) {
        Card(
            modifier = modifier
                .fillMaxWidth()
                .height(140.dp),
            shape = RoundedCornerShape(ShimmerDefaults.CARD_CORNER_RADIUS),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            content()
        }
    } else {
        Box(modifier = modifier.fillMaxWidth()) {
            content()
        }
    }
}

/**
 * Variante simples do shimmer de jogo (sem card).
 * Layout mais compacto para uso em listas densas.
 */
@Composable
fun ShimmerGameCardSimple(
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            ShimmerBox(
                modifier = Modifier
                    .width(80.dp)
                    .height(20.dp)
            )
            ShimmerBox(
                modifier = Modifier
                    .width(100.dp)
                    .height(20.dp)
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        ShimmerBox(
            modifier = Modifier
                .fillMaxWidth(0.7f)
                .height(24.dp)
        )

        Spacer(modifier = Modifier.height(8.dp))

        ShimmerBox(
            modifier = Modifier
                .fillMaxWidth(0.5f)
                .height(16.dp)
        )

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            ShimmerBox(
                modifier = Modifier
                    .width(100.dp)
                    .height(16.dp)
            )
            ShimmerBox(
                modifier = Modifier
                    .width(80.dp)
                    .height(16.dp)
            )
        }
    }
}

/**
 * Lista de cards de jogo com shimmer.
 */
@Composable
private fun ShimmerGameCardList(
    count: Int,
    showInCard: Boolean,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        repeat(count) {
            ShimmerGameCard(showInCard = showInCard)
        }
    }
}

// =============================================================================
// COMPONENTES ESPECIFICOS - PLAYER
// =============================================================================

/**
 * Card de jogador com efeito shimmer (layout horizontal).
 * Simula o layout do PlayerCard durante carregamento.
 *
 * @param modifier Modifier a ser aplicado
 * @param showInCard Se true, envolve em Card com elevacao
 */
@Composable
fun ShimmerPlayerCard(
    modifier: Modifier = Modifier,
    showInCard: Boolean = true
) {
    val content: @Composable () -> Unit = {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Avatar
            ShimmerCircle(modifier = Modifier.size(64.dp))

            Spacer(modifier = Modifier.width(16.dp))

            // Conteudo central
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Nome
                ShimmerBox(
                    modifier = Modifier
                        .width(140.dp)
                        .height(20.dp),
                    cornerRadius = 4.dp
                )

                // Estatisticas
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    ShimmerBox(
                        modifier = Modifier
                            .width(60.dp)
                            .height(16.dp),
                        cornerRadius = 4.dp
                    )
                    ShimmerBox(
                        modifier = Modifier
                            .width(60.dp)
                            .height(16.dp),
                        cornerRadius = 4.dp
                    )
                }
            }

            // Nivel/Badge
            ShimmerBox(
                modifier = Modifier.size(40.dp),
                cornerRadius = 8.dp
            )
        }
    }

    if (showInCard) {
        Card(
            modifier = modifier
                .fillMaxWidth()
                .height(100.dp),
            shape = RoundedCornerShape(ShimmerDefaults.CARD_CORNER_RADIUS),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            content()
        }
    } else {
        Box(
            modifier = modifier
                .fillMaxWidth()
                .height(100.dp)
        ) {
            content()
        }
    }
}

/**
 * Card de jogador com layout vertical (para grids).
 * Usado em FlowRow ou LazyVerticalGrid.
 *
 * @param modifier Modifier a ser aplicado
 */
@Composable
fun ShimmerPlayerCardColumn(
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Avatar
        ShimmerCircle(modifier = Modifier.size(64.dp))

        Spacer(modifier = Modifier.height(8.dp))

        // Nome
        ShimmerBox(
            modifier = Modifier
                .width(80.dp)
                .height(16.dp)
        )

        Spacer(modifier = Modifier.height(4.dp))

        // Level/XP
        ShimmerBox(
            modifier = Modifier
                .width(50.dp)
                .height(12.dp)
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Stats em linha
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            repeat(3) {
                ShimmerBox(
                    modifier = Modifier
                        .width(40.dp)
                        .height(12.dp)
                )
            }
        }
    }
}

/**
 * Lista de cards de jogador com shimmer (layout horizontal).
 */
@Composable
private fun ShimmerPlayerCardList(
    count: Int,
    showInCard: Boolean,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        repeat(count) {
            ShimmerPlayerCard(showInCard = showInCard)
        }
    }
}

/**
 * Lista de cards de jogador com shimmer (layout vertical/grid).
 */
@Composable
private fun ShimmerPlayerColumnList(
    count: Int,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        repeat(count) {
            ShimmerPlayerCardColumn()
        }
    }
}

// =============================================================================
// COMPONENTES ESPECIFICOS - RANKING
// =============================================================================

/**
 * Item de ranking com efeito shimmer.
 * Simula o layout do RankingItem durante carregamento.
 *
 * @param modifier Modifier a ser aplicado
 */
@Composable
fun ShimmerRankingItem(
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Posicao
        ShimmerBox(modifier = Modifier.size(32.dp))

        Spacer(modifier = Modifier.width(12.dp))

        // Avatar
        ShimmerCircle(modifier = Modifier.size(48.dp))

        Spacer(modifier = Modifier.width(12.dp))

        // Nome e stats
        Column(modifier = Modifier.weight(1f)) {
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth(0.6f)
                    .height(18.dp)
            )

            Spacer(modifier = Modifier.height(4.dp))

            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth(0.4f)
                    .height(14.dp)
            )
        }

        // Pontuacao
        ShimmerBox(
            modifier = Modifier
                .width(60.dp)
                .height(24.dp)
        )
    }
}

/**
 * Lista de itens de ranking com shimmer.
 */
@Composable
private fun ShimmerRankingList(
    count: Int,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxWidth()) {
        repeat(count) {
            ShimmerRankingItem()
        }
    }
}

// =============================================================================
// COMPONENTES GENERICOS
// =============================================================================

/**
 * Lista de boxes genericos com shimmer.
 */
@Composable
private fun ShimmerGenericList(
    count: Int,
    height: Dp,
    cornerRadius: Dp,
    fillWidth: Float,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        repeat(count) {
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth(fillWidth)
                    .height(height),
                cornerRadius = cornerRadius
            )
        }
    }
}

/**
 * Item de texto com shimmer (duas linhas).
 */
@Composable
fun ShimmerTextItem(
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        ShimmerBox(
            modifier = Modifier
                .fillMaxWidth(0.7f)
                .height(20.dp),
            cornerRadius = 4.dp
        )
        ShimmerBox(
            modifier = Modifier
                .fillMaxWidth(0.5f)
                .height(16.dp),
            cornerRadius = 4.dp
        )
    }
}

/**
 * Lista de itens de texto com shimmer.
 */
@Composable
private fun ShimmerTextList(
    count: Int,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
    ) {
        repeat(count) {
            ShimmerTextItem()
        }
    }
}

// =============================================================================
// UTILITARIOS PARA LISTAS
// =============================================================================

/**
 * Componente generico de shimmer para listas com layout customizado.
 * Permite criar efeitos de loading personalizados usando LazyColumn.
 *
 * @param count Numero de itens a exibir
 * @param modifier Modifier a ser aplicado
 * @param contentPadding Padding do conteudo
 * @param verticalArrangement Espacamento vertical entre itens
 * @param shimmerContent Composable que define o conteudo de cada item
 */
@Composable
fun ShimmerListContent(
    modifier: Modifier = Modifier,
    count: Int = 5,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    verticalArrangement: Arrangement.Vertical = Arrangement.spacedBy(12.dp),
    shimmerContent: @Composable (Brush) -> Unit = { brush ->
        DefaultShimmerItem(brush = brush)
    }
) {
    val brush = rememberShimmerBrush()

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = contentPadding,
        verticalArrangement = verticalArrangement
    ) {
        items(count) {
            shimmerContent(brush)
        }
    }
}

/**
 * Extension function para adicionar shimmer items a uma LazyListScope existente.
 * Util quando voce quer misturar shimmer com conteudo real em uma LazyColumn.
 *
 * Uso:
 * ```kotlin
 * LazyColumn {
 *     if (isLoading) {
 *         shimmerItems(count = 5) { brush ->
 *             MyCustomShimmerItem(brush = brush)
 *         }
 *     } else {
 *         items(data) { item ->
 *             MyItem(item = item)
 *         }
 *     }
 * }
 * ```
 *
 * @param count Numero de itens shimmer
 * @param shimmerContent Composable que define o conteudo de cada item
 */
fun LazyListScope.shimmerItems(
    count: Int,
    shimmerContent: @Composable (Brush) -> Unit
) {
    items(count) {
        ShimmerBrushProvider { brush ->
            shimmerContent(brush)
        }
    }
}

/**
 * Cria e retorna um Brush animado para shimmer.
 * Util para criar componentes customizados que usam shimmer.
 *
 * @return Brush com gradiente animado
 */
@Composable
fun rememberShimmerBrush(): Brush {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    val transition = rememberInfiniteTransition(label = "shimmer_brush")
    val translateAnim = transition.animateFloat(
        initialValue = 0f,
        targetValue = ShimmerDefaults.TRANSLATE_DISTANCE,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = ShimmerDefaults.ANIMATION_DURATION_MS,
                easing = LinearEasing
            ),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_brush_translate"
    )

    return Brush.linearGradient(
        colors = shimmerColors,
        start = Offset(
            translateAnim.value - ShimmerDefaults.TRANSLATE_DISTANCE,
            translateAnim.value - ShimmerDefaults.TRANSLATE_DISTANCE
        ),
        end = Offset(translateAnim.value, translateAnim.value)
    )
}

/**
 * Provider que fornece um Brush animado para seu conteudo.
 * Util para criar shimmer em LazyListScope.
 */
@Composable
private fun ShimmerBrushProvider(
    content: @Composable (Brush) -> Unit
) {
    val brush = rememberShimmerBrush()
    content(brush)
}

/**
 * Item padrao de shimmer usado quando nenhum conteudo customizado e fornecido.
 */
@Composable
private fun DefaultShimmerItem(brush: Brush) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(0.7f)
                .height(20.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(brush)
        )
        Box(
            modifier = Modifier
                .fillMaxWidth(0.5f)
                .height(16.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(brush)
        )
    }
}
