package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.ReleaseNote

/**
 * Acesso às notas de versão ("Novidades").
 *
 * A implementação combina duas fontes (ver spec §3.8):
 * - **Firestore** (`release_notes`) — fonte primária, dinâmica.
 * - **JSON embarcado** no build — fallback offline; completa a fonte primária
 *   ou a substitui inteiramente quando o Firestore falha.
 */
interface ReleaseNotesRepository {

    /**
     * Notas da [platform] com `buildNumber` maior que [sinceBuild], mais recente
     * primeiro.
     *
     * - `sinceBuild = 0` retorna todo o histórico disponível.
     * - Sucesso com lista vazia = não há notas novas (não é erro).
     * - Falha só quando Firestore falha **e** não há fallback embarcado.
     */
    suspend fun getReleaseNotes(platform: String, sinceBuild: Int): Result<List<ReleaseNote>>
}
