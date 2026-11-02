package com.futebadosparcas.ui.about

import android.net.Uri
import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.R
import com.futebadosparcas.data.repository.ExportMyDataError
import com.futebadosparcas.data.repository.MyDataExportRepository
import com.futebadosparcas.data.repository.exportMyDataFileName
import com.futebadosparcas.data.repository.mapExportMyDataError
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate

/** Estado do "Baixar meus dados" (#4483). */
sealed interface ExportMyDataUiState {
    data object Idle : ExportMyDataUiState
    data object Loading : ExportMyDataUiState

    /** Arquivo salvo; [partial] = o backend devolveu `complete: false`. */
    data class Success(val partial: Boolean) : ExportMyDataUiState

    data class Error(@StringRes val messageRes: Int) : ExportMyDataUiState
}

/**
 * Exportação dos dados do titular (#4483, LGPD art. 18, V).
 *
 * Ordem: a tela abre o seletor de arquivo PRIMEIRO e só com o URI escolhido
 * este ViewModel chama a callable (limite de 3 por 24 h; cancelar o seletor
 * não pode gastar cota). Como o seletor cria o documento vazio, qualquer
 * falha ou cancelamento depois disso apaga o documento se ele estiver vazio
 * (um arquivo existente que o usuário escolheu sobrescrever nunca é apagado).
 */
class ExportMyDataViewModel(
    private val repository: MyDataExportRepository,
    private val today: () -> LocalDate = { LocalDate.now() },
) : ViewModel() {

    private val _uiState = MutableStateFlow<ExportMyDataUiState>(ExportMyDataUiState.Idle)
    val uiState: StateFlow<ExportMyDataUiState> = _uiState.asStateFlow()

    private var exportJob: Job? = null

    /** Nome sugerido no seletor de arquivo. */
    fun suggestedFileName(): String = exportMyDataFileName(today())

    /**
     * Resultado do seletor. URI nulo = usuário cancelou: nada acontece.
     * Ignora um segundo disparo enquanto uma exportação está em andamento.
     */
    fun onFileChosen(uri: Uri?) {
        if (uri == null) return
        if (_uiState.value is ExportMyDataUiState.Loading) return
        exportJob?.cancel()
        exportJob = viewModelScope.launch { performExport(uri) }
    }

    @Suppress("TooGenericExceptionCaught")
    private suspend fun performExport(uri: Uri) {
        _uiState.value = ExportMyDataUiState.Loading
        var saved = false
        try {
            val payload = repository.fetch()
            repository.write(uri, payload.json)
            saved = true
            _uiState.value = ExportMyDataUiState.Success(partial = !payload.complete)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            val error = mapExportMyDataError(e)
            // Só o tipo do erro: o conteúdo do arquivo nunca vai para o log.
            AppLogger.e(TAG, "Falha ao exportar dados: ${error::class.simpleName}", e)
            _uiState.value = ExportMyDataUiState.Error(messageResFor(error))
        } finally {
            if (!saved) {
                withContext(NonCancellable) { repository.discard(uri) }
            }
        }
    }

    /** Aparelho sem app de documentos para o seletor: a callable não é chamada. */
    fun onPickerUnavailable() {
        if (_uiState.value is ExportMyDataUiState.Loading) return
        AppLogger.w(TAG) { "Seletor de documentos indisponível" }
        _uiState.value = ExportMyDataUiState.Error(R.string.about_export_my_data_error)
    }

    /** Fecha o diálogo de resultado. */
    fun dismissResult() {
        if (_uiState.value is ExportMyDataUiState.Loading) return
        _uiState.value = ExportMyDataUiState.Idle
    }

    override fun onCleared() {
        super.onCleared()
        exportJob?.cancel()
    }

    private companion object {
        const val TAG = "ExportMyDataViewModel"

        @StringRes
        fun messageResFor(error: ExportMyDataError): Int = when (error) {
            ExportMyDataError.RateLimited -> R.string.about_export_my_data_rate_limited
            ExportMyDataError.TooLarge -> R.string.about_export_my_data_too_large
            ExportMyDataError.Generic -> R.string.about_export_my_data_error
        }
    }
}
