package com.futebadosparcas.ui.home.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Handshake
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.SportsScore
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import com.futebadosparcas.data.model.MilestoneType
import com.futebadosparcas.ui.home.HomeProgressInsights
import com.futebadosparcas.ui.theme.AppDimensions

@Composable
internal fun HomeProgressNudgesSection(
    insights: HomeProgressInsights,
    modifier: Modifier = Modifier
) {
    if (!insights.hasContent) return

    val title = stringResource(R.string.home_near_progress_title)
    val badgesTitle = stringResource(R.string.home_near_badges_title)
    val nearLevelDescription = insights.nearLevel?.let {
        stringResource(
            R.string.home_near_level_description,
            it.xpRemaining,
            it.nextLevelName
        )
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) {
                contentDescription = buildString {
                    append(title)
                    nearLevelDescription?.let {
                        append(". ")
                        append(it)
                    }
                    if (insights.nearMilestones.isNotEmpty()) {
                        append(". ")
                        append(badgesTitle)
                    }
                }
            },
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(AppDimensions.spacing_medium),
            verticalArrangement = Arrangement.spacedBy(AppDimensions.spacing_medium)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSecondaryContainer
                )
                Text(
                    text = stringResource(R.string.home_near_progress_subtitle),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.84f)
                )
            }

            insights.nearLevel?.let { nearLevel ->
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = stringResource(R.string.home_near_level_title),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                    InsightProgressRow(
                        icon = Icons.AutoMirrored.Filled.TrendingUp,
                        iconDescription = stringResource(R.string.home_near_level_title),
                        title = stringResource(R.string.home_near_level_title),
                        supportingText = nearLevelDescription.orEmpty(),
                        progress = nearLevel.progressPercent / 100f,
                        progressText = stringResource(
                            R.string.home_near_level_progress,
                            nearLevel.currentLevel,
                            nearLevel.nextLevel
                        )
                    )
                }
            }

            if (insights.nearMilestones.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = badgesTitle,
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                    insights.nearMilestones.forEach { milestone ->
                        InsightProgressRow(
                            icon = milestoneIcon(milestone.milestone),
                            iconDescription = milestoneCategoryLabel(milestone.milestone),
                            title = milestone.milestone.displayName,
                            supportingText = milestoneCategoryLabel(milestone.milestone),
                            progress = milestone.progressPercent / 100f,
                            progressText = stringResource(
                                R.string.home_near_badge_progress,
                                milestone.current,
                                milestone.target
                            ),
                            trailingText = stringResource(
                                R.string.home_near_badge_remaining,
                                milestone.remaining
                            )
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun InsightProgressRow(
    icon: ImageVector,
    iconDescription: String,
    title: String,
    supportingText: String,
    progress: Float,
    progressText: String,
    trailingText: String? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) {
                progressBarRangeInfo = ProgressBarRangeInfo(
                    current = progress.coerceIn(0f, 1f),
                    range = 0f..1f
                )
                contentDescription = listOfNotNull(
                    title,
                    supportingText,
                    progressText,
                    trailingText
                ).joinToString(separator = ". ")
            },
        horizontalArrangement = Arrangement.spacedBy(AppDimensions.spacing_small),
        verticalAlignment = Alignment.Top
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .background(
                    color = MaterialTheme.colorScheme.surface.copy(alpha = 0.6f),
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = iconDescription,
                tint = MaterialTheme.colorScheme.onSecondaryContainer
            )
        }

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                    Text(
                        text = supportingText,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.8f)
                    )
                }
                trailingText?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
            }

            LinearProgressIndicator(
                progress = { progress.coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.surface
            )

            Text(
                text = progressText,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSecondaryContainer
            )
        }
    }
}

@Composable
private fun milestoneCategoryLabel(milestone: MilestoneType): String {
    return stringResource(
        when (milestone.field) {
            "totalGoals" -> R.string.home_near_badge_category_goals
            "totalAssists" -> R.string.home_near_badge_category_assists
            "totalSaves" -> R.string.home_near_badge_category_saves
            "gamesWon" -> R.string.home_near_badge_category_wins
            else -> R.string.home_near_badges_title
        }
    )
}

private fun milestoneIcon(milestone: MilestoneType): ImageVector {
    return when (milestone.field) {
        "totalGoals" -> Icons.Filled.SportsScore
        "totalAssists" -> Icons.Filled.Handshake
        "totalSaves" -> Icons.Filled.Shield
        "gamesWon" -> Icons.Filled.EmojiEvents
        else -> Icons.Filled.EmojiEvents
    }
}
