package com.futebadosparcas.platform

import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.suspendCancellableCoroutine
import platform.Foundation.NSData
import platform.Foundation.NSURL
import platform.Foundation.NSTemporaryDirectory
import platform.Foundation.NSUUID
import platform.Foundation.NSFileManager
import platform.PhotosUI.PHPickerConfiguration
import platform.PhotosUI.PHPickerFilter
import platform.PhotosUI.PHPickerResult
import platform.PhotosUI.PHPickerViewController
import platform.PhotosUI.PHPickerViewControllerDelegateProtocol
import platform.UIKit.UIImagePickerController
import platform.UIKit.UIImagePickerControllerDelegateProtocol
import platform.UIKit.UIImagePickerControllerEditedImage
import platform.UIKit.UIImagePickerControllerOriginalImage
import platform.UIKit.UIImagePickerControllerSourceType
import platform.UIKit.UINavigationControllerDelegateProtocol
import platform.UIKit.UIViewController
import platform.UIKit.UIImage
import platform.UIKit.UIImageJPEGRepresentation
import platform.UniformTypeIdentifiers.UTTypeImage
import platform.darwin.NSObject
import kotlin.coroutines.resume

/**
 * Implementação iOS de ImagePicker.
 *
 * - Seleção de galeria: PHPickerViewController (moderno, iOS 14+, sem permissão prévia)
 *   Usa `loadFileRepresentationForTypeIdentifier` para compatibilidade com Kotlin/Native.
 * - Captura de câmera: UIImagePickerController (câmera nativa)
 *
 * Requer que [ImagePickerFactory.initialize] seja chamado com um provider de
 * UIViewController raiz antes de usar.
 *
 * Deployment target 15.0 ≥ PHPickerViewController mínimo (14.0). OK.
 */
@OptIn(ExperimentalForeignApi::class)
class IOSImagePicker(private val viewControllerProvider: () -> UIViewController) : ImagePicker {

    @Throws(Exception::class)
    override suspend fun pickImage(
        allowMultiple: Boolean,
        maxImages: Int
    ): List<ImagePickerResult> = suspendCancellableCoroutine { continuation ->
        val viewController = viewControllerProvider()

        // PHPickerConfiguration — não requer permissão de Photos (iOS 14+)
        val config = PHPickerConfiguration()
        config.filter = PHPickerFilter.imagesFilter()
        config.selectionLimit = if (allowMultiple) maxImages.toLong() else 1L

        val picker = PHPickerViewController(configuration = config)

        val delegate = object : NSObject(), PHPickerViewControllerDelegateProtocol {
            override fun picker(
                picker: PHPickerViewController,
                didFinishPicking: List<*>
            ) {
                picker.dismissViewControllerAnimated(true) {
                    @Suppress("UNCHECKED_CAST")
                    val results = didFinishPicking as List<PHPickerResult>
                    if (results.isEmpty()) {
                        continuation.resume(emptyList())
                        return@dismissViewControllerAnimated
                    }

                    val pickedItems = mutableListOf<ImagePickerResult>()
                    var pendingCount = results.size

                    results.forEach { result ->
                        val provider = result.itemProvider
                        // Usar loadFileRepresentationForTypeIdentifier para evitar problemas
                        // de tipagem com canLoadObjectOfClass/loadObjectOfClass em Kotlin/Native.
                        // UTTypeImage.identifier = "public.image"
                        val typeIdentifier = UTTypeImage.identifier
                        if (provider.hasItemConformingToTypeIdentifier(typeIdentifier)) {
                            provider.loadFileRepresentationForTypeIdentifier(typeIdentifier) { url, error ->
                                if (url != null && error == null) {
                                    // Copiar para tmpDir (URL original pode ser temporária e ser removida)
                                    val tmpUrl = copiarParaTmp(url)
                                    if (tmpUrl != null) {
                                        pickedItems.add(
                                            ImagePickerResult(
                                                uri = PlatformUri(tmpUrl),
                                                mimeType = "image/jpeg",
                                                fileName = tmpUrl.lastPathComponent
                                            )
                                        )
                                    }
                                }
                                pendingCount--
                                if (pendingCount == 0) continuation.resume(pickedItems.toList())
                            }
                        } else {
                            pendingCount--
                            if (pendingCount == 0) continuation.resume(pickedItems.toList())
                        }
                    }
                }
            }
        }

        // Manter referência ao delegate para evitar coleta prematura pelo GC do Kotlin/Native
        picker.delegate = delegate
        viewController.presentViewController(picker, animated = true) {}

        continuation.invokeOnCancellation {
            picker.dismissViewControllerAnimated(false) {}
        }
    }

