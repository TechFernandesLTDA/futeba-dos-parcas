package com.futebadosparcas.ui.core

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.cancel
import com.futebadosparcas.compose.resources.close
import com.futebadosparcas.compose.resources.report_already_body
import com.futebadosparcas.compose.resources.report_block_action
import com.futebadosparcas.compose.resources.report_block_done
import com.futebadosparcas.compose.resources.report_block_failed
import com.futebadosparcas.compose.resources.report_block_offer
import com.futebadosparcas.compose.resources.report_block_skip
import com.futebadosparcas.compose.resources.report_details_label
import com.futebadosparcas.compose.resources.report_failed_body
import com.futebadosparcas.compose.resources.report_group_title
import com.futebadosparcas.compose.resources.report_player_title
import com.futebadosparcas.compose.resources.report_prompt
import com.futebadosparcas.compose.resources.report_reason_abusive_language
import com.futebadosparcas.compose.resources.report_reason_fake_profile
import com.futebadosparcas.compose.resources.report_reason_harassment
import com.futebadosparcas.compose.resources.report_reason_inappropriate_content
import com.futebadosparcas.compose.resources.report_reason_other
import com.futebadosparcas.compose.resources.report_reason_spam
import com.futebadosparcas.compose.resources.report_sending
import com.futebadosparcas.compose.resources.report_sent_body
import com.futebadosparcas.compose.resources.report_sent_title
import com.futebadosparcas.compose.resources.report_submit
import kotlinx.coroutines.launch
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.stringResource

/** O que está sendo denunciado. O código vai para `abuse_reports.target_type`. */
enum class ReportTargetType(val code: String) {
    PLAYER("player"),
    GROUP("group"),
}

/** Motivos aceitos pelas regras do Firestore (`abuse_reports.reason`). */
enum class ReportReason(val code: String, val label: StringResource) {
    INAPPROPRIATE_CONTENT("inappropriate_content", Res.string.report_reason_inappropriate_content),
    ABUSIVE_LANGUAGE("abusive_language", Res.string.report_reason_abusive_language),
    SPAM("spam", Res.string.report_reason_spam),
    HARASSMENT("harassment", Res.string.report_reason_harassment),
    FAKE_PROFILE("fake_profile", Res.string.report_reason_fake_profile),
    OTHER("other", Res.string.report_reason_other),
}

private enum class ReportStep { CHOOSING, SENDING, SENT, FAILED }

/** Tamanho máximo do texto opcional (o mesmo limite de `abuse_reports.details` nas regras). */
const val REPORT_DETAILS_MAX_LENGTH = 500

private enum class BlockStep { OFFER, BLOCKING, DONE, FAILED }

/** Resultado do envio. [ALREADY_REPORTED] mostra a confirmação neutra, sem tratar como erro. */
enum class ReportOutcome { SENT, ALREADY_REPORTED, FAILED }

/**
 * Lembra no aparelho (preferências) quais alvos a pessoa já denunciou, para a denúncia repetida
 * não chamar o Firestore (as regras só deixam criar uma vez) nem aparecer como erro.
 */
class ReportLog(
    private val getFlag: (String) -> Boolean,
    private val putFlag: (String, Boolean) -> Unit,
) {
    internal fun key(reporterId: String, targetType: String, targetId: String) =
        "report_sent_${reporterId}_${targetType}_$targetId"

    /** Já denunciou? Senão chama [send] e, se gravou, guarda o ID para a próxima vez. */
    suspend fun submitOnce(
        reporterId: String,
        targetType: String,
        targetId: String,
        send: suspend () -> Boolean,
    ): ReportOutcome {
        val key = key(reporterId, targetType, targetId)
        if (getFlag(key)) return ReportOutcome.ALREADY_REPORTED
        if (!send()) return ReportOutcome.FAILED
        putFlag(key, true)
        return ReportOutcome.SENT
    }
}

/**
 * Fluxo mínimo de denúncia (diretriz 1.2): escolhe o motivo, envia e mostra a confirmação.
 *
 * [onSubmit] grava a denúncia (código do motivo e texto opcional) e devolve o resultado; a
 * gravação em si fica com quem chama (`FirebaseDataSource.submitContentReport`), para a tela não
 * depender do Firebase. Se [onBlock] vier preenchido (denúncia de jogador), depois do envio a tela
 * oferece bloquear a pessoa e devolve se deu certo.
 */
