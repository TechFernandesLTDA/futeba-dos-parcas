package com.futebadosparcas.ui.home.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.UserBadge
import com.futebadosparcas.ui.adaptive.rememberWindowSizeClass
import com.futebadosparcas.ui.adaptive.rememberAdaptiveSpacing
import com.futebadosparcas.ui.adaptive.adaptiveValue

@Composable
fun RecentBadgesCarousel(
    badges: List<UserBadge>,
    modifier: Modifier = Modifier
) {
    if (badges.isEmpty()) return

    val windowSizeClass = rememberWindowSizeClass()
    val spacing = rememberAdaptiveSpacing()

    // Em telas grandes, mostrar grid ao invés de carrossel
    val useGrid = windowSizeClass.isMedium || windowSizeClass.isExpanded

    Column(modifier = modifier) {
        Text(
            text = stringResource(R.string.recent_badges_title),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = spacing.contentPaddingHorizontal, vertical = spacing.sm)
        )

        if (useGrid) {
            // Grid para tablets e landscape
            val columns = adaptiveValue(
                compact = 4,
                medium = 6,
                expanded = 8
            )

            LazyVerticalGrid(
                columns = GridCells.Fixed(columns),
                contentPadding = PaddingValues(horizontal = spacing.contentPaddingHorizontal),
                horizontalArrangement = Arrangement.spacedBy(spacing.gridItemSpacing),
                verticalArrangement = Arrangement.spacedBy(spacing.gridItemSpacing),
                modifier = Modifier.padding(bottom = spacing.sm)
            ) {
                items(badges.take(columns), key = { it.badgeId }) { badge ->
                    BadgeCard(badge = badge, size = adaptiveValue(
                        compact = 80.dp,
                        medium = 96.dp,
                        expanded = 104.dp
                    ))
                }
            }
        } else {
            // Carrossel horizontal para telefones portrait
            LazyRow(
                contentPadding = PaddingValues(horizontal = spacing.contentPaddingHorizontal),
                horizontalArrangement = Arrangement.spacedBy(spacing.gridItemSpacing)
            ) {
                items(badges, key = { it.badgeId }) { badge ->
                    BadgeCard(badge = badge, size = 80.dp)
                }
            }
        }
    }
}

@Composable
fun BadgeCard(badge: UserBadge, size: androidx.compose.ui.unit.Dp = 80.dp) {
     Card(
         colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
         modifier = Modifier.size(size),
         shape = CircleShape
     ) {
         Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize().padding(8.dp)) {
              Text(
                  text = badge.badgeId.replace("_", " ").uppercase(),
                  fontWeight = FontWeight.Bold,
                  style = MaterialTheme.typography.labelSmall,
                  textAlign = TextAlign.Center
              )
         }
     }
}
