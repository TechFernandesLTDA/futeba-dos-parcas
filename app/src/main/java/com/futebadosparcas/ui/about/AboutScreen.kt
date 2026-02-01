package com.futebadosparcas.ui.about

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.BuildConfig
import com.futebadosparcas.R

/**
 * Tela Sobre o aplicativo
 *
 * Features:
 * - Logo e nome do app
 * - Versão atual
 * - Descrição do app
 * - Links úteis (GitHub, Contato, Avaliar)
 * - Licenças e créditos
 */
@Composable
fun AboutScreen(
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header com logo
        item {
            AboutHeader()
        }

        // Card de Versão
        item {
            VersionCard()
        }

        // Card de Descrição
        item {
            DescriptionCard()
        }

        // Card de Links
        item {
            LinksCard(
                onRateClick = {
                    // Link para Play Store
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        data = Uri.parse("https://play.google.com/store/apps/details?id=${context.packageName}")
                    }
                    context.startActivity(intent)
                },
                onContactClick = {
                    // Abrir email
                    val intent = Intent(Intent.ACTION_SENDTO).apply {
                        data = Uri.parse("mailto:techfernandesltda@gmail.com")
                        putExtra(Intent.EXTRA_SUBJECT, context.getString(R.string.about_feedback_subject))
                    }
                    context.startActivity(intent)
                },
                onPrivacyClick = {
                    // Link para politica de privacidade
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        data = Uri.parse("https://futebadosparcas.web.app/privacy_policy.html")
                    }
                    context.startActivity(intent)
                },
                onTermsClick = {
                    // Link para termos de uso
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        data = Uri.parse("https://futebadosparcas.web.app/terms_of_service.html")
                    }
                    context.startActivity(intent)
                }
            )
        }

        // Card de Créditos
        item {
            CreditsCard()
        }

        // Footer
        item {
            Text(
                text = stringResource(R.string.about_footer_text),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 16.dp),
                textAlign = TextAlign.Center
            )
        }
    }
}

/**
 * Header com logo e nome do app
 */
@Composable
private fun AboutHeader() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Logo do app
            Image(
                painter = painterResource(id = R.drawable.ic_launcher_foreground),
                contentDescription = stringResource(R.string.app_name),
                modifier = Modifier
                    .size(100.dp)
                    .clip(CircleShape)
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Nome do app
            Text(
                text = stringResource(R.string.app_name),
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Slogan
            Text(
                text = stringResource(R.string.about_slogan),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
            )
        }
    }
}

/**
 * Card com informações de versão
 */
@Composable
private fun VersionCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = stringResource(R.string.about_app_info),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = stringResource(R.string.about_version_label),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = BuildConfig.VERSION_NAME,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = stringResource(R.string.about_build_label),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = BuildConfig.VERSION_CODE.toString(),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

/**
 * Card com descrição do app
 */
@Composable
private fun DescriptionCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = stringResource(R.string.about_section_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = stringResource(R.string.about_description),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Justify
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Features principais
            FeatureItem(icon = Icons.Default.Groups, text = stringResource(R.string.about_feature_groups))
            FeatureItem(icon = Icons.Default.Balance, text = stringResource(R.string.about_feature_teams))
            FeatureItem(icon = Icons.Default.EmojiEvents, text = stringResource(R.string.about_feature_xp))
            FeatureItem(icon = Icons.Default.Leaderboard, text = stringResource(R.string.about_feature_ranking))
            FeatureItem(icon = Icons.Default.AttachMoney, text = stringResource(R.string.about_feature_cashbox))
        }
    }
}

/**
 * Item de feature
 */
@Composable
private fun FeatureItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    text: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(20.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = text,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

/**
 * Card com links úteis
 */
@Composable
private fun LinksCard(
    onRateClick: () -> Unit,
    onContactClick: () -> Unit,
    onPrivacyClick: () -> Unit,
    onTermsClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = stringResource(R.string.about_links_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )

            LinkMenuItem(
                icon = Icons.Default.Star,
                title = stringResource(R.string.about_rate_app),
                subtitle = stringResource(R.string.about_rate_app_desc),
                onClick = onRateClick
            )
            HorizontalDivider()
            LinkMenuItem(
                icon = Icons.Default.Email,
                title = stringResource(R.string.about_contact_us),
                subtitle = stringResource(R.string.about_contact_us_desc),
                onClick = onContactClick
            )
            HorizontalDivider()
            LinkMenuItem(
                icon = Icons.Default.Security,
                title = stringResource(R.string.about_privacy_policy),
                subtitle = stringResource(R.string.about_privacy_policy_desc),
                onClick = onPrivacyClick
            )
            HorizontalDivider()
            LinkMenuItem(
                icon = Icons.Default.Description,
                title = stringResource(R.string.about_terms_of_service),
                subtitle = stringResource(R.string.about_terms_of_service_desc),
                onClick = onTermsClick
            )
        }
    }
}

/**
 * Item de menu de link
 */
@Composable
private fun LinkMenuItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                modifier = Modifier.size(24.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Card de créditos
 */
@Composable
private fun CreditsCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = stringResource(R.string.about_credits_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = stringResource(R.string.about_credits_tech),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = stringResource(R.string.about_credits_icons),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = stringResource(R.string.about_copyright),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
