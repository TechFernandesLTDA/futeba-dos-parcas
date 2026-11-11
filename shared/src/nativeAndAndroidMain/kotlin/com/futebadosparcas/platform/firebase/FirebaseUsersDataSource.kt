package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import com.futebadosparcas.platform.UuidGenerator
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.auth.FirebaseAuth
import dev.gitlive.firebase.auth.auth
import dev.gitlive.firebase.firestore.*
import dev.gitlive.firebase.functions.FirebaseFunctionsException
import dev.gitlive.firebase.functions.code
import dev.gitlive.firebase.functions.functions
import dev.gitlive.firebase.storage.FirebaseStorage
import dev.gitlive.firebase.storage.storage
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.datetime.Clock
import kotlinx.serialization.json.*
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi
import kotlin.time.Duration.Companion.seconds

internal class FirebaseUsersDataSource(
    private val firestore: FirebaseFirestore = Firebase.firestore,
    private val auth: FirebaseAuth = Firebase.auth,
    private val storage: FirebaseStorage = Firebase.storage
) {
    companion object {
        private val exportJson = Json { prettyPrint = true }

        internal fun exportPayloadFromCallableData(data: Any?): ExportMyDataPayload {
            val complete = when (data) {
                is JsonObject -> (data["complete"] as? JsonPrimitive)?.content != "false"
                is Map<*, *> -> data["complete"] != false
                else -> true
            }
            val json = exportJson.encodeToString(JsonElement.serializer(), toExportJsonElement(data))
            return ExportMyDataPayload(json = json, complete = complete)
        }

        private fun toExportJsonElement(value: Any?): JsonElement = when (value) {
            null -> JsonNull
            is JsonElement -> value
            is String -> JsonPrimitive(value)
            is Boolean -> JsonPrimitive(value)
            is Number -> JsonPrimitive(value)
            is Map<*, *> -> JsonObject(
                value.entries.associate { (key, item) -> key.toString() to toExportJsonElement(item) }
            )
            is Iterable<*> -> JsonArray(value.map { toExportJsonElement(it) })
            is Array<*> -> JsonArray(value.map { toExportJsonElement(it) })
            else -> JsonPrimitive(value.toString())
        }
    }

    // ========== MODERATION (BLOCK & REPORT — #4423) ==========

    suspend fun blockUserOnServer(
        userId: String,
        targetUserId: String,
        userName: String,
        reason: String
    ): Result<Unit> {
        return try {
            if (userId.isBlank() || targetUserId.isBlank() || userId == targetUserId) {
                return Result.failure(IllegalArgumentException("IDs inválidos para bloqueio"))
            }
            // Caminho canônico autorizado em firestore.rules: users/{userId}/blocked/{targetUserId}
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .collection("blocked")
                .document(targetUserId)
                .set(
                    mapOf(
                        "target_user_id" to targetUserId,
                        "created_at" to FieldValue.serverTimestamp
                    )
                )
            // Caminho espelho opcional users/{userId}/blocked_users/{targetUserId} (best-effort)
            runCatching {
                firestore.collection(COLLECTION_USERS)
                    .document(userId)
                    .collection("blocked_users")
                    .document(targetUserId)
                    .set(
                        mapOf(
                            "target_user_id" to targetUserId,
                            "user_name" to userName,
                            "reason" to reason,
                            "created_at" to FieldValue.serverTimestamp
                        )
                    )
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun unblockUserOnServer(userId: String, targetUserId: String): Result<Unit> {
        return try {
            if (userId.isBlank() || targetUserId.isBlank()) {
                return Result.failure(IllegalArgumentException("IDs inválidos para desbloqueio"))
            }
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .collection("blocked")
                .document(targetUserId)
                .delete()
            runCatching {
                firestore.collection(COLLECTION_USERS)
                    .document(userId)
                    .collection("blocked_users")
                    .document(targetUserId)
                    .delete()
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun submitPlayerReport(
        reporterId: String,
        targetUserId: String,
        targetUserName: String,
        reason: String,
        gameId: String?,
        groupId: String?
    ): Result<Unit> {
        return try {
            val normalizedReason = when (reason.trim().lowercase()) {
                "inappropriate_content", "abusive_language", "spam", "harassment", "other" -> reason.trim().lowercase()
                else -> "harassment"
            }
            // 1. Gravação em abuse_reports (coleção de denúncias; só o autor cria, ninguém lê pelo cliente)
            val reportWrites = mutableListOf<Result<Unit>>()
            reportWrites += submitContentReport(
                reporterId = reporterId,
                targetType = "player",
                targetId = targetUserId,
                targetName = targetUserName,
                reason = normalizedReason,
                gameId = gameId,
                groupId = groupId
            )
            // 2. Fallback via callable submitContentReport quando vinculado a jogo/grupo
            if (reportWrites.none { it.isSuccess } && !gameId.isNullOrBlank()) {
                reportWrites += runCatching {
                    Firebase.functions(FUNCTIONS_REGION)
                        .httpsCallable("submitContentReport")
                        .invoke(
                            mapOf(
                                "targetType" to "game_comment",
                                "gameId" to gameId,
                                "targetId" to targetUserId,
                                "reason" to normalizedReason
                            )
                        )
                    Unit
                }
            }
            // A denúncia só conta como enviada se a gravação (ou o fallback) deu certo:
            // o bloqueio abaixo não substitui o registro para a moderação.
            val reportSent = reportWrites.any { it.isSuccess }
            // 3. Garante bloqueio preventivo no servidor (Guideline 1.2 App Store:
            // denunciar jogador também pode isolar o contato imediatamente)
            if (reporterId.isNotBlank() && targetUserId.isNotBlank() && reporterId != targetUserId) {
                blockUserOnServer(
                    userId = reporterId,
                    targetUserId = targetUserId,
                    userName = targetUserName,
                    reason = reason
                )
            }
            if (reportSent) {
                Result.success(Unit)
            } else {
                reportWrites.firstOrNull() ?: Result.failure(Exception("Falha ao registrar denúncia"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }


    /**
     * Grava uma denúncia de jogador ou de grupo em `abuse_reports` (diretriz 1.2 da App Store).
     * As regras do Firestore só deixam o autor criar (reporter_id == uid) e ninguém ler ou
     * alterar pelo cliente; a moderação lê pelo servidor.
     */
    suspend fun submitContentReport(
        reporterId: String,
        targetType: String,
        targetId: String,
        targetName: String,
        reason: String,
        gameId: String? = null,
        groupId: String? = null
    ): Result<Unit> {
        return try {
            if (reporterId.isBlank() || targetId.isBlank()) {
                return Result.failure(IllegalArgumentException("IDs inválidos para denúncia"))
            }
            val payload = mutableMapOf<String, Any>(
                "reporter_id" to reporterId,
                "target_type" to targetType,
                "target_id" to targetId,
                "target_name" to targetName.trim().take(120),
                "reason" to reason,
                "status" to "OPEN",
                "created_at" to FieldValue.serverTimestamp
            )
            if (!gameId.isNullOrBlank()) payload["game_id"] = gameId
            if (!groupId.isNullOrBlank()) payload["group_id"] = groupId
            firestore.collection("abuse_reports").document.set(payload)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== ACTIVITIES ==========

    /**
     * Busca atividades recentes do feed público.
     */
    suspend fun getRecentActivities(limit: Int): Result<List<Activity>> {
        return try {
            val snapshot = firestore.collection("activities")
                .where { "visibility" equalTo "PUBLIC" }
                .orderBy("created_at", Direction.DESCENDING)
                .limit(limit)
                .get()

            Result.success(snapshot.documents.mapNotNull { it.toActivityOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Flow de atividades recentes em tempo real.
     */
    fun getRecentActivitiesFlow(limit: Int): Flow<Result<List<Activity>>> {
        return firestore.collection("activities")
            .where { "visibility" equalTo "PUBLIC" }
            .orderBy("created_at", Direction.DESCENDING)
            .limit(limit)
            .snapshots()
            .map { snapshot -> Result.success(snapshot.documents.mapNotNull { it.toActivityOrNull() }) }
            .catch { e -> emit(Result.failure(e)) }
    }

    /**
     * Cria uma nova atividade.
     */
    suspend fun createActivity(activity: Activity): Result<Unit> {
        return try {
            firestore.collection("activities").add(activityToMap(activity))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca atividades de um usuário específico.
     */
    suspend fun getUserActivities(userId: String, limit: Int): Result<List<Activity>> {
        return try {
            val snapshot = firestore.collection("activities")
                .where { "user_id" equalTo userId }
                .orderBy("created_at", Direction.DESCENDING)
                .limit(limit)
                .get()

            Result.success(snapshot.documents.mapNotNull { it.toActivityOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== STATISTICS ==========

    suspend fun getUserStatistics(userId: String): Result<Statistics> {
        return try {
            val doc = firestore.collection(COLLECTION_STATISTICS)
                .document(userId)
                .get()

            val stats = doc.toStatisticsOrNull() ?: Statistics(userId = userId)
            Result.success(stats)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun getUserStatisticsFlow(userId: String): Flow<Result<Statistics>> {
        return firestore.collection(COLLECTION_STATISTICS)
            .document(userId)
            .snapshots()
            .map { snapshot ->
                val stats = snapshot.toStatisticsOrNull() ?: Statistics(userId = userId)
                Result.success(stats)
            }
            .catch { e -> emit(Result.failure(e)) }
    }

    suspend fun updateUserStatistics(userId: String, updates: Map<String, Any>): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_STATISTICS)
                .document(userId)
                .update(updates)
            Result.success(Unit)
        } catch (e: Exception) {
            // Se o documento não existir, criar com as atualizações
            try {
                firestore.collection(COLLECTION_STATISTICS)
                    .document(userId)
                    .set(updates, merge = true)
                Result.success(Unit)
            } catch (innerE: Exception) {
                Result.failure(innerE)
            }
        }
    }

    // ========== USERS ==========

    suspend fun getUserById(userId: String): Result<User> {
        return try {
            val doc = firestore.collection(COLLECTION_USERS)
                .document(userId)
                .get()

            val user = doc.toUserOrNull()
                ?: return Result.failure(Exception("Usuário não encontrado"))

            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getUsersByIds(userIds: List<String>): Result<List<User>> {
        return try {
            if (userIds.isEmpty()) return Result.success(emptyList())

            val chunks = userIds.chunked(10)
            val allUsers = mutableListOf<User>()

            for (chunk in chunks) {
                val snapshot = firestore.collection(COLLECTION_USERS)
                    .where { FieldPath.documentId inArray chunk }
                    .get()
                allUsers.addAll(snapshot.documents.mapNotNull { doc -> doc.toUserOrNull() })
            }

            Result.success(allUsers)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getCurrentUser(): Result<User> {
        val uid = auth.currentUser?.uid
            ?: return Result.failure(Exception("Usuário não autenticado"))

        println("FirebaseDataSource: getCurrentUser: buscando para uid=$uid")

        // SECFIX #433 STAGE 2: merge PII de users_private quando próprio user.
        // Stage 1 (PR #482) já popula users_private via triggers + backfill.
        // Backward compat: se users_private vazio/inacessível, fallback pra
        // PII em users (Stage 3 vai remover de users e isolar em users_private).
        val publicResult = getUserById(uid)
        val publicUser = publicResult.getOrNull() ?: return publicResult

        return try {
            val privateDoc = firestore.collection("users_private")
                .document(uid)
                .get()

            val mergedUser = if (privateDoc.exists) {
                publicUser.copy(
                    email = privateDoc.get<String?>("email") ?: publicUser.email,
                    fcmToken = privateDoc.get<String?>("fcm_token")
                        ?: publicUser.fcmToken,
                    birthDate = (privateDoc.get<Long?>("birth_date"))
                        ?: publicUser.birthDate,
                    heightCm = (privateDoc.get<Long?>("height_cm"))?.toInt()
                        ?: publicUser.heightCm,
                    weightKg = (privateDoc.get<Long?>("weight_kg"))?.toInt()
                        ?: publicUser.weightKg,
                    gender = privateDoc.get<String?>("gender")
                        ?: publicUser.gender,
                )
            } else {
                publicUser
            }

            println(
                "FirebaseDataSource: getCurrentUser: carregado " +
                    "${mergedUser.name}, Level=${mergedUser.level}, " +
                    "PII source=${if (privateDoc.exists) "users_private" else "users (fallback)"}"
            )
            Result.success(mergedUser)
        } catch (e: Exception) {
            // Falha lendo users_private → fallback pra user de users (sem merge)
            println(
                "FirebaseDataSource: getCurrentUser: users_private read failed, " +
                    "fallback to users PII: ${e.message}"
            )
            Result.success(publicUser)
        }
    }

    fun getCurrentUserId(): String? {
        return auth.currentUser?.uid
    }

    suspend fun updateUser(userId: String, updates: Map<String, Any>): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update(updates)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * FIX #578 STAGE 2: chama callable Cloud Function `updateUserPii` (us-central1)
     * pra escrever PII em users_private/{auth.uid}. Owner-only — Cloud Function
     * deduz target user via auth context (não aceita userId no payload).
     *
     * Valida server-side: subset de PII fields (email, fcm_token, birth_date,
     * height_cm, weight_kg, gender) com type checks.
     */
    suspend fun updateUserPiiViaCallable(updates: Map<String, Any>): Result<Unit> {
        return try {
            val functions = Firebase.functions(FUNCTIONS_REGION)
            functions.httpsCallable("updateUserPii")
                .invoke(updates)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteAccount(): Result<Unit> {
        return try {
            Firebase.functions(FUNCTIONS_REGION)
                .httpsCallable("deleteAccount")
                .invoke()
            Result.success(Unit)
        } catch (e: FirebaseFunctionsException) {
            // "NOT_FOUND" -> "not-found": mesmo formato do código no protocolo das callables.
            Result.failure(
                CallableException(
                    code = e.code.name.lowercase().replace('_', '-'),
                    message = e.message,
                    cause = e,
                    // #4440: details.reason/groups distinguem os dois failed-precondition.
                    reason = CallableException.reasonFromDetails(e.details),
                    groups = CallableException.groupsFromDetails(e.details)
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun exportMyData(): Result<ExportMyDataPayload> {
        return try {
            val response = Firebase.functions(FUNCTIONS_REGION)
                .httpsCallable("exportMyData", timeout = EXPORT_MY_DATA_TIMEOUT_SECONDS.seconds)
                .invoke()
                .data<JsonElement>()
            Result.success(exportPayloadFromCallableData(response))
        } catch (e: FirebaseFunctionsException) {
            Result.failure(
                CallableException(
                    code = e.code.name.lowercase().replace('_', '-'),
                    message = e.message,
                    cause = e,
                    reason = CallableException.reasonFromDetails(e.details),
                    groups = CallableException.groupsFromDetails(e.details)
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun registerPushToken(registration: PushTokenRegistration): Result<Unit> {
        return try {
            Firebase.functions(FUNCTIONS_REGION)
                .httpsCallable("registerPushToken")
                .invoke(registration.toPayload())
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun unregisterPushToken(deviceId: String, sequence: Long, token: String? = null): Result<Unit> {
        return try {
            require(sequence > 0) { "Sequência da instalação inválida" }
            val payload = mutableMapOf<String, Any>(
                "deviceId" to deviceId.trim(),
                "sequence" to sequence
            )
            token?.trim()?.takeIf { it.isNotEmpty() }?.let { payload["token"] = it }
            Firebase.functions(FUNCTIONS_REGION)
                .httpsCallable("unregisterPushToken")
                .invoke(payload)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun submitMvpVoteViaCallable(vote: MVPVote): Result<Unit> {
        return try {
            if (vote.category == VoteCategory.CUSTOM) {
                return Result.failure(Exception("Categoria de voto não suportada pelo servidor"))
            }

            val functions = Firebase.functions(FUNCTIONS_REGION)
            functions.httpsCallable("submitMvpVote")
                .invoke(
                    mapOf(
                        "gameId" to vote.gameId,
                        "votedPlayerId" to vote.votedPlayerId,
                        "category" to vote.category.name
                    )
                )
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun concludeMvpVotingViaCallable(gameId: String): Result<Unit> {
        return try {
            val functions = Firebase.functions(FUNCTIONS_REGION)
            functions.httpsCallable("concludeMvpVoting")
                .invoke(mapOf("gameId" to gameId))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun startGameLifecycleViaCallable(gameId: String): Result<Unit> {
        return try {
            val functions = Firebase.functions(FUNCTIONS_REGION)
            functions.httpsCallable("startGameLifecycle")
                .invoke(mapOf("gameId" to gameId))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun finishGameLifecycleViaCallable(gameId: String): Result<Unit> {
        return try {
            val functions = Firebase.functions(FUNCTIONS_REGION)
            functions.httpsCallable("finishGameLifecycle")
                .invoke(mapOf("gameId" to gameId))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun searchUsers(query: String, limit: Int): Result<List<User>> {
        println("FirebaseDataSource: searchUsers called with query='$query', limit=$limit")
        return try {
            val collection = firestore.collection(COLLECTION_USERS)

            val snapshot = if (query.isBlank()) {
                collection
                    .limit(limit)
                    .get()
            } else {
                collection
                    .orderBy("name")
                    .startAt(query)
                    .endAt(query + "\uf8ff")
                    .limit(limit)
                    .get()
            }

            println("FirebaseDataSource: searchUsers query success. Documents found: ${snapshot.documents.size}")

            val users = snapshot.documents.mapNotNull {
                val user = it.toUserOrNull()
                if (user == null) {
                    println("FirebaseDataSource: Falha ao mapear documento ${it.id} para User")
                }
                user
            }

            println("FirebaseDataSource: searchUsers mapeou ${users.size} usuários com sucesso")

            Result.success(users)
        } catch (e: Exception) {
            println("FirebaseDataSource: searchUsers falhou: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun getAllUsers(): Result<List<User>> {
        return try {
            // OTIMIZAÇÃO: Limitado a 100 usuários para evitar carregar toda a coleção
            val snapshot = firestore.collection(COLLECTION_USERS)
                .orderBy("name")
                .limit(100)
                .get()

            val users = snapshot.documents.mapNotNull { it.toUserOrNull() }
            Result.success(users)
        } catch (e: Exception) {
            println("FirebaseDataSource: getAllUsers falhou: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun updateUserRole(userId: String, newRole: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update(mapOf("role" to newRole))
            Result.success(Unit)
        } catch (e: Exception) {
            println("FirebaseDataSource: updateUserRole falhou: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun updateAutoRatings(
        userId: String,
        autoStrikerRating: Double,
        autoMidRating: Double,
        autoDefenderRating: Double,
        autoGkRating: Double,
        autoRatingSamples: Int
    ): Result<Unit> {
        return try {
            val updates = mapOf(
                "auto_striker_rating" to autoStrikerRating,
                "auto_mid_rating" to autoMidRating,
                "auto_defender_rating" to autoDefenderRating,
                "auto_gk_rating" to autoGkRating,
                "auto_rating_samples" to autoRatingSamples,
                "auto_rating_updated_at" to FieldValue.serverTimestamp
            )
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update(updates)
            Result.success(Unit)
        } catch (e: Exception) {
            println("FirebaseDataSource: updateAutoRatings falhou: ${e.message}")
            Result.failure(e)
        }
    }

    // ========== PROFILE VISIBILITY ==========

    suspend fun updateProfileVisibility(userId: String, isSearchable: Boolean): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update(mapOf("is_searchable" to isSearchable))
            Result.success(Unit)
        } catch (e: Exception) {
            println("FirebaseDataSource: updateProfileVisibility falhou: ${e.message}")
            Result.failure(e)
        }
    }

    // ========== FIELD OWNERS ==========

    suspend fun getFieldOwners(): Result<List<User>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_USERS)
                .where { "role" equalTo "FIELD_OWNER" }
                .orderBy("name")
                .get()
            val fieldOwners = snapshot.documents.mapNotNull { it.toUserOrNull() }
            Result.success(fieldOwners)
        } catch (e: Exception) {
            println("FirebaseDataSource: getFieldOwners falhou: ${e.message}")
            Result.failure(e)
        }
    }

    // ========== FCM TOKEN ==========

    suspend fun updateFcmToken(token: String): Result<Unit> {
        return try {
            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuario nao autenticado"))

            firestore.collection(COLLECTION_USERS)
                .document(uid)
                .update(mapOf("fcm_token" to token))
            Result.success(Unit)
        } catch (e: Exception) {
            println("FirebaseDataSource: updateFcmToken falhou: ${e.message}")
            Result.failure(e)
        }
    }

    // ========== FAVORITE TEAMS ==========

    suspend fun getAllFavoriteTeams(): Result<List<FavoriteTeam>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_FAVORITE_TEAMS)
                .orderBy("name")
                .get()

            val teams = snapshot.documents.mapNotNull { doc ->
                if (!doc.exists) return@mapNotNull null
                FavoriteTeam(
                    id = doc.id,
                    name = doc.get<String?>("name") ?: "",
                    badgeUrl = doc.get<String?>("badge_url") ?: doc.get<String?>("badgeUrl"),
                    shortName = doc.get<String?>("short_name") ?: doc.get<String?>("shortName"),
                    category = doc.get<String?>("category"),
                    state = doc.get<String?>("state")
                )
            }
            Result.success(teams)
        } catch (e: Exception) {
            println("FirebaseDataSource: getAllFavoriteTeams falhou: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun getFavoriteTeamById(teamId: String): Result<FavoriteTeam> {
        return try {
            val doc = firestore.collection(COLLECTION_FAVORITE_TEAMS)
                .document(teamId)
                .get()

            if (!doc.exists) {
                return Result.failure(Exception("Time nao encontrado: $teamId"))
            }

            val team = FavoriteTeam(
                id = doc.id,
                name = doc.get<String?>("name") ?: "",
                badgeUrl = doc.get<String?>("badge_url") ?: doc.get<String?>("badgeUrl"),
                shortName = doc.get<String?>("short_name") ?: doc.get<String?>("shortName"),
                category = doc.get<String?>("category"),
                state = doc.get<String?>("state")
            )
            Result.success(team)
        } catch (e: Exception) {
            println("FirebaseDataSource: getFavoriteTeamById falhou: ${e.message}")
            Result.failure(e)
        }
    }

    // ========== AUTH ==========

    fun getAuthStateFlow(): Flow<String?> {
        return auth.authStateChanged
            .map { user -> user?.uid }
            .catch { emit(null) }
    }

    fun isLoggedIn(): Boolean {
        return auth.currentUser != null
    }

    fun getCurrentAuthUserId(): String? {
        return auth.currentUser?.uid
    }

    suspend fun getCurrentAuthUser(): Result<User> {
        println("FirebaseDataSource: === getCurrentAuthUser() START ===")
        return try {
            // Lógica de retry para confiabilidade do Google Sign-In
            var uid: String? = null
            var retries = 0
            val maxRetries = 10
            val baseDelay = 300L

            println("FirebaseDataSource: Iniciando loop de retry (máx $maxRetries tentativas)")
            while (uid == null && retries < maxRetries) {
                uid = auth.currentUser?.uid
                println("FirebaseDataSource: Retry $retries: uid = $uid")
                if (uid == null) {
                    val delay = baseDelay * (retries + 1)
                    println("FirebaseDataSource: Aguardando ${delay}ms antes do próximo retry")
                    kotlinx.coroutines.delay(delay)
                    retries++
                }
            }

            if (uid == null) {
                println("FirebaseDataSource: FALHOU: Sem UID após $retries retries")
                return Result.failure(Exception("Usuario nao autenticado"))
            }

            println("FirebaseDataSource: SUCESSO: UID = $uid")
            kotlinx.coroutines.delay(100)

            println("FirebaseDataSource: Consultando Firestore para user doc: $uid")
            val doc = firestore.collection(COLLECTION_USERS).document(uid).get()

            if (doc.exists) {
                println("FirebaseDataSource: Documento do usuário EXISTE no Firestore")
                var user = doc.toUserOrNull()
                    ?: return Result.failure(Exception("Erro ao converter usuario"))

                println("FirebaseDataSource: Usuário carregado: ${user.name} (${user.email})")

                // Verifica se a foto do Google mudou e atualiza
                val firebaseUser = auth.currentUser
                val googlePhotoUrl = firebaseUser?.photoURL

                if (googlePhotoUrl != null && googlePhotoUrl != user.photoUrl) {
                    println("FirebaseDataSource: Atualizando URL da foto")
                    firestore.collection(COLLECTION_USERS)
                        .document(uid)
                        .update(mapOf("photo_url" to googlePhotoUrl))
                    user = user.copy(photoUrl = googlePhotoUrl)
                }

                println("FirebaseDataSource: === getCurrentAuthUser() SUCESSO ===")
                Result.success(user)
            } else {
                println("FirebaseDataSource: Documento do usuário NÃO EXISTE - criando novo usuário")
                // Criar usuario automaticamente se nao existir
                val firebaseUser = auth.currentUser
                    ?: return Result.failure(Exception("Usuário não autenticado"))
                val newUser = User(
                    id = uid,
                    email = firebaseUser.email ?: "",
                    name = firebaseUser.displayName ?: "",
                    photoUrl = firebaseUser.photoURL
                )
                println("FirebaseDataSource: Criando usuário: ${newUser.name} (${newUser.email})")

                // Converter User para Map (serialização manual para compatibilidade)
                val userData = mapOf(
                    "id" to newUser.id,
                    "email" to newUser.email,
                    "name" to newUser.name,
                    "photo_url" to newUser.photoUrl,
                    "fcm_token" to newUser.fcmToken,
                    "is_searchable" to newUser.isSearchable,
                    "is_profile_public" to newUser.isProfilePublic,
                    "role" to newUser.role,
                    "created_at" to FieldValue.serverTimestamp,
                    "updated_at" to FieldValue.serverTimestamp,
                    "level" to newUser.level,
                    "experience_points" to newUser.experiencePoints,
                    "milestones_achieved" to newUser.milestonesAchieved,
                    "striker_rating" to newUser.strikerRating,
                    "mid_rating" to newUser.midRating,
                    "defender_rating" to newUser.defenderRating,
                    "gk_rating" to newUser.gkRating,
                    "striker_rating_set" to newUser.strikerRatingSet,
                    "mid_rating_set" to newUser.midRatingSet,
                    "defender_rating_set" to newUser.defenderRatingSet,
                    "gk_rating_set" to newUser.gkRatingSet,
                    "auto_striker_rating" to newUser.autoStrikerRating,
                    "auto_mid_rating" to newUser.autoMidRating,
                    "auto_defender_rating" to newUser.autoDefenderRating,
                    "auto_gk_rating" to newUser.autoGkRating,
                    "auto_rating_samples" to newUser.autoRatingSamples
                )

                firestore.collection(COLLECTION_USERS)
                    .document(uid)
                    .set(userData)
                println("FirebaseDataSource: === getCurrentAuthUser() SUCESSO (novo usuário criado) ===")
                Result.success(newUser)
            }
        } catch (e: Exception) {
            println("FirebaseDataSource: === getCurrentAuthUser() EXCEÇÃO: ${e.message} ===")
            Result.failure(e)
        }
    }

    suspend fun signInWithEmailPassword(email: String, password: String): Result<String> {
        return try {
            val result = auth.signInWithEmailAndPassword(email.trim(), password)
            val uid = result.user?.uid
                ?: return Result.failure(Exception("Falha ao autenticar: usuário nulo"))
            Result.success(uid)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun signUpWithEmailPassword(email: String, password: String): Result<String> {
        return try {
            val result = auth.createUserWithEmailAndPassword(email.trim(), password)
            val uid = result.user?.uid
                ?: return Result.failure(Exception("Falha ao criar conta: usuário nulo"))
            Result.success(uid)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun sendPasswordResetEmail(email: String): Result<Unit> {
        return try {
            val trimmed = email.trim()
            if (trimmed.isBlank()) {
                return Result.failure(IllegalArgumentException("Informe um e-mail válido"))
            }
            auth.sendPasswordResetEmail(trimmed)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun logout() {
        // No iOS, o AppDelegate persiste os identificadores nas mesmas chaves
        // nativas. Assim o fluxo KMP real remove esta instalação enquanto a
        // sessão ainda está autenticada. Falha de rede não bloqueia logout.
        try {
            PushTokenLifecycleStore.nextForUnregister()?.let { stored ->
                withTimeoutOrNull(2_000) {
                    unregisterPushToken(stored.deviceId, stored.sequence)
                        .onSuccess { PushTokenLifecycleStore.clearToken() }
                }
            }
        } finally {
            auth.signOut()
        }
    }


    // ========== NOTIFICATIONS ==========

    suspend fun getMyNotifications(limit: Int): Result<List<AppNotification>> {
        return try {
            val userId = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            Result.success(firestore.collection("notifications").where { "user_id" equalTo userId }
                .orderBy("created_at", Direction.DESCENDING).limit(limit).get().documents.mapNotNull { it.toAppNotificationOrNull() })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar notificações: ${e.message}")
            Result.failure(e)
        }
    }

    fun getMyNotificationsFlow(limit: Int): Flow<List<AppNotification>> = flow {
        val userId = auth.currentUser?.uid ?: run { emit(emptyList()); return@flow }
        firestore.collection("notifications").where { "user_id" equalTo userId }
            .orderBy("created_at", Direction.DESCENDING).limit(limit).snapshots()
            .collect { emit(it.documents.mapNotNull { d -> d.toAppNotificationOrNull() }) }
    }.catch { emit(emptyList()) }

    suspend fun getUnreadNotifications(): Result<List<AppNotification>> {
        return try {
            val userId = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            Result.success(firestore.collection("notifications").where { "user_id" equalTo userId }
                .where { "read" equalTo false }.get().documents.mapNotNull { it.toAppNotificationOrNull() })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar notificações não lidas: ${e.message}")
            Result.failure(e)
        }
    }

    fun getUnreadCountFlow(): Flow<Int> = flow {
        val userId = auth.currentUser?.uid ?: run { emit(0); return@flow }
        firestore.collection("notifications").where { "user_id" equalTo userId }.where { "read" equalTo false }
            .snapshots().collect { emit(it.documents.size) }
    }.catch { emit(0) }

    suspend fun getUnreadCount(): Result<Int> {
        return try {
            val userId = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            Result.success(firestore.collection("notifications").where { "user_id" equalTo userId }.where { "read" equalTo false }.get().documents.size)
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao contar notificações não lidas: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun markNotificationAsRead(notificationId: String): Result<Unit> {
        return try {
            firestore.collection("notifications").document(notificationId)
                .update(mapOf("read" to true, "read_at" to FieldValue.serverTimestamp))
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun markNotificationAsUnread(notificationId: String): Result<Unit> {
        return try {
            firestore.collection("notifications").document(notificationId)
                .update(mapOf("read" to false, "read_at" to FieldValue.delete))
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun markAllNotificationsAsRead(): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            val snapshot = firestore.collection("notifications").where { "user_id" equalTo userId }.where { "read" equalTo false }.get()
            if (snapshot.documents.isEmpty()) return Result.success(Unit)
            snapshot.documents.chunked(450).forEach { chunk ->
                val batch = firestore.batch()
                chunk.forEach { doc -> batch.update(doc.reference, mapOf("read" to true, "read_at" to FieldValue.serverTimestamp)) }
                batch.commit()
            }
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getNotificationById(notificationId: String): Result<AppNotification> {
        return try {
            val doc = firestore.collection("notifications").document(notificationId).get()
            Result.success(doc.toAppNotificationOrNull() ?: return Result.failure(Exception("Notificação não encontrada")))
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun createNotification(notification: AppNotification): Result<String> {
        return try {
            val docRef = if (notification.id.isNotEmpty()) firestore.collection("notifications").document(notification.id)
            else firestore.collection("notifications").document
            docRef.set(notification.copy(id = docRef.id))
            Result.success(docRef.id)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun batchCreateNotifications(notifications: List<AppNotification>): Result<Unit> {
        return try {
            if (notifications.isEmpty()) return Result.success(Unit)
            val batch = firestore.batch()
            notifications.forEach { notification ->
                val docRef = if (notification.id.isNotEmpty()) firestore.collection("notifications").document(notification.id)
                else firestore.collection("notifications").document
                batch.set(docRef, notification.copy(id = docRef.id))
            }
            batch.commit()
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun deleteNotification(notificationId: String): Result<Unit> {
        return try {
            firestore.collection("notifications").document(notificationId).delete()
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun deleteOldNotifications(): Result<Int> {
        return try {
            val userId = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            val thirtyDaysAgoTs = Timestamp((Clock.System.now().toEpochMilliseconds() - 30L * 24 * 60 * 60 * 1000) / 1000, 0)
            val oldSnapshot = firestore.collection("notifications").where { "user_id" equalTo userId }.where { "created_at" lessThan thirtyDaysAgoTs }.get()
            val allSnapshot = firestore.collection("notifications").where { "user_id" equalTo userId }.get()
            val docsToDelete = mutableListOf<dev.gitlive.firebase.firestore.DocumentSnapshot>()
            docsToDelete.addAll(oldSnapshot.documents)
            allSnapshot.documents.forEach { doc ->
                if (doc.get<Any?>("created_at") == null && !docsToDelete.any { it.id == doc.id }) docsToDelete.add(doc)
            }
            if (docsToDelete.isEmpty()) return Result.success(0)
            docsToDelete.chunked(400).forEach { chunk ->
                val batch = firestore.batch(); chunk.forEach { doc -> batch.delete(doc.reference) }; batch.commit()
            }
            Result.success(docsToDelete.size)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getNotificationsByType(type: NotificationType, limit: Int): Result<List<AppNotification>> {
        return try {
            val userId = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            Result.success(firestore.collection("notifications").where { "user_id" equalTo userId }
                .where { "type" equalTo type.name }.orderBy("created_at", Direction.DESCENDING).limit(limit).get()
                .documents.mapNotNull { it.toAppNotificationOrNull() })
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getPendingActionNotifications(): Result<List<AppNotification>> {
        return try {
            val userId = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            val snapshot = firestore.collection("notifications").where { "user_id" equalTo userId }.where { "read" equalTo false }.get()
            val now = Clock.System.now().toEpochMilliseconds()
            Result.success(snapshot.documents.mapNotNull { it.toAppNotificationOrNull() }
                .filter { it.requiresResponse() && (it.expiresAt == null || it.expiresAt > now) })
        } catch (e: Exception) { Result.failure(e) }
    }

}
