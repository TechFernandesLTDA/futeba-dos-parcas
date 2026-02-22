package com.futebadosparcas.ui.voting

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val BrownColor = Color(0xFF8B4513)
private val BrownLightColor = Color(0xFFDEB887)
private val BrownDarkColor = Color(0xFF5D3A1A)
private val WarningBgColor = Color(0xFFFFF3E0)

@Composable
fun BolaMurchaVotingTab(
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
                containerColor = WarningBgColor
            )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "💩 Bola Murcha 💩",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = BrownDarkColor
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Quem jogou mal hoje?",
                    style = MaterialTheme.typography.bodyMedium,
                    color = BrownDarkColor.copy(alpha = 0.8f)
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "⚠️",
                        fontSize = 14.sp
                    )
                    Text(
                        text = "O Bola Murcha perde 20 XP!",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold,
                        color = BrownDarkColor
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.errorContainer
            )
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("ℹ️", fontSize = 18.sp)
                Text(
                    text = "Esta votação é opcional. Se ninguém merecer, é só pular!",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onErrorContainer
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
                BolaMurchaPlayerCard(
                    player = player,
                    isSelected = selectedId == player["id"],
                    onClick = { onPlayerSelected(player["id"] as String) }
                )
            }
        }
    }
}

@Composable
private fun BolaMurchaPlayerCard(
    player: Map<String, Any?>,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val borderModifier = if (isSelected) {
        Modifier.border(3.dp, BrownColor, RoundedCornerShape(16.dp))
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
                BrownColor.copy(alpha = 0.15f) 
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
                            .clip(androidx.compose.foundation.shape.CircleShape)
                            .background(BrownLightColor.copy(alpha = 0.3f)),
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
                                .clip(androidx.compose.foundation.shape.CircleShape)
                                .background(BrownColor),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("💩", fontSize = 12.sp)
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
                    color = if (isSelected) BrownDarkColor else MaterialTheme.colorScheme.onSurface,
                    textAlign = TextAlign.Center,
                    maxLines = 1
                )

                Spacer(modifier = Modifier.height(2.dp))

                val position = player["position"] as? String ?: ""
                if (position.isNotEmpty()) {
                    Text(
                        text = position,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (isSelected) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = 4.dp)
                ) {
                    Text("😅", fontSize = 20.sp)
                }
            }
        }
    }
}