@Composable
fun ReportDialog(
    targetType: ReportTargetType,
    targetName: String,
    onDismiss: () -> Unit,
    onSubmit: suspend (reasonCode: String, details: String) -> ReportOutcome,
    onBlock: (suspend () -> Boolean)? = null,
) {
    var selected by remember { mutableStateOf<ReportReason?>(null) }
    var step by remember { mutableStateOf(ReportStep.CHOOSING) }
    var details by remember { mutableStateOf("") }
    var alreadyReported by remember { mutableStateOf(false) }
    var blockStep by remember { mutableStateOf(BlockStep.OFFER) }
    val scope = rememberCoroutineScope()

    val title = stringResource(
        if (targetType == ReportTargetType.GROUP) Res.string.report_group_title
        else Res.string.report_player_title
    )

    if (step == ReportStep.SENT) {
        val block = onBlock
        val offerBlock = block != null
        val shownName = targetName.ifBlank { title }
        AlertDialog(
            onDismissRequest = { if (blockStep != BlockStep.BLOCKING) onDismiss() },
            title = { Text(stringResource(Res.string.report_sent_title)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        stringResource(
                            if (alreadyReported) Res.string.report_already_body
                            else Res.string.report_sent_body
                        )
                    )
                    if (offerBlock) {
                        Text(
                            text = when (blockStep) {
                                BlockStep.DONE -> stringResource(Res.string.report_block_done, shownName)
                                BlockStep.FAILED -> stringResource(Res.string.report_block_failed)
                                else -> stringResource(Res.string.report_block_offer, shownName)
                            },
                            style = MaterialTheme.typography.bodyMedium,
                            color = if (blockStep == BlockStep.FAILED) MaterialTheme.colorScheme.error
                            else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            },
            confirmButton = {
                if (offerBlock && blockStep != BlockStep.DONE) {
                    Button(
                        enabled = blockStep != BlockStep.BLOCKING,
                        onClick = {
                            blockStep = BlockStep.BLOCKING
                            scope.launch {
                                blockStep = if (block()) BlockStep.DONE else BlockStep.FAILED
                            }
                        },
                    ) { Text(stringResource(Res.string.report_block_action, shownName)) }
                } else {
                    TextButton(onClick = onDismiss) { Text(stringResource(Res.string.close)) }
                }
            },
            dismissButton = {
                if (offerBlock && blockStep != BlockStep.DONE) {
                    TextButton(
                        enabled = blockStep != BlockStep.BLOCKING,
                        onClick = onDismiss,
                    ) { Text(stringResource(Res.string.report_block_skip)) }
                }
            },
        )
        return
    }

    AlertDialog(
        onDismissRequest = { if (step != ReportStep.SENDING) onDismiss() },
        title = { Text(title) },
        text = {
            Column(
                modifier = Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (targetName.isNotBlank()) {
                    Text(
                        text = targetName,
                        style = MaterialTheme.typography.titleMedium,
                    )
                }
                Text(
                    text = stringResource(Res.string.report_prompt),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.padding(top = 4.dp))
                ReportReason.entries.forEach { reason ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .selectable(
                                selected = selected == reason,
                                enabled = step != ReportStep.SENDING,
                                role = Role.RadioButton,
                                onClick = { selected = reason },
                            )
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = selected == reason, onClick = null)
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = stringResource(reason.label),
                            style = MaterialTheme.typography.bodyLarge,
                        )
                    }
                }
                OutlinedTextField(
                    value = details,
                    onValueChange = { details = it.take(REPORT_DETAILS_MAX_LENGTH) },
                    enabled = step != ReportStep.SENDING,
                    label = { Text(stringResource(Res.string.report_details_label)) },
                    minLines = 2,
                    maxLines = 4,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (step == ReportStep.FAILED) {
                    Text(
                        text = stringResource(Res.string.report_failed_body),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }
        },
        confirmButton = {
            Button(
                enabled = selected != null && step != ReportStep.SENDING,
                onClick = {
                    val reason = selected ?: return@Button
                    step = ReportStep.SENDING
                    scope.launch {
                        val outcome = onSubmit(reason.code, details.trim())
                        alreadyReported = outcome == ReportOutcome.ALREADY_REPORTED
                        step = if (outcome == ReportOutcome.FAILED) ReportStep.FAILED else ReportStep.SENT
                    }
                },
            ) {
                Text(
                    stringResource(
                        if (step == ReportStep.SENDING) Res.string.report_sending
                        else Res.string.report_submit
                    )
                )
            }
        },
        dismissButton = {
            TextButton(
                enabled = step != ReportStep.SENDING,
                onClick = onDismiss,
            ) { Text(stringResource(Res.string.cancel)) }
        },
    )
}
