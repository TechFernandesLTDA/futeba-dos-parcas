package com.futebadosparcas.ui.components.avatar

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R

/**
 * Sistema de customização de avatar para o perfil do jogador.
 * Permite personalizar rosto, cabelo, acessórios, camisa e badges.
 */

// ==================== Models ====================

/**
 * Configuração completa do avatar.
 */
data class AvatarConfig(
    val skinTone: SkinTone = SkinTone.MEDIUM,
    val hairStyle: HairStyle = HairStyle.SHORT,
    val hairColor: HairColor = HairColor.BLACK,
    val facialHair: FacialHair = FacialHair.NONE,
    val glasses: Glasses = Glasses.NONE,
    val shirtColor: Color = Color(0xFF2196F3),
    val shirtNumber: Int? = null,
    val badge: AvatarBadge? = null,
    val frame: AvatarFrame = AvatarFrame.NONE,
    val expression: Expression = Expression.HAPPY
)

/**
 * Tom de pele.
 */
enum class SkinTone(val color: Color, val label: String) {
    LIGHT(Color(0xFFFFDBB4), "Claro"),
    MEDIUM_LIGHT(Color(0xFFEDB98A), "Médio Claro"),
    MEDIUM(Color(0xFFD08B5B), "Médio"),
    MEDIUM_DARK(Color(0xFFAE5D29), "Médio Escuro"),
    DARK(Color(0xFF614335), "Escuro")
}

/**
 * Estilo de cabelo.
 */
enum class HairStyle(val label: String, val icon: String) {
    NONE("Careca", "👨‍🦲"),
    SHORT("Curto", "👨"),
    MEDIUM("Médio", "🧑"),
    LONG("Longo", "🧔"),
    CURLY("Cacheado", "👨‍🦱"),
    MOHAWK("Moicano", "🧑‍🎤"),
    PONYTAIL("Rabo de cavalo", "👩"),
    BUN("Coque", "👨‍🦰")
}

/**
 * Cor do cabelo.
 */
enum class HairColor(val color: Color, val label: String) {
    BLACK(Color(0xFF1A1A1A), "Preto"),
    BROWN(Color(0xFF4A3728), "Castanho"),
    BLONDE(Color(0xFFD4A574), "Loiro"),
    RED(Color(0xFF8B2500), "Ruivo"),
    GRAY(Color(0xFF808080), "Grisalho"),
    WHITE(Color(0xFFE8E8E8), "Branco"),
    BLUE(Color(0xFF2196F3), "Azul"),
    GREEN(Color(0xFF4CAF50), "Verde"),
    PINK(Color(0xFFE91E63), "Rosa")
}

/**
 * Barba/bigode.
 */
enum class FacialHair(val label: String, val icon: String) {
    NONE("Nenhum", "😊"),
    STUBBLE("Barba por fazer", "🧔‍♂️"),
    BEARD("Barba cheia", "🧔"),
    GOATEE("Cavanhaque", "🧑"),
    MUSTACHE("Bigode", "👨")
}

/**
 * Óculos/acessórios.
 */
enum class Glasses(val label: String, val icon: String) {
    NONE("Nenhum", "😊"),
    REGULAR("Normal", "🤓"),
    SUNGLASSES("Óculos de sol", "😎"),
    SPORT("Esportivo", "🥽")
}

/**
 * Expressão facial.
 */
enum class Expression(val label: String, val icon: String) {
    HAPPY("Feliz", "😊"),
    SERIOUS("Sério", "😐"),
    COOL("Descolado", "😎"),
    EXCITED("Empolgado", "😄"),
    FOCUSED("Focado", "🧐")
}

/**
 * Badge especial do avatar.
 */
enum class AvatarBadge(
    val label: String,
    val icon: String,
    val color: Color,
    val requirement: String,
    val isLocked: Boolean = true
) {
    MVP("MVP", "⭐", Color(0xFFFFD700), "Seja MVP 5x", false),
    CAPTAIN("Capitão", "©️", Color(0xFFE91E63), "Seja capitão 10x"),
    VETERAN("Veterano", "🎖️", Color(0xFF9C27B0), "Jogue 50 partidas", false),
    CHAMPION("Campeão", "🏆", Color(0xFFFF9800), "Vença 25 jogos"),
    SCORER("Artilheiro", "⚽", Color(0xFF4CAF50), "Marque 100 gols"),
    ASSIST_KING("Garçom", "🎯", Color(0xFF2196F3), "Dê 50 assistências"),
    IRON_MAN("Homem de Ferro", "💪", Color(0xFF607D8B), "10 jogos seguidos"),
    LEGENDARY("Lendário", "👑", Color(0xFFAB47BC), "Atinja nível 20")
}

