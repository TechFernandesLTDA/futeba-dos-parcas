package com.futebadosparcas.util

import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.concurrent.ConcurrentHashMap

/**
 * Rastreador de edições de campos de Location para insights de UX.
 *
 * Monitora quais campos são mais frequentemente editados pelos usuários,
 * permitindo identificar oportunidades de melhoria na interface.
 *
 * Dados são armazenados localmente em memória e persistidos no Firestore
 * na collection: analytics/location_edits/field_counts
 *
 * Usage:
 * ```kotlin
 * // Rastrear uma edição
 * LocationEditTracker.trackFieldEdit("name")
 *
 * // Obter campos mais editados
 * val topFields = LocationEditTracker.getMostEditedFields(5)
 *
 * // Verificar se um campo é "popular" (frequentemente editado)
 * val isPopular = LocationEditTracker.isPopularField("address")
 *
 * // Obter contagens como Flow para UI reativa
 * val countsFlow = LocationEditTracker.editCountsFlow
 * ```
 */
object LocationEditTracker {

    private const val TAG = "LocationEditTracker"

    // Coleção no Firestore para persistência
    private const val ANALYTICS_COLLECTION = "analytics"
    private const val LOCATION_EDITS_DOC = "location_edits"
    private const val FIELD_COUNTS_COLLECTION = "field_counts"

    // Limiar para considerar um campo como "popular" (top N mais editados)
    private const val POPULAR_THRESHOLD_COUNT = 3

    // Cache local thread-safe
    private val editCounts = ConcurrentHashMap<String, Int>()

    // Flow para UI reativa
    private val _editCountsFlow = MutableStateFlow<Map<String, Int>>(emptyMap())
    val editCountsFlow: StateFlow<Map<String, Int>> = _editCountsFlow

    // Escopo para operações assíncronas
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // Referência ao Firestore (lazy para não inicializar antes do Firebase estar pronto)
    private val firestore: FirebaseFirestore by lazy { Firebase.firestore }

    // Flag para controlar se já carregamos dados do Firestore
    private var isInitialized = false

    /**
     * Inicializa o tracker carregando dados do Firestore.
     * Chamado automaticamente na primeira operação, mas pode ser chamado explicitamente.
     */
    fun initialize() {
        if (isInitialized) return

        scope.launch {
            try {
                loadFromFirestore()
                isInitialized = true
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao inicializar LocationEditTracker", e)
            }
        }
    }

    /**
     * Rastreia a edição de um campo específico.
     *
     * @param fieldName Nome do campo editado (ex: "name", "address", "phone")
     */
    fun trackFieldEdit(fieldName: String) {
        if (fieldName.isBlank()) return

        // Atualiza cache local atomicamente
        val newCount = editCounts.compute(fieldName) { _, currentCount ->
            (currentCount ?: 0) + 1
        } ?: 1

        // Atualiza Flow para UI
        _editCountsFlow.value = editCounts.toMap()

        // Persiste no Firestore em background
        scope.launch {
            persistToFirestore(fieldName, newCount)
        }

        AppLogger.d(TAG) { "Campo '$fieldName' editado. Total: $newCount" }
    }

    /**
     * Rastreia múltiplas edições de uma vez (batch).
     *
     * @param fieldNames Lista de nomes de campos editados
     */
    fun trackFieldEdits(fieldNames: List<String>) {
        fieldNames.forEach { trackFieldEdit(it) }
    }

    /**
     * Retorna os campos mais editados, ordenados por contagem decrescente.
     *
     * @param limit Número máximo de campos a retornar (padrão: 5)
     * @return Lista de pares (fieldName, count) ordenados por contagem
     */
    fun getMostEditedFields(limit: Int = 5): List<Pair<String, Int>> {
        return editCounts.entries
            .sortedByDescending { it.value }
            .take(limit)
            .map { it.key to it.value }
    }

    /**
     * Verifica se um campo é considerado "popular" (frequentemente editado).
     * Um campo é popular se está entre os top N mais editados.
     *
     * @param fieldName Nome do campo a verificar
     * @return true se o campo está entre os mais editados
     */
    fun isPopularField(fieldName: String): Boolean {
        val topFields = getMostEditedFields(POPULAR_THRESHOLD_COUNT)
        return topFields.any { it.first == fieldName }
    }

    /**
     * Retorna a contagem de edições para um campo específico.
     *
     * @param fieldName Nome do campo
     * @return Número de edições ou 0 se nunca editado
     */
    fun getEditCount(fieldName: String): Int {
        return editCounts[fieldName] ?: 0
    }

    /**
     * Retorna todas as contagens de edição.
     *
     * @return Mapa de fieldName -> count
     */
    fun getAllEditCounts(): Map<String, Int> {
        return editCounts.toMap()
    }

