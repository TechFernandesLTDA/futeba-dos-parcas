package com.futebadosparcas.firebase

import kotlinx.coroutines.delay

object FirebaseManager {

    private var currentUserId: String? = null
    private var currentUserEmail: String? = null
    private var currentUserName: String? = null
    private var currentUserPhotoUrl: String? = null
    private var isInitialized = false

    private val mockGroups = listOf(
        mapOf(
            "id" to "group1",
            "groupId" to "group1",
            "name" to "Pelada dos Parças",
            "groupName" to "Pelada dos Parças",
            "members" to 15,
            "memberCount" to 15,
            "role" to "OWNER",
            "description" to "A pelada mais tradicional do bairro!",
            "isPublic" to false,
            "nextGame" to "Sábado 15:00"
        ),
        mapOf(
            "id" to "group2",
            "groupId" to "group2",
            "name" to "Racha da Firma",
            "groupName" to "Racha da Firma",
            "members" to 12,
            "memberCount" to 12,
            "role" to "ADMIN",
            "description" to "Funcionários da empresa.",
            "isPublic" to true,
            "nextGame" to "Domingo 09:00"
        )
    )

    private val createdGroups = mutableListOf<Map<String, Any?>>()

    private val mockLocations = listOf(
        mapOf(
            "id" to "loc1",
            "name" to "Arena Futebol Society",
            "address" to "Av. Brasil, 1500 - Jardim América",
            "city" to "São Paulo",
            "state" to "SP",
            "neighborhood" to "Jardim América",
            "rating" to 4.8,
            "ratingCount" to 156,
            "photoUrl" to "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=400",
            "phone" to "(11) 99999-1111",
            "primaryFieldType" to "SOCIETY",
            "fieldCount" to 4,
            "hasActiveFields" to true,
            "amenities" to listOf("Estacionamento", "Vestiário", "Churrasqueira", "Bar"),
            "priceRange" to 120.0,
            "isActive" to true
        ),
        mapOf(
            "id" to "loc2",
            "name" to "Ginásio Poliesportivo Central",
            "address" to "Rua das Flores, 200 - Centro",
            "city" to "São Paulo",
            "state" to "SP",
            "neighborhood" to "Centro",
            "rating" to 4.5,
            "ratingCount" to 89,
            "photoUrl" to "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400",
            "phone" to "(11) 3333-2222",
            "primaryFieldType" to "FUTSAL",
            "fieldCount" to 2,
            "hasActiveFields" to true,
            "amenities" to listOf("Vestiário", "Arquibancada"),
            "priceRange" to 80.0,
            "isActive" to true
        ),
        mapOf(
            "id" to "loc3",
            "name" to "Campo do Parque Ibirapuera",
            "address" to "Av. Pedro Álvares Cabral, s/n - Vila Mariana",
            "city" to "São Paulo",
            "state" to "SP",
            "neighborhood" to "Vila Mariana",
            "rating" to 4.2,
            "ratingCount" to 234,
            "photoUrl" to "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=400",
            "phone" to "(11) 99999-3333",
            "primaryFieldType" to "CAMPO",
            "fieldCount" to 3,
            "hasActiveFields" to true,
            "amenities" to listOf("Estacionamento", "Lanchonete"),
            "priceRange" to 200.0,
            "isActive" to true
        ),
        mapOf(
            "id" to "loc4",
            "name" to "Quadra da Escola Municipal",
            "address" to "Rua da Escola, 100 - Vila Nova",
            "city" to "São Paulo",
            "state" to "SP",
            "neighborhood" to "Vila Nova",
            "rating" to 3.9,
            "ratingCount" to 67,
            "photoUrl" to null,
            "phone" to "(11) 4444-4444",
            "primaryFieldType" to "FUTSAL",
            "fieldCount" to 1,
            "hasActiveFields" to true,
            "amenities" to listOf("Vestiário"),
            "priceRange" to 50.0,
            "isActive" to true
        ),
        mapOf(
            "id" to "loc5",
            "name" to "Complexo Esportivo Sul",
            "address" to "Av. Sul, 3000 - Santo Amaro",
            "city" to "São Paulo",
            "state" to "SP",
            "neighborhood" to "Santo Amaro",
            "rating" to 4.6,
            "ratingCount" to 312,
            "photoUrl" to "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=400",
            "phone" to "(11) 5555-5555",
            "primaryFieldType" to "SOCIETY",
            "fieldCount" to 6,
            "hasActiveFields" to true,
            "amenities" to listOf("Estacionamento", "Vestiário", "Churrasqueira", "Bar", "Wi-Fi"),
            "priceRange" to 150.0,
            "isActive" to true
        ),
        mapOf(
            "id" to "loc6",
            "name" to "Arena Grama Natural",
            "address" to "Estrada Rural, km 5 - Zona Rural",
            "city" to "São Paulo",
            "state" to "SP",
            "neighborhood" to "Zona Rural",
            "rating" to 4.9,
            "ratingCount" to 78,
            "photoUrl" to "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=400",
            "phone" to "(11) 99999-6666",
            "primaryFieldType" to "CAMPO",
            "fieldCount" to 2,
            "hasActiveFields" to true,
            "amenities" to listOf("Estacionamento", "Vestiário", "Churrasqueira"),
            "priceRange" to 300.0,
            "isActive" to true
        )
    )

    private val createdLocations = mutableListOf<Map<String, Any?>>()

    fun initialize() {
        if (isInitialized) return
        isInitialized = true
        println("FirebaseManager (Mock) initialized")
    }

