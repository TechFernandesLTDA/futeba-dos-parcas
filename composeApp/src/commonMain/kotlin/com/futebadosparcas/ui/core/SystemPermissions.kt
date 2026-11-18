package com.futebadosparcas.ui.core

/**
 * Pede ao sistema a permissão de notificações. O resultado chega na thread principal.
 *
 * No iOS mostra o alerta do sistema (só na primeira vez; depois devolve a escolha já feita)
 * e, se autorizado, registra o app para push. Fora do iOS o `:composeApp` não é a UI viva,
 * então a chamada só confirma.
 */
expect fun requestSystemNotificationPermission(onResult: (Boolean) -> Unit)

/**
 * Pede ao sistema a permissão de localização durante o uso. O resultado chega na thread
 * principal, depois que a pessoa responde ao alerta.
 */
expect fun requestSystemLocationPermission(onResult: (Boolean) -> Unit)
