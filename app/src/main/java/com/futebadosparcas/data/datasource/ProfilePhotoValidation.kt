package com.futebadosparcas.data.datasource

/**
 * Limites compartilhados pelo seletor e pelo pipeline de foto de perfil.
 *
 * O arquivo escolhido pode ser maior que o objeto enviado ao Storage porque a
 * imagem é redimensionada e comprimida antes do upload. O limite de 2 MiB é
 * aplicado ao payload final, em sintonia com `storage.rules`.
 */
internal object ProfilePhotoValidation {
    const val MAX_SOURCE_FILE_SIZE_BYTES: Long = 10L * 1024L * 1024L
    const val MAX_UPLOAD_SIZE_BYTES: Int = 2 * 1024 * 1024

    fun isSourceSizeAllowed(sizeInBytes: Long): Boolean =
        sizeInBytes <= 0L || sizeInBytes <= MAX_SOURCE_FILE_SIZE_BYTES

    fun isUploadSizeAllowed(sizeInBytes: Int): Boolean =
        sizeInBytes in 1 until MAX_UPLOAD_SIZE_BYTES
}
