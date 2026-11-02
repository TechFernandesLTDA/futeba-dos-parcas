package com.futebadosparcas.data.repository

import android.content.ContentResolver
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import com.futebadosparcas.util.AppLogger
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.FirebaseFunctionsException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.io.IOException
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

/**
 * Exportação dos dados do titular no Android (#4483, LGPD art. 18, V).
 *
 * Paridade com a web (#4482): chama a callable `exportMyData` e grava o JSON
 * devolvido no documento que o usuário escolheu pelo Storage Access Framework.
 * O conteúdo do arquivo nunca é logado.
 */
interface MyDataExportRepository {
    /** Chama a callable e devolve o JSON pronto para gravar. */
    suspend fun fetch(): ExportMyDataPayload

    /** Grava [json] no documento [uri], truncando o que houver nele. */
    suspend fun write(uri: Uri, json: String)

    /** Apaga o documento [uri] criado pelo seletor se estiver vazio (best-effort, nunca lança). */
    suspend fun discard(uri: Uri)
}

/** Arquivo pronto para gravar e se a exportação veio completa. */
data class ExportMyDataPayload(
    val json: String,
    val complete: Boolean,
)

/** Falhas da callable `exportMyData` que a UI diferencia. */
sealed interface ExportMyDataError {
    /** `resource-exhausted`: limite de 3 exportações por 24 h. */
    data object RateLimited : ExportMyDataError

    /** `resource-exhausted` com `details.reason == "export-too-large"` (acima de 8 MiB). */
    data object TooLarge : ExportMyDataError

    /** Qualquer outra falha (rede, `unauthenticated`, gravação do arquivo). */
    data object Generic : ExportMyDataError
}

/** Timeout do cliente: mesmo valor da função (`EXPORT_TIMEOUT_SECONDS`) e da web. */
const val EXPORT_MY_DATA_TIMEOUT_SECONDS = 180L

private const val EXPORT_TOO_LARGE_REASON = "export-too-large"

private val exportJson = Json { prettyPrint = true }

private val fileDateFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")

/** Nome sugerido no seletor: futeba-dos-parcas-meus-dados-AAAA-MM-DD.json (data local). */
fun exportMyDataFileName(date: LocalDate): String =
    "futeba-dos-parcas-meus-dados-${date.format(fileDateFormatter)}.json"

/** Classifica o erro da callable. Olha a exceção e a causa direta. */
fun mapExportMyDataError(error: Throwable): ExportMyDataError {
    val ffe = error as? FirebaseFunctionsException
        ?: error.cause as? FirebaseFunctionsException
        ?: return ExportMyDataError.Generic
    if (ffe.code != FirebaseFunctionsException.Code.RESOURCE_EXHAUSTED) {
        return ExportMyDataError.Generic
    }
    val reason = (ffe.details as? Map<*, *>)?.get("reason")
    return if (reason == EXPORT_TOO_LARGE_REASON) {
        ExportMyDataError.TooLarge
    } else {
        ExportMyDataError.RateLimited
    }
}

/**
 * Converte o `data` da callable (Map/List/primitivos) em texto JSON.
 * Puro (kotlinx.serialization), sem `org.json`, para ser testável na JVM.
 * `complete` ausente conta como completo; só `false` explícito é parcial.
 */
fun exportPayloadFromCallableData(data: Any?): ExportMyDataPayload {
    val complete = (data as? Map<*, *>)?.get("complete") != false
    val json = exportJson.encodeToString(JsonElement.serializer(), toJsonElement(data))
    return ExportMyDataPayload(json = json, complete = complete)
}

/** Converte recursivamente um valor decodificado pelo SDK de Functions. */
fun toJsonElement(value: Any?): JsonElement = when (value) {
    null -> JsonNull
    is JsonElement -> value
    is String -> JsonPrimitive(value)
    is Boolean -> JsonPrimitive(value)
    is Number -> JsonPrimitive(value)
    is Map<*, *> -> JsonObject(
        value.entries.associate { (key, item) -> key.toString() to toJsonElement(item) }
    )
    is Iterable<*> -> JsonArray(value.map { toJsonElement(it) })
    is Array<*> -> JsonArray(value.map { toJsonElement(it) })
    else -> JsonPrimitive(value.toString())
}

class MyDataExportRepositoryImpl(
    private val functions: FirebaseFunctions,
    private val contentResolver: ContentResolver,
) : MyDataExportRepository {

    override suspend fun fetch(): ExportMyDataPayload {
        val result = functions
            .getHttpsCallable(CALLABLE_NAME)
            .apply { setTimeout(EXPORT_MY_DATA_TIMEOUT_SECONDS, TimeUnit.SECONDS) }
            .call()
            .await()
        return withContext(Dispatchers.Default) { exportPayloadFromCallableData(result.data) }
    }

    override suspend fun write(uri: Uri, json: String) {
        withContext(Dispatchers.IO) {
            // "wt": trunca se o usuário escolheu sobrescrever um arquivo existente.
            val stream = contentResolver.openOutputStream(uri, "wt")
                ?: throw IOException("Não foi possível abrir o arquivo escolhido")
            stream.use { it.write(json.toByteArray(Charsets.UTF_8)) }
        }
    }

    override suspend fun discard(uri: Uri) {
        withContext(Dispatchers.IO) {
            // Só apaga se estiver VAZIO: o seletor deixa o usuário sobrescrever um
            // arquivo existente, e uma falha da callable não pode apagar esse arquivo.
            // Tamanho desconhecido ou erro na consulta ⇒ não apaga.
            runCatching {
                if (documentSize(uri) == 0L) {
                    DocumentsContract.deleteDocument(contentResolver, uri)
                }
            }.onFailure { AppLogger.w(TAG) { "Não foi possível apagar o arquivo vazio da exportação" } }
        }
    }

    /** Tamanho do documento em bytes, ou null se o provedor não informar. */
    private fun documentSize(uri: Uri): Long? =
        contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
            val index = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (index >= 0 && cursor.moveToFirst() && !cursor.isNull(index)) cursor.getLong(index) else null
        }

    private companion object {
        const val TAG = "MyDataExportRepository"
        const val CALLABLE_NAME = "exportMyData"
    }
}
