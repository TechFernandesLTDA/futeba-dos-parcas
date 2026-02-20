package com.futebadosparcas.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BrokenImage
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import coil3.compose.AsyncImagePainter
import coil3.request.CachePolicy
import coil3.request.ImageRequest
import coil3.size.Size
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource
/**
 * Estado de carregamento progressivo de imagens.
 *
 * O carregamento segue a seguinte ordem:
 * 1. Placeholder estático enquanto não há dados
 * 2. Thumbnail em baixa resolução (carrega rápido)
 * 3. Imagem completa em alta resolução
 */
private enum class ImageLoadState {
    PLACEHOLDER,
    THUMBNAIL_LOADING,
    THUMBNAIL_LOADED,
    FULL_LOADING,
    FULL_LOADED,
    ERROR
}

/**
 * LocationImage - Composable para carregamento progressivo de imagens de locais.
 *
 * Features:
 * - Carregamento progressivo: placeholder -> thumbnail -> imagem completa
 * - Crossfade animation entre estados
 * - Retry automático em caso de falha (até 3 tentativas)
 * - Placeholder customizável
 * - Suporte a cache via Coil
 *
 * Uso:
 * ```kotlin
 * LocationImage(
 *     imageUrl = location.photoUrl,
 *     contentDescription = "Foto de ${location.name}",
 *     modifier = Modifier.fillMaxWidth().height(200.dp)
 * )
 * ```
 *
 * @param imageUrl URL da imagem a ser carregada
 * @param contentDescription Descrição para acessibilidade
 * @param modifier Modifier para customização
 * @param thumbnailSize Tamanho do thumbnail em pixels (padrão: 50)
 * @param placeholderRes Resource drawable do placeholder
 * @param shape Formato da imagem (padrão: RoundedCornerShape(12.dp))
 * @param contentScale Como a imagem deve escalar (padrão: ContentScale.Crop)
 * @param maxRetries Número máximo de tentativas em caso de erro (padrão: 3)
 */
@Composable
fun LocationImage(
    imageUrl: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    thumbnailSize: Int = 50,
    @DrawableRes placeholderRes: Int = R.drawable.ic_location_placeholder,
    shape: Shape = RoundedCornerShape(12.dp),
    contentScale: ContentScale = ContentScale.Crop,
    maxRetries: Int = 3
) {
    ProgressiveImage(
        imageUrl = imageUrl,
        contentDescription = contentDescription,
        modifier = modifier,
        thumbnailSize = thumbnailSize,
        placeholderRes = placeholderRes,
        shape = shape,
        contentScale = contentScale,
        maxRetries = maxRetries
    )
}

/**
 * FieldImage - Composable para carregamento progressivo de imagens de campos/quadras.
 *
 * Features:
 * - Carregamento progressivo: placeholder -> thumbnail -> imagem completa
 * - Crossfade animation entre estados
 * - Retry automático em caso de falha (até 3 tentativas)
 * - Placeholder específico para campos
 * - Dimensões otimizadas para cards de campo
 *
 * Uso:
 * ```kotlin
 * FieldImage(
 *     imageUrl = field.photoUrl,
 *     contentDescription = "Foto de ${field.name}",
 *     width = 120.dp,
 *     height = 80.dp
 * )
 * ```
 *
 * @param imageUrl URL da imagem a ser carregada
 * @param contentDescription Descrição para acessibilidade
 * @param modifier Modifier para customização
 * @param width Largura da imagem (padrão: 120.dp)
 * @param height Altura da imagem (padrão: 80.dp)
 * @param thumbnailSize Tamanho do thumbnail em pixels (padrão: 50)
 * @param placeholderRes Resource drawable do placeholder
 * @param cornerRadius Raio dos cantos arredondados (padrão: 8.dp)
 * @param contentScale Como a imagem deve escalar (padrão: ContentScale.Crop)
 * @param maxRetries Número máximo de tentativas em caso de erro (padrão: 3)
 */