    suspend fun signInWithEmailAndPassword(email: String, password: String): String? {
        delay(300)
        currentUserId = "mock-user-${email.hashCode()}"
        currentUserEmail = email
        currentUserName = email.substringBefore("@").replaceFirstChar { it.uppercase() }
        currentUserPhotoUrl = null
        return currentUserId
    }

    suspend fun signInWithGoogle(): String? {
        delay(500)
        val timestamp = jsGetTimestamp().toLong()
        currentUserId = "google-user-$timestamp"
        currentUserEmail = "googleuser@gmail.com"
        currentUserName = "Usuário Google"
        currentUserPhotoUrl = "https://ui-avatars.com/api/?name=Usuario+Google&background=4285F4&color=fff"
        return currentUserId
    }

    suspend fun signUpWithEmailAndPassword(email: String, password: String, name: String): String? {
        delay(300)
        currentUserId = "new-user-${email.hashCode()}"
        currentUserEmail = email
        currentUserName = name
        currentUserPhotoUrl = null
        return currentUserId
    }

    suspend fun signOut() {
        delay(100)
        currentUserId = null
        currentUserEmail = null
        currentUserName = null
        currentUserPhotoUrl = null
    }

    suspend fun deleteAccount() {
        delay(200)
        currentUserId = null
        currentUserEmail = null
        currentUserName = null
        currentUserPhotoUrl = null
    }

    fun getCurrentUserEmail(): String? = currentUserEmail
    fun getCurrentUserId(): String? = currentUserId
    fun getCurrentUserName(): String? = currentUserName
    fun getCurrentUserPhotoUrl(): String? = currentUserPhotoUrl
    fun getCurrentUserRole(): String? = if (currentUserEmail?.contains("admin") == true) "ADMIN" else "PLAYER"

    suspend fun getCurrentUserProfile(): Map<String, Any?>? {
        delay(100)
        if (currentUserId == null) return null

        return mapOf(
            "id" to currentUserId!!,
            "email" to (currentUserEmail ?: ""),
            "name" to (currentUserName ?: "Jogador"),
            "nickname" to "Peladeiro",
            "role" to "PLAYER",
            "level" to 12,
            "experiencePoints" to 2450L,
            "strikerRating" to 3.8,
            "midRating" to 4.2,
            "defenderRating" to 3.5,
            "gkRating" to 2.8,
            "totalGames" to 45,
            "totalGoals" to 23,
            "totalAssists" to 31,
            "mvpCount" to 6
        )
    }

    suspend fun getUserBadges(): List<Map<String, Any?>> {
        delay(100)
        if (currentUserId == null) return emptyList()

        val mockNow = 1740182400000.0

        return listOf(
            mapOf("badgeId" to "FIRST_GOAL", "unlockedAt" to mockNow - 86400000.0 * 30, "count" to 1),
            mapOf("badgeId" to "STREAK_7", "unlockedAt" to mockNow - 86400000.0 * 15, "count" to 1),
            mapOf("badgeId" to "MVP_5", "unlockedAt" to mockNow - 86400000.0 * 5, "count" to 6)
        )
    }

    suspend fun getCollection(collectionPath: String, limitCount: Int = 50): List<Map<String, Any?>> {
        delay(200)

        return when (collectionPath) {
            "games" -> getMockGames()
            else -> emptyList()
        }
    }

