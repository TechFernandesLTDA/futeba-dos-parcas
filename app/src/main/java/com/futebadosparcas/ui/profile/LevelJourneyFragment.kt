package com.futebadosparcas.ui.profile

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.fragment.app.viewModels
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.fragment.findNavController
import com.futebadosparcas.data.model.LevelTable
import com.futebadosparcas.ui.theme.FutebaColors
import com.futebadosparcas.ui.theme.FutebaTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class LevelJourneyFragment : Fragment() {

    private val viewModel: ProfileViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                FutebaTheme {
                    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

                    LaunchedEffect(Unit) {
                        viewModel.loadProfile()
                    }

                    val currentLevel = when (uiState) {
                        is ProfileUiState.Success -> (uiState as ProfileUiState.Success).user.level
                        else -> 0
                    }
                    val currentXp = when (uiState) {
                        is ProfileUiState.Success -> (uiState as ProfileUiState.Success).user.experiencePoints
                        else -> 0
                    }

                    LevelJourneyScreen(
                        currentLevel = currentLevel,
                        currentXp = currentXp,
                        onBackClick = { findNavController().navigateUp() }
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LevelJourneyScreen(
    currentLevel: Int,
    currentXp: Int,
    onBackClick: () -> Unit
) {
    val scrollState = rememberScrollState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Text(
                        "Rumo ao Estrelato",
                        fontWeight = FontWeight.Bold
                    ) 
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Voltar"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(FutebaColors.Primary),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(scrollState)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color(FutebaColors.Surface),
                            Color(FutebaColors.SurfaceVariant).copy(alpha = 0.3f)
                        )
                    )
                )
        ) {
            // Header com XP atual
            CurrentProgressHeader(currentLevel, currentXp)

            Spacer(modifier = Modifier.height(24.dp))

            // Título da Trilha
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Filled.Star,
                    contentDescription = null,
                    tint = Color(FutebaColors.Primary),
                    modifier = Modifier.size(28.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Trilha do Sucesso",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(FutebaColors.OnSurface)
                )
            }

            Text(
                text = "Cada nível representa sua evolução como jogador",
                fontSize = 14.sp,
                color = Color(FutebaColors.OnSurfaceVariant),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Mapa de Evolução
            LevelJourneyMap(currentLevel, currentXp)

            Spacer(modifier = Modifier.height(24.dp))

            // Documentação do Sistema de XP
            XpDocumentationCard()

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
fun CurrentProgressHeader(currentLevel: Int, currentXp: Int) {
    val levelName = LevelTable.getLevelName(currentLevel)
    val (progressXp, neededXp) = LevelTable.getXpProgress(currentXp)
    val percentage = if (neededXp > 0) (progressXp * 100 / neededXp) else 100

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color.Transparent
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            Color(FutebaColors.Primary),
                            Color(FutebaColors.Secondary)
                        )
                    )
                )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Ícone animado com brilho
                val infiniteTransition = rememberInfiniteTransition(label = "pulse")
                val scale by infiniteTransition.animateFloat(
                    initialValue = 1f,
                    targetValue = 1.15f,
                    animationSpec = infiniteRepeatable(
                        animation = tween(1000),
                        repeatMode = RepeatMode.Reverse
                    ),
                    label = "scale"
                )

                val rotation by infiniteTransition.animateFloat(
                    initialValue = 0f,
                    targetValue = 360f,
                    animationSpec = infiniteRepeatable(
                        animation = tween(3000, easing = LinearEasing),
                        repeatMode = RepeatMode.Restart
                    ),
                    label = "rotation"
                )

                Box(
                    modifier = Modifier
                        .size((100 * scale).dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Filled.Star,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(60.dp)
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                Text(
                    text = "Nível $currentLevel",
                    fontSize = 36.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White
                )

                Text(
                    text = levelName,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.White.copy(alpha = 0.95f)
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Barra de progresso moderna
                Column(modifier = Modifier.fillMaxWidth()) {
                    LinearProgressIndicator(
                        progress = { percentage / 100f },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(16.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .shadow(4.dp, RoundedCornerShape(8.dp)),
                        color = Color.White,
                        trackColor = Color.White.copy(alpha = 0.25f)
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "$currentXp XP total",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color.White.copy(alpha = 0.95f)
                        )
                        Text(
                            text = "$percentage%",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }

                    if (currentLevel < 10) {
                        val nextLevelXp = LevelTable.getXpForNextLevel(currentLevel)
                        val remaining = nextLevelXp - currentXp
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "🎯 Faltam $remaining XP para ${LevelTable.getLevelName(currentLevel + 1)}",
                            fontSize = 13.sp,
                            color = Color.White.copy(alpha = 0.9f),
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                    } else {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "🏆 NÍVEL MÁXIMO ALCANÇADO!",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun LevelJourneyMap(currentLevel: Int, currentXp: Int) {
    val levels = LevelTable.levels.reversed() // Do maior para o menor

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
    ) {
        levels.forEachIndexed { index, levelDef ->
            val isUnlocked = currentLevel >= levelDef.level
            val isCurrent = currentLevel == levelDef.level
            val isNext = currentLevel == levelDef.level - 1

            LevelNode(
                level = levelDef.level,
                name = levelDef.name,
                xpRequired = levelDef.xpRequired,
                isUnlocked = isUnlocked,
                isCurrent = isCurrent,
                isNext = isNext,
                currentXp = currentXp
            )

            // Linha conectora entre nodes (exceto após o último)
            if (index < levels.size - 1) {
                ConnectorLine(
                    isUnlocked = currentLevel >= levels[index + 1].level
                )
            }
        }
    }
}

@Composable
fun LevelNode(
    level: Int,
    name: String,
    xpRequired: Int,
    isUnlocked: Boolean,
    isCurrent: Boolean,
    isNext: Boolean,
    currentXp: Int
) {
    val backgroundColor = when {
        isCurrent -> Color(FutebaColors.Primary)
        isUnlocked -> Color(FutebaColors.Success)
        isNext -> Color(FutebaColors.Secondary).copy(alpha = 0.3f)
        else -> Color(FutebaColors.SurfaceVariant)
    }

    val textColor = when {
        isCurrent || isUnlocked -> Color.White
        else -> Color(FutebaColors.OnSurfaceVariant)
    }

    val borderColor = when {
        isCurrent -> Color(FutebaColors.Primary)
        isNext -> Color(FutebaColors.Secondary)
        else -> Color.Transparent
    }

    val icon = when {
        level >= 10 -> Icons.Filled.Star
        level >= 7 -> Icons.Filled.Star
        level >= 4 -> Icons.Filled.Star
        else -> Icons.Filled.Star
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .then(
                if (isCurrent || isNext) {
                    Modifier.shadow(12.dp, RoundedCornerShape(20.dp))
                } else {
                    Modifier
                }
            ),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = backgroundColor),
        border = if (isNext) BorderStroke(3.dp, borderColor) else null
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Badge do nível
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(
                            if (isUnlocked || isCurrent) Color.White.copy(alpha = 0.2f)
                            else Color(FutebaColors.Surface)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    if (isUnlocked || isCurrent) {
                        Icon(
                            imageVector = icon,
                            contentDescription = null,
                            tint = textColor,
                            modifier = Modifier.size(36.dp)
                        )
                    } else {
                        Text(
                            text = "$level",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(FutebaColors.OnSurfaceVariant)
                        )
                    }
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Nível $level",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = textColor
                        )

                        if (isCurrent) {
                            Spacer(modifier = Modifier.width(8.dp))
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = Color.White.copy(alpha = 0.3f)
                            ) {
                                Text(
                                    text = "VOCÊ ESTÁ AQUI",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }

                    Text(
                        text = name,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium,
                        color = textColor.copy(alpha = 0.95f)
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = if (xpRequired == 0) "🎮 Início da jornada" else "⚡ $xpRequired XP necessários",
                        fontSize = 13.sp,
                        color = textColor.copy(alpha = 0.8f)
                    )
                }

                // Checkmark para níveis desbloqueados
                if (isUnlocked && !isCurrent) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.3f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "✓",
                            fontSize = 22.sp,
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Mostrar progresso se for o próximo nível
            if (isNext && xpRequired > 0) {
                val progress = (currentXp.toFloat() / xpRequired).coerceIn(0f, 1f)
                Spacer(modifier = Modifier.height(12.dp))
                
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(RoundedCornerShape(4.dp)),
                    color = Color(FutebaColors.Secondary),
                    trackColor = Color(FutebaColors.SurfaceVariant)
                )
                
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "🎯 Faltam ${xpRequired - currentXp} XP",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(FutebaColors.Secondary)
                    )
                    Text(
                        text = "${(progress * 100).toInt()}%",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(FutebaColors.Secondary)
                    )
                }
            }

            // Informações extras para níveis desbloqueados
            if (isUnlocked || isCurrent) {
                Spacer(modifier = Modifier.height(8.dp))
                Divider(
                    color = textColor.copy(alpha = 0.2f),
                    modifier = Modifier.padding(vertical = 4.dp)
                )
                Text(
                    text = getLevelDescription(level),
                    fontSize = 12.sp,
                    color = textColor.copy(alpha = 0.85f),
                    lineHeight = 16.sp
                )
            }
        }
    }
}

