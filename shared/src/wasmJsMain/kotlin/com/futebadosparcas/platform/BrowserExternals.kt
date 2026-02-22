package com.futebadosparcas.platform

import kotlin.js.Promise

/**
 * External declarations compartilhadas para APIs do browser em Kotlin/Wasm
 *
 * Referências:
 * - [Kotlin/Wasm JS Interop](https://kotlinlang.org/docs/wasm-js-interop.html)
 * - [Web Share API](https://w3c.github.io/web-share/)
 * - [Web Clipboard API](https://w3c.github.io/clipboard-apis/)
 * - [Media Devices API](https://w3c.github.io/mediacapture-main/)
 */

// ============================================================================
// Web Share API
// ============================================================================

external interface ShareData : JsAny {
    var title: String?
    var text: String?
    var url: String?
}

// ============================================================================
// Clipboard API
// ============================================================================

external interface Clipboard : JsAny {
    fun writeText(text: String): Promise<JsAny?>
}

// ============================================================================
// Media Devices API
// ============================================================================

external interface MediaStream : JsAny

external interface MediaDevices : JsAny {
    fun getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>
}

external interface MediaStreamConstraints : JsAny {
    var video: JsAny?  // Boolean or MediaTrackConstraints
    var audio: JsAny?  // Boolean or MediaTrackConstraints
}

// ============================================================================
// Navigator API (consolidado)
// ============================================================================

external interface WebNavigator : JsAny {
    val clipboard: Clipboard
    val mediaDevices: MediaDevices
    fun canShare(data: ShareData): Boolean
    fun share(data: ShareData): Promise<JsAny?>
    fun vibrate(pattern: JsAny): Boolean  // Vibration API
}

// Acesso global ao navigator
external val navigator: WebNavigator

// ============================================================================
// Date API
// ============================================================================

external object Date : JsAny {
    fun now(): Double
}

// ============================================================================
// Document and DOM APIs
// ============================================================================

external interface Document : JsAny {
    fun createElement(tagName: String): JsAny
}

external val document: Document

// ============================================================================
// URL API
// ============================================================================

external object URL : JsAny {
    fun createObjectURL(blob: JsAny): String
    fun revokeObjectURL(url: String): Unit
}

// ============================================================================
// Helper external functions for JS interop (sem js() inline)
// ============================================================================

external fun createShareData(text: String, url: String, title: String): ShareData

external fun hasShareSupport(): Boolean

external fun openInNewWindow(url: String)

external fun createMediaStreamConstraints(video: Boolean, audio: Boolean): MediaStreamConstraints

// ============================================================================
// Web Notifications API
// ============================================================================

external fun jsRequestNotificationPermission(): Promise<JsAny>

external fun jsShowNotification(title: String, body: String, icon: String?)

external fun jsHasNotificationSupport(): Boolean

external fun jsGetNotificationPermission(): String
