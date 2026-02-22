package com.futebadosparcas.platform

import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * External declarations for Web File API
 * (Navigator, MediaDevices, Document, URL estão em BrowserExternals.kt)
 */
external interface File : JsAny {
    val name: String
    val size: Double
    val type: String
}

external interface FileList : JsAny {
    val length: Int
    fun item(index: Int): File?
}

external interface HTMLInputElement : JsAny {
    var type: String
    var accept: String
    var multiple: Boolean
    var capture: String
    val files: FileList?
    fun click()
}

// Helper to cast createElement result to HTMLInputElement
private fun Document.createInputElement(): HTMLInputElement {
    return createElement("input") as HTMLInputElement
}

// Helper to create object URL from File
private fun createFileObjectURL(file: File): String {
    return URL.createObjectURL(file as JsAny)
}

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
            val input = document.createInputElement()
            input.type = "file"
            input.accept = "image/*"
            input.multiple = allowMultiple

            // TODO: Implementar handler de onchange com callback
            // Por ora, retorna lista vazia como stub
            // Nota: A integração completa requer biblioteca adicional
            // como kotlinx-browser ou wrapper customizado para eventos DOM

            input.click()

            // Stub: retorna lista vazia
            continuation.resume(emptyList())
        } catch (e: Throwable) {
            e.printStackTrace()
            continuation.resume(emptyList())
        }
    }

    override suspend fun captureImage(): ImagePickerResult? = suspendCancellableCoroutine { continuation ->
        try {
            // Criar input file com captura de câmera
            val input = document.createInputElement()
            input.type = "file"
            input.accept = "image/*"
            input.capture = "environment" // Usar câmera traseira

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
            // Verificar se getUserMedia está disponível (usar navigator de BrowserExternals.kt)
            val devices = navigator.mediaDevices
            // Se devices não for null, câmera pode estar disponível
            true  // Simplificado: assume que se a API existe, câmera pode existir
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