    @Throws(Exception::class)
    override suspend fun captureImage(): ImagePickerResult? = suspendCancellableCoroutine { continuation ->
        val viewController = viewControllerProvider()

        if (!UIImagePickerController.isSourceTypeAvailable(
                UIImagePickerControllerSourceType.UIImagePickerControllerSourceTypeCamera
            )
        ) {
            continuation.resume(null)
            return@suspendCancellableCoroutine
        }

        val picker = UIImagePickerController()
        picker.sourceType = UIImagePickerControllerSourceType.UIImagePickerControllerSourceTypeCamera

        val delegate = object : NSObject(),
            UIImagePickerControllerDelegateProtocol,
            UINavigationControllerDelegateProtocol {

            override fun imagePickerController(
                picker: UIImagePickerController,
                didFinishPickingMediaWithInfo: Map<Any?, *>
            ) {
                picker.dismissViewControllerAnimated(true) {
                    val image = (didFinishPickingMediaWithInfo[UIImagePickerControllerEditedImage]
                        ?: didFinishPickingMediaWithInfo[UIImagePickerControllerOriginalImage]) as? UIImage
                    if (image != null) {
                        val fileUrl = salvarImagemCapturada(image)
                        continuation.resume(
                            fileUrl?.let {
                                ImagePickerResult(
                                    uri = PlatformUri(it),
                                    mimeType = "image/jpeg",
                                    fileName = it.lastPathComponent
                                )
                            }
                        )
                    } else {
                        continuation.resume(null)
                    }
                }
            }

            override fun imagePickerControllerDidCancel(picker: UIImagePickerController) {
                picker.dismissViewControllerAnimated(true) {
                    continuation.resume(null)
                }
            }
        }

        picker.delegate = delegate
        viewController.presentViewController(picker, animated = true) {}

        continuation.invokeOnCancellation {
            picker.dismissViewControllerAnimated(false) {}
        }
    }

    override fun isCameraAvailable(): Boolean =
        UIImagePickerController.isSourceTypeAvailable(
            UIImagePickerControllerSourceType.UIImagePickerControllerSourceTypeCamera
        )

    /**
     * Copia arquivo de imagem para NSTemporaryDirectory com nome único.
     * Necessário pois a URL fornecida pelo PHPicker pode ser removida após o callback.
     */
    private fun copiarParaTmp(sourceUrl: NSURL): NSURL? {
        val fileName = "${NSUUID().UUIDString()}.jpg"
        val tmpPath = "${NSTemporaryDirectory()}$fileName"
        val destUrl = NSURL.fileURLWithPath(tmpPath)
        return try {
            val fileManager = NSFileManager.defaultManager()
            // Remover destino caso já exista
            if (fileManager.fileExistsAtPath(tmpPath)) {
                fileManager.removeItemAtURL(destUrl, null)
            }
            if (fileManager.copyItemAtURL(sourceUrl, toURL = destUrl, error = null)) {
                destUrl
            } else null
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Salva UIImage capturada pela câmera como JPEG em NSTemporaryDirectory.
     * Usa NSFileManager.createFileAtPath para evitar ambiguidade de binding NSData.writeToURL.
     */
    private fun salvarImagemCapturada(image: UIImage): NSURL? {
        val jpegData: NSData = UIImageJPEGRepresentation(image, 0.85) ?: return null
        val fileName = "${NSUUID().UUIDString()}.jpg"
        val tmpPath = "${NSTemporaryDirectory()}$fileName"
        val fileUrl = NSURL.fileURLWithPath(tmpPath)
        val criado = NSFileManager.defaultManager()
            .createFileAtPath(tmpPath, contents = jpegData, attributes = null)
        return if (criado) fileUrl else null
    }
}

/**
 * Factory iOS para ImagePicker.
 *
 * Inicializar com um provider de UIViewController antes de usar qualquer ImagePicker:
 *
 * ```swift
 * // Em ContentView.swift ou AppDelegate (Swift side):
 * ImagePickerFactory.shared.doInitialize {
 *     UIApplication.shared.connectedScenes
 *         .compactMap { $0 as? UIWindowScene }
 *         .first?.windows.first?.rootViewController ?? UIViewController()
 * }
 * ```
 */
actual object ImagePickerFactory {
    private var viewControllerProvider: (() -> UIViewController)? = null

    /**
     * Inicializa o factory com um provider de UIViewController raiz.
     * Deve ser chamado antes de qualquer uso de create() no iOS.
     */
    fun initialize(provider: () -> UIViewController) {
        viewControllerProvider = provider
    }

    actual fun create(): ImagePicker {
        val provider = viewControllerProvider
            ?: throw IllegalStateException(
                "ImagePickerFactory não inicializado. " +
                    "Chame ImagePickerFactory.initialize { rootViewController } antes de usar."
            )
        return IOSImagePicker(provider)
    }
}
