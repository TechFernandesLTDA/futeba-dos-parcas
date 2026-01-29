package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import kotlinx.coroutines.flow.Flow

/**
 * Abstração multiplataforma para acesso ao Firebase.
 *
 * Usa expect/actual para permitir implementações específicas de plataforma:
 * - Android: Firebase Android SDK
 * - iOS: Firebase iOS SDK (CocoaPods)
 *
 * IMPORTANTE: Esta interface centraliza TODAS as operações Firebase,
 * permitindo:
 * - Mock em testes unitários
 * - Trocar backend (ex: Firebase → Supabase)
 * - Retry logic e tratamento de erros
 * - Migração incremental para KMP
 */
expect class FirebaseDataSource {

    // ========== GAMES ==========

    suspend fun getUpcomingGames(limit: Int = 50): Result<List<Game>>
    fun getUpcomingGamesFlow(limit: Int = 50): Flow<Result<List<Game>>>
    suspend fun getGameById(gameId: String): Result<Game>
    fun getGameByIdFlow(gameId: String): Flow<Result<Game>>
    suspend fun getConfirmedGamesForUser(userId: String): Result<List<Game>>
    suspend fun getGamesByGroup(groupId: String, limit: Int = 50): Result<List<Game>>
    suspend fun getPublicGames(limit: Int = 20): Result<List<Game>>
    suspend fun createGame(game: Game): Result<Game>
    suspend fun updateGame(gameId: String, updates: Map<String, Any>): Result<Unit>
    suspend fun deleteGame(gameId: String): Result<Unit>

    // ========== GAME CONFIRMATIONS ==========

    suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>>
    fun getGameConfirmationsFlow(gameId: String): Flow<Result<List<GameConfirmation>>>
    suspend fun confirmPresence(
        gameId: String,
        userId: String,
        userName: String,
        userPhoto: String?,
        position: String,
        isCasualPlayer: Boolean
    ): Result<GameConfirmation>
    suspend fun cancelConfirmation(gameId: String, userId: String): Result<Unit>
    suspend fun removePlayerFromGame(gameId: String, userId: String): Result<Unit>
    suspend fun updatePaymentStatus(
        gameId: String,
        userId: String,
        isPaid: Boolean
    ): Result<Unit>
    suspend fun summonPlayers(gameId: String, confirmations: List<GameConfirmation>): Result<Unit>
    suspend fun acceptInvitation(
        gameId: String,
        userId: String,
        position: String
    ): Result<GameConfirmation>
    suspend fun updateConfirmationStatus(
        gameId: String,
        userId: String,
        status: String
    ): Result<Unit>

    // ========== TEAMS ==========

    suspend fun getGameTeams(gameId: String): Result<List<Team>>
    fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>>
    suspend fun saveTeams(gameId: String, teams: List<Team>): Result<Unit>
    suspend fun clearGameTeams(gameId: String): Result<Unit>

    // ========== STATISTICS ==========

    suspend fun getUserStatistics(userId: String): Result<Statistics>
    fun getUserStatisticsFlow(userId: String): Flow<Result<Statistics>>
    suspend fun updateUserStatistics(userId: String, updates: Map<String, Any>): Result<Unit>

    // ========== USERS ==========

    suspend fun getUserById(userId: String): Result<User>
    suspend fun getUsersByIds(userIds: List<String>): Result<List<User>>
    suspend fun getCurrentUser(): Result<User>
    fun getCurrentUserId(): String?
    suspend fun updateUser(userId: String, updates: Map<String, Any>): Result<Unit>
    suspend fun searchUsers(query: String, limit: Int): Result<List<User>>
    suspend fun getAllUsers(): Result<List<User>>
    suspend fun updateUserRole(userId: String, newRole: String): Result<Unit>
    suspend fun updateAutoRatings(
        userId: String,
        autoStrikerRating: Double,
        autoMidRating: Double,
        autoDefenderRating: Double,
        autoGkRating: Double,
        autoRatingSamples: Int
    ): Result<Unit>

    // ========== GROUPS ==========

    suspend fun getUserGroups(userId: String): Result<List<UserGroup>>
    fun getUserGroupsFlow(userId: String): Flow<Result<List<UserGroup>>>
    suspend fun getGroupById(groupId: String): Result<UserGroup>

    // ========== XP LOGS ==========

    suspend fun getUserXpLogs(userId: String, limit: Int): Result<List<XpLog>>

    // ========== XP/GAMIFICATION ==========

    suspend fun createXpLog(xpLog: XpLog): Result<XpLog>
    suspend fun updateUserLevel(userId: String, level: Int, xp: Long): Result<Unit>
    suspend fun awardBadge(userId: String, badgeId: String): Result<Unit>
    suspend fun updateStreak(userId: String, streak: Int, lastGameDate: Long): Result<Unit>
    suspend fun unlockMilestone(userId: String, milestoneId: String): Result<Unit>

    // ========== LIVE GAME ==========

    suspend fun startLiveGame(gameId: String, team1Id: String, team2Id: String): Result<LiveScore>
    suspend fun canManageGameEvents(gameId: String): Boolean
    suspend fun updateScoreForGoal(gameId: String, teamId: String): Result<Unit>
    suspend fun updatePlayerStats(
        gameId: String,
        playerId: String,
        teamId: String,
        eventType: GameEventType,
        assistedById: String?
    ): Result<Unit>
    suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit>
    suspend fun getLivePlayerStats(gameId: String): Result<List<LivePlayerStats>>
    fun getLivePlayerStatsFlow(gameId: String): Flow<Result<List<LivePlayerStats>>>
    suspend fun finishGame(gameId: String): Result<Unit>
    suspend fun clearAllLiveGameData(): Result<Unit>

    // Métodos legados (para compatibilidade)
    suspend fun createLiveGame(gameId: String): Result<Unit>
    suspend fun updateLiveScore(gameId: String, team1Score: Int, team2Score: Int): Result<Unit>
    suspend fun addGameEvent(gameId: String, event: GameEvent): Result<GameEvent>
    suspend fun getGameEvents(gameId: String): Result<List<GameEvent>>
    fun getGameEventsFlow(gameId: String): Flow<Result<List<GameEvent>>>
    fun getLiveScoreFlow(gameId: String): Flow<Result<LiveScore>>

    // ========== GROUPS MANAGEMENT ==========

    suspend fun createGroup(group: Group): Result<Group>
    suspend fun updateGroup(groupId: String, updates: Map<String, Any>): Result<Unit>
    suspend fun getGroupMembers(groupId: String): Result<List<GroupMember>>
    fun getGroupMembersFlow(groupId: String): Flow<Result<List<GroupMember>>>
    suspend fun addGroupMember(groupId: String, userId: String, role: String): Result<Unit>
    suspend fun removeGroupMember(groupId: String, userId: String): Result<Unit>
    suspend fun getGroupDetails(groupId: String): Result<Group>
    fun getGroupDetailsFlow(groupId: String): Flow<Result<Group>>

    // ========== GROUPS AVANCED ==========

    suspend fun promoteGroupMemberToAdmin(groupId: String, memberId: String): Result<Unit>
    suspend fun demoteGroupAdminToMember(groupId: String, memberId: String): Result<Unit>
    suspend fun updateGroupMemberRole(groupId: String, userId: String, role: String): Result<Unit>
    suspend fun leaveGroup(groupId: String, userId: String): Result<Unit>
    suspend fun archiveGroup(groupId: String): Result<Unit>
    suspend fun restoreGroup(groupId: String): Result<Unit>
    suspend fun deleteGroup(groupId: String): Result<Unit>
    suspend fun transferGroupOwnership(groupId: String, newOwnerId: String, oldOwnerId: String, newOwnerName: String): Result<Unit>
    suspend fun syncGroupMemberCount(groupId: String, userIds: List<String>): Result<Unit>
    suspend fun joinGroupByInviteCode(inviteCode: String, userId: String, userName: String, userPhoto: String?): Result<String>
    suspend fun generateGroupInviteCode(groupId: String): Result<String>

    // ========== BATCH OPERATIONS ==========

    suspend fun executeBatch(operations: List<BatchOperation>): Result<Unit>

    // ========== PROFILE VISIBILITY ==========

    suspend fun updateProfileVisibility(userId: String, isSearchable: Boolean): Result<Unit>

    // ========== FIELD OWNERS ==========

    suspend fun getFieldOwners(): Result<List<User>>

    // ========== FCM TOKEN ==========

    suspend fun updateFcmToken(token: String): Result<Unit>

    // ========== AUTH ==========

    /**
     * Flow que emite o ID do usuário atual em tempo real.
     * Emite null quando não há usuário logado.
     */
    fun getAuthStateFlow(): Flow<String?>

    /**
     * Verifica se há um usuário autenticado.
     */
    fun isLoggedIn(): Boolean

    /**
     * Retorna o ID do usuário atual.
     */
    fun getCurrentAuthUserId(): String?

    /**
     * Busca os dados completos do usuário atual com retry logic.
     */
    suspend fun getCurrentAuthUser(): Result<User>

    /**
     * Realiza logout do usuário.
     */
    fun logout()

    // ========== LOCATIONS ==========

    suspend fun getAllLocations(): Result<List<Location>>
    suspend fun getLocationsWithPagination(limit: Int, lastLocationName: String?): Result<List<Location>>

    /**
     * Busca locais com paginação baseada em cursor de DocumentSnapshot.
     *
     * Usa cursor-based pagination com DocumentSnapshot.startAfter() para garantir
     * consistência mesmo quando documentos são adicionados/removidos entre páginas.
     *
     * @param pageSize Número máximo de locais por página (máximo 50)
     * @param cursor Cursor codificado da página anterior (null para primeira página)
     * @param sortBy Campo de ordenação
     * @return PaginatedResult com os locais, cursor para próxima página e flag hasMore
     */
    suspend fun getLocationsPaginated(
        pageSize: Int,
        cursor: String?,
        sortBy: LocationSortField
    ): Result<PaginatedResult<Location>>
    suspend fun deleteLocation(locationId: String): Result<Unit>
    suspend fun getLocationsByOwner(ownerId: String): Result<List<Location>>
    suspend fun getLocationById(locationId: String): Result<Location>
    suspend fun getLocationWithFields(locationId: String): Result<LocationWithFields>
    suspend fun createLocation(location: Location): Result<Location>
    suspend fun updateLocation(location: Location): Result<Unit>
    suspend fun searchLocations(query: String): Result<List<Location>>
    suspend fun getOrCreateLocationFromPlace(
        placeId: String,
        name: String,
        address: String,
        city: String,
        state: String,
        latitude: Double?,
        longitude: Double?
    ): Result<Location>
    suspend fun addLocationReview(review: LocationReview): Result<Unit>
    suspend fun getLocationReviews(locationId: String): Result<List<LocationReview>>
    suspend fun seedGinasioApollo(): Result<Location>
    suspend fun migrateLocations(migrationData: List<LocationMigrationData>): Result<Int>
    suspend fun deduplicateLocations(): Result<Int>

    /**
     * Deleta um local e todas as suas quadras em uma operação atômica usando batch.
     *
     * Esta operação:
     * 1. Busca todas as quadras do local
     * 2. Cria um batch com operações de delete para o local e todas as quadras
     * 3. Se houver mais de 499 quadras, divide em múltiplos batches (limite Firestore: 500 ops/batch)
     * 4. Executa os batches em sequência
     *
     * @param locationId ID do local a ser deletado
     * @return Result<Int> com o número total de documentos deletados (location + fields)
     *         ou Result.failure com:
     *         - LocationNotFoundException se o local não existir
     *         - PartialDeleteException se alguns campos foram deletados mas outros não
     *         - Exception genérica para erros de rede
     */
    suspend fun deleteLocationWithFields(locationId: String): Result<Int>

    // ========== FIELDS ==========

    suspend fun getFieldsByLocation(locationId: String): Result<List<Field>>
    suspend fun getFieldById(fieldId: String): Result<Field>
    suspend fun createField(field: Field): Result<Field>
    suspend fun updateField(field: Field): Result<Unit>
    suspend fun deleteField(fieldId: String): Result<Unit>
    suspend fun uploadFieldPhoto(filePath: String): Result<String>

    // ========== PAYMENTS ==========

    /**
     * Cria um novo pagamento.
     */
    suspend fun createPayment(payment: Payment): Result<Payment>

    /**
     * Confirma um pagamento (marca como pago).
     */
    suspend fun confirmPayment(paymentId: String): Result<Unit>

    /**
     * Busca pagamentos de um usuário.
     */
    suspend fun getPaymentsByUser(userId: String): Result<List<Payment>>

    // ========== CASHBOX ==========

    /**
     * Faz upload do comprovante de pagamento para o Storage.
     * @param groupId ID do grupo
     * @param filePath Caminho local do arquivo
     * @return URL de download do arquivo
     */
    suspend fun uploadCashboxReceipt(groupId: String, filePath: String): Result<String>

    /**
     * Adiciona uma entrada no caixa.
     * @param groupId ID do grupo
     * @param entry Dados da entrada
     * @param receiptFilePath Caminho local do comprovante (opcional)
     * @return ID da entrada criada
     */
    suspend fun addCashboxEntry(
        groupId: String,
        entry: CashboxEntry,
        receiptFilePath: String? = null
    ): Result<String>

    /**
     * Busca o resumo do caixa de um grupo.
     */
    suspend fun getCashboxSummary(groupId: String): Result<CashboxSummary>

    /**
     * Flow que observa o resumo do caixa em tempo real.
     */
    fun getCashboxSummaryFlow(groupId: String): Flow<Result<CashboxSummary>>

    /**
     * Busca histórico do caixa.
     */
    suspend fun getCashboxHistory(groupId: String, limit: Int): Result<List<CashboxEntry>>

    /**
     * Flow que observa histórico do caixa em tempo real.
     */
    fun getCashboxHistoryFlow(groupId: String, limit: Int): Flow<Result<List<CashboxEntry>>>

    /**
     * Busca histórico com filtros.
     */
    suspend fun getCashboxHistoryFiltered(
        groupId: String,
        filter: CashboxFilter,
        limit: Int
    ): Result<List<CashboxEntry>>

    /**
     * Busca entradas por mês.
     */
    suspend fun getCashboxEntriesByMonth(
        groupId: String,
        year: Int,
        month: Int
    ): Result<List<CashboxEntry>>

    /**
     * Busca uma entrada específica por ID.
     */
    suspend fun getCashboxEntryById(groupId: String, entryId: String): Result<CashboxEntry>

    /**
     * Deleta uma entrada (soft delete com recálculo do saldo).
     */
    suspend fun deleteCashboxEntry(groupId: String, entryId: String): Result<Unit>

    /**
     * Recalcula o saldo do caixa (para correção).
     */
    suspend fun recalculateCashboxBalance(groupId: String): Result<CashboxSummary>

    // ========== GAMIFICATION - STREAKS ==========

    /**
     * Busca o streak atual do usuário.
     */
    suspend fun getUserStreak(userId: String): Result<UserStreak?>

    /**
     * Salva ou atualiza o streak do usuário.
     */
    suspend fun saveUserStreak(streak: UserStreak): Result<Unit>

    // ========== GAMIFICATION - BADGES ==========

    /**
     * Busca todos os badges disponíveis no sistema.
     */
    suspend fun getAvailableBadges(): Result<List<BadgeDefinition>>

    /**
     * Busca todos os badges do usuário.
     */
    suspend fun getUserBadges(userId: String): Result<List<UserBadge>>

    /**
     * Busca os badges mais recentes do usuário.
     */
    suspend fun getRecentBadges(userId: String, limit: Int = 5): Result<List<UserBadge>>

    /**
     * Cria um novo badge para o usuário.
     */
    suspend fun createUserBadge(userBadge: UserBadge): Result<UserBadge>

    /**
     * Atualiza um badge existente do usuário.
     */
    suspend fun updateUserBadge(userBadge: UserBadge): Result<Unit>

    // ========== GAMIFICATION - SEASONS ==========

    /**
     * Busca a temporada ativa.
     */
    suspend fun getActiveSeason(): Result<Season?>

    /**
     * Busca todas as temporadas.
     */
    suspend fun getAllSeasons(): Result<List<Season>>

    /**
     * Busca ranking da temporada.
     */
    suspend fun getSeasonRanking(seasonId: String, limit: Int = 50): Result<List<SeasonParticipation>>

    /**
     * Flow que observa o ranking da temporada em tempo real.
     */
    fun observeSeasonRanking(seasonId: String, limit: Int = 50): Flow<List<SeasonParticipation>>

    /**
     * Busca participação de um usuário em uma temporada.
     */
    suspend fun getSeasonParticipation(seasonId: String, userId: String): Result<SeasonParticipation?>

    /**
     * Salva ou atualiza participação na temporada.
     */
    suspend fun saveSeasonParticipation(participation: SeasonParticipation): Result<Unit>

    // ========== GAMIFICATION - CHALLENGES ==========

    /**
     * Busca os desafios ativos no momento.
     */
    suspend fun getActiveChallenges(): Result<List<WeeklyChallenge>>

    /**
     * Busca o progresso do usuário em múltiplos desafios.
     */
    suspend fun getChallengesProgress(userId: String, challengeIds: List<String>): Result<List<UserChallengeProgress>>

    // ========== RANKINGS ==========

    /**
     * Busca ranking por categoria (all-time).
     *
     * @param category Categoria do ranking (GOALS, ASSISTS, SAVES, MVP, XP, GAMES, WINS)
     * @param field Campo no Firestore para ordenar
     * @param limit Número máximo de resultados
     * @return Lista de tuplas (userId, valor, jogos)
     */
    suspend fun getRankingByCategory(
        category: String,
        field: String,
        limit: Int
    ): Result<List<Triple<String, Long, Int>>>

    /**
     * Busca ranking por período usando deltas.
     *
     * @param periodName Nome do período (week, month, year)
     * @param periodKey Chave do período (2025-W02, 2025-01, 2025)
     * @param deltaField Campo delta (goals_added, assists_added, etc)
     * @param minGames Mínimo de jogos para filtrar
     * @param limit Número máximo de resultados
     * @return Lista de tuplas (userId, valor delta, jogos adicionados)
     */
    suspend fun getRankingDeltas(
        periodName: String,
        periodKey: String,
        deltaField: String,
        minGames: Int,
        limit: Int
    ): Result<List<Triple<String, Long, Int>>>

    /**
     * Busca estatísticas de múltiplos usuários em batch.
     *
     * @param userIds Lista de IDs de usuários
     * @return Mapa userId -> Statistics
     */
    suspend fun getUsersStatistics(userIds: List<String>): Result<Map<String, Statistics>>

    // ========== NOTIFICATIONS ==========

    /**
     * Busca todas as notificações do usuário atual.
     *
     * @param limit Número máximo de notificações (padrão 50)
     * @return Lista de notificações ordenada por data (mais recentes primeiro)
     */
    suspend fun getMyNotifications(limit: Int = 50): Result<List<AppNotification>>

    /**
     * Observa notificações do usuário em tempo real.
     *
     * @param limit Número máximo de notificações (padrão 50)
     * @return Flow que emite a lista de notificações atualizada
     */
    fun getMyNotificationsFlow(limit: Int = 50): Flow<List<AppNotification>>

    /**
     * Busca apenas notificações não lidas do usuário atual.
     *
     * @return Lista de notificações não lidas
     */
    suspend fun getUnreadNotifications(): Result<List<AppNotification>>

    /**
     * Observa contagem de notificações não lidas em tempo real.
     *
     * @return Flow que emite o número de notificações não lidas
     */
    fun getUnreadCountFlow(): Flow<Int>

    /**
     * Conta notificações não lidas do usuário atual.
     *
     * @return Número de notificações não lidas
     */
    suspend fun getUnreadCount(): Result<Int>

    /**
     * Marca uma notificação como lida.
     *
     * @param notificationId ID da notificação
     * @return Result<Void> indicando sucesso ou falha
     */
    suspend fun markNotificationAsRead(notificationId: String): Result<Unit>

    /**
     * Marca uma notificação como não lida.
     *
     * @param notificationId ID da notificação
     * @return Result<Unit> indicando sucesso ou falha
     */
    suspend fun markNotificationAsUnread(notificationId: String): Result<Unit>

    /**
     * Marca todas as notificações do usuário como lidas.
     *
     * @return Result<Void> indicando sucesso ou falha
     */
    suspend fun markAllNotificationsAsRead(): Result<Unit>

    /**
     * Busca uma notificação específica por ID.
     *
     * @param notificationId ID da notificação
     * @return Notificação encontrada ou erro
     */
    suspend fun getNotificationById(notificationId: String): Result<AppNotification>

    /**
     * Cria uma nova notificação.
     *
     * @param notification Dados da notificação (id pode ser vazio para auto-gerar)
     * @return ID da notificação criada
     */
    suspend fun createNotification(notification: AppNotification): Result<String>

    /**
     * Cria múltiplas notificações em lote.
     *
     * @param notifications Lista de notificações (ids podem ser vazios para auto-gerar)
     * @return Result<Void> indicando sucesso ou falha
     */
    suspend fun batchCreateNotifications(notifications: List<AppNotification>): Result<Unit>

    /**
     * Deleta uma notificação.
     *
     * @param notificationId ID da notificação
     * @return Result<Void> indicando sucesso ou falha
     */
    suspend fun deleteNotification(notificationId: String): Result<Unit>

    /**
     * Deleta notificações antigas (mais de 30 dias) ou com data nula/ausente.
     *
     * @return Número de notificações deletadas
     */
    suspend fun deleteOldNotifications(): Result<Int>

    /**
     * Busca notificações por tipo.
     *
     * @param type Tipo de notificação
     * @param limit Número máximo de notificações (padrão 20)
     * @return Lista de notificações do tipo especificado
     */
    suspend fun getNotificationsByType(type: NotificationType, limit: Int = 20): Result<List<AppNotification>>

    /**
     * Busca notificações com ação pendente (convites, convocações).
     *
     * Filtra não lidas que requerem resposta e não estão expiradas.
     *
     * @return Lista de notificações com ação pendente
     */
    suspend fun getPendingActionNotifications(): Result<List<AppNotification>>

    // ========== LOCATION AUDIT LOGS ==========

    /**
     * Registra uma entrada de log de auditoria para alteracoes em locais.
     *
     * Armazena em: locations/{locationId}/audit_logs/{logId}
     *
     * @param log Dados do log de auditoria
     * @return Result<Unit> indicando sucesso ou falha
     */
    suspend fun logLocationAudit(log: LocationAuditLog): Result<Unit>

    /**
     * Busca os logs de auditoria de um local.
     *
     * @param locationId ID do local
     * @param limit Numero maximo de logs (padrao 30)
     * @return Lista de logs ordenada por timestamp (mais recentes primeiro)
     */
    suspend fun getLocationAuditLogs(locationId: String, limit: Int = 30): Result<List<LocationAuditLog>>
}

/**
 * Operação de batch write para Firebase.
 *
 * Permite agrupar múltiplas operações em uma única transação atômica.
 */
sealed class BatchOperation {
    data class Set(
        val collection: String,
        val documentId: String,
        val data: Map<String, Any>
    ) : BatchOperation()

    data class Update(
        val collection: String,
        val documentId: String,
        val updates: Map<String, Any>
    ) : BatchOperation()

    data class Delete(
        val collection: String,
        val documentId: String
    ) : BatchOperation()
}
