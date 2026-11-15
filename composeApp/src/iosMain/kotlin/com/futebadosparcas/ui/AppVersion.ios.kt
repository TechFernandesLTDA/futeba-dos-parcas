package com.futebadosparcas.ui

import platform.Foundation.NSBundle

actual fun appVersionName(): String =
    (NSBundle.mainBundle.objectForInfoDictionaryKey("CFBundleShortVersionString") as? String)
        .orEmpty()
