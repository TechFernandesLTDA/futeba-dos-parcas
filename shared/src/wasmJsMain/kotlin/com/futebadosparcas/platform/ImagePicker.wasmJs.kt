package com.futebadosparcas.platform

import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Implementação Web de ImagePicker usando HTML file input
 */
class WebImagePicker : ImagePicker {

    override suspend fun pickImage(
        allowMultiple: Boolean,
        maxImages: Int
    ): List<ImagePickerResult> = suspendCancellableCoroutine { continuation ->
        try {
            // Criar input file dinamicamente
            val input = js("document.createElement('input')")
            js("input.type = 'file'")
            js("input.accept = 'image/*'")

            if (allowMultiple) {
                js("input.multiple = true")
            }

            // Handler para quando arquivos forem selecionados
            js("""
                input.onchange = function(e) {
                    const files = e.target.files;
                    const results = [];

                    for (let i = 0; i < Math.min(files.length, maxImages); i++) {
                        const file = files[i];
                        const url = URL.createObjectURL(file);

                        results.push({
                            uri: url,
                            mimeType: file.type,
                            fileName: file.name,
                            fileSize: file.size
                        });
                    }

                    return results;
                }
            """)

            // Abrir dialog de seleção
            js("input.click()")

            // TODO: Integrar resultado com continuation
            // Por ora, stub que retorna lista vazia
            continuation.resume(emptyList())
        } catch (e: Throwable) {
            e.printStackTrace()
            continuation.resume(emptyList())
        }
    }

    override suspend fun captureImage(): ImagePickerResult? = suspendCancellableCoroutine { continuation ->
        try {
            // Criar input file com captura de câmera
            val input = js("document.createElement('input')")
            js("input.type = 'file'")
            js("input.accept = 'image/*'")
            js("input.capture = 'environment'") // Usar câmera traseira

            // TODO: Implementar handler similar ao pickImage
            // Por ora, stub que retorna null
            continuation.resume(null)
        } catch (e: Throwable) {
            e.printStackTrace()
            continuation.resume(null)
        }
    }

    override fun isCameraAvailable(): Boolean {
        return try {
            // Verificar se getUserMedia está disponível
            js("'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices") as Boolean
        } catch (e: Throwable) {
            false
        }
    }
}

/**
 * Factory Web - sem dependências
 */
actual object ImagePickerFactory {
    actual fun create(): ImagePicker = WebImagePicker()
}
