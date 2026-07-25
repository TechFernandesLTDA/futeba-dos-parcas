package com.futebadosparcas.ui.whatsnew

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.Celebration
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.Construction
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Devices
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Stars
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.ReleaseHighlight
import com.futebadosparcas.domain.model.ReleaseNote
import com.futebadosparcas.domain.model.ReleaseType
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Componentes compartilhados da feature "Novidades" — usados tanto pelo pop-up
 * ([WhatsNewBottomSheet]) quanto pela Tela "Novidades" ([WhatsNewScreen]).
 *
 * Spec: feat-2026-05-22-version-control-release-notes.md — Fase E.
 */

/**
 * Mapeia o nome do ícone (DSL `icon=<nome>` da nota de versão) para um
 * [ImageVector] do Material. Nomes desconhecidos caem no fallback genérico.
 */
internal fun releaseHighlightIcon(name: String): ImageVector = when (name.trim().lowercase()) {
    "palette" -> Icons.Default.Palette
    "dark_mode" -> Icons.Default.DarkMode
    "celebration" -> Icons.Default.Celebration
    "checklist" -> Icons.Default.Checklist
    "translate" -> Icons.Default.Translate
    "devices" -> Icons.Default.Devices
    "construction" -> Icons.Default.Construction
    "bolt", "speed" -> Icons.Default.Bolt
    "bug", "bug_report" -> Icons.Default.BugReport
    "lock", "security" -> Icons.Default.Lock
    "notifications" -> Icons.Default.Notifications
    "star", "stars" -> Icons.Default.Stars
    else -> Icons.Default.AutoAwesome
}

/** Formata a data do release (epoch millis UTC) para pt-BR; vazio se inválida. */
internal fun formatReleaseDate(epochMillis: Long): String {
    if (epochMillis <= 0L) return ""
    return runCatching {
        val ptBr = Locale.forLanguageTag("pt-BR")
        SimpleDateFormat("d 'de' MMMM 'de' yyyy", ptBr).format(Date(epochMillis))
    }.getOrDefault("")
}

/**
 * Badge do tipo de release. Não depende só de cor — sempre inclui texto
 * (requisito de acessibilidade, spec §2.4).
 */
@Composable
internal fun ReleaseTypeBadge(type: ReleaseType, modifier: Modifier = Modifier) {
    val labelRes: Int
    val container: Color
    val onContainer: Color
    when (type) {
        ReleaseType.MAJOR -> {
            labelRes = R.string.whats_new_type_major
            container = MaterialTheme.colorScheme.tertiaryContainer
            onContainer = MaterialTheme.colorScheme.onTertiaryContainer
        }
        ReleaseType.MINOR -> {
            labelRes = R.string.whats_new_type_minor
            container = MaterialTheme.colorScheme.primaryContainer
            onContainer = MaterialTheme.colorScheme.onPrimaryContainer
        }
        ReleaseType.PATCH -> {
            labelRes = R.string.whats_new_type_patch
            container = MaterialTheme.colorScheme.secondaryContainer
            onContainer = MaterialTheme.colorScheme.onSecondaryContainer
        }
    }
    Surface(
        modifier = modifier,
        shape = MaterialTheme.shapes.small,
        color = container,
    ) {
        Text(
            text = stringResource(labelRes),
            style = MaterialTheme.typography.labelSmall,
            color = onContainer,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
        )
    }
}

/** Card de um destaque do release — ícone circular + título + descrição curta. */
@Composable
internal fun ReleaseHighlightCard(highlight: ReleaseHighlight, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Surface(
            shape = CircleShape,
            color = MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier.size(40.dp),
        ) {
            Icon(
                imageVector = releaseHighlightIcon(highlight.icon),
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimaryContainer,
                modifier = Modifier
                    .padding(9.dp)
                    .size(22.dp),
            )
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = rememberMarkdownLite(highlight.title),
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurface,
            )
            if (highlight.description.isNotBlank()) {
                Text(
                    text = rememberMarkdownLite(highlight.description),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** Seção de lista (Novidades / Melhorias / Correções). Não renderiza se vazia. */
@Composable
internal fun ReleaseSection(
    title: String,
    icon: ImageVector,
    items: List<String>,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    if (items.isEmpty()) return
    Column(modifier = modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = accent,
                modifier = Modifier.size(18.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
        Spacer(Modifier.height(6.dp))
        items.forEach { item ->
            Row(modifier = Modifier.padding(vertical = 2.dp)) {
                Text(
                    text = "•",
                    style = MaterialTheme.typography.bodyMedium,
                    color = accent,
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = rememberMarkdownLite(item),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/**
 * Corpo completo de uma nota de versão: headline (opcional) + cards de destaque
 * + seções Novidades/Melhorias/Correções.
 *
 * @param showHeadline `false` quando o headline já é exibido como hero acima
 *        (caso do pop-up).
 */
@Composable
internal fun ReleaseNoteBody(
    note: ReleaseNote,
    modifier: Modifier = Modifier,
    showHeadline: Boolean = true,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        if (showHeadline && note.headline.isNotBlank()) {
            Text(
                text = rememberMarkdownLite(note.headline),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
        if (note.highlights.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                note.highlights.forEach { ReleaseHighlightCard(it) }
            }
        }
        ReleaseSection(
            title = stringResource(R.string.whats_new_section_added),
            icon = Icons.Default.AutoAwesome,
            items = note.added,
            accent = MaterialTheme.colorScheme.primary,
        )
        ReleaseSection(
            title = stringResource(R.string.whats_new_section_improved),
            icon = Icons.Default.Bolt,
            items = note.improved,
            accent = MaterialTheme.colorScheme.tertiary,
        )
        ReleaseSection(
            title = stringResource(R.string.whats_new_section_fixed),
            icon = Icons.Default.BugReport,
            items = note.fixed,
            accent = MaterialTheme.colorScheme.secondary,
        )
    }
}
