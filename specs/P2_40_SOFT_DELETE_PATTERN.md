# P2 #40: Soft Delete Pattern with deleted_at Timestamp

**Status:** SPECIFICATION & RECOMMENDATION
**Date:** 2026-02-05
**Priority:** P2 (Desirable)
**Impact:** Data Integrity, Audit Trail, Compliance

---

## Executive Summary

**Soft delete** pattern replaces physical deletion with a logical deletion marker.

Instead of:
```javascript
// Hard delete (irreversible)
db.collection('games').doc(gameId).delete()
```

Use:
```javascript
// Soft delete (reversible, auditable)
db.collection('games').doc(gameId).update({
    deleted_at: Timestamp.now(),
    deleted_by: userId
})
```

**Benefits:**
- ✅ Reversible (can restore)
- ✅ Auditable (tracks who/when)
- ✅ Compliance-friendly (GDPR soft-delete period)
- ✅ Referential integrity (foreign keys still valid)

---

## Pattern Overview

### Data Model

```kotlin
// Updated from hard delete to soft delete
data class Game(
    val id: String,
    val groupId: String,
    val status: GameStatus,
    val createdAt: Timestamp,
    val updatedAt: Timestamp,
    // NEW: Soft delete markers
    val deletedAt: Timestamp? = null,      // NULL = active, NON-NULL = deleted
    val deletedBy: String? = null,         // User who soft-deleted
    val deletedReason: String? = null      // Optional reason for deletion
)

data class Group(
    val id: String,
    val name: String,
    // ... other fields
    val deletedAt: Timestamp? = null,
    val deletedBy: String? = null
)
```

### Firestore Collection Structure

```javascript
// Collection: games
{
  id: "game123",
  groupId: "group456",
  status: "FINISHED",
  createdAt: Timestamp(2025-01-15T10:00:00Z),
  updatedAt: Timestamp(2025-02-05T14:30:00Z),
  // Soft delete fields
  deletedAt: null,           // NULL = active
  deletedBy: null,
  deletedReason: null
}

// After soft delete:
{
  id: "game123",
  groupId: "group456",
  status: "FINISHED",
  createdAt: Timestamp(2025-01-15T10:00:00Z),
  updatedAt: Timestamp(2025-02-05T14:30:00Z),
  deletedAt: Timestamp(2025-02-05T15:00:00Z),    // When deleted
  deletedBy: "user789",                          // Who deleted
  deletedReason: "Duplicate game"                // Why deleted
}
```

---

## Implementation by Collection

### 1. Games Collection

**Current:** Using hard delete in `GameRepositoryImpl`

