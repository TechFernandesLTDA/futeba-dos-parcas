package com.futebadosparcas.ui.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.platform.firebase.CallableException
import com.futebadosparcas.platform.firebase.ExportMyDataPayload
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

/**
 * Estados da exportação dos dados pessoais (#4483, LGPD art. 18, V).
 */
sealed interface ExportMyDataUiState {
    data object Idle : ExportMyDataUiState
    data object Loading : ExportMyDataUiState
    data class Success(val partial: Boolean) : ExportMyDataUiState
    data class Error(val reason: ExportMyDataError) : ExportMyDataUiState
}

enum class ExportMyDataError {
    /** `resource-exhausted` sem motivo: limite de 3 exportações por 24 h. */
    RATE_LIMITED,

    /** `resource-exhausted` com `details.reason == "export-too-large"` (acima de 8 MiB). */
    TOO_LARGE,

    /** Rede, timeout, gravação/compartilhamento do arquivo ou erro inesperado. */
    GENERIC
}

/**
 * Nome sugerido do arquivo de exportação: `futeba-dos-parcas-meus-dados-AAAA-MM-DD.json`
 * (paridade total com Web e Android, #4482/#4483).
 */
fun exportMyDataFileName(date: LocalDate): String {
    val month = date.monthNumber.toString().padStart(2, '0')
    val day = date.dayOfMonth.toString().padStart(2, '0')
    return "futeba-dos-parcas-meus-dados-${date.year}-$month-$day.json"
}

/**
 * ViewModel compartilhado (composeApp / iOS) para "Baixar meus dados" (#4483, LGPD art. 18, V).
 *
 * Chama a callable `exportMyData` (timeout 180 s) e entrega o arquivo JSON para a folha de
 * compartilhamento / seletor de arquivos da plataforma ([shareJsonFile]).
 */
class ExportMyDataViewModel(
    private val exportMyData: suspend () -> Result<ExportMyDataPayload>,
    private val shareJsonFile: suspend (fileName: String, json: String) -> Boolean,
    private val today: () -> LocalDate = {
        Clock.System.now().toLocalDateTime(TimeZone.currentSystemDefault()).date
    }
) : ViewModel() {

    private val _uiState = MutableStateFlow<ExportMyDataUiState>(ExportMyDataUiState.Idle)
    val uiState: StateFlow<ExportMyDataUiState> = _uiState.asStateFlow()

    private var exportJob: Job? = null

    fun suggestedFileName(): String = exportMyDataFileName(today())

    fun startExport() {
        if (_uiState.value == ExportMyDataUiState.Loading) return
        exportJob?.cancel()
        exportJob = viewModelScope.launch {
            _uiState.value = ExportMyDataUiState.Loading
            val result = try {
                exportMyData()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }
            result.fold(
                onSuccess = { payload ->
                    val shared = try {
                        shareJsonFile(suggestedFileName(), payload.json)
                    } catch (e: CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        false
                    }
                    _uiState.value = if (shared) {
                        ExportMyDataUiState.Success(partial = !payload.complete)
                    } else {
                        ExportMyDataUiState.Error(ExportMyDataError.GENERIC)
                    }
                },
                onFailure = { error ->
                    _uiState.value = classify(error)
                }
            )
        }
    }

    fun dismissResult() {
        if (_uiState.value != ExportMyDataUiState.Loading) {
            _uiState.value = ExportMyDataUiState.Idle
        }
    }

    override fun onCleared() {
        super.onCleared()
        exportJob?.cancel()
    }

    internal companion object {
        fun classify(error: Throwable): ExportMyDataUiState.Error {
            val callable = error as? CallableException
                ?: error.cause as? CallableException
                ?: return ExportMyDataUiState.Error(ExportMyDataError.GENERIC)
            if (callable.code != CallableException.RESOURCE_EXHAUSTED) {
                return ExportMyDataUiState.Error(ExportMyDataError.GENERIC)
            }
            return if (callable.reason == CallableException.REASON_EXPORT_TOO_LARGE) {
                ExportMyDataUiState.Error(ExportMyDataError.TOO_LARGE)
            } else {
                ExportMyDataUiState.Error(ExportMyDataError.RATE_LIMITED)
            }
        }
    }
}
