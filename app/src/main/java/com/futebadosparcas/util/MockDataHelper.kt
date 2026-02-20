package com.futebadosparcas.util

import com.futebadosparcas.domain.model.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import java.util.Date
import java.util.Locale
import kotlin.random.Random

/**
 * Helper para popular o Firebase com dados de desenvolvimento/teste
 * Útil para visualizar e validar a UI durante o desenvolvimento
 */
object MockDataHelper {

    private val firestore by lazy { FirebaseFirestore.getInstance() }
    private val auth by lazy { FirebaseAuth.getInstance() }

    // Nomes de jogadores brasileiros comuns
    private val firstNames = listOf(
        "João", "Pedro", "Lucas", "Gabriel", "Rafael", "Felipe", "Bruno", "Carlos",
        "Thiago", "Diego", "André", "Matheus", "Fernando", "Rodrigo", "Marcelo",
        "Daniel", "Gustavo", "Leonardo", "Ricardo", "Paulo", "Roberto", "Alexandre",
        "Vinicius", "Eduardo", "Henrique", "Leandro", "Fábio", "Márcio", "Anderson",
        "Wellington", "Renan", "Vitor", "William", "Erick", "Julio", "Marcos",
        "Igor", "Douglas", "Renato", "Caio", "Samuel"
    )

    private val lastNames = listOf(
        "Silva", "Santos", "Oliveira", "Souza", "Pereira", "Costa", "Ferreira",
        "Rodrigues", "Almeida", "Nascimento", "Lima", "Araújo", "Fernandes",
        "Carvalho", "Gomes", "Martins", "Rocha", "Ribeiro", "Alves", "Monteiro",
        "Mendes", "Barros", "Freitas", "Barbosa", "Pinto", "Moreira", "Cavalcanti",
        "Dias", "Castro", "Campos", "Cardoso", "Correia", "Teixeira", "Vieira"
    )

    // Locais de jogos
    private val locations = listOf(
        Location(
            name = "Arena Sports Meia Praia",
            address = "Av. Atlântica, 1200 - Meia Praia, Itapema - SC",
            lat = -27.0906,
            lng = -48.6133
        ),
        Location(
            name = "Centro Esportivo Itapema",
            address = "Rua 123, 456 - Centro, Itapema - SC",
            lat = -27.0850,
            lng = -48.6200
        ),
        Location(
            name = "Quadras do Canto da Praia",
            address = "Av. Nereu Ramos, 789 - Canto da Praia, Itapema - SC",
            lat = -27.0800,
            lng = -48.6050
        )
    )

    data class Location(
        val name: String,
        val address: String,
        val lat: Double,
        val lng: Double
    )

    /**
     * Gera um nome aleatório de jogador
     */
    private fun generatePlayerName(): String {
        val firstName = firstNames.random()
        val lastName = lastNames.random()
        return "$firstName $lastName"
    }