/**
 * Moldura do avatar.
 */
enum class AvatarFrame(
    val label: String,
    val colors: List<Color>,
    val requirement: String,
    val isLocked: Boolean = true
) {
    NONE("Nenhuma", listOf(Color.Transparent), "", false),
    BRONZE("Bronze", listOf(Color(0xFFCD7F32)), "Nível 5", false),
    SILVER("Prata", listOf(Color(0xFFC0C0C0)), "Nível 10", false),
    GOLD("Ouro", listOf(Color(0xFFFFD700)), "Nível 15"),
    DIAMOND("Diamante", listOf(Color(0xFFB9F2FF), Color(0xFF87CEEB)), "Nível 20"),
    RAINBOW("Arco-íris", listOf(
        Color(0xFFFF0000), Color(0xFFFF7F00), Color(0xFFFFFF00),
        Color(0xFF00FF00), Color(0xFF0000FF), Color(0xFF8B00FF)
    ), "Seja MVP 10x"),
    FIRE("Fogo", listOf(Color(0xFFFF6B35), Color(0xFFFF3D00)), "Streak de 15 jogos")
}

// ==================== Avatar Display ====================

/**
 * Exibe o avatar customizado.
 */
@Composable
fun CustomAvatar(
    config: AvatarConfig,
    size: Dp = 80.dp,
    modifier: Modifier = Modifier,
    showBadge: Boolean = true,
    showFrame: Boolean = true
) {
    Box(
        modifier = modifier.size(size),
        contentAlignment = Alignment.Center
    ) {
        // Moldura
        if (showFrame && config.frame != AvatarFrame.NONE) {
            AvatarFrameRing(
                frame = config.frame,
                size = size
            )
        }

        // Avatar base
        Box(
            modifier = Modifier
                .size(size * 0.85f)
                .clip(CircleShape)
                .background(config.shirtColor.copy(alpha = 0.3f)),
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                drawAvatar(config, size.toPx() * 0.85f)
            }
        }

        // Badge
        if (showBadge && config.badge != null) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .offset(x = 4.dp, y = 4.dp)
                    .size(size * 0.35f)
                    .clip(CircleShape)
                    .background(config.badge.color)
                    .border(2.dp, Color.White, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = config.badge.icon,
                    style = MaterialTheme.typography.labelSmall
                )
            }
        }
    }
}

/**
 * Anel de moldura do avatar.
 */
@Composable
private fun AvatarFrameRing(
    frame: AvatarFrame,
    size: Dp
) {
    val rotation = remember { Animatable(0f) }

    LaunchedEffect(frame) {
        if (frame == AvatarFrame.RAINBOW || frame == AvatarFrame.FIRE) {
            while (true) {
                rotation.animateTo(
                    targetValue = 360f,
                    animationSpec = tween(3000, easing = FastOutSlowInEasing)
                )
                rotation.snapTo(0f)
            }
        }
    }

    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(
                brush = if (frame.colors.size > 1) {
                    Brush.sweepGradient(frame.colors)
                } else {
                    Brush.linearGradient(listOf(frame.colors.first(), frame.colors.first()))
                }
            )
    )
}

/**
 * Desenha o avatar no canvas.
 */
