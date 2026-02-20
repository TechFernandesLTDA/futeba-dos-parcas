package com.futebadosparcas.ui.home.components
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.domain.model.WeeklyChallenge
import com.futebadosparcas.domain.model.UserChallengeProgress
import com.futebadosparcas.ui.adaptive.rememberWindowSizeClass
import com.futebadosparcas.ui.adaptive.rememberAdaptiveSpacing
import com.futebadosparcas.ui.adaptive.adaptiveValue

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ChallengesSection(
    challenges: List<Pair<WeeklyChallenge, UserChallengeProgress?>>,
    modifier: Modifier = Modifier
) {
    if (challenges.isEmpty()) return

    val windowSizeClass = rememberWindowSizeClass()
    val spacing = rememberAdaptiveSpacing()

    // Em telas grandes, mostrar grid ao invés de carrossel
    val useGrid = windowSizeClass.isMedium || windowSizeClass.isExpanded

    Column(modifier = modifier) {
        Text(
            text = stringResource(Res.string.challenges_title),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = spacing.contentPaddingHorizontal, vertical = spacing.sm)
        )

        if (useGrid) {
            // #016 - FlowRow em vez de LazyVerticalGrid (evita scroll aninhado)
            val columns = adaptiveValue(
                compact = 2,
                medium = 2,
                expanded = 3
            )

            FlowRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = spacing.contentPaddingHorizontal, vertical = spacing.sm),
                horizontalArrangement = Arrangement.spacedBy(spacing.gridItemSpacing),
                verticalArrangement = Arrangement.spacedBy(spacing.gridItemSpacing),
                maxItemsInEachRow = columns
            ) {
                challenges.forEach { (challenge, progress) ->
                    Box(modifier = Modifier.weight(1f)) {
                        ChallengeCard(challenge, progress, fillWidth = true)
                    }
                }
            }
        } else {
            // Carrossel horizontal para telefones portrait
            LazyRow(
                contentPadding = PaddingValues(horizontal = spacing.contentPaddingHorizontal),
                horizontalArrangement = Arrangement.spacedBy(spacing.gridItemSpacing)
            ) {
                items(challenges, key = { it.first.id }) { (challenge, progress) ->
                    ChallengeCard(challenge, progress, fillWidth = false)
                }
            }
        }
    }
}

@Composable
fun ChallengeCard(challenge: WeeklyChallenge, progress: UserChallengeProgress?, fillWidth: Boolean = false) {
    val current = progress?.currentProgress ?: 0
    val target = challenge.targetValue
    val percent = if (target > 0) current.toFloat() / target else 0f

    Card(
        modifier = if (fillWidth) {
            Modifier.fillMaxWidth()
        } else {
            Modifier.width(280.dp)
        },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = challenge.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )
            }
            
            Text(
                text = challenge.description,
                style = MaterialTheme.typography.bodySmall,
                maxLines = 2,
                minLines = 2
            )
            
            Spacer(modifier = Modifier.height(12.dp))
            
            LinearProgressIndicator(
                progress = { percent },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
            )
            
            Spacer(modifier = Modifier.height(4.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(), 
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "$current / $target",
                    style = MaterialTheme.typography.labelSmall
                )
                Text(
                    text = "+${challenge.xpReward} XP",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