```kotlin
// BEFORE: Hard delete
override suspend fun deleteGame(gameId: String): Result<Unit> {
    return try {
        firestore.collection("games").document(gameId).delete().await()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

**AFTER: Soft delete with transaction**

```kotlin
override suspend fun softDeleteGame(gameId: String, reason: String = ""): Result<Unit> {
    return try {
        val currentUserId = getCurrentUserId()
        val now = Timestamp.now()

        firestore.runTransaction { transaction ->
            val gameRef = firestore.collection("games").document(gameId)
            val gameSnapshot = transaction.get(gameRef)

            // Security check: Only creator can delete
            val ownerId = gameSnapshot.getString("owner_id")
            if (ownerId != currentUserId) {
                throw SecurityException("Only game creator can delete")
            }

            // Check game status (can't delete if already started)
            val status = gameSnapshot.getString("status")
            if (status == "LIVE" || status == "FINISHED") {
                throw IllegalStateException("Cannot delete game in progress or finished")
            }

            // Update document (not delete)
            transaction.update(gameRef, mapOf(
                "deleted_at" to now,
                "deleted_by" to currentUserId,
                "deleted_reason" to reason,
                "status" to "DELETED",  // Optional: set explicit status
                "updated_at" to now
            ))

            Unit
        }.await()

        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

// Restore soft-deleted game
override suspend fun restoreGame(gameId: String): Result<Unit> {
    return try {
        firestore.runTransaction { transaction ->
            val gameRef = firestore.collection("games").document(gameId)
            val gameSnapshot = transaction.get(gameRef)

            // Check if actually deleted
            if (gameSnapshot.get("deleted_at") == null) {
                throw IllegalStateException("Game is not deleted")
            }

            // Security check
            val deletedBy = gameSnapshot.getString("deleted_by")
            val currentUserId = getCurrentUserId()
            if (deletedBy != currentUserId) {
                throw SecurityException("Only deletion author can restore")
            }

            transaction.update(gameRef, mapOf(
                "deleted_at" to null,
                "deleted_by" to null,
                "deleted_reason" to null,
                "status" to "SCHEDULED",
                "updated_at" to Timestamp.now()
            ))

            Unit
        }.await()

        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

### 2. Groups Collection

```kotlin
override suspend fun softDeleteGroup(groupId: String, reason: String = ""): Result<Unit> {
    return try {
        val currentUserId = getCurrentUserId()
        val now = Timestamp.now()

        firestore.runTransaction { transaction ->
            val groupRef = firestore.collection("groups").document(groupId)
            val groupSnapshot = transaction.get(groupRef)

            // Only admin can delete group
            val admins = groupSnapshot.get("admins") as? List<String> ?: emptyList()
            if (!admins.contains(currentUserId)) {
                throw SecurityException("Only group admin can delete")
            }

            transaction.update(groupRef, mapOf(
                "deleted_at" to now,
                "deleted_by" to currentUserId,
                "deleted_reason" to reason,
                "updated_at" to now
            ))

            // Cascade: Mark all group games as deleted
            val gamesSnapshot = transaction.get(
                firestore.collection("games")
                    .whereEqualTo("group_id", groupId)
                    .whereEqualTo("deleted_at", null)
            )

            gamesSnapshot.documents.forEach { gameDoc ->
                transaction.update(gameDoc.reference, mapOf(
                    "deleted_at" to now,
                    "deleted_by" to currentUserId,
                    "deleted_reason" to "Group deleted: $reason",
                    "updated_at" to now
                ))
            }

            Unit
        }.await()

        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

### 3. User Account (for GDPR Right to Erasure)

```kotlin
override suspend fun softDeleteUserAccount(userId: String): Result<Unit> {
    return try {
        firestore.runTransaction { transaction ->
            val userRef = firestore.collection("users").document(userId)
            val userSnapshot = transaction.get(userRef)

            // Soft delete with anonymization option
            transaction.update(userRef, mapOf(
                "deleted_at" to Timestamp.now(),
                "deleted_by" to userId,
                "deleted_reason" to "User requested deletion",
                // Anonymize personal data
                "email" to "deleted-${System.currentTimeMillis()}@deleted.local",
                "name" to "Deleted User",
                "phone_number" to null,
                "bio" to null,
                "photo_url" to null,
                "updated_at" to Timestamp.now()
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

## Firestore Security Rules

### Filter Deleted Records

```javascript
// Rules should ALWAYS exclude deleted records in queries
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Games - always filter out deleted
    match /games/{gameId} {
      allow read: if
        request.auth != null &&
        isGroupMember(resource.data.group_id) &&
        // IMPORTANT: Exclude soft-deleted
        resource.data.deleted_at == null;

      allow create: if
        request.auth != null &&
        isGroupMember(request.resource.data.group_id);

      allow update: if
        request.auth != null &&
        request.auth.uid == resource.data.owner_id &&
        // Can update if not already soft-deleted
        resource.data.deleted_at == null;

      allow delete: if false; // No hard deletes allowed
    }

    // Query for active games only
    match /groups/{groupId}/games/{gameId} {
      allow list: if
        request.auth != null &&
        parent.data.deleted_at == null &&
        resource.data.deleted_at == null;
    }

    // Groups
    match /groups/{groupId} {
      allow read: if
        request.auth != null &&
        isGroupMember(groupId) &&
        resource.data.deleted_at == null;

      allow update: if
        request.auth != null &&
        isGroupAdmin(groupId) &&
        // Can't update if already deleted
        resource.data.deleted_at == null;

      allow delete: if false; // No hard deletes
    }

    // Users
    match /users/{userId} {
      allow read: if
        request.auth != null &&
        request.auth.uid == userId &&
        resource.data.deleted_at == null;

      allow delete: if false; // Use soft delete only
    }
  }
}
```

---

## Repository Pattern Implementation

### Update All Repository Queries

Every query **MUST** include `whereEqualTo("deleted_at", null)`:

```kotlin
// BEFORE: Might include deleted records
override suspend fun getUpcomingGames(groupId: String): Result<List<Game>> {
    return try {
        val games = firestore.collection("games")
            .whereEqualTo("group_id", groupId)
            .whereEqualTo("status", "SCHEDULED")
            .get()
            .await()
            .toObjects<Game>()

        Result.success(games)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

// AFTER: Explicitly excludes deleted
override suspend fun getUpcomingGames(groupId: String): Result<List<Game>> {
    return try {
        val games = firestore.collection("games")
            .whereEqualTo("group_id", groupId)
            .whereEqualTo("status", "SCHEDULED")
            .whereEqualTo("deleted_at", null)  // <-- ADD THIS
            .orderBy("date_time")
            .get()
            .await()
            .toObjects<Game>()

        Result.success(games)
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

### Helper Function for Deletion Filters

```kotlin
// Add to BaseRepository
class BaseRepository(
    protected val firestore: FirebaseFirestore
) {
    // Helper to safely get active games
    protected fun Query.filterActive(): Query {
        return this.whereEqualTo("deleted_at", null)
    }

    // Usage:
    firestore.collection("games")
        .whereEqualTo("group_id", groupId)
        .filterActive()  // Automatically adds whereEqualTo("deleted_at", null)
        .get()
}
```

---

## Cleanup & Archival Strategy

### Automated Cleanup (Cloud Function)

```typescript
// functions/src/maintenance/archive-deleted.ts
import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Archive soft-deleted records older than 90 days.
 * Runs monthly on the 1st.
 *
 * Permanently deletes records to comply with GDPR right to erasure.
 */
export const archiveDeletedRecords = functions
  .pubsub
  .schedule('0 2 1 * *')  // 1st of month, 2 AM UTC
  .onRun(async () => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Archive games
    const deletedGames = await db.collection('games')
      .where('deleted_at', '<', admin.firestore.Timestamp.fromDate(ninetyDaysAgo))
      .get();

    console.log(`Archiving ${deletedGames.size} games older than 90 days`);

    let count = 0;
    for (const doc of deletedGames.docs) {
      // Move to archive collection
      await db.collection('archive_games').doc(doc.id).set(doc.data());
      await doc.ref.delete();
      count++;

      // Batch write every 500 docs
      if (count % 500 === 0) {
        console.log(`Archived ${count} records`);
      }
    }

    console.log(`Archive complete: ${count} records`);
  });
```

### Firestore Rules for Archive

```javascript
match /archive_games/{gameId} {
  // Read-only access for auditing
  allow read: if request.auth.token.role == 'ADMIN';
  allow write: if false;
}
```

---

## Implementation Checklist

### Phase 1: Model Changes
- [ ] Add `deletedAt`, `deletedBy`, `deletedReason` to Game model
- [ ] Add `deletedAt`, `deletedBy` to Group model
- [ ] Add `deletedAt`, `deletedBy` to User model
- [ ] Add `deleted_at` field to Firestore rules

### Phase 2: Query Updates
- [ ] Update `GameRepository.getUpcomingGames()` (+ filter)
- [ ] Update `GameRepository.getActiveGames()` (+ filter)
- [ ] Update `GroupRepository.getMyGroups()` (+ filter)
- [ ] Update `GroupRepository.getGroupGames()` (+ filter)
- [ ] Update all list queries to exclude deleted

### Phase 3: Soft Delete Functions
- [ ] Implement `GameRepository.softDeleteGame()`
- [ ] Implement `GroupRepository.softDeleteGroup()`
- [ ] Implement `UserRepository.softDeleteUserAccount()`
- [ ] Add restore functions for games/groups

### Phase 4: Cloud Functions
- [ ] Create `archiveDeletedRecords` function
- [ ] Set up monthly schedule
- [ ] Add logging & monitoring

### Phase 5: Security Rules
- [ ] Update Firestore rules to filter deleted records
- [ ] Test read/write on deleted documents (should fail)
- [ ] Test restore (should succeed)

### Phase 6: Testing
- [ ] Unit tests for soft delete
- [ ] Unit tests for restore
- [ ] Integration tests for cascade delete
- [ ] Verify deleted records excluded from queries
- [ ] Verify restoration works correctly

---

## Migration from Hard Delete

For existing code using hard delete:

```kotlin
// DEPRECATED - will be removed
suspend fun deleteGame(gameId: String): Result<Unit> {
    // Migration path: use softDeleteGame instead
    return softDeleteGame(gameId, "Migrated from hard delete")
}

// NEW - use this
suspend fun softDeleteGame(gameId: String, reason: String = ""): Result<Unit>
```

**Migration Plan:**
1. Deploy soft delete alongside hard delete
2. Gradually migrate calls from `deleteGame()` to `softDeleteGame()`
3. Monitor for issues
4. Remove hard delete function after 2 weeks

---

## GDPR Compliance

### Data Subject Access Request (DSAR)

Soft delete enables compliance with GDPR Article 15 (Right of Access):

```kotlin
// Can recover user's data from soft-deleted documents
suspend fun getUserDataForDSAR(userId: String): UserData {
    val user = firestore.collection("users")
        .document(userId)
        .get()
        .await()
        .toObject<User>()

    // Include deleted_at for transparency
    return UserData(
        user = user,
        deletedAt = user.deletedAt,
        includedInDeletion = user.deletedAt != null
    )
}
```

### Right to Erasure (GDPR Article 17)

Soft delete → Archive → Permanent delete after 90 days:

```
Timeline:
Day 0:  User requests deletion
        → softDeleteUserAccount(userId)
        → Data marked deleted_at = now

Days 1-89: Data in soft-deleted state
           Can be restored if user changes mind
           Not visible in normal queries

Day 90: Automated archival job runs
        → Move to archive_games collection
        → Permanent delete from main collection
        → Complies with right to erasure
```

---

## Performance Considerations

### Query Impact

**Before (no filter):**
```
Query: games WHERE group_id = "g1"
Firestore reads: 100 documents (5 deleted, 95 active)
Cost: 100 reads
```

**After (with filter):**
```
Query: games WHERE group_id = "g1" AND deleted_at = null
Firestore reads: 95 documents (only active)
Cost: 95 reads

But requires composite index for (group_id, deleted_at)
```

### Index Requirements

Create composite indexes in Firestore console:

```
Collection: games
Index 1: group_id (Asc), deleted_at (Asc)
Index 2: status (Asc), deleted_at (Asc)
Index 3: owner_id (Asc), deleted_at (Asc)

Collection: groups
Index 1: deleted_at (Asc)
```

---

## Monitoring & Auditing

### Track Deletions

```kotlin
// Add to GameRepository
fun getDeletedGamesForGroup(groupId: String): Flow<List<Game>> {
    return firestore.collection("games")
        .whereEqualTo("group_id", groupId)
        .whereNotEqualTo("deleted_at", null)
        .orderBy("deleted_at", Query.Direction.DESCENDING)
        .snapshots()
        .map { snapshot ->
            snapshot.toObjects<Game>()
        }
}
```

### Dashboard Metrics

```typescript
// Functions: Get deletion statistics
export const getDeletionStats = onCall(async (request) => {
  const stats = await db.collection('analytics').doc('deletions').get();
  return {
    gamesDeleted7d: stats.data().games_deleted_7d,
    gamesDeleted30d: stats.data().games_deleted_30d,
    groupsDeleted7d: stats.data().groups_deleted_7d,
    usersDeleted30d: stats.data().users_deleted_30d
  };
});
```

---

## Documentation Template

Add to model classes:

```kotlin
/**
 * Representa um jogo.
 *
 * SOFT DELETE: Este documento não é fisicamente removido.
 * Se [deletedAt] != null, o documento é logicamente deletado.
 * Queries automáticamente excluem registros com deleted_at != null.
 *
 * Para restaurar, use [GameRepository.restoreGame()].
 * Registros permanentemente deletados após 90 dias.
 */
data class Game(
    val id: String,
    val status: GameStatus,
    // ... fields ...
    val deletedAt: Timestamp? = null,
    val deletedBy: String? = null,
    val deletedReason: String? = null
)
```

---

## Conclusion

**Recommendation:** Implement soft delete pattern for all core entities:
- Games (already have `status` field, add `deleted_at`)
- Groups
- Users (for GDPR compliance)

**Benefits:**
- ✅ Reversible deletions
- ✅ Audit trail
- ✅ GDPR compliance
- ✅ Data integrity
- ✅ Recovery capability

**Timeline:** 2-3 weeks for full rollout with testing

**Next Steps:**
1. Add `deleted_at`, `deleted_by` fields to models
2. Update all queries with `whereEqualTo("deleted_at", null)`
3. Implement soft delete functions with transactions
4. Create archive automation
5. Deploy with 2-week monitoring period