private fun DrawScope.drawAvatar(config: AvatarConfig, sizePx: Float) {
    val centerX = size.width / 2
    val centerY = size.height / 2
    val faceRadius = sizePx * 0.35f

    // Rosto
    drawCircle(
        color = config.skinTone.color,
        radius = faceRadius,
        center = Offset(centerX, centerY - sizePx * 0.1f)
    )

    // Cabelo (simplificado)
    if (config.hairStyle != HairStyle.NONE) {
        drawHair(config, centerX, centerY - sizePx * 0.1f, faceRadius)
    }

    // Olhos
    val eyeY = centerY - sizePx * 0.15f
    val eyeSpacing = faceRadius * 0.4f

    // Olho esquerdo
    drawCircle(
        color = Color.White,
        radius = faceRadius * 0.18f,
        center = Offset(centerX - eyeSpacing, eyeY)
    )
    drawCircle(
        color = Color.Black,
        radius = faceRadius * 0.1f,
        center = Offset(centerX - eyeSpacing, eyeY)
    )

    // Olho direito
    drawCircle(
        color = Color.White,
        radius = faceRadius * 0.18f,
        center = Offset(centerX + eyeSpacing, eyeY)
    )
    drawCircle(
        color = Color.Black,
        radius = faceRadius * 0.1f,
        center = Offset(centerX + eyeSpacing, eyeY)
    )

    // Boca (baseada na expressão)
    val mouthY = centerY + faceRadius * 0.2f
    when (config.expression) {
        Expression.HAPPY, Expression.EXCITED -> {
            // Sorriso
            drawArc(
                color = Color.Black,
                startAngle = 0f,
                sweepAngle = 180f,
                useCenter = false,
                topLeft = Offset(centerX - faceRadius * 0.3f, mouthY - faceRadius * 0.15f),
                size = androidx.compose.ui.geometry.Size(faceRadius * 0.6f, faceRadius * 0.3f)
            )
        }
        Expression.SERIOUS, Expression.FOCUSED -> {
            // Linha reta
            drawLine(
                color = Color.Black,
                start = Offset(centerX - faceRadius * 0.25f, mouthY),
                end = Offset(centerX + faceRadius * 0.25f, mouthY),
                strokeWidth = 3f
            )
        }
        Expression.COOL -> {
            // Meio sorriso
            drawLine(
                color = Color.Black,
                start = Offset(centerX - faceRadius * 0.2f, mouthY),
                end = Offset(centerX + faceRadius * 0.2f, mouthY - faceRadius * 0.1f),
                strokeWidth = 3f
            )
        }
    }

    // Óculos
    if (config.glasses != Glasses.NONE) {
        drawGlasses(config.glasses, centerX, eyeY, faceRadius)
    }

    // Corpo/camisa
    val bodyTop = centerY + faceRadius * 0.6f
    drawShirt(config, centerX, bodyTop, sizePx)
}

/**
 * Desenha o cabelo.
 */
private fun DrawScope.drawHair(
    config: AvatarConfig,
    centerX: Float,
    faceY: Float,
    faceRadius: Float
) {
    val hairColor = config.hairColor.color

    when (config.hairStyle) {
        HairStyle.SHORT, HairStyle.MEDIUM -> {
            // Cabelo curto/médio - arco no topo
            val hairPath = Path().apply {
                moveTo(centerX - faceRadius * 0.9f, faceY - faceRadius * 0.3f)
                quadraticBezierTo(
                    centerX, faceY - faceRadius * 1.4f,
                    centerX + faceRadius * 0.9f, faceY - faceRadius * 0.3f
                )
            }
            drawPath(
                path = hairPath,
                color = hairColor,
                style = Fill
            )
        }
        HairStyle.CURLY -> {
            // Cabelo cacheado - círculos
            val positions = listOf(
                Offset(centerX - faceRadius * 0.6f, faceY - faceRadius * 0.8f),
                Offset(centerX - faceRadius * 0.2f, faceY - faceRadius),
                Offset(centerX + faceRadius * 0.2f, faceY - faceRadius),
                Offset(centerX + faceRadius * 0.6f, faceY - faceRadius * 0.8f),
                Offset(centerX, faceY - faceRadius * 1.1f)
            )
            positions.forEach { pos ->
                drawCircle(
                    color = hairColor,
                    radius = faceRadius * 0.3f,
                    center = pos
                )
            }
        }
        else -> {
            // Default - arco simples
            drawArc(
                color = hairColor,
                startAngle = 180f,
                sweepAngle = 180f,
                useCenter = true,
                topLeft = Offset(centerX - faceRadius, faceY - faceRadius * 1.2f),
                size = androidx.compose.ui.geometry.Size(faceRadius * 2, faceRadius * 1.2f)
            )
        }
    }
}

/**
 * Desenha óculos.
 */
