package com.futebadosparcas.ui.whatsnew

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.NewReleases
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.cd_back
import com.futebadosparcas.compose.resources.cd_collapse_release_version
import com.futebadosparcas.compose.resources.cd_expand_release_version
import com.futebadosparcas.compose.resources.retry
import com.futebadosparcas.compose.resources.whats_new_empty_body
import com.futebadosparcas.compose.resources.whats_new_empty_title
import com.futebadosparcas.compose.resources.whats_new_error_body
import com.futebadosparcas.compose.resources.whats_new_title
import com.futebadosparcas.compose.resources.whats_new_version_a11y_prefix
import com.futebadosparcas.compose.resources.whats_new_version_title
import com.futebadosparcas.domain.model.ReleaseNote
import com.futebadosparcas.ui.adaptive.AdaptiveTopBar
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel

/**
 * Tela "Novidades" — histórico de release notes, mais recente no topo.
 *
 * Acessível via menu na Home. Cada versão é um card expansível com headline,
 * destaques e seções. Cobre os 4 estados obrigatórios (Loading/Empty/Error/
 * Success). Porta a tela Android (`:app/.../ui/whatsnew/WhatsNewScreen.kt`).
 *
 * Spec: feat-2026-05-22-version-control-release-notes.md — Fase G, task #23.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WhatsNewScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: WhatsNewViewModel = koinViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.loadHistory()
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            AdaptiveTopBar(
                title = stringResource(Res.string.whats_new_title),
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(Res.string.cd_back),
                        )
                    }
                }
            )
        },
    ) { innerPadding ->
        Box(modifier = Modifier.padding(innerPadding)) {
            when (val state = uiState) {
                is WhatsNewUiState.Loading -> WhatsNewLoadingState()

                is WhatsNewUiState.Empty -> WhatsNewEmptyState()

                is WhatsNewUiState.Error -> WhatsNewErrorState(
                    onRetry = viewModel::loadHistory,
                )

                is WhatsNewUiState.Success -> WhatsNewList(notes = state.notes)
            }
        }
    }
}

@Composable
private fun WhatsNewList(
    notes: List<ReleaseNote>,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        itemsIndexed(
            items = notes,
            key = { _, note -> "${note.platform}/${note.version}/${note.buildNumber}" },
        ) { index, note ->
            // A versão mais recente já nasce expandida.
            VersionCard(note = note, initiallyExpanded = index == 0)
        }
    }
}

@Composable
private fun VersionCard(
    note: ReleaseNote,
    initiallyExpanded: Boolean,
) {
    var expanded by remember(note.buildNumber) { mutableStateOf(initiallyExpanded) }
    val releaseDate = formatReleaseDate(note.releaseDate)
    val expansionAction = if (expanded) {
        stringResource(Res.string.cd_collapse_release_version)
    } else {
        stringResource(Res.string.cd_expand_release_version)
    }
    val versionA11yPrefix = stringResource(Res.string.whats_new_version_a11y_prefix)
    val accessibilitySummary = buildString {
        append(versionA11yPrefix)
        append(" ")
        append(note.version)
        if (releaseDate.isNotBlank()) {
            append(". ")
            append(releaseDate)
        }
        append(". ")
        append(expansionAction)
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .animateContentSize(),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expanded = !expanded }
                    .semantics(mergeDescendants = true) {
                        contentDescription = accessibilitySummary
                        role = Role.Button
                    }
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = stringResource(Res.string.whats_new_version_title, note.version),
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Spacer(Modifier.width(8.dp))
                        ReleaseTypeBadge(note.type)
                    }
                    if (releaseDate.isNotBlank()) {
                        Text(
                            text = releaseDate,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                Icon(
                    imageVector = if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (expanded) {
                ReleaseNoteBody(
                    note = note,
                    showHeadline = true,
                    modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
                )
            }
        }
    }
}

/** Estado de carregamento — cards-placeholder simples (composeApp não tem shimmer). */
@Composable
private fun WhatsNewLoadingState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        repeat(4) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(96.dp)
                    .background(
                        color = MaterialTheme.colorScheme.surfaceContainerHigh,
                        shape = RoundedCornerShape(16.dp),
                    ),
            )
        }
    }
}

@Composable
private fun WhatsNewEmptyState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = Icons.Default.NewReleases,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f),
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = stringResource(Res.string.whats_new_empty_title),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = stringResource(Res.string.whats_new_empty_body),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun WhatsNewErrorState(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = Icons.Default.ErrorOutline,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.error,
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = stringResource(Res.string.whats_new_error_body),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(16.dp))
        Button(onClick = onRetry) {
            Text(stringResource(Res.string.retry))
        }
    }
}
