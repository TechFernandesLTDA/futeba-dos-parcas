package com.futebadosparcas.platform

import kotlinx.cinterop.ExperimentalForeignApi
import platform.UIKit.UIImagePickerController
import platform.UIKit.UIImagePickerControllerSourceType

/**
 * Implementação iOS de ImagePicker usando UIImagePickerController
 *
 * NOTA: Implementação básica/stub - requer integração com UIViewController
 */
@OptIn(ExperimentalForeignApi::class)
class IOSImagePicker : ImagePicker {

    override suspend fun pickImage(
        allowMultiple: Boolean,
        maxImages: Int
    ): List<ImagePickerResult> {
        // TODO: Implementar UIImagePickerController ou PHPickerViewController
        // Por ora, retornar lista vazia (stub)
        return emptyList()
    }

    override suspend fun captureImage(): ImagePickerResult? {
        // TODO: Implementar captura com UIImagePickerController
        // Por ora, retornar null (stub)
        return null
    }

    override fun isCameraAvailable(): Boolean {
        return UIImagePickerController.isSourceTypeAvailable(
            UIImagePickerControllerSourceType.UIImagePickerControllerSourceTypeCamera
        )
    }
}

/**
 * Factory iOS - sem dependências
 */
actual object ImagePickerFactory {
    actual fun create(): ImagePicker = IOSImagePicker()
}