private fun DrawScope.drawGlasses(
    glasses: Glasses,
    centerX: Float,
    eyeY: Float,
    faceRadius: Float
) {
    val glassesColor = when (glasses) {
        Glasses.SUNGLASSES -> Color.Black.copy(alpha = 0.8f)
        Glasses.SPORT -> Color(0xFFFF5722).copy(alpha = 0.6f)
        else -> Color.Transparent
    }

    val frameColor = when (glasses) {
        Glasses.REGULAR -> Color.Black
        Glasses.SUNGLASSES -> Color.Black
        Glasses.SPORT -> Color(0xFFFF5722)
        else -> Color.Transparent
    }

    if (glasses != Glasses.NONE) {
        val eyeSpacing = faceRadius * 0.4f
        val lensRadius = faceRadius * 0.22f

        // Lente esquerda
        drawCircle(
            color = glassesColor,
            radius = lensRadius,
            center = Offset(centerX - eyeSpacing, eyeY)
        )
        // Lente direita
        drawCircle(
            color = glassesColor,
            radius = lensRadius,
            center = Offset(centerX + eyeSpacing, eyeY)
        )

        // Armação
        drawCircle(
            color = frameColor,
            radius = lensRadius,
            center = Offset(centerX - eyeSpacing, eyeY),
            style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2f)
        )
        drawCircle(
            color = frameColor,
            radius = lensRadius,
            center = Offset(centerX + eyeSpacing, eyeY),
            style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2f)
        )

        // Ponte
        drawLine(
            color = frameColor,
            start = Offset(centerX - eyeSpacing + lensRadius, eyeY),
            end = Offset(centerX + eyeSpacing - lensRadius, eyeY),
            strokeWidth = 2f
        )
    }
}

/**
 * Desenha a camisa.
 */
private fun DrawScope.drawShirt(
    config: AvatarConfig,
    centerX: Float,
    bodyTop: Float,
    sizePx: Float
) {
    val shirtPath = Path().apply {
        moveTo(centerX - sizePx * 0.35f, bodyTop)
        lineTo(centerX - sizePx * 0.45f, sizePx)
        lineTo(centerX + sizePx * 0.45f, sizePx)
        lineTo(centerX + sizePx * 0.35f, bodyTop)
        close()
    }

    drawPath(
        path = shirtPath,
        color = config.shirtColor
    )

    // Número na camisa
    config.shirtNumber?.let { number ->
        // TODO: Desenhar número (requer TextMeasurer)
    }
}

// ==================== Customizer Screen ====================

