package com.futebadosparcas.domain.ranking

import com.futebadosparcas.domain.model.*
import com.futebadosparcas.domain.model.LeagueDivision as SharedLeagueDivision
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.tasks.await
import java.util.*

/**
 * Resultado da atualizacao de liga.
 */
data class LeagueUpdateResult(
    val userId: String,
    val oldDivision: SharedLeagueDivision,
    val newDivision: SharedLeagueDivision,
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
 *
 * NOTA: O calculador de League Rating foi movido para o shared module (KMP).
 * Este service converte entre os modelos Android e shared.
 */
class LeagueService constructor(
    private val firestore: FirebaseFirestore
) {
    companion object {
        private const val TAG = "LeagueService"
        private const val PROMOTION_GAMES_REQUIRED = 3
        private const val RELEGATION_GAMES_REQUIRED = 3
        private const val PROTECTION_GAMES = 5
        private const val MAX_RECENT_GAMES = 10

        /**
         * Converte LeagueDivision do Android para Shared.
         * Ambos usam os mesmos nomes em portugues.
         */
        fun toSharedDivision(division: com.futebadosparcas.data.model.LeagueDivision): SharedLeagueDivision {
            return when (division) {
                com.futebadosparcas.data.model.LeagueDivision.BRONZE -> SharedLeagueDivision.BRONZE
                com.futebadosparcas.data.model.LeagueDivision.PRATA -> SharedLeagueDivision.PRATA
                com.futebadosparcas.data.model.LeagueDivision.OURO -> SharedLeagueDivision.OURO
                com.futebadosparcas.data.model.LeagueDivision.DIAMANTE -> SharedLeagueDivision.DIAMANTE
            }
        }

        /**
         * Converte LeagueDivision do Shared para Android.
         * Ambos usam os mesmos nomes em portugues.
         */
        fun toAndroidDivision(division: SharedLeagueDivision): com.futebadosparcas.data.model.LeagueDivision {
            return when (division) {
                SharedLeagueDivision.BRONZE -> com.futebadosparcas.data.model.LeagueDivision.BRONZE
                SharedLeagueDivision.PRATA -> com.futebadosparcas.data.model.LeagueDivision.PRATA
                SharedLeagueDivision.OURO -> com.futebadosparcas.data.model.LeagueDivision.OURO
                SharedLeagueDivision.DIAMANTE -> com.futebadosparcas.data.model.LeagueDivision.DIAMANTE
            }
        }
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
                doc.toObject(SeasonParticipation::class.java) ?: createNewParticipation(userId, seasonId)
            } else {
                createNewParticipation(userId, seasonId)
            }

            // 2. Adicionar jogo recente
            // FIXME: recentGames nao existe no modelo KMP SeasonParticipation
            // Calculando league rating baseado apenas no rating atual + resultado do jogo
            val ratingChange = when {
                wasMvp -> 50
                won -> 20
                drew -> 5
                else -> -10
            }
            val newLeagueRating = (participation.leagueRating + ratingChange).toDouble()
            val suggestedDivision = com.futebadosparcas.domain.ranking.LeagueRatingCalculator.getDivisionForRating(newLeagueRating)

            // FIXME: protectionGames, promotionProgress, relegationProgress nao existem no SeasonParticipation
            // Simplificando: divisao baseada apenas no league rating atual
            val oldDivisionShared = LeagueDivision.fromString(participation.division)
            val newDivisionShared = com.futebadosparcas.domain.ranking.LeagueRatingCalculator.getDivisionForRating(newLeagueRating.toInt())

            val promoted = newDivisionShared.ordinal > oldDivisionShared.ordinal
            val relegated = newDivisionShared.ordinal < oldDivisionShared.ordinal

            val newDivision = newDivisionShared.name
            val oldDivision = participation.division

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
            // Nota: promotionProgress, relegationProgress, protectionGames, goalsScored/Conceded,
            // recentGames e lastCalculatedAt nao existem no modelo KMP SeasonParticipation.
            // Remover ou adicionar ao model se necessario.
            val updatedParticipation = participation.copy(
                division = newDivision,
                gamesPlayed = participation.gamesPlayed + 1,
                wins = participation.wins + if (won) 1 else 0,
                draws = participation.draws + if (drew) 1 else 0,
                losses = participation.losses + if (!won && !drew) 1 else 0,
                goals = participation.goals + maxOf(0, goalDiff),
                mvpCount = participation.mvpCount + if (wasMvp) 1 else 0,
                points = participation.points + when {
                    won -> 3
                    drew -> 1
                    else -> 0
                },
                leagueRating = newLeagueRating.toInt(),
                updatedAt = System.currentTimeMillis()
            )

            // 6. Salvar (Adicionar ao Batch)
            batch.set(seasonParticipationCollection.document(docId), updatedParticipation, SetOptions.merge())

            AppLogger.d(TAG) { "Liga update agendado no batch: $userId LR=${"%.1f".format(newLeagueRating)} $oldDivision -> $newDivision" }

            Result.success(
                LeagueUpdateResult(
                    userId = userId,
                    oldDivision = oldDivisionShared,
                    newDivision = newDivisionShared,
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
    suspend fun getParticipation(userId: String, seasonId: String): Result<SeasonParticipation?> {
        return try {
            val docId = "${seasonId}_$userId"
            val doc = seasonParticipationCollection.document(docId).get().await()

            val participation = if (doc.exists()) {
                doc.toObject(SeasonParticipation::class.java)
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
    suspend fun getLeagueRanking(seasonId: String, limit: Int = 50): Result<List<SeasonParticipation>> {
        return try {
            val snapshot = seasonParticipationCollection
                .whereEqualTo("season_id", seasonId)
                .orderBy("points", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val participations = snapshot.toObjects(SeasonParticipation::class.java)
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
        division: SharedLeagueDivision,
        limit: Int = 50
    ): Result<List<SeasonParticipation>> {
        return try {
            val androidDivision = toAndroidDivision(division)
            val snapshot = seasonParticipationCollection
                .whereEqualTo("season_id", seasonId)
                .whereEqualTo("division", androidDivision.name)
                .orderBy("league_rating", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val participations = snapshot.toObjects(SeasonParticipation::class.java)
            Result.success(participations)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogadores da divisao $division", e)
            Result.failure(e)
        }
    }

    private suspend fun createNewParticipation(userId: String, seasonId: String): SeasonParticipation {
        var startDivision = com.futebadosparcas.data.model.LeagueDivision.BRONZE
        var momentumGames = emptyList<SharedRecentGameData>()

        // Tenta buscar QUALQUER historico anterior para definir a divisao inicial e momentum
        try {
             val allParticipations = seasonParticipationCollection
                .whereEqualTo("user_id", userId)
                .orderBy("last_calculated_at", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .limit(1)
                .get()
                .await()

             val lastParticipation = allParticipations.documents.firstOrNull()
                ?.toObject(SeasonParticipation::class.java)

             if (lastParticipation != null) {
                // Bug #2 Fix: Busca ultima participacao independente do mes
                val sharedDivision = com.futebadosparcas.domain.ranking.LeagueRatingCalculator.getDivisionForRating(lastParticipation.leagueRating)
                startDivision = toAndroidDivision(sharedDivision)

                // Bug #3 Fix: Momentum - FIXME: recentGames nao existe no modelo KMP
                // momentumGames = lastParticipation.recentGames.take(5)

                AppLogger.d(TAG) {
                    "Usuario $userId inicia a temporada $seasonId em $startDivision (Rating anterior: ${lastParticipation.leagueRating})"
                }
             }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao calcular divisao inicial para $seasonId", e)
        }

        return SeasonParticipation(
            id = "${seasonId}_$userId",
            userId = userId,
            seasonId = seasonId,
            division = startDivision,
            leagueRating = 1000 // Rating inicial padrão
        )
    }
}
