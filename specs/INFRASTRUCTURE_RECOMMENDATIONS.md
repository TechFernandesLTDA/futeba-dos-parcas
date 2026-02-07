# Infrastructure Recommendations - Cache & CDN Strategy

**Status:** SPECIFICATION & RECOMMENDATIONS
**Date:** 2026-02-05
**Target:** P2 #28, #29, #30
**Impact:** Latency, Cost, Scalability

---

## Executive Summary

Three infrastructure optimization opportunities:

1. **Leaderboard Caching** (P2 #28): Cache rankings to reduce expensive Firestore queries
2. **Batch FCM Notifications** (P2 #29): Batch push notifications to reduce API calls & costs
3. **CDN for Public Content** (P2 #30): Distribute static/public responses via CDN edge servers

---

## P2 #28: Leaderboard Cache Strategy

### Current Problem

**Current flow:**
```
User opens RankingScreen
  → Firestore Query: season_participation
      WHERE season_id = "2025-feb"
      AND deleted_at = null
      ORDER BY rating DESC LIMIT 100
  → 1 document read × 10,000 users = 10,000 reads/day
  → Cost: $0.06/day just for ranking queries
```

**Why it's expensive:**
- Query runs every time user opens Ranking screen
- 10k users × 2 opens/day = 20k queries/day
- Each query reads entire leaderboard snapshot

### Solution: Memory Cache with TTL

#### Option 1: In-Memory Cache (Client-Side)

```kotlin
// Ideal for: Single user viewing rankings

@HiltViewModel
class RankingViewModel @Inject constructor(
    private val statisticsRepository: StatisticsRepository
) : ViewModel() {

    private val _rankingCache = mutableMapOf<String, CachedRanking>()

    suspend fun getLeaderboard(seasonId: String, forceRefresh: Boolean = false): Result<List<PlayerRanking>> {
        return try {
            val cached = _rankingCache[seasonId]

            // Return cached if fresh (< 5 minutes old)
            if (cached != null && !forceRefresh && !cached.isExpired()) {
                return Result.success(cached.rankings)
            }

            // Fetch fresh from repository
            val result = statisticsRepository.getSeasonLeaderboard(seasonId, limit = 100)

            result.onSuccess { rankings ->
                _rankingCache[seasonId] = CachedRanking(
                    rankings = rankings,
                    cachedAt = System.currentTimeMillis(),
                    ttlMs = 5 * 60 * 1000  // 5 minutes
                )
            }

            result
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    data class CachedRanking(
        val rankings: List<PlayerRanking>,
        val cachedAt: Long,
        val ttlMs: Long
    ) {
        fun isExpired(): Boolean = System.currentTimeMillis() - cachedAt > ttlMs
    }
}
```

**Pros:**
- ✅ Zero Firestore reads for cache hits
- ✅ Instant load (from RAM)
- ✅ Simple implementation

**Cons:**
- ❌ Per-device cache (not shared)
- ❌ Lost on app restart

**Cost Savings:**
- 20k queries → 4k queries (80% reduction if 5-min cache)
- $0.06/day → $0.012/day

---

#### Option 2: Server-Side Cache (Firestore + Redis)

```typescript
// Cloud Function to cache leaderboard
import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Redis from 'ioredis';

const db = admin.firestore();
const redis = new Redis(process.env.REDIS_URL);

/**
 * Get leaderboard with Redis caching
 * TTL: 15 minutes
 */
export const getLeaderboard = onCall(async (request) => {
  const { seasonId, limit = 100 } = request.data;

  // 1. Check Redis cache first
  const cacheKey = `leaderboard:${seasonId}:${limit}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    console.log(`Cache HIT for ${cacheKey}`);
    return JSON.parse(cached);
  }

  // 2. Miss - fetch from Firestore
  console.log(`Cache MISS for ${cacheKey}`);
  const rankings = await db.collection('season_participation')
    .where('season_id', '==', seasonId)
    .where('deleted_at', '==', null)
    .orderBy('rating', 'desc')
    .limit(limit)
    .get();

  const result = rankings.docs.map((doc, index) => ({
    rank: index + 1,
    userId: doc.data().user_id,
    rating: doc.data().rating,
    streak: doc.data().streak
  }));

  // 3. Cache for 15 minutes
  await redis.setex(cacheKey, 15 * 60, JSON.stringify(result));

  return result;
});

