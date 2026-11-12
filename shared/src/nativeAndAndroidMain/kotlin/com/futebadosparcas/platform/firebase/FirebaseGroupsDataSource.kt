package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import com.futebadosparcas.platform.UuidGenerator
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.auth.FirebaseAuth
import dev.gitlive.firebase.auth.auth
import dev.gitlive.firebase.firestore.*
import dev.gitlive.firebase.storage.FirebaseStorage
import dev.gitlive.firebase.storage.storage
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.datetime.Clock

internal class FirebaseGroupsDataSource(
    private val firestore: FirebaseFirestore = Firebase.firestore,
    private val auth: FirebaseAuth = Firebase.auth,
    private val storage: FirebaseStorage = Firebase.storage
) {
    // ========== GROUPS ==========

    suspend fun getUserGroups(userId: String): Result<List<UserGroup>> {
        return try {
            val snapshot = firestore.collection("users")
                .document(userId)
                .collection("groups")
                .orderBy("joined_at", Direction.DESCENDING)
                .get()

            val userGroups = snapshot.documents.mapNotNull { it.toUserGroupOrNull() }
            Result.success(userGroups)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun getUserGroupsFlow(userId: String): Flow<Result<List<UserGroup>>> {
        return firestore.collection("users")
            .document(userId)
            .collection("groups")
            .orderBy("joined_at", Direction.DESCENDING)
            .snapshots()
            .map { snapshot -> Result.success(snapshot.documents.mapNotNull { it.toUserGroupOrNull() }) }
            .catch { e -> emit(Result.failure(e)) }
    }

    suspend fun getGroupById(groupId: String): Result<UserGroup> {
        return try {
            val doc = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .get()

            if (!doc.exists) {
                return Result.failure(NoSuchElementException("Grupo não encontrado: $groupId"))
            }

            val group = doc.toUserGroupOrNull()
                ?: return Result.failure(IllegalStateException("Erro ao converter grupo"))

            Result.success(group)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }


    // ========== GROUPS MANAGEMENT ==========

    suspend fun createGroup(group: Group): Result<Group> {
        return try {
            val docRef = firestore.collection(COLLECTION_GROUPS).document
            val groupData = mapOf(
                "id" to docRef.id,
                "name" to group.name,
                "description" to group.description,
                "photo_url" to group.photoUrl,
                "owner_id" to group.ownerId,
                "is_active" to true,
                "created_at" to FieldValue.serverTimestamp
            )
            docRef.set(groupData)
            Result.success(group.copy(id = docRef.id))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateGroup(groupId: String, updates: Map<String, Any>): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .updateLoose(updates)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getGroupMembers(groupId: String): Result<List<GroupMember>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .get()
            Result.success(snapshot.documents.mapNotNull { it.toGroupMemberOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun addGroupMember(groupId: String, userId: String, role: String): Result<Unit> {
        return try {
            val memberData = mapOf(
                "user_id" to userId,
                "role" to role,
                "joined_at" to FieldValue.serverTimestamp
            )
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .document(userId)
                .set(memberData)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun removeGroupMember(groupId: String, userId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .document(userId)
                .delete()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getGroupDetails(groupId: String): Result<Group> {
        return try {
            val doc = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .get()

            if (!doc.exists) {
                return Result.failure(NoSuchElementException("Grupo não encontrado: $groupId"))
            }

            val group = doc.toGroupOrNull()
                ?: return Result.failure(IllegalStateException("Erro ao converter grupo"))

            Result.success(group)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun getGroupMembersFlow(groupId: String): Flow<Result<List<GroupMember>>> {
        return firestore.collection(COLLECTION_GROUPS)
            .document(groupId)
            .collection("members")
            .where { "status" equalTo "ACTIVE" }
            .orderBy("joined_at", Direction.ASCENDING)
            .snapshots()
            .map { snapshot -> Result.success(snapshot.documents.mapNotNull { it.toGroupMemberOrNull() }) }
            .catch { e -> emit(Result.failure(e)) }
    }

    fun getGroupDetailsFlow(groupId: String): Flow<Result<Group>> {
        return firestore.collection(COLLECTION_GROUPS)
            .document(groupId)
            .snapshots()
            .map { snapshot ->
                if (snapshot.exists) {
                    val group = snapshot.toGroupOrNull()
                    if (group != null) Result.success(group)
                    else Result.failure(Exception("Erro ao converter grupo"))
                } else {
                    Result.failure(Exception("Grupo não encontrado"))
                }
            }
            .catch { e -> emit(Result.failure(e)) }
    }

    // ========== GROUPS ADVANCED ==========

    suspend fun promoteGroupMemberToAdmin(groupId: String, memberId: String): Result<Unit> {
        return try {
            firestore.runTransaction<Unit> {
                val memberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(memberId)
                update(memberRef, mapOf("role" to "ADMIN"))

                val userGroupRef = firestore.collection("users")
                    .document(memberId)
                    .collection("groups").document(groupId)
                update(userGroupRef, mapOf("role" to "ADMIN"))
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun demoteGroupAdminToMember(groupId: String, memberId: String): Result<Unit> {
        return try {
            firestore.runTransaction<Unit> {
                val memberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(memberId)
                update(memberRef, mapOf("role" to "MEMBER"))

                val userGroupRef = firestore.collection("users")
                    .document(memberId)
                    .collection("groups").document(groupId)
                update(userGroupRef, mapOf("role" to "MEMBER"))
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateGroupMemberRole(groupId: String, userId: String, role: String): Result<Unit> {
        return try {
            firestore.runTransaction<Unit> {
                val memberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(userId)
                update(memberRef, mapOf("role" to role))

                val userGroupRef = firestore.collection("users")
                    .document(userId)
                    .collection("groups").document(groupId)
                update(userGroupRef, mapOf("role" to role))
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun leaveGroup(groupId: String, userId: String): Result<Unit> {
        return try {
            firestore.runTransaction<Unit> {
                val memberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(userId)
                update(memberRef, mapOf("status" to "INACTIVE"))

                // member_count é server-authoritative. onMemberWritten observa
                // ACTIVE -> INACTIVE e aplica o único delta idempotente.

                val userGroupRef = firestore.collection("users")
                    .document(userId)
                    .collection("groups").document(groupId)
                delete(userGroupRef)
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun archiveGroup(groupId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .update(mapOf(
                    "status" to "ARCHIVED",
                    "updated_at" to FieldValue.serverTimestamp
                ))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun restoreGroup(groupId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .update(mapOf(
                    "status" to "ACTIVE",
                    "updated_at" to FieldValue.serverTimestamp
                ))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteGroup(groupId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .update(mapOf(
                    "status" to "DELETED",
                    "updated_at" to FieldValue.serverTimestamp
                ))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun transferGroupOwnership(
        groupId: String,
        newOwnerId: String,
        oldOwnerId: String,
        newOwnerName: String
    ): Result<Unit> {
        return try {
            firestore.runTransaction<Unit> {
                val groupRef = firestore.collection(COLLECTION_GROUPS).document(groupId)
                update(groupRef, mapOf(
                    "owner_id" to newOwnerId,
                    "owner_name" to newOwnerName,
                    "updated_at" to FieldValue.serverTimestamp
                ))

                val oldOwnerMemberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(oldOwnerId)
                update(oldOwnerMemberRef, mapOf("role" to "ADMIN"))

                val newOwnerMemberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(newOwnerId)
                update(newOwnerMemberRef, mapOf("role" to "OWNER"))

                val oldOwnerGroupRef = firestore.collection("users")
                    .document(oldOwnerId)
                    .collection("groups").document(groupId)
                update(oldOwnerGroupRef, mapOf("role" to "ADMIN"))

                val newOwnerGroupRef = firestore.collection("users")
                    .document(newOwnerId)
                    .collection("groups").document(groupId)
                update(newOwnerGroupRef, mapOf("role" to "OWNER"))
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun syncGroupMemberCount(groupId: String, userIds: List<String>): Result<Unit> {
        return try {
            val correctMemberCount = userIds.size
            val batch = firestore.batch()

            val groupRef = firestore.collection(COLLECTION_GROUPS).document(groupId)
            batch.update(groupRef, mapOf("member_count" to correctMemberCount))

            userIds.forEach { memberId ->
                val userGroupRef = firestore.collection("users")
                    .document(memberId)
                    .collection("groups").document(groupId)
                batch.update(userGroupRef, mapOf("member_count" to correctMemberCount))
            }

            batch.commit()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun joinGroupByInviteCode(
        inviteCode: String,
        userId: String,
        userName: String,
        userPhoto: String?
    ): Result<String> {
        return try {
            // Sistema canonico: lookup primeiro em invites/ (codigos com TTL e tracking)
            // Fallback: groups.invite_code (codes legados, sticky)
            // SPEC: feat-2026-05-08-consolidate-shareable-invites.md
            val normalized = inviteCode.uppercase()

            // 1. Tenta resolver via collection invites/ (caminho CANÔNICO).
            // #2351: doc-id == code — lookup por get(doc-id), nao where('code')
            // (que era LIST e permitia enumerar todos os convites). A rule de
            // `invites` agora bloqueia list p/ nao-admin.
            val invDoc = firestore.collection("invites").document(normalized).get()
            val isModernInvite = run {
                if (!invDoc.exists) return@run false
                if (invDoc.get<Boolean?>("used") == true) return@run false
                val expiresAt = invDoc.get<Timestamp?>("expires_at")
                val nowMs = Clock.System.now().toEpochMilliseconds()
                if (expiresAt != null && expiresAt.seconds * 1000L < nowMs) return@run false
                true
            }

            if (isModernInvite) {
                // ===== CAMINHO CANÔNICO (invites/) — FIX #2516 / #2517 =====
                // O cliente NÃO cria mais o member doc nem incrementa member_count.
                // Apenas marca o convite como usado; o trigger server-side
                // `onInviteRedeemed` (functions/src/groups/invite-redeemed.ts) cria
                // a membership via admin SDK (bypassa rules), funcionando p/ grupo
                // PRIVADO — espelha `onJoinRequestApproved`. O counter member_count
                // é mantido por `onMemberWritten`.
                //
                // BUGFIX: o fluxo Android antigo NUNCA marcava o convite como usado
                // (criava o member direto), deixando single-use furado. Agora o
                // update é o gatilho do trigger.
                val groupId = invDoc.get<String?>("group_id")
                    ?: return Result.failure(Exception("Convite sem grupo associado"))

                // A rule de update de invites exige
                // hasOnly(['used','used_by','used_at']), used==true e used_by==self.
                firestore.collection("invites").document(normalized).update(
                    mapOf(
                        "used" to true,
                        "used_by" to userId,
                        "used_at" to FieldValue.serverTimestamp
                    )
                )

                // FIX #2517: a membership é criada de forma ASSÍNCRONA pelo trigger.
                // Em grupo PRIVADO, voltar antes do member doc existir causaria
                // PERMISSION_DENIED na leitura do grupo. Aguardamos o member doc
                // aparecer (até ~8s, polling leve). Timeout não é erro: a
                // membership já está garantida pelo trigger; só a propagação pode
                // demorar (cold start).
                val memberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(userId)
                val deadlineMs = Clock.System.now().toEpochMilliseconds() + 8000L
                while (Clock.System.now().toEpochMilliseconds() < deadlineMs) {
                    if (memberRef.get().exists) break
                    delay(500L)
                }

                return Result.success(groupId)
            }

            // ===== CAMINHO LEGADO (groups.invite_code) =====
            // Codes legados, sticky, sem doc em invites/. Um joiner não pode criar
            // um invites/{code} (a rule exige inviter_id==self + admin do grupo),
            // logo o trigger NÃO tem como disparar aqui. Mantemos o member-create
            // pelo cliente — porém ele só é permitido pela rule em grupo PÚBLICO
            // (gate is_public==true, proteção de #2153). Limitação herdada e
            // documentada: convite legado em grupo PRIVADO no Android não entra
            // (a web não suporta legado). Não é regressão deste PR.
            val legacySnap = firestore.collection(COLLECTION_GROUPS)
                .where { "invite_code" equalTo normalized }
                .where { "status" equalTo "ACTIVE" }
                .limit(1)
                .get()

            if (legacySnap.documents.isEmpty()) {
                return Result.failure(Exception("Código de convite inválido"))
            }
            val groupId = legacySnap.documents[0].id

            val groupDoc = firestore.collection(COLLECTION_GROUPS).document(groupId).get()
            if (!groupDoc.exists) {
                return Result.failure(Exception("Grupo não encontrado"))
            }
            val groupStatus = groupDoc.get<String?>("status") ?: "ACTIVE"
            if (groupStatus != "ACTIVE") {
                return Result.failure(Exception("Grupo não está mais ativo"))
            }
            val groupName = groupDoc.get<String?>("name") ?: ""
            val groupPhoto = groupDoc.get<String?>("photo_url")

            firestore.runTransaction<Unit> {
                val memberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(userId)

                val memberData = mapOf(
                    "user_id" to userId,
                    "user_name" to userName,
                    "user_photo" to userPhoto,
                    "role" to "MEMBER",
                    "status" to "ACTIVE",
                    "joined_at" to FieldValue.serverTimestamp
                )
                set(memberRef, memberData)

                // FIX #2516: REMOVIDO o client-side increment de member_count.
                // Era server-authoritative (rule exige fieldUnchanged('member_count'))
                // e o cliente entrando não é owner/admin → a transação inteira era
                // rejeitada. O trigger `onMemberWritten` faz o +1 via admin SDK ao
                // detectar o set(memberRef) acima. (Paridade com web FIX #611/#626.)

                val userGroupRef = firestore.collection("users")
                    .document(userId)
                    .collection("groups").document(groupId)

                val userGroupData = mapOf(
                    "group_id" to groupId,
                    "group_name" to groupName,
                    "group_photo" to groupPhoto,
                    "role" to "MEMBER",
                    "joined_at" to FieldValue.serverTimestamp
                )
                set(userGroupRef, userGroupData)
            }

            Result.success(groupId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun generateGroupInviteCode(groupId: String): Result<String> {
        return try {
            val chars = ('A'..'Z') + ('0'..'9')
            var code: String
            var attempts = 0

            do {
                code = (1..8).map { chars.random() }.joinToString("")
                val existing = firestore.collection(COLLECTION_GROUPS)
                    .where { "invite_code" equalTo code }
                    .limit(1)
                    .get()
                attempts++
            } while (!existing.documents.isEmpty() && attempts < 5)

            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .update(mapOf(
                    "invite_code" to code,
                    "updated_at" to FieldValue.serverTimestamp
                ))

            Result.success(code)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== DISCOVERY (Issue #517 Phase 1) ==========

    suspend fun searchPublicGroups(query: String, limit: Int): Result<List<Group>> {
        return try {
            val normalized = query.trim().lowercase()
            // Firestore não tem full-text search nativa. Estratégia:
            // 1. Buscar TODOS public+ACTIVE
            // 2. Filtrar in-memory por nome OU descrição contendo o query
            // Aceitável até ~hundreds de grupos públicos. Para escalar, plugar Algolia/MeiliSearch.
            val snap = firestore.collection(COLLECTION_GROUPS)
                .where { "is_public" equalTo true }
                .where { "status" equalTo "ACTIVE" }
                .limit(200)
                .get()

            val all = snap.documents.mapNotNull { doc ->
                try {
                    Group(
                        id = doc.id,
                        name = doc.get<String?>("name") ?: "",
                        description = doc.get<String?>("description") ?: "",
                        photoUrl = doc.get<String?>("photo_url"),
                        ownerId = doc.get<String?>("owner_id") ?: "",
                        ownerName = doc.get<String?>("owner_name") ?: "",
                        isPublic = doc.get<Boolean?>("is_public") ?: false,
                        membersCount = doc.get<Long?>("members_count")?.toInt() ?: 0,
                    )
                } catch (_: Exception) {
                    null
                }
            }

            val filtered = if (normalized.isBlank()) {
                all
            } else {
                all.filter { g ->
                    g.name.lowercase().contains(normalized) ||
                        g.description.lowercase().contains(normalized)
                }
            }

            Result.success(filtered.take(limit))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== JOIN REQUESTS (Issue #517 Phase 2) ==========

    suspend fun createGroupJoinRequest(
        groupId: String,
        userId: String,
        userName: String,
        userPhoto: String?,
    ): Result<Unit> {
        return try {
            val data = mapOf(
                "user_id" to userId,
                "user_name" to userName,
                "user_photo" to userPhoto,
                "status" to "PENDING",
                "requested_at" to FieldValue.serverTimestamp,
            )
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("join_requests")
                .document(userId)
                .set(data)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun cancelGroupJoinRequest(groupId: String, userId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("join_requests")
                .document(userId)
                .delete()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun approveGroupJoinRequest(
        groupId: String,
        requesterId: String,
        approverId: String,
    ): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("join_requests")
                .document(requesterId)
                .update(
                    mapOf(
                        "status" to "APPROVED",
                        "responded_at" to FieldValue.serverTimestamp,
                        "responded_by" to approverId,
                    )
                )
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun rejectGroupJoinRequest(
        groupId: String,
        requesterId: String,
        approverId: String,
    ): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("join_requests")
                .document(requesterId)
                .update(
                    mapOf(
                        "status" to "REJECTED",
                        "responded_at" to FieldValue.serverTimestamp,
                        "responded_by" to approverId,
                    )
                )
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun observeMyGroupJoinRequest(
        groupId: String,
        userId: String,
    ): Flow<GroupJoinRequest?> = flow {
        firestore.collection(COLLECTION_GROUPS)
            .document(groupId)
            .collection("join_requests")
            .document(userId)
            .snapshots
            .collect { snapshot ->
                if (!snapshot.exists) {
                    emit(null)
                } else {
                    emit(parseGroupJoinRequest(snapshot.id, snapshot::get))
                }
            }
    }

    fun observePendingGroupJoinRequests(groupId: String): Flow<List<GroupJoinRequest>> = flow {
        firestore.collection(COLLECTION_GROUPS)
            .document(groupId)
            .collection("join_requests")
            .where { "status" equalTo "PENDING" }
            .orderBy("requested_at")
            .snapshots
            .collect { snap ->
                val items = snap.documents.mapNotNull { doc ->
                    parseGroupJoinRequest(doc.id, doc::get)
                }
                emit(items)
            }
    }

    private fun parseGroupJoinRequest(
        id: String,
        getter: (String) -> Any?,
    ): GroupJoinRequest? {
        return try {
            @Suppress("UNCHECKED_CAST")
            val requestedAtTs = getter("requested_at") as? Timestamp
            @Suppress("UNCHECKED_CAST")
            val respondedAtTs = getter("responded_at") as? Timestamp
            GroupJoinRequest(
                id = id,
                userId = (getter("user_id") as? String) ?: id,
                userName = (getter("user_name") as? String) ?: "",
                userPhoto = getter("user_photo") as? String,
                status = GroupJoinRequestStatus.fromString(getter("status") as? String),
                requestedAt = requestedAtTs?.let { it.seconds * 1000L + it.nanoseconds / 1_000_000L },
                respondedAt = respondedAtTs?.let { it.seconds * 1000L + it.nanoseconds / 1_000_000L },
                respondedBy = getter("responded_by") as? String,
            )
        } catch (_: Exception) {
            null
        }
    }

    // ========== MÉTODOS AUXILIARES DE GRUPO ==========

    suspend fun getMyRoleInGroup(groupId: String, userId: String): Result<String?> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .document(userId)
                .get()

            val role = snapshot.get<String?>("role")
            Result.success(role)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun isMemberOfGroup(groupId: String, userId: String): Result<Boolean> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .document(userId)
                .get()

            val isMember = snapshot.exists && snapshot.get<String?>("status") == "ACTIVE"
            Result.success(isMember)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getMyAdminGroups(userId: String): Result<List<String>> {
        return try {
            val snapshot = firestore.collection("users")
                .document(userId)
                .collection("groups")
                .where { "role" inArray listOf("OWNER", "ADMIN") }
                .get()

            val groupIds = snapshot.documents.map { it.id }
            Result.success(groupIds)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getValidGroupsForGame(userId: String): Result<List<String>> {
        return try {
            val snapshot = firestore.collection("users")
                .document(userId)
                .collection("groups")
                .where { "status" equalTo "ACTIVE" }
                .where { "role" inArray listOf("OWNER", "ADMIN") }
                .get()

            val groupIds = snapshot.documents.map { it.id }
            Result.success(groupIds)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun canCreateGames(userId: String): Result<Boolean> {
        return try {
            val snapshot = firestore.collection("users")
                .document(userId)
                .collection("groups")
                .where { "status" equalTo "ACTIVE" }
                .where { "role" inArray listOf("OWNER", "ADMIN") }
                .limit(1)
                .get()

            Result.success(!snapshot.documents.isEmpty())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun countMyAdminGroups(userId: String): Result<Int> {
        return try {
            val snapshot = firestore.collection("users")
                .document(userId)
                .collection("groups")
                .where { "role" inArray listOf("OWNER", "ADMIN") }
                .get()

            Result.success(snapshot.documents.size)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun syncAllMyGroupsMemberCount(userId: String): Result<Unit> {
        return try {
            val groupsSnapshot = firestore.collection("users")
                .document(userId)
                .collection("groups")
                .get()

            groupsSnapshot.documents.forEach { userGroupDoc ->
                val groupId = userGroupDoc.id

                val membersSnapshot = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members")
                    .where { "status" equalTo "ACTIVE" }
                    .get()

                val memberCount = membersSnapshot.documents.size

                firestore.runTransaction<Unit> {
                    val groupRef = firestore.collection(COLLECTION_GROUPS).document(groupId)
                    update(groupRef, mapOf("member_count" to memberCount))

                    val userGroupRef = firestore.collection("users")
                        .document(userId)
                        .collection("groups").document(groupId)
                    update(userGroupRef, mapOf("member_count" to memberCount))
                }
            }

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getGroupActiveMemberIds(groupId: String): Result<List<String>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .where { "status" equalTo "ACTIVE" }
                .get()

            val userIds = snapshot.documents.map { it.id }
            Result.success(userIds)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun uploadGroupPhoto(groupId: String, photoPath: String): Result<String> {
        return Result.failure(Exception("Upload de fotos requer URI Android — não disponível nesta plataforma"))
    }

}