    /**
     * Compara dois objetos Location e retorna os campos que foram alterados.
     *
     * @param oldLocation Location original
     * @param newName Novo nome
     * @param newAddress Novo endereço
     * @param newPhone Novo telefone
     * @param newOpeningTime Novo horário de abertura
     * @param newClosingTime Novo horário de fechamento
     * @param newMinDuration Nova duração mínima
     * @param newRegion Nova região
     * @param newNeighborhood Novo bairro
     * @param newDescription Nova descrição
     * @param newAmenities Novas amenidades
     * @param newIsActive Novo status ativo
     * @param newInstagram Novo Instagram
     * @param newCep Novo CEP
     * @param newStreet Nova rua
     * @param newNumber Novo número
     * @param newComplement Novo complemento
     * @param newCity Nova cidade
     * @param newState Novo estado
     * @param newCountry Novo país
     * @param newOwnerId Novo proprietário
     * @return Lista de nomes dos campos alterados
     */
    fun getChangedFields(
        oldName: String,
        oldAddress: String,
        oldPhone: String?,
        oldOpeningTime: String,
        oldClosingTime: String,
        oldMinDuration: Int,
        oldRegion: String,
        oldNeighborhood: String,
        oldDescription: String,
        oldAmenities: List<String>,
        oldIsActive: Boolean,
        oldInstagram: String?,
        oldCep: String,
        oldStreet: String,
        oldNumber: String,
        oldComplement: String,
        oldCity: String,
        oldState: String,
        oldCountry: String,
        oldOwnerId: String,
        newName: String,
        newAddress: String,
        newPhone: String?,
        newOpeningTime: String,
        newClosingTime: String,
        newMinDuration: Int,
        newRegion: String,
        newNeighborhood: String,
        newDescription: String,
        newAmenities: List<String>,
        newIsActive: Boolean,
        newInstagram: String,
        newCep: String,
        newStreet: String,
        newNumber: String,
        newComplement: String,
        newCity: String,
        newState: String,
        newCountry: String,
        newOwnerId: String?
    ): List<String> {
        val changedFields = mutableListOf<String>()

        if (oldName != newName) changedFields.add("name")
        if (oldAddress != newAddress) changedFields.add("address")
        if (oldPhone != newPhone) changedFields.add("phone")
        if (oldOpeningTime != newOpeningTime) changedFields.add("openingTime")
        if (oldClosingTime != newClosingTime) changedFields.add("closingTime")
        if (oldMinDuration != newMinDuration) changedFields.add("minGameDurationMinutes")
        if (oldRegion != newRegion) changedFields.add("region")
        if (oldNeighborhood != newNeighborhood) changedFields.add("neighborhood")
        if (oldDescription != newDescription) changedFields.add("description")
        if (oldAmenities != newAmenities) changedFields.add("amenities")
        if (oldIsActive != newIsActive) changedFields.add("isActive")
        if (oldInstagram != newInstagram) changedFields.add("instagram")
        if (oldCep != newCep) changedFields.add("cep")
        if (oldStreet != newStreet) changedFields.add("street")
        if (oldNumber != newNumber) changedFields.add("number")
        if (oldComplement != newComplement) changedFields.add("complement")
        if (oldCity != newCity) changedFields.add("city")
        if (oldState != newState) changedFields.add("state")
        if (oldCountry != newCountry) changedFields.add("country")
        if (newOwnerId != null && oldOwnerId != newOwnerId) changedFields.add("ownerId")

        return changedFields
    }

    /**
     * Persiste a contagem de um campo no Firestore.
     */
    private suspend fun persistToFirestore(fieldName: String, count: Int) {
        try {
            val docRef = firestore
                .collection(ANALYTICS_COLLECTION)
                .document(LOCATION_EDITS_DOC)
                .collection(FIELD_COUNTS_COLLECTION)
                .document(fieldName)

            val data = mapOf(
                "fieldName" to fieldName,
                "count" to count,
                "lastEdited" to System.currentTimeMillis()
            )

            docRef.set(data).await()

            AppLogger.d(TAG) { "Contagem de '$fieldName' persistida no Firestore: $count" }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao persistir contagem de '$fieldName' no Firestore", e)
        }
    }

    /**
     * Carrega contagens do Firestore para o cache local.
     */
    private suspend fun loadFromFirestore() {
        try {
            val snapshot = firestore
                .collection(ANALYTICS_COLLECTION)
                .document(LOCATION_EDITS_DOC)
                .collection(FIELD_COUNTS_COLLECTION)
                .get()
                .await()

            snapshot.documents.forEach { doc ->
                val fieldName = doc.getString("fieldName") ?: return@forEach
                val count = doc.getLong("count")?.toInt() ?: 0
                editCounts[fieldName] = count
            }

            _editCountsFlow.value = editCounts.toMap()

            AppLogger.d(TAG) { "Carregadas ${editCounts.size} contagens do Firestore" }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao carregar contagens do Firestore", e)
        }
    }

    /**
     * Limpa todas as contagens (local e Firestore).
     * Útil para testes ou reset de analytics.
     */
    suspend fun clearAllCounts() {
        try {
            // Limpa cache local
            editCounts.clear()
            _editCountsFlow.value = emptyMap()

            // Limpa Firestore
            val snapshot = firestore
                .collection(ANALYTICS_COLLECTION)
                .document(LOCATION_EDITS_DOC)
                .collection(FIELD_COUNTS_COLLECTION)
                .get()
                .await()

            val batch = firestore.batch()
            snapshot.documents.forEach { doc ->
                batch.delete(doc.reference)
            }
            batch.commit().await()

            AppLogger.d(TAG) { "Todas as contagens foram limpas" }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao limpar contagens", e)
        }
    }
}

/**
 * Data class para representar a contagem de edições de um campo.
 * Usada para serialização/deserialização com Firestore.
 */
data class FieldEditCount(
    val fieldName: String = "",
    val count: Int = 0,
    val lastEdited: Long = 0L
)