/**
 * Invalidate cache when ratings change
 * Called by onGameFinished trigger
 */
export const invalidateLeaderboardCache = onDocumentWritten(
  'season_participation/{docId}',
  async (event) => {
    const after = event.data?.after.data();
    if (!after) return;

    const seasonId = after.season_id;
    const cacheKey = `leaderboard:${seasonId}:*`;

    // Delete all leaderboard caches for this season
    const keys = await redis.keys(cacheKey);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`Invalidated ${keys.length} leaderboard caches for season ${seasonId}`);
    }
  }
);
```

**Pros:**
- ✅ Shared cache across all users
- ✅ Survives app restart
- ✅ 15-minute TTL balances freshness & cost

**Cons:**
- ✅ Requires Redis/Memcache setup
- ❌ Additional infrastructure cost (~$10/month)
- ❌ Cache invalidation complexity

**Cost Analysis:**
- Firestore: 20k queries/day → 100 queries/day (99.5% reduction)
- Savings: $0.06/day → $0.0006/day = **$20/month**
- Redis cost: ~$10/month
- **Net savings: $10/month + 99.5% latency reduction**

---

### Implementation Recommendation

**Short-term (Now):** In-memory client cache
- Add to RankingViewModel
- 5-minute TTL
- Manual refresh button
- No infrastructure changes

**Long-term (After 10k users):** Redis server-side cache
- Shared across users
- Better consistency
- Auto-invalidation on rating changes

---

## P2 #29: Batch FCM Notifications

### Current Problem

**Current flow:**
```
Game finalized
  → For each player (e.g., 20 players):
      → sendNotification(userId)
          → Firebase Cloud Messaging API call
  → Total: 20 API calls per game
  → Cost: ~$0.001 per call = $0.02 per game
  → 100 games/day = $2/day = $60/month
```

### Solution: Queue-Based Batching

```typescript
// functions/src/notifications/batch-fcm.ts

/**
 * Queue a notification for batch delivery
 * Collects notifications for 30 seconds, then sends in batch
 */
export const queueNotification = functions.firestore
  .document('notifications/{docId}')
  .onCreate(async (snap) => {
    const notification = snap.data();

    // Add to Redis queue
    const queueKey = `fcm:batch:${notification.type}`;
    await redis.lpush(queueKey, JSON.stringify(notification));

    // Set expiry (auto-cleanup if not processed)
    await redis.expire(queueKey, 60);
  });

/**
 * Process batches every 30 seconds
 * Groups notifications by type and sends in batches
 */
export const processFCMBatches = functions
  .pubsub
  .schedule('every 30 seconds')
  .onRun(async () => {
    const types = ['mvp_awarded', 'xp_gained', 'game_created', 'strike_milestone'];

    for (const type of types) {
      const queueKey = `fcm:batch:${type}`;

      // Get all queued notifications
      const notifications = await redis.lrange(queueKey, 0, -1);
      if (notifications.length === 0) continue;

      console.log(`Batch processing ${notifications.length} ${type} notifications`);

      // Parse notifications
      const batch = notifications.map(n => JSON.parse(n));

      // Group by user to merge duplicates
      const grouped = new Map<string, typeof batch[0]>();
      for (const notif of batch) {
        const existing = grouped.get(notif.userId);
        if (existing) {
          // Merge: increment count, update message
          existing.count = (existing.count || 1) + 1;
          existing.message = `You have ${existing.count} notifications`;
        } else {
          grouped.set(notif.userId, { ...notif, count: 1 });
        }
      }

      // Send via FCM (single multi-cast call)
      const tokens = Array.from(grouped.keys());
      const payload = {
        notification: {
          title: getTitleForType(type),
          body: `${grouped.size} notifications pending`
        },
        data: {
          type: type,
          count: grouped.size.toString()
        }
      };

      try {
        const response = await admin.messaging().sendMulticast({
          tokens: tokens,
          notification: payload.notification,
          data: payload.data
        });

        console.log(`Sent ${response.successCount}/${tokens.length} notifications`);

        // Clear queue
        await redis.del(queueKey);

        // Log metrics
        await logMetric('fcm_batch_sent', response.successCount, {
          type: type,
          batchSize: tokens.length
        });

      } catch (error) {
        console.error(`Failed to send batch: ${error}`);
        // Queue will expire automatically
      }
    }
  });

