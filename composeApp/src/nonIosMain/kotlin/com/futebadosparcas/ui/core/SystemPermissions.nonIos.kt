package com.futebadosparcas.ui.core

// O Android usa o onboarding do módulo :app; aqui só mantém o comportamento anterior.
actual fun requestSystemNotificationPermission(onResult: (Boolean) -> Unit) = onResult(true)

actual fun requestSystemLocationPermission(onResult: (Boolean) -> Unit) = onResult(true)
