package com.futebadosparcas.data.util

import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.QuerySnapshot
import com.google.firebase.firestore.util.CustomClassMapper
import java.util.concurrent.ConcurrentHashMap

/*
 * Leitura tolerante de documentos do Firestore.
 *
 * O `toObject` do Firestore lança `RuntimeException` quando o modelo tem `@DocumentId` numa propriedade e o
 * documento também traz um campo gravado com o mesmo nome:
 *
 *   'id' was found from document groups/x/members/y, cannot apply @DocumentId on this property for class ...
 *
 * Existem documentos assim em produção (`users/{uid}/groups`, `groups/{id}/members`). Dentro de um
 * `addSnapshotListener` a exceção sobe na thread principal e fecha o app.
 *
 * REGRA: no app Android, toda leitura por reflexão usa as funções deste arquivo no lugar de
 * `toObject`/`toObjects`:
 * - [toObjectTolerant]: igual ao `toObject`, mas no conflito de `@DocumentId` refaz a conversão sem o campo
 *   gravado (o ID continua vindo do ID do documento). Outras exceções seguem como antes.
 * - [toObjectOrNullSafely]: para dentro de listeners. Qualquer falha de conversão vira `null` + não fatal.
 * - [toObjectsTolerant]: lista. Tenta o caminho normal; se falhar, converte documento a documento e deixa de
 *   fora só o que não puder ser lido.
 */

private const val TAG = "FirestoreMapping"
private const val DOCUMENT_ID_CONFLICT_MARKER = "cannot apply @DocumentId"
private val CONFLICT_FIELD_REGEX = Regex("'([^']+)' was found from document")

/** Um modelo pode ter mais de uma propriedade com `@DocumentId`; cada tentativa remove um campo. */
private const val MAX_CONFLICT_FIELDS = 4
private const val MAX_CAUSE_DEPTH = 5

/** Evita um não fatal por documento a cada snapshot: registra uma vez por modelo e coleção. */
private val reportedConflicts = ConcurrentHashMap.newKeySet<String>()

/**
 * Nome do campo gravado que conflita com o `@DocumentId`, ou `null` se a exceção for de outro tipo.
 * Olha também as causas, porque o mapper embrulha a exceção quando o modelo está aninhado.
 */
internal fun documentIdConflictField(error: Throwable): String? {
    var current: Throwable? = error
    repeat(MAX_CAUSE_DEPTH) {
        val message = current?.message
        if (message != null && DOCUMENT_ID_CONFLICT_MARKER in message) {
            return CONFLICT_FIELD_REGEX.find(message)?.groupValues?.get(1)
        }
        current = current?.cause ?: return null
    }
    return null
}

/**
 * Converte os campos para [clazz] ignorando os campos gravados que conflitam com `@DocumentId`.
 * [convert] recebe o mapa já sem o campo e devolve o objeto (em produção, o mapper do Firestore).
 * Lança a exceção original se o conflito não puder ser resolvido removendo campos de primeiro nível.
 */
internal fun <T : Any> convertIgnoringDocumentIdConflicts(
    data: Map<String, Any?>,
    firstError: RuntimeException,
    convert: (Map<String, Any?>) -> T?
): T? {
    val remaining = data.toMutableMap()
    var error = firstError
    repeat(MAX_CONFLICT_FIELDS) {
        val field = documentIdConflictField(error) ?: throw error
        if (field !in remaining) throw error
        remaining.remove(field)
        try {
            return convert(remaining)
        } catch (e: RuntimeException) {
            error = e
        }
    }
    throw error
}

/**
 * Igual a `toObject(clazz)`, mas tolera campo gravado com o mesmo nome de uma propriedade `@DocumentId`.
 * Qualquer outra exceção de conversão é relançada, como no `toObject`.
 */
fun <T : Any> DocumentSnapshot.toObjectTolerant(clazz: Class<T>): T? =
    try {
        toObject(clazz)
    } catch (e: RuntimeException) {
        if (documentIdConflictField(e) == null) throw e
        val fields = data ?: throw e
        val reference = reference
        val result = convertIgnoringDocumentIdConflicts(fields, e) { clean ->
            // API interna do SDK (pacote util), a mesma que o toObject usa por baixo. Se a assinatura mudar
            // numa atualização do Firebase, o build quebra aqui e o FirestoreSafeMappingTest também.
            CustomClassMapper.convertToCustomClass(clean, clazz, reference)
        }
        reportConflictOnce(clazz, reference.parent.id)
        result
    }

/** Versão reificada de [toObjectTolerant]. */
inline fun <reified T : Any> DocumentSnapshot.toObjectTolerant(): T? = toObjectTolerant(T::class.java)

/**
 * Para dentro de `addSnapshotListener`: nunca lança. Falha de conversão vira `null` e um não fatal no
 * Crashlytics.
 */
fun <T : Any> DocumentSnapshot.toObjectOrNullSafely(clazz: Class<T>): T? =
    try {
        toObjectTolerant(clazz)
    } catch (e: RuntimeException) {
        AppLogger.e(TAG, "Documento $id ignorado: não foi possível converter para ${clazz.simpleName}", e)
        null
    }

/** Versão reificada de [toObjectOrNullSafely]. */
inline fun <reified T : Any> DocumentSnapshot.toObjectOrNullSafely(): T? = toObjectOrNullSafely(T::class.java)

/**
 * Igual a `toObjects(clazz)`, mas nunca lança por causa de um documento: se a conversão em lote falhar,
 * converte documento a documento com [toObjectTolerant] e deixa de fora só o que não puder ser lido.
 */
fun <T : Any> QuerySnapshot.toObjectsTolerant(clazz: Class<T>): List<T> =
    try {
        toObjects(clazz)
    } catch (e: RuntimeException) {
        documents.mapDocumentsSafely(TAG) { it.toObjectTolerant(clazz) }
    }

/** Versão reificada de [toObjectsTolerant]. */
inline fun <reified T : Any> QuerySnapshot.toObjectsTolerant(): List<T> = toObjectsTolerant(T::class.java)

/**
 * Converte cada documento sem deixar a exceção do mapper escapar. O documento que falha é registrado (vai
 * para o Crashlytics como não fatal) e fica fora da lista; os outros seguem.
 */
internal inline fun <T : Any> List<DocumentSnapshot>.mapDocumentsSafely(
    tag: String,
    mapper: (DocumentSnapshot) -> T?
): List<T> = mapNotNull { doc ->
    try {
        mapper(doc)
    } catch (e: RuntimeException) {
        AppLogger.e(tag, "Documento ${doc.id} ignorado: não foi possível converter", e)
        null
    }
}

/** A exceção original não vai junto: a mensagem dela traz o caminho do documento, que pode conter UID. */
private fun reportConflictOnce(clazz: Class<*>, collectionId: String) {
    if (reportedConflicts.add("${clazz.name}@$collectionId")) {
        val message = "Campo gravado com o nome do @DocumentId em $collectionId " +
            "(${clazz.simpleName}); lido sem o campo"
        AppLogger.e(TAG, message, IllegalStateException(message))
    }
}
