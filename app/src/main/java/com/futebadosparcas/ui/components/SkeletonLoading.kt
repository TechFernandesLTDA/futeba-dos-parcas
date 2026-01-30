package com.futebadosparcas.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.dp

// =============================================================================
// SKELETON LOADING - COMPONENTES DE LOADING COM EFEITO WAVE STAGGERED
// =============================================================================
//
// Este arquivo contem componentes de skeleton loading com animacao wave
// (onda) que se propaga com delay entre os itens (stagger effect).
//
// Componentes:
// 1. LocationCardSkeleton - Skeleton para cards de locais/campos
// 2. LocationListSkeleton - Lista de skeletons com efeito stagger
// 3. FieldRowSkeleton - Skeleton para linha de campo dentro do card
//
// Uso:
// ```kotlin
// when (uiState) {
//     is UiState.Loading -> LocationListSkeleton()
//     is UiState.Success -> LocationList(locations = uiState.data)
// }
// ```
//
// =============================================================================

// =============================================================================
// CONSTANTES DE ANIMACAO
// =============================================================================

/**
 * Configuracoes padrao da animacao skeleton.
 * O efeito wave move da esquerda para direita com stagger entre itens.
 */
private object SkeletonDefaults {
    /** Duracao base da animacao em milissegundos */
    const val ANIMATION_DURATION_MS = 1200

    /** Distancia percorrida pelo gradiente */
    const val TRANSLATE_DISTANCE = 1000f

    /** Corner radius padrao para boxes */
    val DEFAULT_CORNER_RADIUS = 8.dp

    /** Corner radius para cards */
    val CARD_CORNER_RADIUS = 12.dp

    /** Delay padrao entre itens em ms */
    const val DEFAULT_STAGGER_DELAY_MS = 100
}

// =============================================================================
// BRUSH ANIMADO COM DELAY (STAGGER)
// =============================================================================

/**
 * Cria um Brush animado para efeito shimmer/wave com delay opcional.
 * O delay permite criar o efeito de onda que se propaga entre itens.
 *
 * @param animationDelay Delay em ms antes de iniciar a animacao (para stagger)
 * @return Brush com gradiente animado movendo da esquerda para direita
 */
@Composable
private fun rememberStaggeredShimmerBrush(animationDelay: Int = 0): Brush {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    val transition = rememberInfiniteTransition(label = "skeleton_wave_$animationDelay")
    val translateAnim by transition.animateFloat(
        initialValue = 0f,
        targetValue = SkeletonDefaults.TRANSLATE_DISTANCE,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = SkeletonDefaults.ANIMATION_DURATION_MS,
                delayMillis = animationDelay,
                easing = LinearEasing
            ),
            repeatMode = RepeatMode.Restart
        ),
        label = "skeleton_translate_$animationDelay"
    )

    // Wave effect: gradiente horizontal movendo da esquerda para direita
    return Brush.linearGradient(
        colors = shimmerColors,
        start = Offset(translateAnim - SkeletonDefaults.TRANSLATE_DISTANCE, 0f),
        end = Offset(translateAnim, 0f)
    )
}

// =============================================================================
// SKELETON BOX PRIMITIVO
// =============================================================================

/**
 * Box retangular com efeito skeleton wave.
 * Componente base para construir layouts de skeleton.
 *
 * @param modifier Modifier para customizar tamanho e posicionamento
 * @param brush Brush animado para o efeito wave
 * @param cornerRadius Raio dos cantos (padrao: 8.dp)
 */
@Composable
private fun SkeletonBox(
    modifier: Modifier = Modifier,
    brush: Brush,
    cornerRadius: androidx.compose.ui.unit.Dp = SkeletonDefaults.DEFAULT_CORNER_RADIUS
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(cornerRadius))
            .background(brush)
    )
}

// =============================================================================
// LOCATION CARD SKELETON
// =============================================================================

/**
 * Skeleton para card de local com efeito wave staggered.
 * Simula o layout do LocationCard durante carregamento.
 *
 * Layout:
 * - Imagem placeholder (arredondado)
 * - Titulo (linha longa)
 * - Subtitulo (linha curta)
 * - Rating stars placeholder
 * - Endereco placeholder
 * - Fields placeholders (opcional)
 *
 * @param modifier Modifier a ser aplicado ao card
 * @param animationDelay Delay em ms para inicio da animacao (para stagger effect)
 * @param showFieldRows Se true, exibe placeholders para campos dentro do local
 */