@Composable
fun ConnectorLine(isUnlocked: Boolean) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(40.dp),
        contentAlignment = Alignment.Center
    ) {
        Canvas(
            modifier = Modifier
                .width(6.dp)
                .height(40.dp)
        ) {
            val pathEffect = if (!isUnlocked) {
                PathEffect.dashPathEffect(floatArrayOf(15f, 15f), 0f)
            } else null

            drawLine(
                color = if (isUnlocked) Color(FutebaColors.Success) else Color(FutebaColors.SurfaceVariant),
                start = Offset(size.width / 2, 0f),
                end = Offset(size.width / 2, size.height),
                strokeWidth = 6f,
                pathEffect = pathEffect
            )
        }
    }
}

@Composable
fun XpDocumentationCard() {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(FutebaColors.SurfaceVariant)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Filled.Info,
                    contentDescription = null,
                    tint = Color(FutebaColors.Primary),
                    modifier = Modifier.size(28.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = "Como Ganhar XP",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(FutebaColors.OnSurface)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            XpSourceItem("⚽", "Gols", "10 XP por gol marcado")
            XpSourceItem("🎯", "Assistências", "7 XP por assistência")
            XpSourceItem("🧤", "Defesas", "5 XP por defesa (goleiro)")
            XpSourceItem("🏆", "Vitória", "20 XP bonus por vitória")
            XpSourceItem("🤝", "Empate", "10 XP bonus por empate")
            XpSourceItem("⭐", "MVP", "30 XP bonus como melhor jogador")
            XpSourceItem("🎮", "Participação", "15 XP só por jogar")
            XpSourceItem("🎖️", "Milestones", "50-2500 XP por conquistas especiais")
            XpSourceItem("🔥", "Sequências", "Bonus por vitórias consecutivas")

            Spacer(modifier = Modifier.height(12.dp))

            Divider(color = Color(FutebaColors.OnSurfaceVariant).copy(alpha = 0.2f))

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "💡 Dica: Jogue regularmente e ajude seu time para subir de nível mais rápido!",
                fontSize = 13.sp,
                color = Color(FutebaColors.OnSurfaceVariant),
                fontWeight = FontWeight.Medium,
                lineHeight = 18.sp
            )
        }
    }
}

