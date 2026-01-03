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
        batch: com.google.firebase.firestore.WriteBatch,
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
            // Thresholds
            val nextTierThreshold = LeagueRatingCalculator.getNextDivisionThreshold(participation.division)
            val prevTierThreshold = LeagueRatingCalculator.getPreviousDivisionThreshold(participation.division)
            
            var currentProtection = participation.protectionGames
            var currentPromotionProgress = participation.promotionProgress
            var currentRelegationProgress = participation.relegationProgress
            
            val oldDivision = participation.division
            var promoted = false
            var relegated = false
            var newDivision = participation.division

            // Se estiver protegido, decrementa e nao altera progressos
            if (currentProtection > 0) {
                currentProtection--
                currentPromotionProgress = 0
                currentRelegationProgress = 0
            } else {
                // Checa Promocao
                if (newLeagueRating >= nextTierThreshold && participation.division != LeagueDivision.DIAMANTE) {
                    currentPromotionProgress++
                    currentRelegationProgress = 0 // Reseta o oposto
                    
                    if (currentPromotionProgress >= PROMOTION_GAMES_REQUIRED) {
                        promoted = true
                        currentPromotionProgress = 0
                        currentProtection = PROTECTION_GAMES
                        newDivision = getNextDivision(participation.division)
                    }
                } 
                // Checa Rebaixamento
                else if (newLeagueRating < prevTierThreshold && participation.division != LeagueDivision.BRONZE) {
                    currentRelegationProgress++
                    currentPromotionProgress = 0 // Reseta o oposto
                    
                    if (currentRelegationProgress >= RELEGATION_GAMES_REQUIRED) {
                        relegated = true
                        currentRelegationProgress = 0
                        currentProtection = PROTECTION_GAMES // Ganha protecao na nova (inferior) divisao? Discutivel. Por enquanto sim.
                        newDivision = getPreviousDivision(participation.division)
                    }
                } else {
                    // Mantem status quo mas pode resetar progressos se saiu da zona
                    // Opcional: Resetar se rating voltar ao normal?
                    // Por simplicidade: Se nao esta na zona de promocao, zera promocao.
                    if (newLeagueRating < nextTierThreshold) currentPromotionProgress = 0
                    if (newLeagueRating >= prevTierThreshold) currentRelegationProgress = 0
                }
            }
            
            // REGRA DE TEMPORADA: Se a regra for mudar apenas no fim da temporada,
            // nos sobrescrevemos newDivision aqui.
            // Porem, como o usuario pediu logica completa, vamos permitir a mudanca dinamica
            // OU manter a logica visual.
            // Para manter consistencia com "Season a Season", vamos comentar a atribuicao de newDivision real
            // mas manter os campos de progresso atualizados para feedback visual.
            
            // newDivision = oldDivision // DESCOMENTAR PARA TRAVAR A DIVISAO
            // Se mantivermos dinamico:
            if (promoted || relegated) {
                AppLogger.i(TAG) { "MUDANCA DE DIVISAO: $userId $oldDivision -> $newDivision" }
            }
            AppLogger.d(TAG) { "League Update: Jogador $userId em $oldDivision (Rating Atual: ${"%.1f".format(newLeagueRating)})" }

            // 5. Atualizar estatisticas
            val updatedParticipation = participation.copy(
                division = newDivision,
                promotionProgress = currentPromotionProgress,
                relegationProgress = currentRelegationProgress,
                protectionGames = currentProtection,
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
                recentGames = updatedRecentGames,
                lastCalculatedAt = Date()
            )

            // 6. Salvar (Adicionar ao Batch)
            batch.set(seasonParticipationCollection.document(docId), updatedParticipation, SetOptions.merge())

            AppLogger.d(TAG) { "Liga update agendado no batch: $userId LR=${"%.1f".format(newLeagueRating)} $oldDivision -> $newDivision" }

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
        var momentumGames = emptyList<RecentGameData>()

        // Tenta buscar QUALQUER historico anterior para definir a divisao inicial e momentum
        try {
             val allParticipations = seasonParticipationCollection
                .whereEqualTo("user_id", userId)
                .orderBy("last_calculated_at", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .limit(1)
                .get()
                .await()

             val lastParticipation = allParticipations.documents.firstOrNull()
                ?.toObject(SeasonParticipationV2::class.java)

             if (lastParticipation != null) {
                // Bug #2 Fix: Busca ultima participacao independente do mes
                startDivision = LeagueRatingCalculator.getDivisionForRating(lastParticipation.leagueRating)
                
                // Bug #3 Fix: Momentum - Carregar últimos jogos (max 5) para não zerar rating
                momentumGames = lastParticipation.recentGames.take(5)

                AppLogger.d(TAG) { 
                    "Usuario $userId inicia a temporada $seasonId em $startDivision (Rating anterior: ${lastParticipation.leagueRating}, Momentum: ${momentumGames.size} jogos)" 
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
            recentGames = momentumGames // Começa com histórico anterior (momentum)
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

