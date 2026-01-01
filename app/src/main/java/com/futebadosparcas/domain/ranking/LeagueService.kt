package com.futebadosparcas.domain.ranking

import com.futebadosparcas.data.model.*
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.tasks.await
import java.util.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Resultado da atualizacao de liga.
 */
data class LeagueUpdateResult(
    val userId: String,
    val oldDivision: LeagueDivision,
    val newDivision: LeagueDivision,
    val leagueRating: Double,
    val promoted: Boolean,
    val relegated: Boolean
)

/**
 * Service responsavel por gerenciar o sistema de ligas.
 *
 * Regras:
 * - Bronze: LR 0-29
 * - Prata: LR 30-49
 * - Ouro: LR 50-69
 * - Diamante: LR 70-100
 *
 * Promocao: LR >= limite superior por 3 jogos consecutivos
 * Rebaixamento: LR < limite inferior por 3 jogos consecutivos
 * Protecao: 5 jogos de imunidade apos promocao
 */
@Singleton
class LeagueService @Inject constructor(
    private val firestore: FirebaseFirestore
) {
    companion object {
        private const val TAG = "LeagueService"
        private const val PROMOTION_GAMES_REQUIRED = 3
        private const val RELEGATION_GAMES_REQUIRED = 3
        private const val PROTECTION_GAMES = 5
        private const val MAX_RECENT_GAMES = 10
    }

    private val seasonParticipationCollection = firestore.collection("season_participation")

    /**
     * Atualiza a liga de um jogador apos um jogo.
     */
    suspend fun updateLeague(
        userId: String,
        seasonId: String,
        xpEarned: Long,
        won: Boolean,
        drew: Boolean,
        goalDiff: Int,
        wasMvp: Boolean,
        gameId: String
    ): Result<LeagueUpdateResult> {
        return try {
            // 1. Buscar participacao atual
            val docId = "${seasonId}_$userId"
            val doc = seasonParticipationCollection.document(docId).get().await()

            val participation = if (doc.exists()) {
                doc.toObject(SeasonParticipationV2::class.java) ?: createNewParticipation(userId, seasonId)
            } else {
                createNewParticipation(userId, seasonId)
            }

            // 2. Adicionar jogo recente
            val newRecentGame = RecentGameData(
                gameId = gameId,
                xpEarned = xpEarned,
                won = won,
                drew = drew,
                goalDiff = goalDiff,
                wasMvp = wasMvp,
                playedAt = Date()
            )

            val updatedRecentGames = (listOf(newRecentGame) + participation.recentGames)
                .take(MAX_RECENT_GAMES)

            // 3. Calcular novo League Rating
            val newLeagueRating = LeagueRatingCalculator.calculate(updatedRecentGames)
            val suggestedDivision = LeagueRatingCalculator.getDivisionForRating(newLeagueRating)

            // 4. Verificar promocao/rebaixamento
            // REGRA DE NEGOCIO (Alterada): A mudanca de divisao so acontece MES A MES (Season a Season).
            // Portanto, durante a temporada, a divisao permanece fixa.
            // O League Rating continua sendo calculado para definir a divisao da PROXIMA temporada.
            
            val oldDivision = participation.division
            val newDivision = oldDivision // Mantem a divisao atual ate virar a temporada
            
            // Zeramos os progressos pois a logica agora é estatica por temporada
            val promotionProgress = 0
            val relegationProgress = 0
            val protectionGames = 0
            val promoted = false
            val relegated = false

            AppLogger.d(TAG) { "League Update: Jogador $userId mantido em $oldDivision (Rating Atual: ${"%.1f".format(newLeagueRating)}) - Mudança apenas ao fim da temporada." }

            // 5. Atualizar estatisticas
            val updatedParticipation = participation.copy(
                division = newDivision,
                gamesPlayed = participation.gamesPlayed + 1,
                wins = participation.wins + if (won) 1 else 0,
                draws = participation.draws + if (drew) 1 else 0,
                losses = participation.losses + if (!won && !drew) 1 else 0,
                goalsScored = participation.goalsScored + maxOf(0, goalDiff),
                goalsConceded = participation.goalsConceded + maxOf(0, -goalDiff),
                mvpCount = participation.mvpCount + if (wasMvp) 1 else 0,
                points = participation.points + when {
                    won -> 3
                    drew -> 1
                    else -> 0
                },
                leagueRating = newLeagueRating,
                promotionProgress = promotionProgress,
                relegationProgress = relegationProgress,
                protectionGames = protectionGames,
                recentGames = updatedRecentGames,
                lastCalculatedAt = Date()
            )

            // 6. Salvar
            seasonParticipationCollection.document(docId)
                .set(updatedParticipation, SetOptions.merge())
                .await()

            AppLogger.d(TAG) { "Liga atualizada: $userId LR=${"%.1f".format(newLeagueRating)} $oldDivision -> $newDivision" }

            Result.success(
                LeagueUpdateResult(
                    userId = userId,
                    oldDivision = oldDivision,
                    newDivision = newDivision,
                    leagueRating = newLeagueRating,
                    promoted = promoted,
                    relegated = relegated
                )
            )
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao atualizar liga de $userId", e)
            Result.failure(e)
        }
    }

    /**
     * Busca participacao de um jogador em uma temporada.
     */
    suspend fun getParticipation(userId: String, seasonId: String): Result<SeasonParticipationV2?> {
        return try {
            val docId = "${seasonId}_$userId"
            val doc = seasonParticipationCollection.document(docId).get().await()

            val participation = if (doc.exists()) {
                doc.toObject(SeasonParticipationV2::class.java)
            } else {
                null
            }

            Result.success(participation)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar participacao", e)
            Result.failure(e)
        }
    }

    /**
     * Busca ranking da liga (ordenado por pontos).
     */
    suspend fun getLeagueRanking(seasonId: String, limit: Int = 50): Result<List<SeasonParticipationV2>> {
        return try {
            val snapshot = seasonParticipationCollection
                .whereEqualTo("season_id", seasonId)
                .orderBy("points", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val participations = snapshot.toObjects(SeasonParticipationV2::class.java)
            Result.success(participations)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar ranking da liga", e)
            Result.failure(e)
        }
    }

    /**
     * Busca jogadores de uma divisao especifica.
     */
    suspend fun getPlayersByDivision(
        seasonId: String,
        division: LeagueDivision,
        limit: Int = 50
    ): Result<List<SeasonParticipationV2>> {
        return try {
            val snapshot = seasonParticipationCollection
                .whereEqualTo("season_id", seasonId)
                .whereEqualTo("division", division.name)
                .orderBy("league_rating", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val participations = snapshot.toObjects(SeasonParticipationV2::class.java)
            Result.success(participations)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogadores da divisao $division", e)
            Result.failure(e)
        }
    }

    private suspend fun createNewParticipation(userId: String, seasonId: String): SeasonParticipationV2 {
        var startDivision = LeagueDivision.BRONZE
        
        // Tenta buscar o historico da temporada ANTERIOR para definir a divisao inicial (Promocao/Rebaixamento)
        try {
            // seasonId esperado: monthly_2025_12
            if (seasonId.startsWith("monthly_")) {
                val parts = seasonId.split("_")
                if (parts.size == 3) {
                    val year = parts[1].toInt()
                    val month = parts[2].toInt() // 1-12
                    
                    // Calcular mes anterior
                    val cal = Calendar.getInstance()
                    cal.set(Calendar.YEAR, year)
                    cal.set(Calendar.MONTH, month - 1) // Calendar.MONTH é 0-11
                    cal.add(Calendar.MONTH, -1) // Subtrai 1 mes
                    
                    val prevYear = cal.get(Calendar.YEAR)
                    val prevMonth = cal.get(Calendar.MONTH) + 1
                    
                    val prevSeasonId = "monthly_${prevYear}_${prevMonth.toString().padStart(2, '0')}"
                    val prevDocId = "${prevSeasonId}_$userId"
                    
                    val prevDoc = seasonParticipationCollection.document(prevDocId).get().await()
                    if (prevDoc.exists()) {
                        val prevPart = prevDoc.toObject(SeasonParticipationV2::class.java)
                        if (prevPart != null) {
                            // Define a nova divisao baseada no Rating Final da temporada passada
                            startDivision = LeagueRatingCalculator.getDivisionForRating(prevPart.leagueRating)
                            AppLogger.d(TAG) { "Usuario $userId inicia a temporada $seasonId em $startDivision (Rating anterior: ${prevPart.leagueRating})" }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao calcular divisao inicial para $seasonId", e)
        }

        return SeasonParticipationV2(
            id = "${seasonId}_$userId",
            userId = userId,
            seasonId = seasonId,
            division = startDivision,
            recentGames = emptyList()
        )
    }

    private fun getNextDivision(current: LeagueDivision): LeagueDivision {
        return when (current) {
            LeagueDivision.BRONZE -> LeagueDivision.PRATA
            LeagueDivision.PRATA -> LeagueDivision.OURO
            LeagueDivision.OURO -> LeagueDivision.DIAMANTE
            LeagueDivision.DIAMANTE -> LeagueDivision.DIAMANTE
        }
    }

    private fun getPreviousDivision(current: LeagueDivision): LeagueDivision {
        return when (current) {
            LeagueDivision.BRONZE -> LeagueDivision.BRONZE
            LeagueDivision.PRATA -> LeagueDivision.BRONZE
            LeagueDivision.OURO -> LeagueDivision.PRATA
            LeagueDivision.DIAMANTE -> LeagueDivision.OURO
        }
    }
}
