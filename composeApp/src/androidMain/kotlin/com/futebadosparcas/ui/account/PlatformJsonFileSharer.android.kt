package com.futebadosparcas.ui.account

/**
 * Implementação Android do harness `composeApp`.
 *
 * No app Android de produção (`:app`), a exportação usa `ActivityResultContracts.CreateDocument`
 * diretamente em `AboutScreen` e `PreferencesScreen`.
 */
actual suspend fun shareExportedJsonFile(fileName: String, json: String): Boolean =
    fileName.isNotBlank() && json.isNotEmpty()
