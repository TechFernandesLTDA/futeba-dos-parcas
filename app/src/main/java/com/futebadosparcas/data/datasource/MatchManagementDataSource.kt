package com.futebadosparcas.data.datasource

import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.max

@Singleton
class MatchManagementDataSource @Inject constructor(
    private val firestore: FirebaseFirestore
) {
    private val gamesCollection = firestore.collection("games")
    private val confirmationsCollection = firestore.collection("confirmations")

    companion object {
        private const val TAG = "MatchManagementDataSource"
    }

    suspend fun confirmPlayer(
        gameId: String, 
        userId: String, 
        userName: String, 
        userPhoto: String?, 
        position: String, 
        isCasual: Boolean
    ): GameConfirmation {
        val gameRef = gamesCollection.document(gameId)
        val confirmationId = "${gameId}_${userId}"
        val confirmationRef = confirmationsCollection.document(confirmationId)

        return try {
             firestore.runTransaction { transaction ->
                val gameSnapshot = transaction.get(gameRef)
                val existingConfirmationSnapshot = transaction.get(confirmationRef)

                if (!gameSnapshot.exists()) {
                    throw Exception("Jogo nao encontrado")
                }

                // ISSUE #4 FIX: Bloquear confirmações quando lista está fechada
                val gameStatus = gameSnapshot.getString("status") ?: "SCHEDULED"
                if (gameStatus !in listOf("SCHEDULED", "CONFIRMED")) {
                    throw Exception("Lista de confirmação está fechada")
                }

                // Se status for CONFIRMED (lista fechada), bloquear novas confirmações
                if (gameStatus == "CONFIRMED" && !existingConfirmationSnapshot.exists()) {
                    throw Exception("Lista de confirmação está fechada. Não é possível confirmar presença.")
                }

                val currentGk = gameSnapshot.getLong("goalkeepers_count")?.toInt() ?: 0
                val currentPlayers = gameSnapshot.getLong("players_count")?.toInt() ?: 0
                val maxGk = gameSnapshot.getLong("max_goalkeepers")?.toInt() ?: 3
                val maxPlayers = gameSnapshot.getLong("max_players")?.toInt() ?: 24

                val isUpdate = existingConfirmationSnapshot.exists()
                val previousPosition = existingConfirmationSnapshot.getString("position")
                val previousStatus = existingConfirmationSnapshot.getString("status")

                var finalStatus = "CONFIRMED"
                // Assuming caller provides desired position
                val finalPosition = position 

                // Lógica de Vagas e Lista de Espera
                if (!isUpdate || previousStatus != "CONFIRMED") {
                    if (currentPlayers >= maxPlayers) {
                        finalStatus = "WAITLIST"
                    } else if (position == "GOALKEEPER" && currentGk >= maxGk) {
                        finalStatus = "WAITLIST"
                    }
                } else {
                    if (position == "GOALKEEPER" && previousPosition != "GOALKEEPER" && currentGk >= maxGk) {
                         throw Exception("Vagas de goleiro esgotadas.")
                    }
                }

                // Calcular novos contadores (Apenas se CONFIRMED)
                var newGkCount = currentGk
                var newPlayerCount = currentPlayers

                if (finalStatus == "CONFIRMED") {
                    if (!isUpdate || previousStatus != "CONFIRMED") {
                        newPlayerCount++
                        if (finalPosition == "GOALKEEPER") newGkCount++
                    } else {
                        if (previousPosition == "GOALKEEPER" && finalPosition != "GOALKEEPER") newGkCount--
                        else if (previousPosition != "GOALKEEPER" && finalPosition == "GOALKEEPER") newGkCount++
                    }
                }

                if (newPlayerCount != currentPlayers || newGkCount != currentGk) {
                    transaction.update(gameRef, mapOf(
                        "players_count" to newPlayerCount,
                        "goalkeepers_count" to newGkCount
                    ))
                }

                val confirmationData = GameConfirmation(
                    id = confirmationId,
                    gameId = gameId,
                    userId = userId,
                    userName = userName,
                    userPhoto = userPhoto,
                    position = finalPosition,
                    status = finalStatus,
                    isCasualPlayer = isCasual
                )
                transaction.set(confirmationRef, confirmationData)
                confirmationData
            }.await()
        } catch (e: Exception) {
            AppLogger.e(TAG, "Error in confirmPlayer transaction", e)
            throw e
        }
    }

    suspend fun removePlayer(gameId: String, userId: String): Boolean {
        val gameRef = gamesCollection.document(gameId)
        val confirmationRef = confirmationsCollection.document("${gameId}_${userId}")

        return try {
            firestore.runTransaction { transaction ->
                val confirmationSnapshot = transaction.get(confirmationRef)

                if (confirmationSnapshot.exists()) {
                    val status = confirmationSnapshot.getString("status")
                    val isConfirmed = status == "CONFIRMED"
                    
                    if (isConfirmed) {
                         val gameSnapshot = transaction.get(gameRef)
                         val position = confirmationSnapshot.getString("position")
                         val currentGk = gameSnapshot.getLong("goalkeepers_count")?.toInt() ?: 0
                         val currentPlayers = gameSnapshot.getLong("players_count")?.toInt() ?: 0
                         
                         val newGkCount = if (position == "GOALKEEPER") maxOf(0, currentGk - 1) else currentGk
                         val newPlayerCount = maxOf(0, currentPlayers - 1)
                         
                         transaction.update(gameRef, mapOf(
                            "players_count" to newPlayerCount,
                            "goalkeepers_count" to newGkCount
                         ))
                    }
                    transaction.delete(confirmationRef)
                    isConfirmed
                } else {
                    false
                }
            }.await()
        } catch (e: Exception) {
            AppLogger.e(TAG, "Error in removePlayer transaction", e)
            throw e
        }
    }

    /**
     * Promove jogadores da waitlist para preencher vagas disponíveis.
     *
     * Usa uma única transação que:
     * 1. Lê o estado atual do jogo (vagas disponíveis)
     * 2. Busca jogadores na waitlist ordenados por tempo de confirmação
     * 3. Promove tantos jogadores quanto vagas disponíveis
     *
     * Isso evita race conditions quando múltiplos jogadores cancelam simultaneamente.
     */
    suspend fun promoteWaitlistedPlayer(gameId: String) {
        try {
            val gameRef = gamesCollection.document(gameId)

            firestore.runTransaction { transaction ->
                // 1. Ler estado atual do jogo na transação
                val gameSnapshot = transaction.get(gameRef)
                if (!gameSnapshot.exists()) return@runTransaction

                val currentPlayers = gameSnapshot.getLong("players_count")?.toInt() ?: 0
                val maxPlayers = gameSnapshot.getLong("max_players")?.toInt() ?: 24
                val currentGk = gameSnapshot.getLong("goalkeepers_count")?.toInt() ?: 0
                val maxGk = gameSnapshot.getLong("max_goalkeepers")?.toInt() ?: 3

                val availableSpots = maxPlayers - currentPlayers
                if (availableSpots <= 0) return@runTransaction

                // 2. Não podemos fazer query dentro de transação, então fazemos antes
                // e validamos o status dentro da transação
                null // Marker para indicar que precisamos buscar candidatos fora
            }.await()

            // Buscar candidatos fora da transação (Firestore não permite queries em transactions)
            val waitlistSnapshot = confirmationsCollection
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("status", "WAITLIST")
                .orderBy("confirmed_at", Query.Direction.ASCENDING)
                .limit(10) // Buscar até 10 candidatos para cobrir race conditions
                .get()
                .await()

            if (waitlistSnapshot.isEmpty) return

            // 3. Executar promoção em transação com validação
            firestore.runTransaction { transaction ->
                val gameSnapshot = transaction.get(gameRef)
                if (!gameSnapshot.exists()) return@runTransaction

                var currentPlayers = gameSnapshot.getLong("players_count")?.toInt() ?: 0
                val maxPlayers = gameSnapshot.getLong("max_players")?.toInt() ?: 24
                var currentGk = gameSnapshot.getLong("goalkeepers_count")?.toInt() ?: 0
                val maxGk = gameSnapshot.getLong("max_goalkeepers")?.toInt() ?: 3

                var promoted = 0
                var gkPromoted = 0

                for (candidateDoc in waitlistSnapshot.documents) {
                    if (currentPlayers >= maxPlayers) break

                    val candidateRef = candidateDoc.reference
                    val candidateSnapshot = transaction.get(candidateRef)

                    // Validar que ainda está na waitlist (pode ter sido promovido por outra transação)
                    if (!candidateSnapshot.exists()) continue
                    if (candidateSnapshot.getString("status") != "WAITLIST") continue

                    val position = candidateSnapshot.getString("position")

                    // Validar limite de goleiros
                    if (position == "GOALKEEPER" && currentGk >= maxGk) continue

                    // Promover jogador
                    transaction.update(candidateRef, "status", "CONFIRMED")

                    currentPlayers++
                    promoted++

                    if (position == "GOALKEEPER") {
                        currentGk++
                        gkPromoted++
                    }
                }

                // Atualizar contadores do jogo uma única vez
                if (promoted > 0) {
                    val updates = mutableMapOf<String, Any>(
                        "players_count" to currentPlayers
                    )
                    if (gkPromoted > 0) {
                        updates["goalkeepers_count"] = currentGk
                    }
                    transaction.update(gameRef, updates)

                    AppLogger.d(TAG) { "Promovidos $promoted jogadores da waitlist para game $gameId" }
                }
            }.await()

        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao promover jogador da waitlist", e)
        }
    }
}