    private fun getMockGames(): List<Map<String, Any?>> {
        val today = jsGetCurrentDate()
        val tomorrow = jsGetDatePlusDays(1)
        val in3Days = jsGetDatePlusDays(3)
        val yesterday = jsGetDatePlusDays(-1)

        return listOf(
            mapOf(
                "id" to "game1",
                "title" to "Pelada do Sábado",
                "date" to today,
                "time" to "15:00",
                "endTime" to "17:00",
                "locationName" to "Campo do Parque Ibirapuera",
                "locationAddress" to "Av. Pedro Álvares Cabral, s/n - Vila Mariana",
                "status" to "SCHEDULED",
                "playersCount" to 10,
                "maxPlayers" to 14,
                "gameType" to "Society",
                "dailyPrice" to 25.0,
                "ownerName" to "João Silva",
                "groupId" to "group1",
                "groupName" to "Pelada dos Parças",
                "confirmations" to listOf(
                    mapOf("userId" to "u1", "userName" to "João Silva", "position" to "Goleiro", "status" to "CONFIRMED", "paymentStatus" to "PAID"),
                    mapOf("userId" to "u2", "userName" to "Pedro Santos", "position" to "Zagueiro", "status" to "CONFIRMED", "paymentStatus" to "PENDING"),
                    mapOf("userId" to "u3", "userName" to "Lucas Oliveira", "position" to "Meia", "status" to "CONFIRMED", "paymentStatus" to "PAID"),
                    mapOf("userId" to "u4", "userName" to "Marcos Lima", "position" to "Atacante", "status" to "PENDING", "paymentStatus" to "PENDING")
                )
            ),
            mapOf(
                "id" to "game2",
                "title" to "Racha do Domingo",
                "date" to tomorrow,
                "time" to "09:00",
                "endTime" to "11:00",
                "locationName" to "Ginásio Central",
                "locationAddress" to "Rua das Flores, 123 - Centro",
                "status" to "SCHEDULED",
                "playersCount" to 8,
                "maxPlayers" to 12,
                "gameType" to "Futsal",
                "dailyPrice" to 20.0,
                "ownerName" to "Carlos Ferreira",
                "groupId" to "group2",
                "groupName" to "Racha da Firma",
                "confirmations" to listOf(
                    mapOf("userId" to "u5", "userName" to "Carlos Ferreira", "position" to "Goleiro", "status" to "CONFIRMED", "paymentStatus" to "PAID"),
                    mapOf("userId" to "u6", "userName" to "André Souza", "position" to "Fixo", "status" to "CONFIRMED", "paymentStatus" to "PENDING")
                )
            ),
            mapOf(
                "id" to "game3",
                "title" to "Pelada Quartou!",
                "date" to in3Days,
                "time" to "19:00",
                "endTime" to "21:00",
                "locationName" to "Arena Futebol",
                "locationAddress" to "Av. Brasil, 500 - Jardim América",
                "status" to "CONFIRMED",
                "playersCount" to 14,
                "maxPlayers" to 14,
                "gameType" to "Society",
                "dailyPrice" to 30.0,
                "ownerName" to "João Silva",
                "groupId" to "group1",
                "groupName" to "Pelada dos Parças",
                "team1Name" to "Mengão",
                "team2Name" to "Fla-Flu",
                "team1Score" to 0,
                "team2Score" to 0,
                "team1Players" to listOf("João Silva", "Pedro Santos", "Lucas Oliveira", "Marcos Lima", "Rafael Costa", "Diego Souza", "Bruno Costa"),
                "team2Players" to listOf("André Lima", "Carlos Eduardo", "Fernando Silva", "Gustavo Santos", "Henrique Oliveira", "Igor Lima", "Julio Cesar"),
                "confirmations" to (1..14).map { i ->
                    mapOf("userId" to "u$i", "userName" to "Jogador $i", "position" to if (i <= 2) "Goleiro" else "Linheiro", "status" to "CONFIRMED", "paymentStatus" to if (i % 3 == 0) "PENDING" else "PAID")
                }
            ),
            mapOf(
                "id" to "game4",
                "title" to "Jogo Ao Vivo",
                "date" to today,
                "time" to "10:00",
                "endTime" to "12:00",
                "locationName" to "Campo da Escola",
                "locationAddress" to "Rua da Escola, 100",
                "status" to "LIVE",
                "playersCount" to 10,
                "maxPlayers" to 10,
                "gameType" to "Grama",
                "dailyPrice" to 15.0,
                "ownerName" to "Admin",
                "groupId" to "group1",
                "groupName" to "Pelada dos Parças",
                "team1Name" to "Amarelo",
                "team2Name" to "Azul",
                "team1Score" to 3,
                "team2Score" to 2,
                "team1Players" to listOf("João", "Pedro", "Lucas", "Marcos", "Rafael"),
                "team2Players" to listOf("André", "Carlos", "Fernando", "Gustavo", "Henrique"),
                "confirmations" to (1..10).map { i ->
                    mapOf("userId" to "u$i", "userName" to "Jogador $i", "position" to "Linheiro", "status" to "CONFIRMED", "paymentStatus" to "PAID")
                }
            ),
            mapOf(
                "id" to "game5",
                "title" to "Partida Finalizada",
                "date" to yesterday,
                "time" to "16:00",
                "endTime" to "18:00",
                "locationName" to "Estádio Municipal",
                "locationAddress" to "Av. Principal, 1000",
                "status" to "FINISHED",
                "playersCount" to 12,
                "maxPlayers" to 12,
                "gameType" to "Society",
                "dailyPrice" to 25.0,
                "ownerName" to "Carlos",
                "groupId" to "group2",
                "groupName" to "Racha da Firma",
                "team1Name" to "Vermelho",
                "team2Name" to "Preto",
                "team1Score" to 5,
                "team2Score" to 3,
                "team1Players" to listOf("Carlos", "André", "Bruno", "Diego", "Eduardo", "Fernando"),
                "team2Players" to listOf("Gustavo", "Henrique", "Igor", "Julio", "Kleber", "Lucas"),
                "confirmations" to (1..12).map { i ->
                    mapOf("userId" to "u$i", "userName" to "Jogador $i", "position" to "Linheiro", "status" to "CONFIRMED", "paymentStatus" to "PAID")
                }
            )
        )
    }

    suspend fun getUserGroups(): List<Map<String, Any?>> {
        delay(100)
        if (currentUserId == null) return emptyList()
        return mockGroups + createdGroups
    }

    suspend fun getGroupById(groupId: String): Map<String, Any?>? {
        delay(100)
        val allGroups = mockGroups + createdGroups
        return allGroups.find { it["id"] == groupId || it["groupId"] == groupId }
    }

    suspend fun getGroupMembers(groupId: String): List<Map<String, Any?>> {
        delay(100)
        return listOf(
            mapOf("id" to "u1", "userId" to "u1", "userName" to "João Silva", "role" to "OWNER"),
            mapOf("id" to "u2", "userId" to "u2", "userName" to "Pedro Santos", "role" to "ADMIN"),
            mapOf("id" to "u3", "userId" to "u3", "userName" to "Lucas Oliveira", "role" to "MEMBER")
        )
    }

    suspend fun createGroup(name: String, description: String, isPublic: Boolean): String? {
        delay(300)
        if (currentUserId == null) return null

        val timestamp = jsGetTimestamp()
        val groupId = "group-$timestamp"
        val newGroup = mapOf(
            "id" to groupId,
            "groupId" to groupId,
            "name" to name,
            "groupName" to name,
            "members" to 1,
            "memberCount" to 1,
            "role" to "OWNER",
            "description" to description,
            "isPublic" to isPublic,
            "nextGame" to null as String?
        )
        createdGroups.add(newGroup)
        return groupId
    }