@Composable
fun LocationCardSkeleton(
    modifier: Modifier = Modifier,
    animationDelay: Int = 0,
    showFieldRows: Boolean = true
) {
    val brush = rememberStaggeredShimmerBrush(animationDelay = animationDelay)

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(SkeletonDefaults.CARD_CORNER_RADIUS),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Header: Titulo e botoes de acao
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    // Titulo do local (linha longa)
                    SkeletonBox(
                        modifier = Modifier
                            .fillMaxWidth(0.7f)
                            .height(20.dp),
                        brush = brush,
                        cornerRadius = 4.dp
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    // Subtitulo/endereco (linha curta)
                    SkeletonBox(
                        modifier = Modifier
                            .fillMaxWidth(0.5f)
                            .height(14.dp),
                        brush = brush,
                        cornerRadius = 4.dp
                    )
                }

                // Botoes de acao placeholders
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    // Botao editar
                    SkeletonBox(
                        modifier = Modifier.size(32.dp),
                        brush = brush,
                        cornerRadius = 16.dp
                    )
                    // Botao deletar
                    SkeletonBox(
                        modifier = Modifier.size(32.dp),
                        brush = brush,
                        cornerRadius = 16.dp
                    )
                }
            }

            // Rating stars placeholder
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                repeat(5) {
                    SkeletonBox(
                        modifier = Modifier.size(16.dp),
                        brush = brush,
                        cornerRadius = 2.dp
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                // Rating text
                SkeletonBox(
                    modifier = Modifier
                        .width(32.dp)
                        .height(14.dp),
                    brush = brush,
                    cornerRadius = 4.dp
                )
            }

            // Endereco completo
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Icone de localizacao
                SkeletonBox(
                    modifier = Modifier.size(16.dp),
                    brush = brush,
                    cornerRadius = 8.dp
                )
                Spacer(modifier = Modifier.width(6.dp))
                // Texto do endereco
                SkeletonBox(
                    modifier = Modifier
                        .fillMaxWidth(0.85f)
                        .height(14.dp),
                    brush = brush,
                    cornerRadius = 4.dp
                )
            }

            // Campos (fields) se habilitado
            if (showFieldRows) {
                // Divider placeholder
                SkeletonBox(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(1.dp),
                    brush = brush,
                    cornerRadius = 0.dp
                )

                // Label "X campos"
                SkeletonBox(
                    modifier = Modifier
                        .width(80.dp)
                        .height(12.dp),
                    brush = brush,
                    cornerRadius = 4.dp
                )

                // 2 campos placeholder
                repeat(2) { index ->
                    FieldRowSkeleton(
                        brush = brush,
                        modifier = Modifier.padding(top = if (index > 0) 4.dp else 0.dp)
                    )
                }
            }
        }
    }
}

/**
 * Skeleton para linha de campo dentro do LocationCardSkeleton.
 * Simula o FieldRow durante carregamento.
 *
 * @param brush Brush animado compartilhado com o card pai
 * @param modifier Modifier a ser aplicado
 */
@Composable
private fun FieldRowSkeleton(
    brush: Brush,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(MaterialTheme.colorScheme.background.copy(alpha = 0.5f))
            .padding(8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            // Nome do campo
            SkeletonBox(
                modifier = Modifier
                    .width(100.dp)
                    .height(14.dp),
                brush = brush,
                cornerRadius = 4.dp
            )
            Spacer(modifier = Modifier.height(4.dp))
            // Tipo do campo
            SkeletonBox(
                modifier = Modifier
                    .width(60.dp)
                    .height(12.dp),
                brush = brush,
                cornerRadius = 4.dp
            )
        }
        // Botao de remover
        SkeletonBox(
            modifier = Modifier.size(28.dp),
            brush = brush,
            cornerRadius = 14.dp
        )
    }
}

// =============================================================================
// LOCATION LIST SKELETON
// =============================================================================

/**
 * Lista de skeletons de local com efeito wave staggered.
 * Cada card inicia sua animacao com um delay crescente, criando
 * o efeito de onda que se propaga de cima para baixo.
 *
 * @param modifier Modifier a ser aplicado ao container
 * @param itemCount Numero de cards skeleton a exibir (padrao: 4)
 * @param staggerDelayMs Delay em ms entre cada card (padrao: 100ms)
 * @param showFieldRows Se true, exibe placeholders de campos em cada card
 */
@Composable
fun LocationListSkeleton(
    modifier: Modifier = Modifier,
    itemCount: Int = 4,
    staggerDelayMs: Int = SkeletonDefaults.DEFAULT_STAGGER_DELAY_MS,
    showFieldRows: Boolean = true
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        repeat(itemCount) { index ->
            LocationCardSkeleton(
                animationDelay = index * staggerDelayMs,
                showFieldRows = showFieldRows
            )
        }
    }
}

// =============================================================================
// COMPACT LOCATION SKELETON (SEM FIELDS)
// =============================================================================

/**
 * Skeleton compacto para locais sem exibir campos.
 * Util para listas mais densas onde nao e necessario mostrar campos.
 *
 * @param modifier Modifier a ser aplicado
 * @param animationDelay Delay em ms para inicio da animacao
 */
@Composable
fun LocationCardSkeletonCompact(
    modifier: Modifier = Modifier,
    animationDelay: Int = 0
) {
    LocationCardSkeleton(
        modifier = modifier,
        animationDelay = animationDelay,
        showFieldRows = false
    )
}

/**
 * Lista de skeletons compactos de local.
 *
 * @param modifier Modifier a ser aplicado ao container
 * @param itemCount Numero de cards skeleton a exibir (padrao: 5)
 * @param staggerDelayMs Delay em ms entre cada card (padrao: 100ms)
 */
@Composable
fun LocationListSkeletonCompact(
    modifier: Modifier = Modifier,
    itemCount: Int = 5,
    staggerDelayMs: Int = SkeletonDefaults.DEFAULT_STAGGER_DELAY_MS
) {
    LocationListSkeleton(
        modifier = modifier,
        itemCount = itemCount,
        staggerDelayMs = staggerDelayMs,
        showFieldRows = false
    )
}
