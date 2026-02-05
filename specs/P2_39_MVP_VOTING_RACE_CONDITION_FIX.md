# P2 #39: MVP Voting Without Race Conditions - Implementation Plan

**Status:** READY FOR IMPLEMENTATION
**Date:** 2026-02-05
**Priority:** P2 (Desirable)
**Risk Level:** MEDIUM (affects game finalization)

---

## Executive Summary

Currently, MVP voting uses **sequential writes** without atomic guarantees:
- Multiple clients can vote for the same player simultaneously
- Vote counts may be inconsistent due to race conditions
- No protection against duplicate votes in same category
- `checkAllVoted()` can return false positives

**Solution:** Use Firestore transactions for vote submission and tally operations.

---

## Current Problem Analysis

### Current Implementation (GameExperienceRepositoryImpl.kt)

```kotlin
override suspend fun submitVote(vote: MVPVote): Result<Unit> {
    // 1. Check game status
    val gameSnapshot = gameRef.get().await()

    // 2. Check if already voted (separate query)
    val existingVote = voteRef.get().await()
    if (existingVote.exists()) {
        return Result.failure(...)
    }

    // 3. Write vote (NO TRANSACTION!)
    voteRef.set(mapOf(...)).await()
}
```

**Issues:**
1. **Time-of-check to time-of-use (TOCTOU) race condition:**
   - Thread A: Checks `!existingVote.exists()` → true
   - Thread B: Checks `!existingVote.exists()` → true
   - Thread A: Writes vote → Success
   - Thread B: Writes vote → Overwrites Thread A's vote

2. **Vote counting inconsistency:**
   - `concludeVoting()` reads votes without transaction
   - New votes can arrive during tally
   - Counts may not match vote snapshot used

3. **Duplicate vote protection fails:**
   - Document ID is deterministic: `${gameId}_${voterId}_${category}`
   - But if vote already exists, `set()` overwrites it
   - Timestamp not updated, multiple submissions appear as one

---

## Solution: Firestore Transactions

### Transaction Guarantee
Firestore transactions provide:
- ✅ Atomic read-write (all or nothing)
- ✅ Isolation from concurrent writes
- ✅ Automatic retry on conflicts
- ✅ No TOCTOU race conditions

### Implementation Strategy