    suspend fun leaveGroup(groupId: String): Boolean {
        delay(200)
        createdGroups.removeAll { it["id"] == groupId || it["groupId"] == groupId }
        return true
    }

    suspend fun getLocations(): List<Map<String, Any?>> {
        delay(150)
        return mockLocations + createdLocations
    }

    suspend fun getLocationById(locationId: String): Map<String, Any?>? {
        delay(100)
        val allLocations = mockLocations + createdLocations
        return allLocations.find { it["id"] == locationId }
    }

    suspend fun createLocation(
        name: String,
        address: String,
        city: String,
        state: String,
        neighborhood: String,
        fieldType: String,
        phone: String?,
        amenities: List<String>
    ): String? {
        delay(300)
        if (currentUserId == null) return null

        val timestamp = jsGetTimestamp()
        val locationId = "loc-$timestamp"
        val newLocation = mapOf(
            "id" to locationId,
            "name" to name,
            "address" to address,
            "city" to city,
            "state" to state,
            "neighborhood" to neighborhood,
            "rating" to 0.0,
            "ratingCount" to 0,
            "photoUrl" to null,
            "phone" to phone,
            "primaryFieldType" to fieldType,
            "fieldCount" to 1,
            "hasActiveFields" to true,
            "amenities" to amenities,
            "priceRange" to 0.0,
            "isActive" to true
        )
        createdLocations.add(newLocation)
        return locationId
    }

    private val mockNotifications = mutableListOf<Map<String, Any?>>()

    suspend fun getNotifications(): List<Map<String, Any?>> {
        delay(100)
        if (currentUserId == null) return emptyList()

        val now = jsGetTimestamp().toLong()
        if (mockNotifications.isEmpty()) {
            mockNotifications.addAll(listOf(
                mapOf(
                    "id" to "notif1",
                    "type" to "GAME_SUMMON",
                    "title" to "Convocação para jogo",
                    "message" to "Você foi convocado para Pelada do Sábado (22/02/2026)",
                    "read" to false,
                    "createdAt" to now - 3600000.0,
                    "referenceId" to "game1",
                    "referenceType" to "game"
                ),
                mapOf(
                    "id" to "notif2",
                    "type" to "GROUP_INVITE",
                    "title" to "Convite para grupo",
                    "message" to "Carlos Ferreira convidou você para o grupo Racha da Firma",
                    "read" to false,
                    "createdAt" to now - 7200000.0,
                    "referenceId" to "invite1",
                    "referenceType" to "invite"
                ),
                mapOf(
                    "id" to "notif3",
                    "type" to "ACHIEVEMENT",
                    "title" to "🏆 Nova conquista!",
                    "message" to "Você desbloqueou a conquista Goleador!",
                    "read" to false,
                    "createdAt" to now - 86400000.0,
                    "referenceId" to "badge1",
                    "referenceType" to "badge"
                ),
                mapOf(
                    "id" to "notif4",
                    "type" to "LEVEL_UP",
                    "title" to "⬆️ Subiu de nível!",
                    "message" to "Parabéns! Você alcançou o nível 12!",
                    "read" to true,
                    "createdAt" to now - 172800000.0,
                    "referenceId" to null,
                    "referenceType" to "level"
                ),
                mapOf(
                    "id" to "notif5",
                    "type" to "GAME_CONFIRMED",
                    "title" to "Jogo confirmado",
                    "message" to "Pelada do Sábado está confirmada com 14 jogadores!",
                    "read" to true,
                    "createdAt" to now - 259200000.0,
                    "referenceId" to "game1",
                    "referenceType" to "game"
                ),
                mapOf(
                    "id" to "notif6",
                    "type" to "MVP_RECEIVED",
                    "title" to "🏆 MVP da partida!",
                    "message" to "Você foi eleito o MVP da última partida!",
                    "read" to true,
                    "createdAt" to now - 345600000.0,
                    "referenceId" to "game5",
                    "referenceType" to "game"
                ),
                mapOf(
                    "id" to "notif7",
                    "type" to "GAME_REMINDER",
                    "title" to "Lembrete de jogo",
                    "message" to "Pelada do Sábado começa em 2 horas!",
                    "read" to false,
                    "createdAt" to now - 600000.0,
                    "referenceId" to "game1",
                    "referenceType" to "game"
                )
            ))
        }

        return mockNotifications.sortedByDescending { it["createdAt"] as? Double ?: 0.0 }
    }

    suspend fun getUnreadNotificationsCount(): Int {
        delay(50)
        return mockNotifications.count { it["read"] == false }
    }

    suspend fun markNotificationAsRead(notificationId: String): Boolean {
        delay(100)
        val index = mockNotifications.indexOfFirst { it["id"] == notificationId }
        if (index >= 0) {
            val notif = mockNotifications[index].toMutableMap()
            notif["read"] = true
            mockNotifications[index] = notif
            return true
        }
        return false
    }

    suspend fun markAllNotificationsAsRead(): Int {
        delay(150)
        var count = 0
        mockNotifications.forEachIndexed { index, notif ->
            if (notif["read"] == false) {
                val updated = notif.toMutableMap()
                updated["read"] = true
                mockNotifications[index] = updated
                count++
            }
        }
        return count
    }

    suspend fun deleteNotification(notificationId: String): Boolean {
        delay(100)
        return mockNotifications.removeAll { it["id"] == notificationId }
    }

