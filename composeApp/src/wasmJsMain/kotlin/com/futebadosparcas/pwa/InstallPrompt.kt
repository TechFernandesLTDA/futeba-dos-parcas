package com.futebadosparcas.pwa

import kotlin.js.Promise

external fun pwaCanInstall(): Boolean

external fun pwaIsInstalled(): Boolean

external fun pwaPromptInstall(): Promise<JsAny>

object InstallOutcome {
    const val ACCEPTED = "accepted"
    const val DISMISSED = "dismissed"
    const val NOT_INSTALLABLE = "not-installable"
    const val ERROR = "error"
}