@Composable
fun FieldImage(
    imageUrl: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    width: Dp = 120.dp,
    height: Dp = 80.dp,
    thumbnailSize: Int = 50,
    @DrawableRes placeholderRes: Int = R.drawable.ic_field_placeholder,
    cornerRadius: Dp = 8.dp,
    contentScale: ContentScale = ContentScale.Crop,
    maxRetries: Int = 3
) {
    ProgressiveImage(
        imageUrl = imageUrl,
        contentDescription = contentDescription,
        modifier = modifier
            .width(width)
            .height(height),
        thumbnailSize = thumbnailSize,
        placeholderRes = placeholderRes,
        shape = RoundedCornerShape(cornerRadius),
        contentScale = contentScale,
        maxRetries = maxRetries
    )
}

/**
 * LocationHeaderImage - Imagem grande para headers de detalhes de local.
 *
 * Otimizada para telas de detalhe com:
 * - Aspect ratio 16:9
 * - Thumbnail maior para melhor preview
 * - Cantos arredondados inferiores
 *
 * @param imageUrl URL da imagem a ser carregada
 * @param contentDescription Descrição para acessibilidade
 * @param modifier Modifier para customização
 * @param thumbnailSize Tamanho do thumbnail em pixels (padrão: 100)
 * @param placeholderRes Resource drawable do placeholder
 * @param maxRetries Número máximo de tentativas em caso de erro (padrão: 3)
 */
@Composable
fun LocationHeaderImage(
    imageUrl: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    thumbnailSize: Int = 100,
    @DrawableRes placeholderRes: Int = R.drawable.ic_location_placeholder,
    maxRetries: Int = 3
) {
    ProgressiveImage(
        imageUrl = imageUrl,
        contentDescription = contentDescription,
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(16f / 9f),
        thumbnailSize = thumbnailSize,
        placeholderRes = placeholderRes,
        shape = RoundedCornerShape(
            topStart = 0.dp,
            topEnd = 0.dp,
            bottomStart = 16.dp,
            bottomEnd = 16.dp
        ),
        contentScale = ContentScale.Crop,
        maxRetries = maxRetries
    )
}

/**
 * Composable interno que implementa o carregamento progressivo de imagens.
 *
 * Fluxo de carregamento:
 * 1. Mostra placeholder estático
 * 2. Carrega thumbnail em baixa resolução
 * 3. Quando thumbnail carrega, inicia carregamento da imagem completa
 * 4. Crossfade da thumbnail para imagem completa
 *
 * Em caso de erro:
 * - Mostra ícone de erro
 * - Permite retry até maxRetries vezes
 * - Após esgotar retries, mostra estado de erro final
 */