function getTitleForType(type: string): string {
  const titles = {
    'mvp_awarded': 'You were awarded MVP! 🏆',
    'xp_gained': 'XP earned! ⭐',
    'game_created': 'New game scheduled 🎮',
    'strike_milestone': 'Streak milestone! 🔥'
  };
  return titles[type] || 'New notification';
}
```

### Implementation Checklist

- [ ] Add `notifications` collection (or use existing)
- [ ] Create `queueNotification` trigger
- [ ] Create `processFCMBatches` scheduled function
- [ ] Add `sendMulticast()` for batch sending
- [ ] Configure batch size limits (max 500 per batch)
- [ ] Add exponential backoff for failures
- [ ] Monitor batch success rate

### Cost Impact

**Before Batching:**
- 100 games/day × 20 players = 2,000 notifications/day
- 2,000 API calls = ~$0.002/day (assuming $0.001/call)
- Cost: ~$60/month

**After Batching (30-second window):**
- 2,000 notifications → ~100 batches (20 per batch)
- 100 API calls = ~$0.0001/day
- **Savings: 95% reduction = $57/month**

### Latency Trade-off

- Before: Instant (real-time)
- After: 30-second delay (acceptable for non-critical notifications)
- Can use priority queue for urgent notifications

---

## P2 #30: CDN for Public Content

### Current Problem

**Current flow:**
```
Mobile client requests rankings
  → HTTP GET /api/rankings
  → Cloud Function (southamerica-east1)
  → Firestore query
  → Response from Brazil server
  → Latency: 200-500ms (depending on user location)

User in São Paulo: 200ms ✅
User in New York: 500ms ❌
User in Tokyo: 1000ms ❌
```

### Solution: CDN Edge Caching

#### Option 1: Firebase Hosting CDN (Recommended)

```typescript
// deploy.json config
{
  "hosting": {
    "public": "public",
    "rewrites": [
      {
        "source": "/api/rankings/:seasonId",
        "function": "getLeaderboard"
      }
    ],
    "headers": [
      {
        "source": "/api/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=900"  // 15 min edge cache
          }
        ]
      }
    ]
  }
}
```

```typescript
// getLeaderboard function with CDN headers
export const getLeaderboard = onRequest({
  cors: true
}, async (req, res) => {
  const seasonId = req.query.seasonId as string;

  // Set CDN cache headers
  res.set('Cache-Control', 'public, max-age=900');  // 15 min edge cache
  res.set('CDN-Cache-Control', 'max-age=900');

  // Get rankings (cached by Redis)
  const rankings = await getRankingsFromCache(seasonId);

  res.json(rankings);
});
```

**How it works:**
```
User Request
  ↓
CDN Edge (SFO/NYC/DXB/SG/JP/etc)
  ├─ Cache HIT → Instant response (50ms)
  └─ Cache MISS
      ↓
Cloud Function (Brazil)
  ├─ Redis Cache HIT → Fast (100ms)
  └─ Redis MISS → Firestore query (200ms+)
```

**Benefits:**
- ✅ Global presence (Google Cloud CDN)
- ✅ Automatic edge caching
- ✅ No additional cost (included in Hosting)
- ✅ Supports HTTPS/2
- ✅ DDoS protection

**Locations Covered:**
- Americas: Toronto, SFO, LA, Dallas, São Paulo
- Europe: London, Paris, Amsterdam, Warsaw
- Asia: Singapore, Tokyo, Sydney, Mumbai
- Middle East: Dubai, Bahrain

---

#### Option 2: Cloudflare (Alternative)

```javascript
// cloudflare.toml
[env.production]
route = "api.futebadosparcas.com/*"
zone_id = "..."

