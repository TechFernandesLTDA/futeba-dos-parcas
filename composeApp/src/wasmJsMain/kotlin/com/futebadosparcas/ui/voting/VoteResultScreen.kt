package com.futebadosparcas.ui.voting

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

data class VoteResultPlayer(
    val id: String,
    val name: String,
    val nickname: String? = null,
    val photoUrl: String? = null,
    val voteCount: Int,
    val percentage: Float,
    val xpEarned: Int = 0
)

data class VoteResultGameData(
    val gameId: String,
    val date: String,
    val location: String,
    val team1Name: String = "Time A",
    val team2Name: String = "Time B",
    val team1Score: Int = 0,
    val team2Score: Int = 0
)

sealed class VoteResultState {
    object Loading : VoteResultState()
    data class Success(
        val gameData: VoteResultGameData,
        val mvpResults: List<VoteResultPlayer>,
        val gkResults: List<VoteResultPlayer> = emptyList(),
        val worstResults: List<VoteResultPlayer> = emptyList(),
        val totalMvpVotes: Int,
        val totalGkVotes: Int = 0,
        val totalWorstVotes: Int = 0
    ) : VoteResultState()
    data class Error(val message: String) : VoteResultState()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VoteResultScreen(
    gameId: String,
    onBack: () -> Unit = {},
    initialState: VoteResultState = VoteResultState.Loading
) {
    var state by remember { mutableStateOf(initialState) }
    var showMvp by remember { mutableStateOf(false) }
    var showGk by remember { mutableStateOf(false) }
    var showWorst by remember { mutableStateOf(false) }
    var showConfetti by remember { mutableStateOf(false) }

    LaunchedEffect(gameId) {
        state = VoteResultState.Loading
        delay(500)
        state = getMockVoteResults(gameId)
    }

    LaunchedEffect(state) {
        if (state is VoteResultState.Success) {
            delay(300)
            showMvp = true
            showConfetti = true
            triggerConfetti()
            delay(600)
            showGk = true
            delay(400)
            showWorst = true
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("📊 Resultados da Votação") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Text("←", fontSize = 20.sp)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val currentState = state) {
                is VoteResultState.Loading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(48.dp),
                                color = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                "Calculando resultados...",
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                is VoteResultState.Success -> {
                    VoteResultContent(
                        gameData = currentState.gameData,
                        mvpResults = currentState.mvpResults,
                        gkResults = currentState.gkResults,
                        worstResults = currentState.worstResults,
                        totalMvpVotes = currentState.totalMvpVotes,
                        totalGkVotes = currentState.totalGkVotes,
                        totalWorstVotes = currentState.totalWorstVotes,
                        showMvp = showMvp,
                        showGk = showGk,
                        showWorst = showWorst,
                        onShare = { category ->
                            shareResults(currentState.gameData, category)
                        }
                    )
                }

                is VoteResultState.Error -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("❌ ${currentState.message}", color = MaterialTheme.colorScheme.error)
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(onClick = onBack) {
                                Text("Voltar")
                            }
                        }
                    }
                }
            }

            if (showConfetti) {
                ConfettiOverlay(
                    modifier = Modifier.fillMaxSize()
                )
            }
        }
    }
}

