package com.futebadosparcas.ui.whatsnew

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.whats_new_acknowledge
import com.futebadosparcas.compose.resources.whats_new_popup_eyebrow
import com.futebadosparcas.compose.resources.whats_new_title
import com.futebadosparcas.domain.model.ReleaseNote
import com.futebadosparcas.ui.adaptive.AdaptiveModalBottomSheet
import kotlinx.coroutines.launch
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel

/**
 * Pop-up "Novidades" exibido automaticamente no boot pós-atualização.
 *
 * BottomSheet modal — dispensável por gesto (arrastar/scrim) e pelo botão único
 * "Entendi". Sempre exibe uma nota única (a mais recente não vista).
 *
 * Porta o pop-up Android (`:app/.../ui/whatsnew/WhatsNewBottomSheet.kt`).
 * Spec: feat-2026-05-22-version-control-release-notes.md — Fase G, task #23.
 *
 * @param onDismiss chamado após a animação de fechamento concluir — o caller
 *        deve marcar o build como visto e limpar o estado do pop-up.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WhatsNewBottomSheet(
    note: ReleaseNote,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val sheetState = rememberModalBottomSheetState()
    val scope = rememberCoroutineScope()

    // Anima o fechamento antes de notificar o caller — evita o sheet "sumir"
    // bruscamente e mantém o gesto de swipe-to-dismiss natural.
    fun animateAndDismiss() {
        scope.launch { sheetState.hide() }.invokeOnCompletion {
            if (!sheetState.isVisible) onDismiss()
        }
    }

    AdaptiveModalBottomSheet(
        onDismissRequest = { animateAndDismiss() },
        sheetState = sheetState,
        modifier = modifier,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = stringResource(Res.string.whats_new_popup_eyebrow, note.version),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.weight(1f),
                )
                ReleaseTypeBadge(note.type)
            }

            Spacer(Modifier.height(8.dp))

            Text(
                text = rememberMarkdownLite(
                    note.headline.ifBlank { stringResource(Res.string.whats_new_title) },
                ),
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.semantics { heading() },
            )

            Spacer(Modifier.height(20.dp))

            ReleaseNoteBody(note = note, showHeadline = false)

            Spacer(Modifier.height(24.dp))

            Button(
                onClick = { animateAndDismiss() },
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp),
            ) {
                Text(stringResource(Res.string.whats_new_acknowledge))
            }
        }
    }
}

/**
 * Host do pop-up "Novidades" — montado no boot do app (em `AppContent`).
 *
 * No primeiro frame dispara [WhatsNewViewModel.checkForPopup]; se houver uma
 * nota não vista com `showPopup`, renderiza [WhatsNewBottomSheet]. Em targets
 * sem fonte de notas (harness Android, wasmJs) o use case é nulo e nada aparece.
 *
 * A idempotência do disparo é garantida por `popupChecked` dentro do ViewModel —
 * seguro mesmo que este Composable recomponha.
 */
@Composable
fun WhatsNewPopupHost(
    viewModel: WhatsNewViewModel = koinViewModel(),
) {
    LaunchedEffect(Unit) {
        viewModel.checkForPopup()
    }

    val popupNote by viewModel.popupNote.collectAsStateWithLifecycle()

    popupNote?.let { note ->
        WhatsNewBottomSheet(
            note = note,
            onDismiss = viewModel::dismissPopup,
        )
    }
}