    private val mockInvites = mapOf(
        "ABC123" to mapOf(
            "id" to "invite1",
            "code" to "ABC123",
            "groupId" to "group1",
            "inviterId" to "u1",
            "createdAt" to jsGetTimestamp(),
            "expiresAt" to jsGetTimestamp() + 7 * 24 * 60 * 60 * 1000,
            "used" to false
        ),
        "XYZ789" to mapOf(
            "id" to "invite2",
            "code" to "XYZ789",
            "groupId" to "group2",
            "inviterId" to "u2",
            "createdAt" to jsGetTimestamp(),
            "expiresAt" to jsGetTimestamp() + 7 * 24 * 60 * 60 * 1000,
            "used" to false
        )
    )

    private val mockUsers = mapOf(
        "u1" to mapOf("id" to "u1", "name" to "João Silva"),
        "u2" to mapOf("id" to "u2", "name" to "Pedro Santos"),
        "u3" to mapOf("id" to "u3", "name" to "Lucas Oliveira")
    )

    suspend fun getInviteByCode(code: String): Map<String, Any?>? {
        delay(100)
        val invite = mockInvites[code.uppercase()] ?: return null
        val now = jsGetTimestamp()
        val expiresAt = invite["expiresAt"] as? Double ?: return null
        if (now > expiresAt) return null
        if (invite["used"] == true) return null
        return invite
    }

    suspend fun acceptGroupInvite(code: String, groupId: String): Boolean {
        delay(200)
        if (currentUserId == null) return false
        val invite = mockInvites[code.uppercase()] ?: return false
        if (invite["groupId"] != groupId) return false
        return true
    }

    suspend fun getDocument(collection: String, documentId: String): Map<String, Any?>? {
        delay(100)
        return when (collection) {
            "users" -> mockUsers[documentId]
            else -> null
        }
    }

    suspend fun getGlobalRanking(limit: Int = 50): List<Map<String, Any?>> {
        delay(200)
        if (currentUserId == null) return emptyList()
        return getMockRanking()
    }

    suspend fun getGroupRanking(groupId: String, limit: Int = 50): List<Map<String, Any?>> {
        delay(200)
        if (currentUserId == null) return emptyList()
        return getMockRanking().map { player ->
            player + ("groupId" to groupId)
        }
    }

    suspend fun getMvpRanking(limit: Int = 50): List<Map<String, Any?>> {
        delay(200)
        if (currentUserId == null) return emptyList()
        return getMockRanking().sortedByDescending { it["mvpCount"] as? Int ?: 0 }
    }

    suspend fun getActiveSeason(): Map<String, Any?>? {
        delay(100)
        val now = jsGetTimestamp().toLong()
        return mapOf(
            "id" to "season_2026_02",
            "name" to "Temporada Fevereiro 2026",
            "description" to "Liga mensal de peladeiros",
            "startDate" to now - (15L * 24 * 60 * 60 * 1000),
            "endDate" to now + (10L * 24 * 60 * 60 * 1000),
            "isActive" to true,
            "totalParticipants" to 127,
            "totalGames" to 45
        )
    }

    suspend fun getSeasonRanking(seasonId: String, limit: Int = 50): List<Map<String, Any?>> {
        delay(200)
        return getMockRanking().mapIndexed { index, player ->
            player + mapOf(
                "seasonId" to seasonId,
                "leagueRating" to (1000 - index * 15 + (player["experiencePoints"] as? Long ?: 0L) / 10).coerceAtLeast(100),
                "division" to when {
                    index < 3 -> "DIAMANTE"
                    index < 10 -> "OURO"
                    index < 25 -> "PRATA"
                    else -> "BRONZE"
                }
            )
        }
    }

    suspend fun getUserSeasonStats(userId: String, seasonId: String): Map<String, Any?>? {
        delay(100)
        val ranking = getMockRanking().find { it["userId"] == userId }
            ?: getMockRanking().firstOrNull()
        val gamesPlayed: Int = (ranking?.get("totalGames") as? Int) ?: 12
        val goals: Int = (ranking?.get("totalGoals") as? Int) ?: 8
        val assists: Int = (ranking?.get("totalAssists") as? Int) ?: 11
        val mvpCount: Int = (ranking?.get("mvpCount") as? Int) ?: 2
        return mapOf(
            "userId" to userId,
            "seasonId" to seasonId,
            "division" to "OURO",
            "leagueRating" to 1285,
            "position" to 7,
            "gamesPlayed" to gamesPlayed,
            "wins" to 8,
            "draws" to 2,
            "losses" to 2,
            "goals" to goals,
            "assists" to assists,
            "saves" to 5,
            "mvpCount" to mvpCount,
            "xpEarned" to 450L,
            "points" to 156
        )
    }

    suspend fun getUserStatistics(userId: String): Map<String, Any?> {
        delay(150)
        return mapOf(
            "userId" to userId,
            "totalGames" to 45,
            "totalGoals" to 23,
            "totalAssists" to 31,
            "totalSaves" to 12,
            "totalWins" to 28,
            "totalDraws" to 7,
            "totalLosses" to 10,
            "mvpCount" to 6,
            "bestGkCount" to 2,
            "currentStreak" to 3,
            "bestStreak" to 8,
            "yellowCards" to 3,
            "redCards" to 0,
            "avgGoalsPerGame" to 0.51,
            "avgAssistsPerGame" to 0.69,
            "winRate" to 0.622
        )
    }

    suspend fun getGroupAverages(groupId: String): Map<String, Any?> {
        delay(100)
        return mapOf(
            "avgGoalsPerGame" to 0.45,
            "avgAssistsPerGame" to 0.55,
            "avgWins" to 12,
            "avgWinRate" to 0.52,
            "avgMvpCount" to 2.5,
            "totalPlayers" to 15
        )
    }

