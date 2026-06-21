---
name: Rate limiter fail-open on Firestore error
description: When Firestore transaction fails, checkRateLimit() returns allowed:true — deliberate availability tradeoff, exploitable under DDoS
type: project
---

In `functions/src/middleware/rate-limiter.ts` lines 167-179 and 415-426, the catch block returns `{ allowed: true }` when the Firestore transaction fails.

This is documented as "fail-open para disponibilidade" — a deliberate tradeoff. Under DDoS scenarios where an attacker saturates Firestore quota to trigger errors, rate limiting is bypassed.

**How to apply:** For critical admin-only operations (setUserRole, migrate), consider whether fail-closed is more appropriate. For regular user operations, current tradeoff is acceptable.
