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
import androidx.compose.ui.unit.dp
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.release_section_added
import com.futebadosparcas.compose.resources.release_section_fixed
import com.futebadosparcas.compose.resources.release_section_improved
import com.futebadosparcas.compose.resources.release_type_major
import com.futebadosparcas.compose.resources.release_type_minor
import com.futebadosparcas.compose.resources.release_type_patch
import com.futebadosparcas.domain.model.ReleaseHighlight
import com.futebadosparcas.domain.model.ReleaseNote
import com.futebadosparcas.domain.model.ReleaseType
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import org.jetbrains.compose.resources.stringResource

/**
 * Componentes compartilhados da feature "Novidades" no `composeApp` (iOS via
 * Compose Multiplatform) — usados tanto pelo pop-up ([WhatsNewBottomSheet])
 * quanto pela Tela "Novidades" ([WhatsNewScreen]).
 *
 * Porta a UI Android (`:app/.../ui/whatsnew/WhatsNewContent.kt`) para commonMain.
 * As strings de UI são resolvidas via Compose resources para manter a paridade
 * cross-platform e preparar localização futura.
 *
 * Spec: feat-2026-05-22-version-control-release-notes.md — Fase G, task #23.
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

/**
 * Formata a data do release (epoch millis UTC) para `dd/MM/aaaa`; vazio se
 * inválida. Usa `kotlinx-datetime` (formato numérico, sem nomes de mês) para
 * funcionar de forma idêntica em Android, iOS e wasmJs sem `expect/actual`.
 */
@OptIn(kotlin.time.ExperimentalTime::class)
internal fun formatReleaseDate(epochMillis: Long): String {
    if (epochMillis <= 0L) return ""
    return runCatching {
        val date = Instant.fromEpochMilliseconds(epochMillis).toLocalDateTime(TimeZone.UTC)
        val day = date.dayOfMonth.toString().padStart(2, '0')
        val month = date.monthNumber.toString().padStart(2, '0')
        "$day/$month/${date.year}"
    }.getOrDefault("")
}

/** Rótulo PT-BR do tipo de release. */
@Composable
internal fun releaseTypeLabel(type: ReleaseType): String = when (type) {
    ReleaseType.MAJOR -> stringResource(Res.string.release_type_major)
    ReleaseType.MINOR -> stringResource(Res.string.release_type_minor)
    ReleaseType.PATCH -> stringResource(Res.string.release_type_patch)
}

/**
 * Badge do tipo de release. Não depende só de cor — sempre inclui texto
 * (requisito de acessibilidade, spec §2.4).
 */
@Composable
internal fun ReleaseTypeBadge(type: ReleaseType, modifier: Modifier = Modifier) {
    val container: Color
    val onContainer: Color
    when (type) {
        ReleaseType.MAJOR -> {
            container = MaterialTheme.colorScheme.tertiaryContainer
            onContainer = MaterialTheme.colorScheme.onTertiaryContainer
        }
        ReleaseType.MINOR -> {
            container = MaterialTheme.colorScheme.primaryContainer
            onContainer = MaterialTheme.colorScheme.onPrimaryContainer
        }
        ReleaseType.PATCH -> {
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
            text = releaseTypeLabel(type),
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
            title = stringResource(Res.string.release_section_added),
            icon = Icons.Default.AutoAwesome,
            items = note.added,
            accent = MaterialTheme.colorScheme.primary,
        )
        ReleaseSection(
            title = stringResource(Res.string.release_section_improved),
            icon = Icons.Default.Bolt,
            items = note.improved,
            accent = MaterialTheme.colorScheme.tertiary,
        )
        ReleaseSection(
            title = stringResource(Res.string.release_section_fixed),
            icon = Icons.Default.BugReport,
            items = note.fixed,
            accent = MaterialTheme.colorScheme.secondary,
        )
    }
}
