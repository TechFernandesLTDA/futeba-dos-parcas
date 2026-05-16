package com.futebadosparcas.platform

import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.suspendCancellableCoroutine
import platform.Foundation.NSItemProvider
import platform.Foundation.NSURL
import platform.Foundation.NSTemporaryDirectory
import platform.Foundation.NSUUID
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
import platform.darwin.NSObject
import kotlin.coroutines.resume

/**
 * Implementação iOS de ImagePicker.
 *
 * - Seleção de galeria: PHPickerViewController (moderno, iOS 14+, sem permissão prévia)
 * - Captura de câmera: UIImagePickerController (câmera nativa)
 *
 * Requer que [ImagePickerFactory.initialize] seja chamado com um provider de
 * UIViewController raiz antes de usar.
 *
 * PHPickerViewController requer iOS 14+. O projeto tem deployment target 15.0.
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
                        val provider: NSItemProvider = result.itemProvider
                        if (provider.canLoadObjectOfClass(UIImage)) {
                            provider.loadObjectOfClass(UIImage) { obj, _ ->
                                val image = obj as? UIImage
                                if (image != null) {
                                    val fileUrl = salvarImagemTemporaria(image)
                                    if (fileUrl != null) {
                                        pickedItems.add(
                                            ImagePickerResult(
                                                uri = PlatformUri(fileUrl),
                                                mimeType = "image/jpeg",
                                                fileName = fileUrl.lastPathComponent
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
                        val fileUrl = salvarImagemTemporaria(image)
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
     * Salva UIImage como JPEG no diretório temporário e retorna o NSURL do arquivo.
     * Retorna null se a conversão ou gravação falhar.
     */
    private fun salvarImagemTemporaria(image: UIImage): NSURL? {
        val jpegData = UIImageJPEGRepresentation(image, 0.85) ?: return null
        val fileName = "${NSUUID().UUIDString()}.jpg"
        val tmpDir = NSTemporaryDirectory()
        val filePath = "$tmpDir$fileName"
        val fileUrl = NSURL.fileURLWithPath(filePath)
        return if (jpegData.writeToURL(fileUrl, atomically = true)) fileUrl else null
    }
}

/**
 * Factory iOS para ImagePicker.
 *
 * Inicializar com um provider de UIViewController antes de usar qualquer ImagePicker:
 *
 * ```swift
 * // Em ContentView.swift (Swift side):
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
