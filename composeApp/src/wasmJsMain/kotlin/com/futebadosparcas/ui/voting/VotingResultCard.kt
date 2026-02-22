package com.futebadosparcas.ui.voting

import androidx.compose.animation.core.*
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun VotingResultCard(
    mvpWinner: Map<String, Any?>,
    bolaMurchaWinner: Map<String, Any?>?,
    mvpVotes: Map<String, Int>,
    bolaMurchaVotes: Map<String, Int>,
    onClose: () -> Unit
) {
    var showContent by remember { mutableStateOf(false) }
    
    LaunchedEffect(Unit) {
        showContent = true
    }

    val scale by animateFloatAsState(
        targetValue = if (showContent) 1f else 0.5f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "scale"
    )

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text(
                text = "🎉 Votação Concluída! 🎉",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        }

        item {
            MvpWinnerCard(
                winner = mvpWinner,
                votes = mvpVotes,
                modifier = Modifier.scale(scale)
            )
        }

        bolaMurchaWinner?.let { winner ->
            item {
                BolaMurchaWinnerCard(
                    winner = winner,
                    votes = bolaMurchaVotes,
                    modifier = Modifier.scale(scale)
                )
            }
        } ?: item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "🤝",
                        fontSize = 40.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Ninguém levou a Bola Murcha!",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "Todos jogaram bem hoje!",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        item {
            Spacer(modifier = Modifier.height(8.dp))
            
            Button(
                onClick = onClose,
                modifier = Modifier.fillMaxWidth(0.6f),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Fechar", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun MvpWinnerCard(
    winner: Map<String, Any?>,
    votes: Map<String, Int>,
    modifier: Modifier = Modifier
) {
    val winnerId = winner["id"] as? String ?: ""
    val winnerVotes = votes[winnerId] ?: 0
    val totalVotes = votes.values.sum()
    val percentage = if (totalVotes > 0) (winnerVotes * 100 / totalVotes) else 0

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = GoldLightColor
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "🏆 MVP DO JOGO 🏆",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = GoldDarkColor
            )

            Spacer(modifier = Modifier.height(16.dp))

            Box(
                modifier = Modifier
                    .size(100.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(GoldColor, GoldDarkColor)
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "👑",
                    fontSize = 48.sp
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            val displayName = (winner["nickname"] as? String)?.takeIf { it.isNotBlank() }
                ?: winner["name"] as? String
                ?: "Jogador"

            Text(
                text = displayName,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = GoldDarkColor
            )

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "$winnerVotes votos",
                    style = MaterialTheme.typography.bodyLarge,
                    color = GoldDarkColor,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "($percentage%)",
                    style = MaterialTheme.typography.bodyMedium,
                    color = GoldDarkColor.copy(alpha = 0.7f)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            VotesBarChart(
                votes = votes,
                players = mapOf(winnerId to winner),
                highlightColor = GoldColor,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(12.dp))

            Surface(
                shape = RoundedCornerShape(8.dp),
                color = GoldColor.copy(alpha = 0.3f)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("⭐", fontSize = 18.sp)
                    Text(
                        text = "+50 XP conquistados!",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = GoldDarkColor
                    )
                }
            }
        }
    }
}

@Composable
private fun BolaMurchaWinnerCard(
    winner: Map<String, Any?>,
    votes: Map<String, Int>,
    modifier: Modifier = Modifier
) {
    val winnerId = winner["id"] as? String ?: ""
    val winnerVotes = votes[winnerId] ?: 0
    val totalVotes = votes.values.sum()
    val percentage = if (totalVotes > 0) (winnerVotes * 100 / totalVotes) else 0

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = WarningBgColor
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "💩 BOLA MURCHA 💩",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = BrownDarkColor
            )

            Spacer(modifier = Modifier.height(12.dp))

            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(BrownLightColor.copy(alpha = 0.5f)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "😅",
                    fontSize = 40.sp
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            val displayName = (winner["nickname"] as? String)?.takeIf { it.isNotBlank() }
                ?: winner["name"] as? String
                ?: "Jogador"

            Text(
                text = displayName,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = BrownDarkColor
            )

            Spacer(modifier = Modifier.height(4.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "$winnerVotes votos ($percentage%)",
                    style = MaterialTheme.typography.bodyMedium,
                    color = BrownDarkColor.copy(alpha = 0.8f)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Surface(
                shape = RoundedCornerShape(8.dp),
                color = BrownColor.copy(alpha = 0.2f)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("📉", fontSize = 14.sp)
                    Text(
                        text = "-20 XP",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        color = BrownDarkColor
                    )
                }
            }
        }
    }
}

@Composable
private fun VotesBarChart(
    votes: Map<String, Int>,
    players: Map<String, Map<String, Any?>>,
    highlightColor: Color,
    modifier: Modifier = Modifier
) {
    val maxVotes = votes.values.maxOrNull() ?: 0

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        votes.entries.sortedByDescending { it.value }.take(3).forEach { (playerId, voteCount) ->
            val player = players[playerId]
            val playerName = (player?.get("nickname") as? String)
                ?: (player?.get("name") as? String)?.split(" ")?.firstOrNull()
                ?: "Jogador"
            val barWidth = if (maxVotes > 0) voteCount.toFloat() / maxVotes else 0f

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = playerName.take(10),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.width(80.dp)
                )
                
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(16.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxHeight()
                            .fillMaxWidth(barWidth)
                            .clip(RoundedCornerShape(4.dp))
                            .background(highlightColor)
                    )
                }
                
                Text(
                    text = voteCount.toString(),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = highlightColor,
                    modifier = Modifier.width(24.dp),
                    textAlign = TextAlign.End
                )
            }
        }
    }
}

private val GoldLightColor = Color(0xFFFFF8DC)
private val GoldDarkColor = Color(0xFFB8860B)
private val GoldColor = Color(0xFFFFD700)
private val BrownDarkColor = Color(0xFF5D3A1A)
private val BrownLightColor = Color(0xFFDEB887)
private val BrownColor = Color(0xFF8B4513)
private val WarningBgColor = Color(0xFFFFF3E0)