    suspend fun getStatisticsHistory(userId: String, months: Int = 6): List<Map<String, Any?>> {
        delay(150)
        return (1..months).map { month ->
            mapOf(
                "month" to "2026-${month.toString().padStart(2, '0')}",
                "games" to (4 + (month % 3)),
                "goals" to (2 + (month % 4)),
                "assists" to (3 + (month % 2)),
                "wins" to (2 + (month % 3)),
                "mvpCount" to (if (month % 2 == 0) 1 else 0),
                "xpEarned" to (80L + month * 10L)
            )
        }
    }

    suspend fun getSeasonPrizes(seasonId: String): List<Map<String, Any?>> {
        delay(100)
        return listOf(
            mapOf(
                "position" to 1,
                "title" to "Campeão da Temporada",
                "description" to "1º lugar no ranking",
                "xpBonus" to 500,
                "badgeId" to "SEASON_CHAMPION",
                "emoji" to "🏆"
            ),
            mapOf(
                "position" to 2,
                "title" to "Vice-Campeão",
                "description" to "2º lugar no ranking",
                "xpBonus" to 300,
                "badgeId" to "SEASON_RUNNER_UP",
                "emoji" to "🥈"
            ),
            mapOf(
                "position" to 3,
                "title" to "Terceiro Lugar",
                "description" to "3º lugar no ranking",
                "xpBonus" to 200,
                "badgeId" to "SEASON_THIRD",
                "emoji" to "🥉"
            ),
            mapOf(
                "position" to 0,
                "title" to "Rei do Gol",
                "description" to "Maior artilheiro",
                "xpBonus" to 150,
                "badgeId" to "TOP_SCORER",
                "emoji" to "⚽"
            ),
            mapOf(
                "position" to 0,
                "title" to "MVP Supremo",
                "description" to "Mais MVPs na temporada",
                "xpBonus" to 150,
                "badgeId" to "MVP_KING",
                "emoji" to "👑"
            )
        )
    }

    private val mockPlayers = listOf(
        mapOf(
            "userId" to "u1",
            "userName" to "João Silva",
            "nickname" to "Jota",
            "level" to 25,
            "experiencePoints" to 5230L,
            "preferredPosition" to "Atacante",
            "strikerRating" to 4.8,
            "midRating" to 3.5,
            "defenderRating" to 2.1,
            "gkRating" to 1.5,
            "groups" to listOf("group1", "group2"),
            "isCurrentUser" to false
        ),
        mapOf(
            "userId" to "u2",
            "userName" to "Pedro Santos",
            "nickname" to "Pedrão",
            "level" to 22,
            "experiencePoints" to 4180L,
            "preferredPosition" to "Meia",
            "strikerRating" to 3.2,
            "midRating" to 4.5,
            "defenderRating" to 3.8,
            "gkRating" to 1.2,
            "groups" to listOf("group1"),
            "isCurrentUser" to false
        ),
        mapOf(
            "userId" to "u3",
            "userName" to "Lucas Oliveira",
            "nickname" to "Lucao",
            "level" to 19,
            "experiencePoints" to 3650L,
            "preferredPosition" to "Zagueiro",
            "strikerRating" to 2.0,
            "midRating" to 3.0,
            "defenderRating" to 4.7,
            "gkRating" to 2.5,
            "groups" to listOf("group1", "group2"),
            "isCurrentUser" to false
        ),
        mapOf(
            "userId" to "u4",
            "userName" to "Marcos Lima",
            "nickname" to "Marquinhos",
            "level" to 18,
            "experiencePoints" to 3420L,
            "preferredPosition" to "Goleiro",
            "strikerRating" to 1.5,
            "midRating" to 2.0,
            "defenderRating" to 3.0,
            "gkRating" to 4.9,
            "groups" to listOf("group1"),
            "isCurrentUser" to false
        ),
        mapOf(
            "userId" to "u5",
            "userName" to "Carlos Ferreira",
            "nickname" to "Carlinhos",
            "level" to 17,
            "experiencePoints" to 3180L,
            "preferredPosition" to "Atacante",
            "strikerRating" to 4.2,
            "midRating" to 3.8,
            "defenderRating" to 2.0,
            "gkRating" to 1.0,
            "groups" to listOf("group2"),
            "isCurrentUser" to false
        ),
        mapOf(
            "userId" to "u6",
            "userName" to "André Souza",
            "nickname" to "Dedé",
            "level" to 16,
            "experiencePoints" to 2950L,
            "preferredPosition" to "Meia",
            "strikerRating" to 3.0,
            "midRating" to 4.3,
            "defenderRating" to 3.5,
            "gkRating" to 1.8,
            "groups" to listOf("group1", "group2"),
            "isCurrentUser" to false
        )
    )

    suspend fun searchPlayers(query: String): List<Map<String, Any?>> {
        delay(200)
        if (currentUserId == null) return emptyList()

        if (query.isEmpty()) {
            return mockPlayers.sortedByDescending { it["experiencePoints"] as? Long ?: 0L }
        }

        return mockPlayers.filter { player ->
            val name = (player["userName"] as? String ?: "").lowercase()
            val nickname = (player["nickname"] as? String ?: "").lowercase()
            val searchQuery = query.lowercase()
            name.contains(searchQuery) || nickname.contains(searchQuery)
        }.sortedByDescending { it["experiencePoints"] as? Long ?: 0L }
    }

    suspend fun getPlayerById(id: String): Map<String, Any?>? {
        delay(100)
        return mockPlayers.find { it["userId"] == id }
    }