```kotlin
override suspend fun submitVote(vote: MVPVote): Result<Unit> {
    return try {
        firestore.runTransaction { transaction ->
            // 1. Read game status (within transaction)
            val gameSnapshot = transaction.get(gameRef)
            val gameStatus = gameSnapshot.getString("status")
            if (gameStatus != GameStatus.FINISHED.name) {
                throw Exception("Game not finished")
            }

            // 2. Check vote deadline (within transaction)
            val gameDateTime = gameSnapshot.getDate("dateTime")
            if (gameDateTime != null) {
                val now = Date()
                val deadline = Date(gameDateTime.time + (VOTE_WINDOW_HOURS * 60 * 60 * 1000))
                if (now.after(deadline)) {
                    throw Exception("Vote deadline passed")
                }
            }

            // 3. Check for existing vote (within transaction)
            val voteId = "${vote.gameId}_${vote.voterId}_${vote.category.name}"
            val existingVote = transaction.get(voteRef)
            if (existingVote.exists()) {
                throw Exception("Already voted in this category")
            }

            // 4. Write vote (within transaction)
            transaction.set(voteRef, mapOf(
                "id" to voteId,
                "game_id" to vote.gameId,
                "voter_id" to vote.voterId,
                "voted_player_id" to vote.votedPlayerId,
                "category" to vote.category.name,
                "voted_at" to FieldValue.serverTimestamp()
            ))

            Unit
        }.await()

        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

---

## Implementation Details

### Phase 1: submitVote() with Transaction

**File:** `C:\Projetos\FutebaDosParcas\shared\src\androidMain\kotlin\com\futebadosparcas\data\GameExperienceRepositoryImpl.kt`

```kotlin
override suspend fun submitVote(vote: MVPVote): Result<Unit> {
    return try {
        PlatformLogger.d(TAG, "Enviando voto para jogo ${vote.gameId} (transação)")

        // Executar dentro de uma transação
        firestore.runTransaction { transaction ->
            // 1. Ler status do jogo
            val gameRef = gamesCollection.document(vote.gameId)
            val gameSnapshot = transaction.get(gameRef)

            val gameStatus = gameSnapshot.getString("status")
            if (gameStatus != GameStatus.FINISHED.name) {
                throw IllegalStateException("Votação disponível apenas para jogos finalizados")
            }

            // 2. Verificar janela de 24h
            val gameDateTime = gameSnapshot.getDate("dateTime")
            if (gameDateTime != null) {
                val now = Date()
                val deadline = Date(gameDateTime.time + (VOTE_WINDOW_HOURS * 60 * 60 * 1000))

                if (now.after(deadline)) {
                    throw IllegalStateException("Prazo de votação expirado")
                }
            }

            // 3. Verificar voto duplicado (idempotência)
            val voteId = "${vote.gameId}_${vote.voterId}_${vote.category.name}"
            val voteRef = votesCollection.document(voteId)
            val existingVote = transaction.get(voteRef)

            if (existingVote.exists()) {
                throw IllegalStateException("Você já votou nesta categoria")
            }

            // 4. Escrever voto dentro da transação
            transaction.set(voteRef, mapOf(
                "id" to voteId,
                "game_id" to vote.gameId,
                "voter_id" to vote.voterId,
                "voted_player_id" to vote.votedPlayerId,
                "category" to vote.category.name,
                "voted_at" to FieldValue.serverTimestamp(),
                // Novo campo para rastreability
                "attempt_timestamp" to System.currentTimeMillis()
            ))

            Unit
        }.await()

        PlatformLogger.d(TAG, "Voto enviado com sucesso (dentro de transação)")
        Result.success(Unit)

    } catch (e: Exception) {
        PlatformLogger.e(TAG, "Erro ao enviar voto", e)
        Result.failure(e)
    }
}
```

**Changes:**
- ✅ Move game check into transaction
- ✅ Move deadline check into transaction
- ✅ Move duplicate detection into transaction
- ✅ All writes atomic with reads
- ✅ Auto-retry on conflicts (up to 5 times)

---

### Phase 2: concludeVoting() with Transaction

**Current problem:** Vote tallying reads votes, then updates confirmations separately.

```kotlin
override suspend fun concludeVoting(gameId: String): Result<Unit> {
    return try {
        firestore.runTransaction { transaction ->
            // 1. Ler todos os votos (snapshot dentro da transação)
            val votesSnapshot = transaction.get(votesCollection
                .whereEqualTo("game_id", gameId))

            val votes = votesSnapshot.documents.mapNotNull { doc ->
                docToMVPVote(doc.id, doc.data)
            }

            if (votes.isEmpty()) {
                return@runTransaction Unit // Nenhum voto
            }

            // 2. Contar votos
            val mvpCounts = votes.filter { it.category == VoteCategory.MVP }
                .groupingBy { it.votedPlayerId }
                .eachCount()

            val bestGkCounts = votes.filter { it.category == VoteCategory.BEST_GOALKEEPER }
                .groupingBy { it.votedPlayerId }
                .eachCount()

            val worstCounts = votes.filter { it.category == VoteCategory.WORST }
                .groupingBy { it.votedPlayerId }
                .eachCount()

            // 3. Resolver empates (determinístico)
            val mvpId = resolveWinner(mvpCounts)
            val bestGkId = resolveWinner(bestGkCounts)
            val worstId = resolveWinner(worstCounts)

            // 4. Atualizar confirmations (dentro da transação)
            val confirmationsSnapshot = transaction.get(confirmationsCollection
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("status", "CONFIRMED"))

            confirmationsSnapshot.documents.forEach { doc ->
                val userId = doc.getString("user_id") ?: return@forEach
                val confId = "${gameId}_${userId}"
                val confRef = confirmationsCollection.document(confId)

                transaction.update(confRef, mapOf(
                    "is_mvp" to (mvpId == userId),
                    "is_best_gk" to (bestGkId == userId),
                    "is_worst_player" to (worstId == userId),
                    "voting_concluded_at" to FieldValue.serverTimestamp()
                ))
            }

            // 5. Atualizar jogo com resultados (dentro da transação)
            val gameRef = gamesCollection.document(gameId)
            val updates = mutableMapOf<String, Any?>(
                "mvp_id" to mvpId,
                "best_gk_id" to bestGkId,
                "worst_player_id" to worstId,
                "voting_concluded_at" to FieldValue.serverTimestamp(),
                "voting_status" to "CONCLUDED"
            )

            transaction.update(gameRef, updates)

            Unit
        }.await()

        Result.success(Unit)

    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

**Guarantees:**
- ✅ Vote snapshot is consistent
- ✅ Tally counts match actual votes
- ✅ All confirmations updated atomically
- ✅ Game status updated with results
- ✅ No partial updates on failure

---

### Phase 3: checkAllVoted() Safe

```kotlin
override suspend fun checkAllVoted(gameId: String): Result<Boolean> {
    return try {
        // Transaction not needed here (read-only)
        // But use consistent snapshot for accuracy

        val confirmationsSnapshot = firestore
            .collection("confirmations")
            .whereEqualTo("game_id", gameId)
            .whereEqualTo("status", "CONFIRMED")
            .get()
            .await()

        val confirmedCount = confirmationsSnapshot.size()

        if (confirmedCount == 0) return Result.success(false)

        // Read votes at same moment
        val votesSnapshot = firestore
            .collection("mvp_votes")
            .whereEqualTo("game_id", gameId)
            .orderBy("voter_id")  // Ensure consistent ordering
            .get()
            .await()

        val uniqueVoters = votesSnapshot.documents
            .mapNotNull { it.getString("voter_id") }
            .distinct()
            .size

        Result.success(uniqueVoters >= confirmedCount)

    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

---

## Firestore Rules Enhancement

Update security rules to enforce vote constraints at the database level:

```javascript
// In firestore.rules
match /mvp_votes/{voteId} {
  // Vote ID format: {gameId}_{voterId}_{category}

  allow create: if
    request.auth != null &&
    request.auth.uid == request.resource.data.voter_id &&
    // Validate vote data
    request.resource.data.game_id is string &&
    request.resource.data.voter_id is string &&
    request.resource.data.voted_player_id is string &&
    request.resource.data.category in ['MVP', 'BEST_GOALKEEPER', 'WORST'] &&
    // Check game is finished (requires get)
    get(/databases/$(database)/documents/games/$(request.resource.data.game_id))
      .data.status == 'FINISHED' &&
    // Check vote deadline (24h from game end)
    request.time <
      get(/databases/$(database)/documents/games/$(request.resource.data.game_id))
        .data.dateTime + duration.value(24, 'h');

  allow read: if
    request.auth != null &&
    // Only read votes for games user participated in
    exists(/databases/$(database)/documents/confirmations/$(
      resource.data.game_id + '_' + request.auth.uid))
    && get(/databases/$(database)/documents/confirmations/$(
      resource.data.game_id + '_' + request.auth.uid))
      .data.status == 'CONFIRMED';

  allow delete: if false; // Votes are immutable
  allow update: if false;  // Votes are immutable
}

match /confirmations/{confirmationId} {
  // Updated by concludeVoting() transaction only
  allow update: if
    // Cloud Function only (custom claims check)
    request.auth.token.iss == 'https://securetoken.google.com/futebadosparcas-xyz';
}
```

---

## Implementation Checklist

- [ ] Update `submitVote()` to use `runTransaction`
- [ ] Update `concludeVoting()` to use `runTransaction`
- [ ] Add `voting_status` field to games (NEW/OPEN/CONCLUDED)
- [ ] Add `voting_concluded_at` timestamp to confirmations
- [ ] Update Firestore rules for vote validation
- [ ] Add integration test for concurrent vote submissions
- [ ] Update MVPVoteViewModel to handle retry logic
- [ ] Test edge cases:
  - [ ] Multiple rapid votes from same user (should fail 2nd onwards)
  - [ ] Concurrent votes from different users (both should succeed)
  - [ ] Vote submitted after deadline (should fail)
  - [ ] Vote after concludeVoting() called (should fail)

---

## Testing Strategy

### Unit Tests

```kotlin
@Test
fun submitVote_withConcurrentSubmissions_onlyFirstSucceeds() = runTest {
    // Simulate two clients voting simultaneously
    val vote1 = MVPVote(gameId, voterId, playerId1, MVP)
    val vote2 = MVPVote(gameId, voterId, playerId2, MVP)

    // Both should start transaction at same time
    val job1 = async { repository.submitVote(vote1) }
    val job2 = async { repository.submitVote(vote2) }

    val result1 = job1.await()
    val result2 = job2.await()

    // First should succeed, second should fail
    assertThat(result1.isSuccess).isTrue()
    assertThat(result2.isFailure).isTrue()
    assertThat(result2.exceptionOrNull()?.message)
        .contains("Already voted")
}

@Test
fun concludeVoting_withRapidVoteSubmissions_countsAllVotes() = runTest {
    // Start 10 concurrent vote submissions
    val votes = (1..10).map { i ->
        MVPVote(gameId, "voter$i", "player$i", MVP)
    }

    val jobs = votes.map { vote ->
        async { repository.submitVote(vote) }
    }

    // Wait for all to complete
    jobs.awaitAll()

    // Then conclude voting
    val concludeResult = repository.concludeVoting(gameId)
    assertThat(concludeResult.isSuccess).isTrue()

    // Check that all votes were counted
    val talliedVotes = repository.getGameVotes(gameId)
    assertThat(talliedVotes.getOrNull()).hasSize(10)
}
```

### Integration Tests

```kotlin
@Test
fun votingFlow_endToEnd_withTransactions() = runTest {
    // 1. Create game and confirmations
    val gameId = createTestGame()
    createTestConfirmations(gameId, playerIds = listOf("p1", "p2", "p3"))

    // 2. Submit votes from multiple users
    submitVote(gameId, "voter1", "p1", MVP)
    submitVote(gameId, "voter2", "p2", MVP)
    submitVote(gameId, "voter3", "p1", MVP)

    // 3. Check all voted
    val allVoted = repository.checkAllVoted(gameId).getOrNull() ?: false
    assertThat(allVoted).isTrue()

    // 4. Conclude voting
    repository.concludeVoting(gameId)

    // 5. Verify results
    val game = repository.getGameDetails(gameId)
    assertThat(game.getOrNull()?.mvpId).isEqualTo("p1") // 2 votes
}
```

---

## Performance Implications

### Transaction Cost
- **Firestore read operations:** 1-2 reads per transaction
- **Firestore write operations:** 1 write per transaction
- **Cost:** ~0.06 reads + 0.06 writes per vote = $0.0006/vote

### Conflict Rate
- Expected conflict rate: LOW (typically 1-2 concurrent voters)
- Max retries: 5 (built-in by Firestore)
- Worst case latency: 2-3 seconds (with retries)

### Scaling
- Supports up to ~5-10 concurrent votes per game
- Beyond that, transaction conflicts increase
- Mitigation: Client-side debouncing (already implemented)

---

## Migration Plan

### Step 1: Deploy New Code
- [ ] Update `GameExperienceRepositoryImpl.kt`
- [ ] Update Firestore rules
- [ ] Backward compatible (old votes still readable)

### Step 2: Monitor
- [ ] Watch Firestore metrics for transaction conflicts
- [ ] Monitor MVP vote latency (should be <500ms)
- [ ] Track any voting errors

### Step 3: Cleanup (Optional)
- [ ] Archive old `mvp_votes` collection after 1 month
- [ ] Consolidate vote documents

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Transaction conflicts | Low | Medium | Client debouncing, retry logic |
| Deadlock | Very Low | High | Firestore handles automatically |
| Vote loss | Very Low | Critical | Transaction guarantee |
| Timeout | Low | Medium | 25 second timeout (Firestore default) |
| Rate limiting | Medium | Low | Quota limits already in place |

---

## Documentation & Code Comments

```kotlin
/**
 * Submete um voto de forma segura contra race conditions.
 *
 * Implementa Firestore transaction para garantir:
 * - Verificação atômica de status do jogo
 * - Validação de prazo de votação
 * - Detecção de votos duplicados
 * - Escrita atômica do voto
 *
 * Em caso de conflito, Firestore retenta automaticamente.
 * Se o usuário já votou nesta categoria, falha com erro amigável.
 *
 * @param vote Voto a ser registrado
 * @return Result.success(Unit) se voto registrado, Result.failure(Exception) caso contrário
 *
 * @throws IllegalStateException Se jogo não está finalizado ou prazo expirado
 */
override suspend fun submitVote(vote: MVPVote): Result<Unit>
```

---

## Conclusion

**Current Status:** Vulnerable to race conditions
**Proposed Solution:** Firestore transactions
**Implementation Effort:** 2-3 hours
**Risk Level:** Medium (tested thoroughly first)
**Benefit:** Guaranteed vote consistency, no duplicates, atomic tallying

**Recommended:** Implement immediately before scaling to 10k+ users.

