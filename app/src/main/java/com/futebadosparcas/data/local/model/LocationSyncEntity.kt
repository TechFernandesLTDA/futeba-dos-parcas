package com.futebadosparcas.data.local.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

/**
 * Representa as ações de sincronização possíveis para Location.
 * Usado para rastrear operações offline que precisam ser sincronizadas.
 */
enum class SyncAction {
    CREATE,
    UPDATE,
    DELETE
}

/**
 * Entidade para a fila de sincronização de Locations.
 *
 * Quando o app está offline, operações de criar/atualizar/deletar
 * locais são armazenadas nesta fila para sincronização posterior.
 *
 * O sistema implementa exponential backoff (10s, 60s, 300s) para
 * tentativas de sincronização falhas.
 */
@Entity(tableName = "location_sync_queue")
data class LocationSyncEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),

    /** ID do Location a ser sincronizado */
    val locationId: String,

    /** Tipo de operação: CREATE, UPDATE ou DELETE */
    val action: SyncAction,

    /** Dados do Location serializados em JSON (usando kotlinx.serialization) */
    val locationJson: String,

    /** Timestamp de quando o item foi adicionado à fila */
    val timestamp: Long = System.currentTimeMillis(),

    /** Número de tentativas de sincronização realizadas */
    val retryCount: Int = 0,

    /** Última mensagem de erro, se houver */
    val lastError: String? = null,

    /** Timestamp da próxima tentativa de sincronização */
    val nextRetryAt: Long = 0
) {
    companion object {
        /** Intervalos de backoff em milissegundos: 10s, 60s, 300s */
        val BACKOFF_DELAYS = listOf(10_000L, 60_000L, 300_000L)

        /** Número máximo de tentativas antes de desistir */
        const val MAX_RETRY_COUNT = 3
    }

    /**
     * Calcula o próximo delay de backoff baseado no número de tentativas.
     * Retorna o delay em milissegundos.
     */
    fun getNextBackoffDelay(): Long {
        return BACKOFF_DELAYS.getOrElse(retryCount) { BACKOFF_DELAYS.last() }
    }

    /**
     * Verifica se ainda pode tentar sincronizar (não excedeu MAX_RETRY_COUNT).
     */
    fun canRetry(): Boolean = retryCount < MAX_RETRY_COUNT

    /**
     * Verifica se está pronto para uma nova tentativa de sincronização.
     */
    fun isReadyToSync(): Boolean {
        return System.currentTimeMillis() >= nextRetryAt
    }
}