    suspend fun getCommonGroups(userId: String): List<Map<String, Any?>> {
        delay(150)
        val player = mockPlayers.find { it["userId"] == userId }
        val playerGroups = (player?.get("groups") as? List<*>) ?: emptyList<String>()
        
        return mockGroups.filter { group ->
            playerGroups.contains(group["id"] as? String ?: group["groupId"] as? String)
        }
    }

    private fun getMockRanking(): List<Map<String, Any?>> {
        val currentUid = currentUserId ?: "mock-user-0"
        return listOf(
            mapOf(
                "userId" to "u1",
                "userName" to "João Silva",
                "nickname" to "Jota",
                "level" to 25,
                "experiencePoints" to 5230L,
                "totalGames" to 89,
                "totalGoals" to 67,
                "totalAssists" to 45,
                "totalWins" to 54,
                "mvpCount" to 12,
                "isCurrentUser" to false
            ),
            mapOf(
                "userId" to "u2",
                "userName" to "Pedro Santos",
                "nickname" to "Pedrão",
                "level" to 22,
                "experiencePoints" to 4180L,
                "totalGames" to 76,
                "totalGoals" to 52,
                "totalAssists" to 38,
                "totalWins" to 48,
                "mvpCount" to 9,
                "isCurrentUser" to false
            ),
            mapOf(
                "userId" to "u3",
                "userName" to "Lucas Oliveira",
                "nickname" to "Lucao",
                "level" to 19,
                "experiencePoints" to 3650L,
                "totalGames" to 65,
                "totalGoals" to 41,
                "totalAssists" to 29,
                "totalWins" to 38,
                "mvpCount" to 7,
                "isCurrentUser" to false
            ),
            mapOf(
                "userId" to currentUid,
                "userName" to (currentUserName ?: "Você"),
                "nickname" to "Peladeiro",
                "level" to 12,
                "experiencePoints" to 2450L,
                "totalGames" to 45,
                "totalGoals" to 23,
                "totalAssists" to 31,
                "totalWins" to 28,
                "mvpCount" to 6,
                "isCurrentUser" to true
            ),
            mapOf(
                "userId" to "u4",
                "userName" to "Marcos Lima",
                "nickname" to "Marquinhos",
                "level" to 18,
                "experiencePoints" to 3420L,
                "totalGames" to 62,
                "totalGoals" to 35,
                "totalAssists" to 42,
                "totalWins" to 35,
                "mvpCount" to 5,
                "isCurrentUser" to false
            ),
            mapOf(
                "userId" to "u5",
                "userName" to "Carlos Ferreira",
                "nickname" to "Carlinhos",
                "level" to 17,
                "experiencePoints" to 3180L,
                "totalGames" to 58,
                "totalGoals" to 28,
                "totalAssists" to 33,
                "totalWins" to 32,
                "mvpCount" to 4,
                "isCurrentUser" to false
            ),
            mapOf(
                "userId" to "u6",
                "userName" to "André Souza",
                "nickname" to "Dedé",
                "level" to 16,
                "experiencePoints" to 2950L,
                "totalGames" to 54,
                "totalGoals" to 31,
                "totalAssists" to 25,
                "totalWins" to 30,
                "mvpCount" to 5,
                "isCurrentUser" to false
            ),
            mapOf(
                "userId" to "u7",
                "userName" to "Rafael Costa",
                "nickname" to "Rafa",
                "level" to 15,
                "experiencePoints" to 2780L,
                "totalGames" to 51,
                "totalGoals" to 24,
                "totalAssists" to 28,
                "totalWins" to 28,
                "mvpCount" to 3,
                "isCurrentUser" to false
            ),
            mapOf(
                "userId" to "u8",
                "userName" to "Diego Souza",
                "nickname" to "Diegão",
                "level" to 14,
                "experiencePoints" to 2620L,
                "totalGames" to 48,
                "totalGoals" to 29,
                "totalAssists" to 22,
                "totalWins" to 26,
                "mvpCount" to 4,
                "isCurrentUser" to false
            ),
            mapOf(
                "userId" to "u9",
                "userName" to "Bruno Costa",
                "nickname" to "Bruninho",
                "level" to 14,
                "experiencePoints" to 2540L,
                "totalGames" to 46,
                "totalGoals" to 19,
                "totalAssists" to 31,
                "totalWins" to 25,
                "mvpCount" to 3,
                "isCurrentUser" to false
            ),
            mapOf(
                "userId" to "u10",
                "userName" to "Fernando Silva",
                "nickname" to "Nando",
                "level" to 13,
                "experiencePoints" to 2480L,
                "totalGames" to 44,
                "totalGoals" to 22,
                "totalAssists" to 19,
                "totalWins" to 24,
                "mvpCount" to 2,
                "isCurrentUser" to false
            ),
            mapOf(
                "userId" to "u11",
                "userName" to "Gustavo Santos",
                "nickname" to "Guga",
                "level" to 13,
                "experiencePoints" to 2350L,
                "totalGames" to 42,
                "totalGoals" to 17,
                "totalAssists" to 24,
                "totalWins" to 22,
                "mvpCount" to 2,
                "isCurrentUser" to false
            ),
            mapOf(
                "userId" to "u12",
                "userName" to "Henrique Oliveira",
                "nickname" to "Rique",
                "level" to 12,
                "experiencePoints" to 2280L,
                "totalGames" to 40,
                "totalGoals" to 21,
                "totalAssists" to 18,
                "totalWins" to 21,
                "mvpCount" to 3,
                "isCurrentUser" to false
            )
        ).sortedByDescending { it["experiencePoints"] as? Long ?: 0L }
    }