/**
 * Tela de customização de avatar.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AvatarCustomizerScreen(
    initialConfig: AvatarConfig,
    unlockedBadges: List<AvatarBadge>,
    unlockedFrames: List<AvatarFrame>,
    onSave: (AvatarConfig) -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier
) {
    var config by remember { mutableStateOf(initialConfig) }
    var selectedTab by remember { mutableIntStateOf(0) }

    val tabs = listOf("Rosto", "Cabelo", "Acessórios", "Camisa", "Moldura")

    Column(modifier = modifier.fillMaxSize()) {
        // Preview do avatar
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp)
                .background(MaterialTheme.colorScheme.surfaceContainerHigh),
            contentAlignment = Alignment.Center
        ) {
            CustomAvatar(
                config = config,
                size = 120.dp
            )
        }

        // Tabs
        TabRow(
            selectedTabIndex = selectedTab
        ) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = { Text(title) }
                )
            }
        }

        // Conteúdo da tab
        Box(
            modifier = Modifier
                .weight(1f)
                .padding(16.dp)
        ) {
            when (selectedTab) {
                0 -> FaceCustomizer(config) { config = it }
                1 -> HairCustomizer(config) { config = it }
                2 -> AccessoriesCustomizer(config) { config = it }
                3 -> ShirtCustomizer(config) { config = it }
                4 -> FrameCustomizer(config, unlockedFrames, unlockedBadges) { config = it }
            }
        }

        // Botões de ação
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                onClick = onCancel,
                modifier = Modifier.weight(1f)
            ) {
                Text("Cancelar")
            }

            Button(
                onClick = { onSave(config) },
                modifier = Modifier.weight(1f)
            ) {
                Text("Salvar")
            }
        }
    }
}

/**
 * Customizador de rosto.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FaceCustomizer(
    config: AvatarConfig,
    onConfigChange: (AvatarConfig) -> Unit
) {
    Column {
        Text(
            text = "Tom de Pele",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            SkinTone.entries.forEach { skinTone ->
                ColorOption(
                    color = skinTone.color,
                    label = skinTone.label,
                    isSelected = config.skinTone == skinTone,
                    onClick = { onConfigChange(config.copy(skinTone = skinTone)) }
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Expressão",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(Expression.entries) { expression ->
                EmojiOption(
                    emoji = expression.icon,
                    label = expression.label,
                    isSelected = config.expression == expression,
                    onClick = { onConfigChange(config.copy(expression = expression)) }
                )
            }
        }
    }
}

/**
 * Customizador de cabelo.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun HairCustomizer(
    config: AvatarConfig,
    onConfigChange: (AvatarConfig) -> Unit
) {
    Column {
        Text(
            text = "Estilo",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            HairStyle.entries.forEach { style ->
                EmojiOption(
                    emoji = style.icon,
                    label = style.label,
                    isSelected = config.hairStyle == style,
                    onClick = { onConfigChange(config.copy(hairStyle = style)) }
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Cor do Cabelo",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            HairColor.entries.forEach { color ->
                ColorOption(
                    color = color.color,
                    label = color.label,
                    isSelected = config.hairColor == color,
                    onClick = { onConfigChange(config.copy(hairColor = color)) }
                )
            }
        }
    }
}

/**
 * Customizador de acessórios.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AccessoriesCustomizer(
    config: AvatarConfig,
    onConfigChange: (AvatarConfig) -> Unit
) {
    Column {
        Text(
            text = "Óculos",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Glasses.entries.forEach { glasses ->
                EmojiOption(
                    emoji = glasses.icon,
                    label = glasses.label,
                    isSelected = config.glasses == glasses,
                    onClick = { onConfigChange(config.copy(glasses = glasses)) }
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Barba/Bigode",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FacialHair.entries.forEach { facial ->
                EmojiOption(
                    emoji = facial.icon,
                    label = facial.label,
                    isSelected = config.facialHair == facial,
                    onClick = { onConfigChange(config.copy(facialHair = facial)) }
                )
            }
        }
    }
}

/**
 * Customizador de camisa.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ShirtCustomizer(
    config: AvatarConfig,
    onConfigChange: (AvatarConfig) -> Unit
) {
    val shirtColors = listOf(
        Color(0xFF2196F3) to "Azul",
        Color(0xFFF44336) to "Vermelho",
        Color(0xFF4CAF50) to "Verde",
        Color(0xFFFFEB3B) to "Amarelo",
        Color(0xFFFF9800) to "Laranja",
        Color(0xFF9C27B0) to "Roxo",
        Color(0xFF000000) to "Preto",
        Color(0xFFFFFFFF) to "Branco"
    )

    Column {
        Text(
            text = "Cor da Camisa",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            shirtColors.forEach { (color, label) ->
                ColorOption(
                    color = color,
                    label = label,
                    isSelected = config.shirtColor == color,
                    onClick = { onConfigChange(config.copy(shirtColor = color)) }
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Número",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                FilterChip(
                    selected = config.shirtNumber == null,
                    onClick = { onConfigChange(config.copy(shirtNumber = null)) },
                    label = { Text("Sem número") }
                )
            }
            items((1..99).toList()) { number ->
                FilterChip(
                    selected = config.shirtNumber == number,
                    onClick = { onConfigChange(config.copy(shirtNumber = number)) },
                    label = { Text("$number") }
                )
            }
        }
    }
}

/**
 * Customizador de moldura e badges.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FrameCustomizer(
    config: AvatarConfig,
    unlockedFrames: List<AvatarFrame>,
    unlockedBadges: List<AvatarBadge>,
    onConfigChange: (AvatarConfig) -> Unit
) {
    Column {
        Text(
            text = "Moldura",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            AvatarFrame.entries.forEach { frame ->
                val isUnlocked = frame in unlockedFrames || !frame.isLocked
                FrameOption(
                    frame = frame,
                    isSelected = config.frame == frame,
                    isUnlocked = isUnlocked,
                    onClick = {
                        if (isUnlocked) {
                            onConfigChange(config.copy(frame = frame))
                        }
                    }
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Badge",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Opção sem badge
            EmojiOption(
                emoji = "❌",
                label = "Nenhum",
                isSelected = config.badge == null,
                onClick = { onConfigChange(config.copy(badge = null)) }
            )

            AvatarBadge.entries.forEach { badge ->
                val isUnlocked = badge in unlockedBadges || !badge.isLocked
                BadgeOption(
                    badge = badge,
                    isSelected = config.badge == badge,
                    isUnlocked = isUnlocked,
                    onClick = {
                        if (isUnlocked) {
                            onConfigChange(config.copy(badge = badge))
                        }
                    }
                )
            }
        }
    }
}

// ==================== Option Components ====================

@Composable
private fun ColorOption(
    color: Color,
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val borderColor by animateColorAsState(
        targetValue = if (isSelected) MaterialTheme.colorScheme.primary else Color.Transparent,
        label = "borderColor"
    )

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(color)
                .border(3.dp, borderColor, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            if (isSelected) {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = null,
                    tint = if (color.luminance() > 0.5f) Color.Black else Color.White,
                    modifier = Modifier.size(20.dp)
                )
            }
        }

        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun EmojiOption(
    emoji: String,
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val backgroundColor by animateColorAsState(
        targetValue = if (isSelected) {
            MaterialTheme.colorScheme.primaryContainer
        } else {
            MaterialTheme.colorScheme.surfaceContainerHigh
        },
        label = "bgColor"
    )

    Card(
        modifier = Modifier.clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = backgroundColor)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = emoji, style = MaterialTheme.typography.headlineSmall)
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun FrameOption(
    frame: AvatarFrame,
    isSelected: Boolean,
    isUnlocked: Boolean,
    onClick: () -> Unit
) {
    val scale = remember { Animatable(1f) }

    LaunchedEffect(isSelected) {
        if (isSelected) {
            scale.animateTo(1.1f, spring(dampingRatio = Spring.DampingRatioMediumBouncy))
            scale.animateTo(1f)
        }
    }

    Card(
        modifier = Modifier
            .scale(scale.value)
            .clickable(enabled = isUnlocked, onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) {
                MaterialTheme.colorScheme.primaryContainer
            } else if (!isUnlocked) {
                MaterialTheme.colorScheme.surfaceContainerLow.copy(alpha = 0.5f)
            } else {
                MaterialTheme.colorScheme.surfaceContainerHigh
            }
        )
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(
                        brush = if (frame.colors.size > 1) {
                            Brush.sweepGradient(frame.colors)
                        } else if (frame.colors.isNotEmpty()) {
                            Brush.linearGradient(listOf(frame.colors.first(), frame.colors.first()))
                        } else {
                            Brush.linearGradient(listOf(Color.Gray, Color.Gray))
                        }
                    ),
                contentAlignment = Alignment.Center
            ) {
                if (!isUnlocked) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = "Bloqueado",
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = frame.label,
                style = MaterialTheme.typography.labelSmall,
                color = if (!isUnlocked) {
                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )
        }
    }
}

@Composable
private fun BadgeOption(
    badge: AvatarBadge,
    isSelected: Boolean,
    isUnlocked: Boolean,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier.clickable(enabled = isUnlocked, onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) {
                badge.color.copy(alpha = 0.3f)
            } else if (!isUnlocked) {
                MaterialTheme.colorScheme.surfaceContainerLow.copy(alpha = 0.5f)
            } else {
                MaterialTheme.colorScheme.surfaceContainerHigh
            }
        )
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(text = badge.icon, style = MaterialTheme.typography.headlineSmall)
                if (!isUnlocked) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = "Bloqueado",
                        tint = Color.Black.copy(alpha = 0.5f),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            Text(
                text = badge.label,
                style = MaterialTheme.typography.labelSmall,
                color = if (!isUnlocked) {
                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                } else {
                    badge.color
                }
            )
        }
    }
}

/**
 * Extensão para calcular luminância de uma cor.
 */
private fun Color.luminance(): Float {
    return (0.299f * red + 0.587f * green + 0.114f * blue)
}
