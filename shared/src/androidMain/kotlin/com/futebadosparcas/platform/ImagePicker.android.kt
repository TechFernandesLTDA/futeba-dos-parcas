package com.futebadosparcas.platform

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.MediaStore
import androidx.core.content.FileProvider
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
import kotlin.coroutines.resume

/**
 * Implementação Android de ImagePicker usando Activity Result API
 *
 * IMPORTANTE: Esta classe requer integração com uma Activity/Fragment.
 * Use ImagePickerActivity ou implemente callbacks em sua Activity.
 */
class AndroidImagePicker(private val context: Context) : ImagePicker {

    private var currentContinuation: ((List<ImagePickerResult>) -> Unit)? = null
    private var captureImageUri: Uri? = null

    override suspend fun pickImage(
        allowMultiple: Boolean,
        maxImages: Int
    ): List<ImagePickerResult> = suspendCancellableCoroutine { continuation ->
        currentContinuation = { results ->
            continuation.resume(results)
        }

        val intent = Intent(Intent.ACTION_PICK).apply {
            type = "image/*"
            if (allowMultiple) {
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            }
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        // TODO: Integrar com Activity Result API
        // Por ora, stub que retorna lista vazia
        currentContinuation?.invoke(emptyList())
    }

    override suspend fun captureImage(): ImagePickerResult? = suspendCancellableCoroutine { continuation ->
        try {
            // Criar arquivo temporário para a foto
            val photoFile = File.createTempFile(
                "IMG_${System.currentTimeMillis()}",
                ".jpg",
                context.cacheDir
            )

            val photoUri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                photoFile
            )

            captureImageUri = photoUri

            val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            }

            // TODO: Integrar com Activity Result API
            // Por ora, stub que retorna null
            continuation.resume(null)
        } catch (e: Exception) {
            e.printStackTrace()
            continuation.resume(null)
        }
    }

    override fun isCameraAvailable(): Boolean {
        return context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)
    }

    /**
     * Callback para ser chamado quando o resultado do picker estiver disponível
     */
    fun onImagePickerResult(uris: List<Uri>) {
        val results = uris.mapNotNull { uri ->
            try {
                ImagePickerResult(
                    uri = PlatformUri(uri),
                    mimeType = context.contentResolver.getType(uri),
                    fileName = uri.lastPathSegment,
                    fileSize = null // Pode ser calculado se necessário
                )
            } catch (e: Exception) {
                null
            }
        }
        currentContinuation?.invoke(results)
        currentContinuation = null
    }
}

/**
 * Factory Android - requer Context
 */
actual object ImagePickerFactory {
    private var contextProvider: (() -> Context)? = null

    fun initialize(provider: () -> Context) {
        contextProvider = provider
    }

    actual fun create(): ImagePicker {
        val context = contextProvider?.invoke()
            ?: throw IllegalStateException("ImagePickerFactory não foi inicializado")
        return AndroidImagePicker(context)
    }
}