    data class AdminMetrics(
        val totalUsers: Int = 0,
        val totalGames: Int = 0,
        val totalGroups: Int = 0,
        val totalLocations: Int = 0,
        val activeUsersToday: Int = 0,
        val gamesThisWeek: Int = 0,
        val pendingReports: Int = 0,
        val newUsersThisMonth: Int = 0
    )

    data class AdminUser(
        val id: String,
        val name: String,
        val email: String,
        val role: String,
        val level: Int = 1,
        val totalGames: Int = 0,
        val createdAt: Long = 0L,
        val isActive: Boolean = true
    )

    data class Report(
        val id: String,
        val reporterId: String,
        val reporterName: String,
        val reportedUserId: String,
        val reportedUserName: String,
        val type: String,
        val reason: String,
        val description: String,
        val createdAt: Long,
        val status: String = "PENDING"
    )

    private val mockAdminUsers = listOf(
        AdminUser("u1", "João Silva", "joao@email.com", "ADMIN", 25, 89, jsGetTimestamp().toLong() - 86400000L * 30, true),
        AdminUser("u2", "Pedro Santos", "pedro@email.com", "FIELD_OWNER", 22, 76, jsGetTimestamp().toLong() - 86400000L * 45, true),
        AdminUser("u3", "Lucas Oliveira", "lucas@email.com", "PLAYER", 19, 65, jsGetTimestamp().toLong() - 86400000L * 60, true),
        AdminUser("u4", "Marcos Lima", "marcos@email.com", "PLAYER", 18, 62, jsGetTimestamp().toLong() - 86400000L * 15, true),
        AdminUser("u5", "Carlos Ferreira", "carlos@email.com", "PLAYER", 17, 58, jsGetTimestamp().toLong() - 86400000L * 20, true),
        AdminUser("u6", "André Souza", "andre@email.com", "PLAYER", 16, 54, jsGetTimestamp().toLong() - 86400000L * 10, true),
        AdminUser("u7", "Rafael Costa", "rafael@email.com", "PLAYER", 15, 51, jsGetTimestamp().toLong() - 86400000L * 5, true),
        AdminUser("u8", "admin@futeba.com", "admin@futeba.com", "ADMIN", 30, 100, jsGetTimestamp().toLong() - 86400000L * 90, true)
    )

    private val mockReports = mutableListOf(
        Report(
            id = "r1",
            reporterId = "u2",
            reporterName = "Pedro Santos",
            reportedUserId = "u3",
            reportedUserName = "Lucas Oliveira",
            type = "ABUSE",
            reason = "Comportamento agressivo durante o jogo",
            description = "O jogador teve uma atitude agressiva com outros participantes, xingando e empurrando jogadores do time adversário.",
            createdAt = jsGetTimestamp().toLong() - 3600000L,
            status = "PENDING"
        ),
        Report(
            id = "r2",
            reporterId = "u4",
            reporterName = "Marcos Lima",
            reportedUserId = "u5",
            reportedUserName = "Carlos Ferreira",
            type = "CHEATING",
            reason = "Suspeita de manipulação de resultados",
            description = "O jogador parece estar combinando resultados com outros jogadores para ganhar XP de forma injusta.",
            createdAt = jsGetTimestamp().toLong() - 7200000L,
            status = "PENDING"
        ),
        Report(
            id = "r3",
            reporterId = "u1",
            reporterName = "João Silva",
            reportedUserId = "u6",
            reportedUserName = "André Souza",
            type = "FAKE_PROFILE",
            reason = "Perfil falso/suspeito",
            description = "O perfil usa foto de celebridade e as informações parecem inconsistentes.",
            createdAt = jsGetTimestamp().toLong() - 86400000L,
            status = "PENDING"
        )
    )

    suspend fun getAdminMetrics(): AdminMetrics {
        delay(200)
        return AdminMetrics(
            totalUsers = 1247,
            totalGames = 3842,
            totalGroups = 89,
            totalLocations = 156,
            activeUsersToday = 312,
            gamesThisWeek = 105,
            pendingReports = mockReports.count { it.status == "PENDING" },
            newUsersThisMonth = 87
        )
    }

    suspend fun getAllUsers(): List<AdminUser> {
        delay(200)
        return mockAdminUsers
    }

    suspend fun updateUserRole(userId: String, newRole: String): Boolean {
        delay(200)
        return true
    }

    suspend fun getPendingReports(): List<Report> {
        delay(200)
        return mockReports.filter { it.status == "PENDING" }
    }

    suspend fun ignoreReport(reportId: String): Boolean {
        delay(100)
        val index = mockReports.indexOfFirst { it.id == reportId }
        if (index >= 0) {
            mockReports[index] = mockReports[index].copy(status = "REVIEWED")
            return true
        }
        return false
    }

    suspend fun warnUser(userId: String, reportId: String): Boolean {
        delay(200)
        val index = mockReports.indexOfFirst { it.id == reportId }
        if (index >= 0) {
            mockReports[index] = mockReports[index].copy(status = "RESOLVED")
            return true
        }
        return false
    }

    suspend fun banUser(userId: String, reportId: String): Boolean {
        delay(300)
        val index = mockReports.indexOfFirst { it.id == reportId }
        if (index >= 0) {
            mockReports[index] = mockReports[index].copy(status = "RESOLVED")
            return true
        }
        return false
    }
}

private external fun jsGetCurrentDate(): String
private external fun jsGetDatePlusDays(days: Int): String
private external fun jsGetTimestamp(): Double
