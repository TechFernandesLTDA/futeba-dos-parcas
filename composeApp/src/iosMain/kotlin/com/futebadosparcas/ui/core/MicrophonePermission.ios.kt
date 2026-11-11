package com.futebadosparcas.ui.core

import platform.AVFoundation.AVAuthorizationStatusAuthorized
import platform.AVFoundation.AVAuthorizationStatusDenied
import platform.AVFoundation.AVAuthorizationStatusRestricted
import platform.AVFoundation.AVCaptureDevice
import platform.AVFoundation.AVMediaTypeAudio
import platform.AVFoundation.authorizationStatusForMediaType
import platform.AVFoundation.requestAccessForMediaType
import platform.darwin.dispatch_async
import platform.darwin.dispatch_get_main_queue

actual fun requestMicrophonePermission(onResult: (granted: Boolean) -> Unit) {
    when (AVCaptureDevice.authorizationStatusForMediaType(AVMediaTypeAudio)) {
        AVAuthorizationStatusAuthorized -> onResult(true)
        AVAuthorizationStatusDenied, AVAuthorizationStatusRestricted -> onResult(false)
        else -> AVCaptureDevice.requestAccessForMediaType(AVMediaTypeAudio) { granted ->
            dispatch_async(dispatch_get_main_queue()) { onResult(granted) }
        }
    }
}
