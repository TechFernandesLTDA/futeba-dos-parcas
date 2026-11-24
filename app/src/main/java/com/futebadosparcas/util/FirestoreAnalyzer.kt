package com.futebadosparcas.util

import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

/**
 * Analisador da estrutura do Firestore
 * Gera relatório completo de todas as collections e documentos
 */
object FirestoreAnalyzer {
    
    private const val TAG = "FirestoreAnalyzer"
    
    /**
     * Analisa toda a estrutura do Firestore e retorna relatório
     */
    suspend fun analyzeDatabase(): DatabaseReport {
        val firestore = org.koin.java.KoinJavaComponent.get<FirebaseFirestore>(FirebaseFirestore::class.java)
        val report = DatabaseReport()
        
        try {
            // Analisar cada collection
            val collections = listOf(
                "users",
                "games", 
                "confirmations",
                "teams",
                "statistics",
                "player_stats",
                "live_games",
                "locations",
                "fields",
                "notifications"
            )
            
            for (collectionName in collections) {
                val collectionReport = analyzeCollection(firestore, collectionName)
                report.collections[collectionName] = collectionReport
            }
            
            report.success = true
            
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao analisar database", e)
            report.success = false
            report.error = e.message
        }
        
        return report
    }
    
    /**
     * Analisa uma collection específica
     */
    private suspend fun analyzeCollection(
        firestore: FirebaseFirestore,
        collectionName: String
    ): CollectionReport {
        val report = CollectionReport(collectionName)
        
        try {
            val snapshot = firestore.collection(collectionName).get().await()
            
            report.documentCount = snapshot.size()
            report.exists = true
            
            // Analisar estrutura dos documentos
            if (snapshot.documents.isNotEmpty()) {
                val sampleDoc = snapshot.documents.first()
                report.sampleFields = sampleDoc.data?.keys?.toList() ?: emptyList()
                
                // Verificar campos obrigatórios por collection
                report.missingFields = checkRequiredFields(collectionName, report.sampleFields)
            }
            
            // Estatísticas específicas por collection
            when (collectionName) {
                "locations" -> {
                    report.stats["locais_ativos"] = snapshot.documents.count { 
                        it.getBoolean("is_active") == true 
                    }
                    report.stats["locais_verificados"] = snapshot.documents.count { 
                        it.getBoolean("is_verified") == true 
                    }
                }
                "fields" -> {
                    report.stats["quadras_ativas"] = snapshot.documents.count { 
                        it.getBoolean("is_active") == true 
                    }
                    val types = snapshot.documents.mapNotNull { it.getString("type") }
                    report.stats["tipos"] = types.groupingBy { it }.eachCount()
                }
                "games" -> {
                    val statuses = snapshot.documents.mapNotNull { it.getString("status") }
                    report.stats["por_status"] = statuses.groupingBy { it }.eachCount()
                }
                "users" -> {
                    val roles = snapshot.documents.mapNotNull { it.getString("role") }
                    report.stats["por_role"] = roles.groupingBy { it }.eachCount()
                    report.stats["usuarios_mock"] = snapshot.documents.count {
                        it.getBoolean("isMock") == true || it.id.startsWith("mock_")
                    }
                }
            }
            
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao analisar collection $collectionName", e)
            report.exists = false
            report.error = e.message
        }
        
        return report
    }
    
    /**
     * Verifica campos obrigatórios por collection
     */
    private fun checkRequiredFields(
        collectionName: String,
        existingFields: List<String>
    ): List<String> {
        val requiredFields = when (collectionName) {
            "users" -> listOf("id", "name", "email", "role")
            "games" -> listOf("id", "location_id", "date_time", "status", "owner_id")
            "confirmations" -> listOf("game_id", "user_id", "status")
            "locations" -> listOf("id", "name", "address", "owner_id")
            "fields" -> listOf("id", "location_id", "name", "type", "hourly_price")
            "statistics" -> listOf("user_id", "total_games")
            else -> emptyList()
        }
        
        return requiredFields.filter { it !in existingFields }
    }
    
    /**
     * Formata o relatório em texto legível
     */
    fun formatReport(report: DatabaseReport): String {
        val sb = StringBuilder()
        
        sb.appendLine("=" .repeat(60))
        sb.appendLine("📊 RELATÓRIO DE ANÁLISE DO FIRESTORE")
        sb.appendLine("=" .repeat(60))
        sb.appendLine()
        
        if (!report.success) {
            sb.appendLine("❌ ERRO: ${report.error}")
            return sb.toString()
        }
        
        sb.appendLine("✅ Análise concluída com sucesso!")
        sb.appendLine()
        
        // Resumo geral
        sb.appendLine("📈 RESUMO GERAL")
        sb.appendLine("-" .repeat(60))
        val totalDocs = report.collections.values.sumOf { it.documentCount }
        val existingCollections = report.collections.values.count { it.exists }
        sb.appendLine("Total de Collections: ${report.collections.size}")
        sb.appendLine("Collections Existentes: $existingCollections")
        sb.appendLine("Total de Documentos: $totalDocs")
        sb.appendLine()
        
        // Detalhes por collection
        sb.appendLine("📋 DETALHES POR COLLECTION")
        sb.appendLine("-" .repeat(60))
        
        report.collections.forEach { (name, collReport) ->
            sb.appendLine()
            sb.appendLine("🗂️  $name")
            
            if (!collReport.exists) {
                sb.appendLine("   ❌ Collection não existe ou está vazia")
                collReport.error?.let { sb.appendLine("   Erro: $it") }
            } else {
                sb.appendLine("   ✅ ${collReport.documentCount} documento(s)")
                
                // Campos
                if (collReport.sampleFields.isNotEmpty()) {
                    sb.appendLine("   📝 Campos: ${collReport.sampleFields.joinToString(", ")}")
                }
                
                // Campos faltando
                if (collReport.missingFields.isNotEmpty()) {
                    sb.appendLine("   ⚠️  Campos faltando: ${collReport.missingFields.joinToString(", ")}")
                }
                
                // Estatísticas
                if (collReport.stats.isNotEmpty()) {
                    sb.appendLine("   📊 Estatísticas:")
                    collReport.stats.forEach { (key, value) ->
                        sb.appendLine("      • $key: $value")
                    }
                }
            }
        }
        
        sb.appendLine()
        sb.appendLine("=" .repeat(60))
        
        return sb.toString()
    }
}

/**
 * Relatório completo do database
 */
data class DatabaseReport(
    var success: Boolean = false,
    var error: String? = null,
    val collections: MutableMap<String, CollectionReport> = mutableMapOf()
)

/**
 * Relatório de uma collection
 */
data class CollectionReport(
    val name: String,
    var exists: Boolean = false,
    var documentCount: Int = 0,
    var sampleFields: List<String> = emptyList(),
    var missingFields: List<String> = emptyList(),
    var error: String? = null,
    val stats: MutableMap<String, Any> = mutableMapOf()
)
