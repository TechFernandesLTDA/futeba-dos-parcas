package com.futebadosparcas.platform

/**
 * Resultado da seleção de imagem
 */
data class ImagePickerResult(
    val uri: PlatformUri,
    val mimeType: String? = null,
    val fileName: String? = null,
    val fileSize: Long? = null
)

/**
 * Abstração multiplataforma para seleção de imagens
 * - Android: Activity Result API com Intent.ACTION_PICK
 * - iOS: UIImagePickerController / PHPickerViewController
 * - Web: HTML file input
 */
interface ImagePicker {
    /**
     * Abre o seletor de imagens nativo
     *
     * @param allowMultiple Permitir seleção múltipla (padrão: false)
     * @param maxImages Número máximo de imagens (apenas se allowMultiple = true)
     * @return Lista de imagens selecionadas (ou lista vazia se cancelado)
     *
     * @Throws adicionado para que o Swift consumer receba NSError em vez de NSException
     * ao chamar esta função suspend via Kotlin/Native (issue #882).
     */
    @Throws(Exception::class)
    suspend fun pickImage(
        allowMultiple: Boolean = false,
        maxImages: Int = 1
    ): List<ImagePickerResult>

    /**
     * Captura uma foto usando a câmera
     *
     * @return URI da foto capturada (ou null se cancelado)
     *
     * @Throws adicionado para que o Swift consumer receba NSError em vez de NSException
     * ao chamar esta função suspend via Kotlin/Native (issue #882).
     */
    @Throws(Exception::class)
    suspend fun captureImage(): ImagePickerResult?

    /**
     * Verifica se a câmera está disponível na plataforma
     */
    fun isCameraAvailable(): Boolean
}

/**
 * Factory para criar instância de ImagePicker específica da plataforma
 */
expect object ImagePickerFactory {
    fun create(): ImagePicker
}
