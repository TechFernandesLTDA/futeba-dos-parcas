package com.futebadosparcas.ui.core

/**
 * Pede ao sistema a permissão de microfone. No iOS abre o diálogo real do sistema (texto de
 * `NSMicrophoneUsageDescription`); [onResult] chega na thread principal com o que o usuário decidiu.
 * No Android o app real pede a permissão pelo próprio módulo; aqui só marca como concedida.
 */
expect fun requestMicrophonePermission(onResult: (granted: Boolean) -> Unit)
