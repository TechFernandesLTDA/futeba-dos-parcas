package com.futebadosparcas.ui.voting

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val GoldColor = Color(0xFFFFD700)
private val GoldDarkColor = Color(0xFFB8860B)
private val GoldLightColor = Color(0xFFFFF8DC)

@Composable
fun MvpVotingTab(
    players: List<Map<String, Any?>>,
    selectedId: String?,
    onPlayerSelected: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = GoldLightColor
            )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "🏆 Vote no MVP! 🏆",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = GoldDarkColor
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Quem foi o destaque do jogo?",
                    style = MaterialTheme.typography.bodyMedium,
                    color = GoldDarkColor.copy(alpha = 0.8f)
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "+50 XP para o vencedor!",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Bold,
                    color = GoldDarkColor
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(
                items = players,
                key = { it["id"] as String }
            ) { player ->
                PlayerVoteCard(
                    player = player,
                    isSelected = selectedId == player["id"],
                    onClick = { onPlayerSelected(player["id"] as String) },
                    accentColor = GoldColor,
                    darkColor = GoldDarkColor,
                    emoji = "⭐"
                )
            }
        }
    }
}

@Composable
private fun PlayerVoteCard(
    player: Map<String, Any?>,
    isSelected: Boolean,
    onClick: () -> Unit,
    accentColor: Color,
    darkColor: Color,
    emoji: String
) {
    val borderModifier = if (isSelected) {
        Modifier.border(3.dp, accentColor, RoundedCornerShape(16.dp))
    } else {
        Modifier
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(0.85f)
            .then(borderModifier)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) 
                accentColor.copy(alpha = 0.2f) 
            else 
                MaterialTheme.colorScheme.surfaceVariant
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = if (isSelected) 8.dp else 2.dp
        )
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Box {
                    Box(
                        modifier = Modifier
                            .size(60.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(
                                        accentColor.copy(alpha = 0.3f),
                                        accentColor.copy(alpha = 0.1f)
                                    )
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "👤",
                            fontSize = 28.sp
                        )
                    }
                    
                    if (isSelected) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .size(24.dp)
                                .clip(CircleShape)
                                .background(accentColor),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("✓", color = Color.White, fontSize = 14.sp)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                val displayName = (player["nickname"] as? String)?.takeIf { it.isNotBlank() }
                    ?: (player["name"] as? String)?.split(" ")?.firstOrNull()
                    ?: "Jogador"

                Text(
                    text = displayName,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = if (isSelected) darkColor else MaterialTheme.colorScheme.onSurface,
                    textAlign = TextAlign.Center,
                    maxLines = 1
                )

                Spacer(modifier = Modifier.height(2.dp))

                val position = player["position"] as? String ?: ""
                val goals = player["goals"] as? Int ?: 0
                val assists = player["assists"] as? Int ?: 0
                val saves = player["saves"] as? Int ?: 0

                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (position.isNotEmpty()) {
                        Text(
                            text = position,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    when {
                        goals > 0 -> Text(
                            text = "⚽$goals",
                            style = MaterialTheme.typography.labelSmall,
                            color = accentColor
                        )
                        assists > 0 -> Text(
                            text = "🅰️$assists",
                            style = MaterialTheme.typography.labelSmall,
                            color = accentColor
                        )
                        saves > 0 -> Text(
                            text = "🧤$saves",
                            style = MaterialTheme.typography.labelSmall,
                            color = accentColor
                        )
                    }
                }
            }

            if (isSelected) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = 4.dp)
                ) {
                    Text(emoji, fontSize = 20.sp)
                }
            }
        }
    }
}