@Composable
fun XpSourceItem(emoji: String, title: String, description: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = emoji,
            fontSize = 20.sp,
            modifier = Modifier.size(32.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column {
            Text(
                text = title,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(FutebaColors.OnSurface)
            )
            Text(
                text = description,
                fontSize = 13.sp,
                color = Color(FutebaColors.OnSurfaceVariant)
            )
        }
    }
}

fun getLevelDescription(level: Int): String {
    return when (level) {
        0 -> "🎮 Todo jogador começa aqui. Bem-vindo ao Futeba!"
        1 -> "⚽ Primeiros passos no futebol. Continue jogando!"
        2 -> "🏃 Já conhece o básico. Hora de evoluir!"
        3 -> "💪 Jogador regular. Sua presença faz diferença!"
        4 -> "🎯 Experiência conta! Você sabe o que faz."
        5 -> "⭐ Habilidade reconhecida. Um craque em formação!"
        6 -> "🏆 Nível profissional. Respeito garantido!"
        7 -> "🔥 Expert no campo. Poucos chegam aqui!"
        8 -> "👑 Mestre do futebol. Referência para todos!"
        9 -> "💎 Lenda viva! Seu nome é conhecido por todos!"
        10 -> "🌟 IMORTAL! O nível máximo. Você é uma lenda!"
        else -> "Jogador em evolução"
    }
}
