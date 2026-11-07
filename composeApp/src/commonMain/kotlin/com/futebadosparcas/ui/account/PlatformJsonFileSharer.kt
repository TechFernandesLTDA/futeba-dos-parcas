package com.futebadosparcas.ui.account

/**
 * Grava o JSON exportado em um arquivo temporário com [fileName] e abre a folha de
 * compartilhamento / salvamento da plataforma (UIActivityViewController no iOS).
 *
 * Retorna `true` se o fluxo de compartilhamento/salvamento foi iniciado com sucesso.
 */
expect suspend fun shareExportedJsonFile(fileName: String, json: String): Boolean