    /**
     * Popula o Firebase com dados mock
     * - 6 quadras
     * - 40 jogadores
     * - Jogos com estatísticas históricas
     */
    @Suppress("unused")
    suspend fun populateMockData(ownerId: String, ownerName: String): Result<String> {
        return try {
            val sb = StringBuilder()
            sb.appendLine("🎲 Populando dados de desenvolvimento...\n")

            // 1. Criar jogadores fictícios no Firestore
            val playerIds = mutableListOf<String>()
            sb.appendLine("👥 Criando 40 jogadores no Firebase...")
            repeat(40) { index ->
                val playerId = "mock_player_$index"
                playerIds.add(playerId)

                // Criar usuário no Firestore
                val playerName = generatePlayerName()
                val user = hashMapOf(
                    "name" to playerName,
                    "email" to "mock_$index@test.com",
                    "phone" to "+5547${String.format(Locale.US, "%09d", Random.nextInt(900000000) + 100000000)}",
                    "photo_url" to null,
                    "role" to "PLAYER",
                    "created_at" to Date(),
                    "updated_at" to Date()
                )
                firestore.collection("users").document(playerId).set(user).await()
            }
            sb.appendLine("✅ 40 jogadores criados\n")

            // 2. Criar jogos de exemplo
            sb.appendLine("⚽ Criando jogos de exemplo...")
            val gameIds = createMockGames(ownerId, ownerName)
            sb.appendLine("✅ ${gameIds.size} jogos criados\n")

            // 3. Criar confirmações para os jogos
            sb.appendLine("✔️ Criando confirmações...")
            val confirmationsCount = createMockConfirmations(gameIds, playerIds)
            sb.appendLine("✅ $confirmationsCount confirmações criadas\n")

            // 4. Criar estatísticas históricas
            sb.appendLine("📊 Criando estatísticas históricas...")
            val statsCount = createMockStats(gameIds)
            sb.appendLine("✅ $statsCount estatísticas criadas\n")

            sb.appendLine("🎉 Dados mock criados com sucesso!")
            Result.success(sb.toString())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Cria jogos de exemplo com diferentes status
     */
    private suspend fun createMockGames(
        ownerId: String,
        ownerName: String
    ): List<String> {
        val gameIds = mutableListOf<String>()
        val gamesCollection = firestore.collection("games")

        // Criar 10 jogos com status variados
        val statusList = listOf(
            "SCHEDULED", "SCHEDULED", "SCHEDULED",  // 3 agendados
            "CONFIRMED", "CONFIRMED",                // 2 confirmados
            "LIVE", "LIVE",                          // 2 ao vivo
            "FINISHED", "FINISHED", "FINISHED"       // 3 finalizados
        )

        statusList.forEach { status ->
            val location = locations.random()
            val docRef = gamesCollection.document()
            val gameId = docRef.id

                // Data baseada no status
            val daysOffset = when (status) {
                "FINISHED" -> -Random.nextInt(1, 30)  // Jogos passados
                "LIVE" -> 0                             // Hoje
                else -> Random.nextInt(1, 15)          // Futuros
            }
            val date = getDateString(daysOffset)
            val time = "${Random.nextInt(18, 23)}:00"

            val game = hashMapOf(
                // "id" removed - Firestore uses document ID
                "schedule_id" to "",
                "date" to date,
                "time" to time,
                "end_time" to "${time.split(":")[0].toInt() + 2}:00",
                "status" to status,
                "max_players" to 14,
                "players" to emptyList<String>(),
                "daily_price" to listOf(0.0, 20.0, 30.0, 40.0).random(),
                "confirmation_closes_at" to null,
                "number_of_teams" to 2,
                "owner_id" to ownerId,
                "owner_name" to ownerName,
                "location_name" to location.name,
                "location_address" to location.address,
                "location_lat" to location.lat,
                "location_lng" to location.lng,
                "field_name" to "Quadra ${Random.nextInt(1, 7)} - Society",
                "game_type" to "Society",
                "recurrence" to "none",
                "created_at" to Date(),
                "updated_at" to Date()
            )

            docRef.set(game).await()
            gameIds.add(gameId)
        }

        return gameIds
    }

    /**
     * Cria confirmações para os jogos
     */
    private suspend fun createMockConfirmations(
        gameIds: List<String>,
        playerIds: List<String>
    ): Int {
        val confirmationsCollection = firestore.collection("confirmations")
        var count = 0

        gameIds.forEach { gameId ->
            // Número aleatório de confirmações (6 a 14)
            val numConfirmations = Random.nextInt(6, 15)
            val selectedPlayers = playerIds.shuffled().take(numConfirmations)

            selectedPlayers.forEach { playerId ->
                val docRef = confirmationsCollection.document()

                // Buscar nome do usuário
                val userDoc = firestore.collection("users").document(playerId).get().await()
                val playerName = userDoc.getString("name") ?: generatePlayerName()

                val confirmation = hashMapOf(
                    // "id" removed
                    "game_id" to gameId,
                    "user_id" to playerId,
                    "user_name" to playerName,
                    "user_photo" to null,
                    "position" to if (Random.nextDouble() < 0.15) "GOALKEEPER" else "FIELD",
                    "status" to "CONFIRMED",
                    "payment_status" to listOf("PENDING", "PAID", "PAID").random(),
                    "is_casual_player" to Random.nextBoolean(),
                    "confirmed_at" to Date()
                )

                docRef.set(confirmation).await()
                count++
            }
        }

        return count
    }

    /**
     * Cria estatísticas históricas para jogos finalizados
     * E AGORA TAMBÉM popula a coleção global 'statistics'
     */
    private suspend fun createMockStats(
        gameIds: List<String>
    ): Int {
        val playerStatsCollection = firestore.collection("player_stats")
        val globalStatsCollection = firestore.collection("statistics")
        var count = 0

        // Map para agregar estatísticas globais: UserId -> Stats
        val globalAggregator = mutableMapOf<String, MutableMap<String, Any>>()

        // Pegar apenas jogos finalizados
        val finishedGames = gameIds.takeLast(3)

        finishedGames.forEach { gameId ->
            // Buscar confirmações desse jogo
            val confirmations = firestore.collection("confirmations")
                .whereEqualTo("game_id", gameId)
                .get()
                .await()

            confirmations.documents.forEach { doc ->
                val playerId = doc.getString("user_id") ?: return@forEach
                val position = doc.getString("position") ?: "FIELD"

                val docRef = playerStatsCollection.document()

                val isGoalkeeper = (position == "GOALKEEPER")
                val goals = if (isGoalkeeper) 0 else Random.nextInt(0, 4)
                val saves = if (isGoalkeeper) Random.nextInt(3, 12) else 0
                val isBestPlayer = (goals >= 3 && Random.nextDouble() < 0.2)
                val isWorstPlayer = (Random.nextDouble() < 0.05)
                val bestGoal = (goals > 0 && Random.nextDouble() < 0.1)

                // Estatísticas da partida
                val stats = hashMapOf(
                    // "id" removed
                    "game_id" to gameId,
                    "user_id" to playerId,
                    "team_id" to "team_${Random.nextInt(1, 3)}",
                    "goals" to goals,
                    "saves" to saves,
                    "is_best_player" to isBestPlayer,
                    "is_worst_player" to isWorstPlayer,
                    "best_goal" to bestGoal
                )

                docRef.set(stats).await()
                count++

                // --- Agregação Global ---
                val userGlobal = globalAggregator.getOrPut(playerId) {
                    mutableMapOf(
                        "matches_played" to 0L,
                        "goals" to 0L,
                        "saves" to 0L,
                        "man_of_the_match" to 0L,
                        "best_goals" to 0L,
                         // Campos extras para MAD/Gamificação
                        "rating" to 5.0,
                        "xp" to 0L
                    )
                }

                userGlobal["matches_played"] = (userGlobal["matches_played"] as Long) + 1
                userGlobal["goals"] = (userGlobal["goals"] as Long) + goals
                userGlobal["saves"] = (userGlobal["saves"] as Long) + saves
                if (isBestPlayer) userGlobal["man_of_the_match"] = (userGlobal["man_of_the_match"] as Long) + 1
                if (bestGoal) userGlobal["best_goals"] = (userGlobal["best_goals"] as Long) + 1
                // Simples XP
                userGlobal["xp"] = (userGlobal["xp"] as Long) + (goals * 10) + (if(isBestPlayer) 50 else 0) + 5 // 5xp por jogo
            }
        }

        // Salvar Estatísticas Globais
        globalAggregator.forEach { (userId, statsMap) ->
            // "statistics/{userId}"
            globalStatsCollection.document(userId).set(statsMap).await()
        }

        return count
    }


    /**
     * Limpa todos os dados mock do Firebase
     */
    suspend fun clearAllMockData(): Result<String> {
        return try {
            val sb = StringBuilder()
            sb.appendLine("🗑️ Limpando dados mock...\n")

            // 1. Deletar usuários mock
            val usersSnapshot = firestore.collection("users")
                 .whereGreaterThanOrEqualTo(com.google.firebase.firestore.FieldPath.documentId(), "mock_user_")
                 .whereLessThan(com.google.firebase.firestore.FieldPath.documentId(), "mock_user_~")
                 .get().await()
            
            usersSnapshot.documents.forEach { it.reference.delete().await() }
            sb.appendLine("Usuários mock deletados: ${usersSnapshot.size()}")

            // 2. Deletar confirmações mock (user_id começa com mock_user_)
            val confSnapshot = firestore.collection("confirmations")
                 .whereGreaterThanOrEqualTo("user_id", "mock_user_")
                 .whereLessThan("user_id", "mock_user_~")
                 .get().await()

            confSnapshot.documents.forEach { it.reference.delete().await() }
            sb.appendLine("Confirmações de mock deletadas: ${confSnapshot.size()}")

            // 3. Deletar Locations mock (owner_id == "mock_admin")
            val locSnapshot = firestore.collection("locations")
                .whereEqualTo("owner_id", "mock_admin")
                .get().await()
            
            locSnapshot.documents.forEach { it.reference.delete().await() }
            sb.appendLine("Locais mock deletados: ${locSnapshot.size()}")

            // 4. Deletar Games mock (owner_id == "mock_admin" ou criados por mocks)
            val gamesSnapshot = firestore.collection("games")
                .whereEqualTo("owner_id", "mock_admin")
                .get().await()

            gamesSnapshot.documents.forEach { it.reference.delete().await() }
            sb.appendLine("Jogos mock e estatísticas deletados: ${gamesSnapshot.size()}")
            
            // Nota: Estatísticas (player_stats) são deletadas via cascade ou teríamos que buscar. 
            // Simplificação: vamos buscar stats de jogos mock se possível, mas por agora limpa o principal.

            sb.appendLine("\n✅ Dados limpos com sucesso!")
            Result.success(sb.toString())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Cria 50 usuários base para testes de usabilidade (Apenas homens por enquanto)
     */
    suspend fun createBaseUsers(count: Int = 50): Result<String> {
        return try {
            val usersCollection = firestore.collection("users")
            var createdCount = 0

            repeat(count) {
                val id = "mock_user_$it"
                val name = generatePlayerName()
                val email = "mock_$it@test.com"
                // Fotos apenas de homens (0-99)
                val photoUrl = "https://randomuser.me/api/portraits/men/${it % 100}.jpg"

                // Gerar ratings variados (números inteiros de 1 a 5)
                // 20% especialistas (alto em 1 posição)
                // 30% versáteis (médio em todas)
                // 50% jogadores normais (variados)
                val rand = Random.nextDouble()
                val (striker, mid, defender, gk) = when {
                    rand < 0.20 -> {
                        // Especialista: alto em uma posição, baixo nas outras
                        when (Random.nextInt(4)) {
                            0 -> listOf(Random.nextInt(4, 6).toDouble(), Random.nextInt(1, 3).toDouble(), Random.nextInt(1, 3).toDouble(), Random.nextInt(1, 3).toDouble())
                            1 -> listOf(Random.nextInt(1, 3).toDouble(), Random.nextInt(4, 6).toDouble(), Random.nextInt(1, 3).toDouble(), Random.nextInt(1, 3).toDouble())
                            2 -> listOf(Random.nextInt(1, 3).toDouble(), Random.nextInt(1, 3).toDouble(), Random.nextInt(4, 6).toDouble(), Random.nextInt(1, 3).toDouble())
                            else -> listOf(Random.nextInt(1, 3).toDouble(), Random.nextInt(1, 3).toDouble(), Random.nextInt(1, 3).toDouble(), Random.nextInt(4, 6).toDouble())
                        }
                    }
                    rand < 0.50 -> {
                        // Versátil: médio em todas (3-4)
                        listOf(Random.nextInt(3, 5).toDouble(), Random.nextInt(3, 5).toDouble(), Random.nextInt(3, 5).toDouble(), Random.nextInt(3, 5).toDouble())
                    }
                    else -> {
                        // Normal: variados (1-5)
                        listOf(Random.nextInt(1, 6).toDouble(), Random.nextInt(1, 6).toDouble(), Random.nextInt(1, 6).toDouble(), Random.nextInt(1, 6).toDouble())
                    }
                }

                // Preferências de tipo de campo (1-3 tipos)
                val allFieldTypes = listOf(FieldType.SOCIETY, FieldType.FUTSAL, FieldType.CAMPO)
                val numPreferences = Random.nextInt(1, 4) // 1, 2 ou 3 tipos
                val preferredTypes = allFieldTypes.shuffled().take(numPreferences)

                val user = User(
                    id = id,
                    email = email,
                    name = name,
                    photoUrl = photoUrl,
                    strikerRating = striker,
                    midRating = mid,
                    defenderRating = defender,
                    gkRating = gk,
                    preferredFieldTypes = preferredTypes,
                    role = UserRole.PLAYER.name,
                    isSearchable = true,
                    createdAt = Date().time,
                    updatedAt = Date().time
                )
                usersCollection.document(id).set(user).await()
                createdCount++
            }
            Result.success("Criados $createdCount usuários mock (homens) com ratings variados.")
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun createMockLocationsAndFields(): Result<String> {
        return try {
            val locationsCollection = firestore.collection("locations")
            val fieldsCollection = firestore.collection("fields")
            var createdCount = 0
            
            locations.forEach { locData ->
                // Check if exists or create new
                val id = "mock_loc_${locData.name.hashCode()}" // deterministic ID
                val location = hashMapOf(
                    "id" to id,
                    "name" to locData.name,
                    "address" to locData.address,
                    "lat" to locData.lat,
                    "lng" to locData.lng,
                    "owner_id" to "mock_admin", // Special owner for mocks
                    "created_at" to Date()
                )
                locationsCollection.document(id).set(location).await()
                
                // Create Fields for this location
                repeat(2) { fieldIdx ->
                    val fieldId = "mock_field_${id}_$fieldIdx"
                    val field = hashMapOf(
                        "id" to fieldId,
                        "location_id" to id,
                        "name" to "Quadra ${fieldIdx + 1} - Society",
                        "type" to "Society",
                        "has_parking" to true,
                        "has_bar" to true,
                        "has_dressing_room" to true,
                        "price_per_hour" to 150.0
                    )
                    fieldsCollection.document(fieldId).set(field).await()
                }
                createdCount++
            }
             Result.success("Criados $createdCount locais mock com quadras.")
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun createMockHistoricalData(): Result<String> {
        return try {
             // 1. Ensure users exist
             val usersCheck = firestore.collection("users").document("mock_user_0").get().await()
             if (!usersCheck.exists()) createBaseUsers()
             
             // 2. Ensure locations exist
             createMockLocationsAndFields()
             
             // 3. Create Games
             // Generate player IDs list
             val playerIds = (0 until 40).map { "mock_user_$it" }
             val gameIds = createMockGames("mock_admin", "Admin Mock")
             
             // 4. Confirmations
             createMockConfirmations(gameIds, playerIds)
             
             // 5. Stats
             createMockStats(gameIds)
             
             Result.success("Histórico completo gerado com sucesso!")
        } catch (e: Exception) {
             Result.failure(e)
        }
    }

    @Suppress("unused")
    suspend fun addRandomPlayersToGame(gameId: String): Result<String> {
        return try {
            // 1. Buscar dados do jogo para ver o limite
            val gameSnapshot = firestore.collection("games").document(gameId).get().await()
            val game = gameSnapshot.toObject(Game::class.java)
                ?: return Result.failure(Exception("Jogo não encontrado"))
            
            val maxPlayers = game.maxPlayers
            
            // 2. Buscar confirmações atuais
            val confirmationsCollection = firestore.collection("confirmations")
            val currentConfirmations = confirmationsCollection
                .whereEqualTo("game_id", gameId)
                .get().await()
                
            val currentCount = currentConfirmations.size()
            val slotsAvailable = maxPlayers - currentCount
            
            if (slotsAvailable <= 0) {
                return Result.failure(Exception("O jogo já está cheio ($currentCount/$maxPlayers)"))
            }
            
             // 3. Buscar usuários mock
             val usersSnapshot = firestore.collection("users")
                 .whereGreaterThanOrEqualTo(com.google.firebase.firestore.FieldPath.documentId(), "mock_user_")
                 .whereLessThan(com.google.firebase.firestore.FieldPath.documentId(), "mock_user_~")
                 .get().await()
             
             val allMockUsers = usersSnapshot.toObjects(User::class.java)

             if (allMockUsers.isEmpty()) return Result.failure(Exception("Nenhum usuário mock encontrado. Crie os usuários primeiro."))

             // Filtrar usuários que já estão no jogo
             val confirmedUserIds = currentConfirmations.documents.map { it.getString("user_id") ?: "" }.toSet()
             val availableUsers = allMockUsers.filter { it.id !in confirmedUserIds }
             
             if (availableUsers.isEmpty()) return Result.failure(Exception("Todos os usuários mock já estão neste jogo."))

             // Selecionar aleatórios para preencher as vagas
             val selectedUsers = availableUsers.shuffled().take(slotsAvailable)
             var addedCount = 0

             selectedUsers.forEach { user ->
                 val confirmation = GameConfirmation(
                     id = confirmationsCollection.document().id,
                     gameId = gameId,
                     userId = user.id,
                     userName = user.name,
                     userPhoto = user.photoUrl,
                     position = if(Random.nextBoolean()) PlayerPosition.LINE.name else PlayerPosition.GOALKEEPER.name,
                     status = ConfirmationStatus.CONFIRMED.name,
                     paymentStatus = PaymentStatus.PENDING.name,
                     confirmedAt = Date()
                 )
                 confirmationsCollection.document(confirmation.id).set(confirmation).await()
                 addedCount++
             }
             
             Result.success("Adicionados $addedCount jogadores (Limite: $maxPlayers).")
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Limpa jogos inválidos E os jogos fantasmas específicos relatados
     */
    suspend fun cleanUpInvalidGames(): Result<String> {
        return try {
            val gamesCollection = firestore.collection("games")
            val allGames = gamesCollection.get().await()
            var deletedCount = 0
            val analyzedCount = allGames.size()

            // Alvos específicos (Data, Local)
            val targets = listOf(
                Pair("2026-02-17", "Quadras do Canto da Praia"),
                Pair("2025-12-30", "Arena Sports Meia Praia")
            )

            allGames.documents.forEach { doc ->
                val data = doc.data ?: return@forEach

                val locationName = data["location_name"] as? String
                val date = data["date"] as? String
                
                // 1. Critério: Jogos inválidos/sem dados
                if (locationName.isNullOrEmpty() || date.isNullOrEmpty()) {
                    deleteGameFully(doc.id)
                    deletedCount++
                } 
                // 2. Critério: Alvos específicos (Jogos Fantasmas)
                else {
                    val isTarget = targets.any { (targetDate, targetLoc) -> 
                        date == targetDate && locationName == targetLoc
                    }
                    if (isTarget) {
                        deleteGameFully(doc.id)
                        deletedCount++
                    }
                }
            }

            Result.success("Analisados: $analyzedCount. Removidos: $deletedCount (incluindo os fantasmas 👻).")
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Remove especificamente documentos de player_stats relacionados a usuários mockados
     */
    suspend fun cleanUpMockStats(): Result<String> {
        return try {
            val statsCollection = firestore.collection("player_stats")
            
            // Buscar por user_id começando com "mock_"
            // Nota: Firestore não tem "startsWith", usamos range
            val snapshot = statsCollection
                .whereGreaterThanOrEqualTo("user_id", "mock_")
                .whereLessThan("user_id", "mock_~")
                .get()
                .await()
                
            val count = snapshot.size()
            snapshot.documents.forEach { it.reference.delete() } // Fire and forget deletes usually ok for scripts
            
            // Também limpar estatísticas globais
            val globalStats = firestore.collection("statistics")
                .whereGreaterThanOrEqualTo(com.google.firebase.firestore.FieldPath.documentId(), "mock_")
                .whereLessThan(com.google.firebase.firestore.FieldPath.documentId(), "mock_~")
                .get()
                .await()
                
            globalStats.documents.forEach { it.reference.delete() }
            
            Result.success("Removidos $count registros de player_stats mockados e estatísticas globais.")
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun deleteGameFully(gameId: String) {
        // 1. Delete Confirmations
        val confirmations = firestore.collection("confirmations")
            .whereEqualTo("game_id", gameId)
            .get().await()
        confirmations.documents.forEach { it.reference.delete() }

        // 2. Delete Stats
        val stats = firestore.collection("player_stats")
            .whereEqualTo("game_id", gameId)
            .get().await()
        stats.documents.forEach { it.reference.delete() }

        // 3. Delete Game
        firestore.collection("games").document(gameId).delete().await()
    }

    /**
     * Gera string de data baseado no offset em dias
     */
    private fun getDateString(daysOffset: Int): String {
        val calendar = java.util.Calendar.getInstance()
        calendar.add(java.util.Calendar.DAY_OF_YEAR, daysOffset)
        return String.format(
            Locale.US,
            "%04d-%02d-%02d",
            calendar.get(java.util.Calendar.YEAR),
            calendar.get(java.util.Calendar.MONTH) + 1,
            calendar.get(java.util.Calendar.DAY_OF_MONTH)
        )
    }
    suspend fun cleanUpPendingInvitesAndSummons(): Result<String> {
        return try {
            val sb = StringBuilder()
            
            // 1. Limpar group_invites pendentes
            val groupInvites = firestore.collection("group_invites")
                .whereEqualTo("status", "PENDING")
                .get().await()
            groupInvites.documents.forEach { it.reference.delete().await() }
            sb.appendLine("Convites de grupo deletados: ${groupInvites.size()}")

            // 2. Limpar game_summons pendentes
            val gameSummons = firestore.collection("game_summons")
                .whereEqualTo("status", "PENDING")
                .get().await()
            gameSummons.documents.forEach { it.reference.delete().await() }
            sb.appendLine("Convocações de jogo deletadas: ${gameSummons.size()}")

            // 3. Limpar notificações de convite/convocação
            // Como whereIn tem limites, e queremos ser precisos
            val notificationTypes = listOf("GROUP_INVITE", "GAME_SUMMON")
            val notifications = firestore.collection("notifications")
                .whereIn("type", notificationTypes)
                .get().await()
            notifications.documents.forEach { it.reference.delete().await() }
            sb.appendLine("Notificações de convite/convocação deletadas: ${notifications.size()}")

            Result.success(sb.toString())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun forcePromoteCurrentUserToAdmin(): Result<String> {
        return try {
            val uid = auth.currentUser?.uid ?: return Result.failure(Exception("Não logado"))
            firestore.collection("users").document(uid).update("role", "ADMIN").await()
            Result.success("Usuário $uid promovido a ADMIN com sucesso!")
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