@Composable
private fun VoteResultContent(
    gameData: VoteResultGameData,
    mvpResults: List<VoteResultPlayer>,
    gkResults: List<VoteResultPlayer>,
    worstResults: List<VoteResultPlayer>,
    totalMvpVotes: Int,
    totalGkVotes: Int,
    totalWorstVotes: Int,
    showMvp: Boolean,
    showGk: Boolean,
    showWorst: Boolean,
    onShare: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        item {
            GameResultHeader(gameData)
        }

        if (mvpResults.isNotEmpty()) {
            item {
                AnimatedVisibility(
                    visible = showMvp,
                    enter = fadeIn(animationSpec = tween(500)) + scaleIn(
                        initialScale = 0.8f,
                        animationSpec = spring(
                            dampingRatio = Spring.DampingRatioMediumBouncy,
                            stiffness = Spring.StiffnessLow
                        )
                    )
                ) {
                    CategoryResultCard(
                        title = "🏆 MVP do Jogo",
                        icon = "⭐",
                        results = mvpResults,
                        totalVotes = totalMvpVotes,
                        accentColor = GoldColor,
                        bgColor = GoldLightColor,
                        onShare = { onShare("mvp") }
                    )
                }
            }
        }

        if (gkResults.isNotEmpty()) {
            item {
                AnimatedVisibility(
                    visible = showGk,
                    enter = fadeIn(animationSpec = tween(500)) + scaleIn(
                        initialScale = 0.8f,
                        animationSpec = spring(
                            dampingRatio = Spring.DampingRatioMediumBouncy,
                            stiffness = Spring.StiffnessLow
                        )
                    )
                ) {
                    CategoryResultCard(
                        title = "🧤 Melhor Goleiro",
                        icon = "🥅",
                        results = gkResults,
                        totalVotes = totalGkVotes,
                        accentColor = Color(0xFF1976D2),
                        bgColor = Color(0xFFE3F2FD),
                        onShare = { onShare("gk") }
                    )
                }
            }
        }

        if (worstResults.isNotEmpty()) {
            item {
                AnimatedVisibility(
                    visible = showWorst,
                    enter = fadeIn(animationSpec = tween(500)) + scaleIn(
                        initialScale = 0.8f,
                        animationSpec = spring(
                            dampingRatio = Spring.DampingRatioMediumBouncy,
                            stiffness = Spring.StiffnessLow
                        )
                    )
                ) {
                    CategoryResultCard(
                        title = "😅 Bola Murcha",
                        icon = "💩",
                        results = worstResults,
                        totalVotes = totalWorstVotes,
                        accentColor = BrownColor,
                        bgColor = WarningBgColor,
                        isNegative = true,
                        onShare = { onShare("worst") }
                    )
                }
            }
        }

        item {
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun GameResultHeader(gameData: VoteResultGameData) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "📅 ${gameData.date}",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(12.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = gameData.team1Name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.width(16.dp))
                Text(
                    text = "${gameData.team1Score} x ${gameData.team2Score}",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(16.dp))
                Text(
                    text = gameData.team2Name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "📍 ${gameData.location}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun CategoryResultCard(
    title: String,
    icon: String,
    results: List<VoteResultPlayer>,
    totalVotes: Int,
    accentColor: Color,
    bgColor: Color,
    isNegative: Boolean = false,
    onShare: () -> Unit
) {
    val winner = results.firstOrNull()

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = bgColor),
        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(icon, fontSize = 28.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = title,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = accentColor
                        )
                        Text(
                            text = "🗳️ $totalVotes votos totais",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                IconButton(onClick = onShare) {
                    Text("📤", fontSize = 20.sp)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
            HorizontalDivider(color = accentColor.copy(alpha = 0.3f))
            Spacer(modifier = Modifier.height(16.dp))

            winner?.let { player ->
                WinnerHighlight(
                    player = player,
                    accentColor = accentColor,
                    isNegative = isNegative
                )

                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                Spacer(modifier = Modifier.height(12.dp))
            }

            results.drop(1).forEach { player ->
                VoteResultRow(
                    player = player,
                    maxVotes = winner?.voteCount ?: 1,
                    accentColor = accentColor
                )
                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun WinnerHighlight(
    player: VoteResultPlayer,
    accentColor: Color,
    isNegative: Boolean
) {
    var animatedScale by remember { mutableStateOf(0.5f) }

    LaunchedEffect(Unit) {
        animatedScale = 1f
    }

    val scale by animateFloatAsState(
        targetValue = animatedScale,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "winnerScale"
    )

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .scale(scale),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (!isNegative) {
            Text(
                text = "👑",
                fontSize = 32.sp,
                modifier = Modifier.offset(y = 8.dp)
            )
        }

        Box(
            modifier = Modifier
                .size(90.dp)
                .clip(CircleShape)
                .background(
                    Brush.verticalGradient(
                        colors = if (isNegative) {
                            listOf(BrownLightColor.copy(alpha = 0.6f), BrownColor.copy(alpha = 0.4f))
                        } else {
                            listOf(accentColor, accentColor.copy(alpha = 0.7f))
                        }
                    )
                ),
            contentAlignment = Alignment.Center
        ) {
            if (!player.photoUrl.isNullOrEmpty()) {
                Text("👤", fontSize = 36.sp)
            } else {
                val initials = (player.nickname ?: player.name)
                    .split(" ")
                    .take(2)
                    .joinToString("") { it.take(1).uppercase() }
                Text(
                    text = initials,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        val displayName = player.nickname ?: player.name.split(" ").firstOrNull() ?: player.name
        Text(
            text = displayName,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = accentColor,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )

        Spacer(modifier = Modifier.height(4.dp))

        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "${player.voteCount} votos",
                style = MaterialTheme.typography.bodyLarge,
                color = accentColor,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "(${player.percentage.toInt()}%)",
                style = MaterialTheme.typography.bodyMedium,
                color = accentColor.copy(alpha = 0.7f)
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        Surface(
            shape = RoundedCornerShape(12.dp),
            color = if (isNegative) BrownColor.copy(alpha = 0.2f) else accentColor.copy(alpha = 0.2f)
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (isNegative) "📉" else "⭐",
                    fontSize = 18.sp
                )
                Text(
                    text = if (player.xpEarned >= 0) "+${player.xpEarned} XP" else "${player.xpEarned} XP",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (isNegative) BrownDarkColor else accentColor
                )
            }
        }
    }
}

@Composable
private fun VoteResultRow(
    player: VoteResultPlayer,
    maxVotes: Int,
    accentColor: Color
) {
    val barWidth = if (maxVotes > 0) player.voteCount.toFloat() / maxVotes else 0f

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center
        ) {
            val initial = (player.nickname ?: player.name).take(1).uppercase()
            Text(
                text = initial,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = player.nickname ?: player.name,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.height(4.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxHeight()
                        .fillMaxWidth(barWidth)
                        .clip(RoundedCornerShape(4.dp))
                        .background(accentColor.copy(alpha = 0.6f))
                )
            }
        }

        Column(
            horizontalAlignment = Alignment.End,
            modifier = Modifier.width(50.dp)
        ) {
            Text(
                text = "${player.voteCount}",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = accentColor
            )
            Text(
                text = "${player.percentage.toInt()}%",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun ConfettiOverlay(modifier: Modifier = Modifier) {
    val confettiEmojis = listOf("🎉", "🎊", "⭐", "🏆", "✨", "🌟", "💫", "🥇")
    
    Box(modifier = modifier) {
        confettiEmojis.forEachIndexed { index, emoji ->
            val delayMs = index * 150L
            var visible by remember { mutableStateOf(false) }
            var offsetY by remember { mutableStateOf(-50f) }
            
            LaunchedEffect(Unit) {
                delay(delayMs)
                visible = true
                repeat(3) {
                    offsetY = -50f
                    animate(
                        initialValue = -50f,
                        targetValue = 800f,
                        animationSpec = tween(3000, easing = LinearEasing)
                    ) { value, _ ->
                        offsetY = value
                    }
                    delay(500)
                }
                visible = false
            }
            
            if (visible) {
                Text(
                    text = emoji,
                    fontSize = 28.sp,
                    modifier = Modifier
                        .offset(
                            x = ((index * 100) % 300).dp,
                            y = offsetY.dp
                        )
                        .graphicsLayer { 
                            alpha = if (offsetY > 600f) 1f - (offsetY - 600f) / 200f else 1f
                        }
                )
            }
        }
    }
}

private fun triggerConfetti() {
    try {
        triggerConfettiJs()
    } catch (e: Exception) {
    }
}

@JsFun("""
    (function() {
        if (typeof window !== 'undefined' && window.document) {
            var emojis = ['🎉', '🎊', '⭐', '🏆', '✨'];
            for (var i = 0; i < 20; i++) {
                (function(index) {
                    setTimeout(function() {
                        var span = document.createElement('span');
                        span.textContent = emojis[index % emojis.length];
                        span.style.cssText = 'position:fixed;top:-50px;left:' + (Math.random() * 100) + '%;font-size:24px;z-index:9999;pointer-events:none;animation:confetti-fall 3s linear forwards;';
                        document.body.appendChild(span);
                        setTimeout(function() { span.remove(); }, 3000);
                    }, index * 100);
                })(i);
            }
            
            if (!document.getElementById('confetti-style')) {
                var style = document.createElement('style');
                style.id = 'confetti-style';
                style.textContent = '@keyframes confetti-fall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }';
                document.head.appendChild(style);
            }
        }
    })()
""")
private external fun triggerConfettiJs()

private fun shareResults(gameData: VoteResultGameData, category: String) {
    val categoryLabel = when (category) {
        "mvp" -> "MVP"
        "gk" -> "Melhor Goleiro"
        "worst" -> "Bola Murcha"
        else -> category
    }
    val shareText = "🏆 Veja o resultado da votação $categoryLabel do jogo ${gameData.team1Name} ${gameData.team1Score}x${gameData.team2Score} ${gameData.team2Name} no Futeba dos Parças!"
    
    try {
        shareTextJs(shareText)
    } catch (e: Exception) {
    }
}

@JsFun("""
    (function(shareText) {
        if (navigator.share) {
            navigator.share({
                title: 'Resultado da Votação - Futeba dos Parças',
                text: shareText,
                url: window.location.href
            }).catch(function() {});
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(shareText).catch(function() {});
        }
    })
""")
private external fun shareTextJs(text: String)

private suspend fun getMockVoteResults(gameId: String): VoteResultState {
    return VoteResultState.Success(
        gameData = VoteResultGameData(
            gameId = gameId,
            date = "22/02/2026",
            location = "Campo do Parque",
            team1Name = "Time Amarelo",
            team2Name = "Time Preto",
            team1Score = 5,
            team2Score = 3
        ),
        mvpResults = listOf(
            VoteResultPlayer(
                id = "p1",
                name = "João Silva",
                nickname = "Joãozinho",
                voteCount = 8,
                percentage = 40f,
                xpEarned = 50
            ),
            VoteResultPlayer(
                id = "p2",
                name = "Pedro Santos",
                nickname = "Pedrão",
                voteCount = 5,
                percentage = 25f,
                xpEarned = 0
            ),
            VoteResultPlayer(
                id = "p3",
                name = "Lucas Oliveira",
                nickname = "Luquinhas",
                voteCount = 4,
                percentage = 20f,
                xpEarned = 0
            ),
            VoteResultPlayer(
                id = "p4",
                name = "Carlos Gomes",
                nickname = "Carlinhos",
                voteCount = 3,
                percentage = 15f,
                xpEarned = 0
            )
        ),
        gkResults = listOf(
            VoteResultPlayer(
                id = "p6",
                name = "Bruno Lima",
                nickname = "Bruninho",
                voteCount = 6,
                percentage = 60f,
                xpEarned = 25
            ),
            VoteResultPlayer(
                id = "p7",
                name = "Diego Souza",
                nickname = "Diegão",
                voteCount = 4,
                percentage = 40f,
                xpEarned = 0
            )
        ),
        worstResults = listOf(
            VoteResultPlayer(
                id = "p8",
                name = "Thiago Ferreira",
                nickname = "Thiaguinho",
                voteCount = 4,
                percentage = 50f,
                xpEarned = -20
            ),
            VoteResultPlayer(
                id = "p5",
                name = "Rafael Costa",
                nickname = "Rafa",
                voteCount = 2,
                percentage = 25f,
                xpEarned = 0
            ),
            VoteResultPlayer(
                id = "p9",
                name = "André Lima",
                nickname = "Dedé",
                voteCount = 2,
                percentage = 25f,
                xpEarned = 0
            )
        ),
        totalMvpVotes = 20,
        totalGkVotes = 10,
        totalWorstVotes = 8
    )
}

private val GoldLightColor = Color(0xFFFFF8DC)
private val GoldColor = Color(0xFFFFD700)
private val BrownColor = Color(0xFF8B4513)
private val BrownLightColor = Color(0xFFDEB887)
private val BrownDarkColor = Color(0xFF5D3A1A)
private val WarningBgColor = Color(0xFFFFF3E0)