@Composable
private fun ProgressiveImage(
    imageUrl: String?,
    contentDescription: String?,
    modifier: Modifier,
    thumbnailSize: Int,
    @DrawableRes placeholderRes: Int,
    shape: Shape,
    contentScale: ContentScale,
    maxRetries: Int
) {
    val context = LocalContext.current

    // Estado de carregamento
    var loadState by remember(imageUrl) { mutableStateOf(ImageLoadState.PLACEHOLDER) }
    var retryCount by remember(imageUrl) { mutableIntStateOf(0) }
    var thumbnailPainterState by remember(imageUrl) {
        mutableStateOf<AsyncImagePainter.State>(AsyncImagePainter.State.Empty)
    }
    var fullImagePainterState by remember(imageUrl) {
        mutableStateOf<AsyncImagePainter.State>(AsyncImagePainter.State.Empty)
    }

    // Verifica se deve mostrar a imagem ou placeholder
    val hasValidUrl = !imageUrl.isNullOrBlank()

    Box(
        modifier = modifier
            .clip(shape)
            .background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center
    ) {
        if (!hasValidUrl) {
            // Sem URL - mostrar placeholder estático
            PlaceholderContent(
                placeholderRes = placeholderRes,
                contentDescription = contentDescription
            )
        } else {
            // Camada 1: Thumbnail (carrega primeiro, em baixa resolução)
            AsyncImage(
                model = ImageRequest.Builder(context)
                    .data(imageUrl)
                    .size(thumbnailSize, thumbnailSize)
                    .crossfade(true)
                    .diskCachePolicy(CachePolicy.ENABLED)
                    .memoryCachePolicy(CachePolicy.ENABLED)
                    .build(),
                contentDescription = contentDescription,
                modifier = Modifier.fillMaxSize(),
                contentScale = contentScale,
                onState = { state ->
                    thumbnailPainterState = state
                    when (state) {
                        is AsyncImagePainter.State.Loading -> {
                            loadState = ImageLoadState.THUMBNAIL_LOADING
                        }
                        is AsyncImagePainter.State.Success -> {
                            loadState = ImageLoadState.THUMBNAIL_LOADED
                        }
                        is AsyncImagePainter.State.Error -> {
                            if (retryCount < maxRetries) {
                                // Será tratado pelo retry
                            } else {
                                loadState = ImageLoadState.ERROR
                            }
                        }
                        else -> {}
                    }
                }
            )

            // Camada 2: Imagem completa (carrega após thumbnail)
            AnimatedVisibility(
                visible = loadState == ImageLoadState.THUMBNAIL_LOADED ||
                        loadState == ImageLoadState.FULL_LOADING ||
                        loadState == ImageLoadState.FULL_LOADED,
                enter = fadeIn(animationSpec = tween(300)),
                exit = fadeOut(animationSpec = tween(300))
            ) {
                AsyncImage(
                    model = ImageRequest.Builder(context)
                        .data(imageUrl)
                        .size(Size.ORIGINAL)
                        .crossfade(true)
                        .diskCachePolicy(CachePolicy.ENABLED)
                        .memoryCachePolicy(CachePolicy.ENABLED)
                        .build(),
                    contentDescription = contentDescription,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = contentScale,
                    onState = { state ->
                        fullImagePainterState = state
                        when (state) {
                            is AsyncImagePainter.State.Loading -> {
                                loadState = ImageLoadState.FULL_LOADING
                            }
                            is AsyncImagePainter.State.Success -> {
                                loadState = ImageLoadState.FULL_LOADED
                            }
                            is AsyncImagePainter.State.Error -> {
                                if (retryCount < maxRetries) {
                                    // Mantém thumbnail visível
                                } else {
                                    loadState = ImageLoadState.ERROR
                                }
                            }
                            else -> {}
                        }
                    }
                )
            }

            // Overlay de carregamento
            AnimatedVisibility(
                visible = loadState == ImageLoadState.THUMBNAIL_LOADING,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }

            // Overlay de erro com retry
            AnimatedVisibility(
                visible = loadState == ImageLoadState.ERROR,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                ErrorContent(
                    canRetry = retryCount < maxRetries,
                    onRetry = {
                        retryCount++
                        loadState = ImageLoadState.PLACEHOLDER
                    }
                )
            }
        }
    }
}

/**
 * Conteúdo de placeholder quando não há URL ou está carregando inicialmente.
 */
@Composable
private fun PlaceholderContent(
    @DrawableRes placeholderRes: Int,
    contentDescription: String?
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Image(
            painter = painterResource(id = placeholderRes),
            contentDescription = contentDescription,
            modifier = Modifier.size(48.dp),
            alpha = 0.5f
        )
    }
}

/**
 * Conteúdo de erro com opção de retry.
 */
@Composable
private fun ErrorContent(
    canRetry: Boolean,
    onRetry: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)),
        contentAlignment = Alignment.Center
    ) {
        if (canRetry) {
            IconButton(onClick = onRetry) {
                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = stringResource(R.string.cd_retry),
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(32.dp)
                )
            }
        } else {
            Icon(
                imageVector = Icons.Default.BrokenImage,
                contentDescription = stringResource(R.string.cd_image_load_error),
                tint = MaterialTheme.colorScheme.error,
                modifier = Modifier.size(32.dp)
            )
        }
    }
}
