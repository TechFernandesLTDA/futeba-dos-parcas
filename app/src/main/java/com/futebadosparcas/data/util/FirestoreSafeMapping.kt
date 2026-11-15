package com.futebadosparcas.data.util

import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.DocumentSnapshot

/**
 * Converte cada documento sem deixar a exceção do mapper escapar.
 *
 * O `toObject` do Firestore lança `RuntimeException` quando o documento não cabe no modelo. O caso que
 * derrubou o app: o modelo tem `@DocumentId` em `id` e o documento também traz um campo `id` gravado
 * ("'id' was found from document ..., cannot apply @DocumentId"). Dentro de um `addSnapshotListener` essa
 * exceção sobe na thread principal e fecha o app.
 *
 * Aqui o documento que falha é registrado (vai para o Crashlytics como não fatal) e fica fora da lista;
 * os outros seguem. O log leva só o ID do documento, nunca o caminho, que pode conter o UID.
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
