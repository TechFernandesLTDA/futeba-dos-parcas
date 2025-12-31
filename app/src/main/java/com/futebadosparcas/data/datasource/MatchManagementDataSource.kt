package com.futebadosparcas.data.datasource

import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.max
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

    suspend fun promoteWaitlistedPlayer(gameId: String) {
        try {
            val snapshot = confirmationsCollection
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("status", "WAITLIST")
                .orderBy("confirmed_at", Query.Direction.ASCENDING)
                .limit(1)
                .get()
                .await()
                
            if (!snapshot.isEmpty) {
                val candidateDoc = snapshot.documents.first()
                val candidateRef = candidateDoc.reference
                
                firestore.runTransaction { transaction ->
                    val gameRef = gamesCollection.document(gameId)
                    val gameSnapshot = transaction.get(gameRef)
                    val candidateSnapshot = transaction.get(candidateRef)
                    
                    if (candidateSnapshot.exists() && candidateSnapshot.getString("status") == "WAITLIST") {
                         val currentPlayers = gameSnapshot.getLong("players_count")?.toInt() ?: 0
                         val maxPlayers = gameSnapshot.getLong("max_players")?.toInt() ?: 24
                         
                         if (currentPlayers < maxPlayers) {
                             transaction.update(candidateRef, "status", "CONFIRMED")
                             transaction.update(gameRef, "players_count", currentPlayers + 1)
                             
                             if (candidateSnapshot.getString("position") == "GOALKEEPER") {
                                 val currentGk = gameSnapshot.getLong("goalkeepers_count")?.toInt() ?: 0
                                 transaction.update(gameRef, "goalkeepers_count", currentGk + 1)
                             }
                         }
                    }
                }.await()
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao promover jogador da waitlist", e)
        }
    }
}