[env.production.routes.rankings]
path = "/api/rankings/*"
cache_ttl = 900  // 15 minutes
cache_level = "cache_everything"
```

**Pros:**
- ✅ More edge locations (250+ globally)
- ✅ Advanced caching rules
- ✅ WAF (Web Application Firewall)
- ✅ Rate limiting

**Cons:**
- ❌ Additional cost ($20/month)
- ❌ DNS change required
- ❌ More complex setup

---

### Cache Strategy by Endpoint

```typescript
// rankings - change infrequently
GET /api/rankings/:seasonId
  Cache-Control: public, max-age=900  // 15 min

// user profile - changes sometimes
GET /api/users/:userId
  Cache-Control: public, max-age=300  // 5 min

// live game scores - change frequently
GET /api/games/:gameId/score
  Cache-Control: public, max-age=10   // 10 sec

// user's personal stats - private
GET /api/users/me/stats
  Cache-Control: private, max-age=60  // 1 min (browser cache only)
```

---

### Implementation Checklist

**Firebase Hosting:**
- [ ] Add Cache-Control headers to Cloud Functions
- [ ] Set TTL based on update frequency
- [ ] Test edge cache behavior (curl -I)
- [ ] Monitor cache hit rates

**Optional (Cloudflare):**
- [ ] Add Cloudflare DNS
- [ ] Configure cache rules
- [ ] Enable WAF
- [ ] Monitor analytics

---

## Cost Comparison Summary

| Strategy | Implementation | Monthly Savings | Latency Reduction |
|----------|----------------|-----------------|-------------------|
| Client Cache (P2 #28) | 2 hours | $10-20 | 0ms (local) |
| Redis Server Cache | 4 hours + $10 | $20 | 50-100ms |
| Batch FCM (P2 #29) | 3 hours | $50-60 | N/A (better throughput) |
| Firebase CDN (P2 #30) | 1 hour | $0 | 150-300ms |
| Cloudflare CDN | 2 hours + $20 | $0-10 | 200-400ms |

**Recommended Rollout:**
1. **Week 1:** Client cache + Batch FCM (quick wins)
2. **Week 2:** Firebase Hosting CDN
3. **Month 2:** Redis if needed (>10k users)
4. **Month 3:** Cloudflare if scaling globally

---

## Monitoring & Alerting

### Metrics to Track

```typescript
// Log cache metrics
function logCacheMetric(endpoint: string, hit: boolean) {
  analytics.log('cache_' + (hit ? 'hit' : 'miss'), {
    endpoint: endpoint,
    timestamp: Date.now()
  });
}

// Calculate hit rate
async function getCacheHitRate(endpoint: string): Promise<number> {
  const hits = await getMetric(`cache_hit:${endpoint}`);
  const misses = await getMetric(`cache_miss:${endpoint}`);
  return hits / (hits + misses);
}
```

### Target Hit Rates

```
Leaderboard:   > 90% (stable data)
User Profile:  > 80% (changes occasionally)
Game Score:    > 60% (real-time updates)
Notifications: > 95% (batch processing)
```

---

## Conclusion & Recommendations

### Immediate Actions (This Week)

1. **P2 #28 - Client Leaderboard Cache**
   - Add 5-minute TTL cache to RankingViewModel
   - Effort: 1 hour
   - Savings: $10-15/month

2. **P2 #29 - Batch FCM Notifications**
   - Implement queue-based batching with 30-second window
   - Effort: 3 hours
   - Savings: $50-60/month
   - Bonus: 95% reduction in API calls

3. **P2 #30 - Firebase CDN**
   - Enable Cache-Control headers on all GET endpoints
   - Effort: 1 hour
   - Savings: $0 (included)
   - Benefit: 50-60% latency reduction globally

### Short-term (This Month)

- Monitor cache hit rates
- Adjust TTLs based on metrics
- Consider Redis if hit rates < 80%

### Long-term (Q2 2026)

- Implement Cloudflare if scaling to 100k+ users
- Advanced caching strategies (cache warming)
- GraphQL field-level caching

---

**Total Estimated Savings:** $60-80/month (10% of infrastructure costs)
**Total Implementation Time:** 6-8 hours
**ROI:** Excellent (payback in 1 week of saved costs)

