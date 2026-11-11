package com.futebadosparcas.ui.core

actual fun requestMicrophonePermission(onResult: (granted: Boolean) -> Unit) {
    onResult(true)
}
