package com.futebadosparcas.ui.home.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.theme.GamificationColors
import com.futebadosparcas.util.LevelBadgeHelper

/**
 * Estado vazio amigavel para usuarios novos
 *
 * Mostra:
 * - Boas-vindas personalizadas
 * - Brasao do nivel inicial
 * - Dicas de primeiros passos
 *
 * OTIMIZADO: Removidas animacoes para scroll suave
 */
@Composable
fun WelcomeEmptyState(
    userName: String = "Jogador",
    userLevel: Int = 0,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Brasao do Nivel (sem animacao)
        Box(
            modifier = Modifier.size(120.dp),
            contentAlignment = Alignment.Center
        ) {
            androidx.compose.foundation.Image(
                painter = painterResource(id = LevelBadgeHelper.getBadgeForLevel(userLevel)),
                contentDescription = "Brasão de nível $userLevel",
                modifier = Modifier.size(120.dp)
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Mensagem de Boas-vindas
        Text(
            text = "Bem-vindo, $userName! ⚽",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Você ainda não tem jogos agendados",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Card de Dicas
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            ),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
            ) {
                Text(
                    text = "Primeiros Passos",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )

                Spacer(modifier = Modifier.height(16.dp))

                TipItem(
                    icon = Icons.Default.SportsSoccer,
                    text = "Vá na aba de Jogos para criar sua primeira partida"
                )

                Spacer(modifier = Modifier.height(12.dp))

                TipItem(
                    icon = Icons.Default.Group,
                    text = "Convide seus amigos e monte os times"
                )

                Spacer(modifier = Modifier.height(12.dp))

                TipItem(
                    icon = Icons.Default.EmojiEvents,
                    text = "Jogue, ganhe XP e suba de nível!"
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Informação sobre XP
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(
                            GamificationColors.XpGreen.copy(alpha = 0.1f),
                            GamificationColors.XpLightGreen.copy(alpha = 0.1f)
                        )
                    ),
                    shape = RoundedCornerShape(12.dp)
                )
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Star,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(24.dp)
            )

            Spacer(modifier = Modifier.width(12.dp))

            Text(
                text = "Cada jogo te dá XP e ajuda a evoluir como jogador!",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun TipItem(
    icon: ImageVector,
    text: String
) {
    Row(
        verticalAlignment = Alignment.Top,
        modifier = Modifier.fillMaxWidth()
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(20.dp)
        )

        Spacer(modifier = Modifier.width(12.dp))

        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
