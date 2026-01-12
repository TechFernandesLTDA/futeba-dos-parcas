package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.PlayerRankingItem
import com.futebadosparcas.domain.model.RankingCategory
import com.futebadosparcas.domain.model.RankingPeriod
import com.futebadosparcas.domain.model.XpEvolution
import com.futebadosparcas.domain.model.XpHistoryEntry
import com.futebadosparcas.domain.model.XpLog

/**
 * Repositório para consultas de ranking e estatísticas.
 *
 * Responsável por:
 * - Buscar rankings por categoria e período
 * - Consultar posição de um usuário específico
 * - Recuperar histórico de XP e evolução
 * - Manter cache de usuários para performance
 *
 * Performance:
 * - Utiliza cache LRU para evitar queries N+1 ao Firestore
 * - Implementa batching paralelo para múltiplas buscas
 * - TTL de 5 minutos para cache de dados de usuário
 */
interface RankingRepository {

    /**
     * Busca ranking de uma categoria (all-time).
     *
     * @param category Categoria do ranking (GOALS, ASSISTS, SAVES, MVP, XP, GAMES, WINS)
     * @param limit Número máximo de resultados (padrão: 50)
     * @return Lista de jogadores ordenados por ranking
     */
    suspend fun getRanking(
        category: RankingCategory,
        limit: Int = 50
    ): Result<List<PlayerRankingItem>>

    /**
     * Busca ranking por período específico.
     *
     * Utiliza a coleção de deltas para calcular rankings temporais.
     * Filtra jogadores que não atingem o mínimo de jogos do período.
     *
     * @param category Categoria do ranking
     * @param period Período de tempo (WEEK, MONTH, YEAR, ALL_TIME)
     * @param limit Número máximo de resultados (padrão: 50)
     * @return Lista de jogadores filtrados por período
     */
    suspend fun getRankingByPeriod(
        category: RankingCategory,
        period: RankingPeriod,
        limit: Int = 50
    ): Result<List<PlayerRankingItem>>

    /**
     * Busca posição de um usuário em um ranking específico.
     *
     * @param userId ID do usuário
     * @param category Categoria do ranking
     * @param period Período de tempo (padrão: ALL_TIME)
     * @return Posição no ranking (1-based) ou 0 se não encontrado
     */
    suspend fun getUserPosition(
        userId: String,
        category: RankingCategory,
        period: RankingPeriod = RankingPeriod.ALL_TIME
    ): Result<Int>

    /**
     * Busca histórico de XP de um usuário.
     *
     * @param userId ID do usuário
     * @param limit Número máximo de registros (padrão: 30)
     * @return Lista de logs de XP ordenados por data (mais recente primeiro)
     */
    suspend fun getUserXpHistory(
        userId: String,
        limit: Int = 30
    ): Result<List<XpLog>>

    /**
     * Busca evolução de XP de um usuário para gráficos.
     *
     * @param userId ID do usuário
     * @param months Número de meses para buscar (padrão: 6)
     * @return Mapa com XP ganho por mês (formato: "MM/yyyy" -> XP)
     */
    suspend fun getXpEvolution(
        userId: String,
        months: Int = 6
    ): Result<XpEvolution>

    /**
     * Limpa o cache de usuários.
     *
     * Útil para forçar atualização após mudanças de perfil.
     */
    fun clearUserCache()

    /**
     * Invalida o cache de um usuário específico.
     *
     * @param userId ID do usuário a remover do cache
     */
    fun invalidateUserCache(userId: String)

    /**
     * Busca ranking top para múltiplas categorias.
     *
     * @param categories Lista de categorias
     * @param limit Número máximo por categoria (padrão: 10)
     * @return Mapa categoria -> lista de jogadores
     */
    suspend fun getTopRankings(
        categories: List<RankingCategory>,
        limit: Int = 10
    ): Result<Map<RankingCategory, List<PlayerRankingItem>>>

    /**
     * Busca dados agregados de ranking para o dashboard.
     *
     * Retorna os top 3 de cada categoria principal.
     *
     * @return Mapa com ranking de artilheiros, assistentes, defesas e MVPs
     */
    suspend fun getDashboardRankings(): Result<Map<RankingCategory, List<PlayerRankingItem>>>

    /**
     * Busca estatísticas comparativas entre usuários.
     *
     * @param userIds Lista de IDs de usuários para comparar
     * @return Mapa userId -> estatísticas completas
     */
    suspend fun getUsersRankingsComparison(
        userIds: List<String>
    ): Result<Map<String, PlayerRankingItem>>
}
