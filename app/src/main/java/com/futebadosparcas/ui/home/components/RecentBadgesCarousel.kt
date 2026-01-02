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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.data.model.UserBadge

@Composable
fun RecentBadgesCarousel(
    badges: List<UserBadge>,
    modifier: Modifier = Modifier
) {
    if (badges.isEmpty()) return

    Column(modifier = modifier) {
        Text(
            text = "Conquistas Recentes",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
        )

        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(badges) { badge ->
                 BadgeCard(badge)
            }
        }
    }
}

@Composable
fun BadgeCard(badge: UserBadge) {
     Card(
         colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
         modifier = Modifier.size(80.dp),
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
