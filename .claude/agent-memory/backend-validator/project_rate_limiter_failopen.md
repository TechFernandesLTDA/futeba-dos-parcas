---
name: rate-limiter-failclosed
description: Rate limiter fails CLOSED (blocks) on Firestore error since fix #931 — NOT fail-open
metadata:
  type: project
---

Rate limiter now fails **closed** (blocks request) on Firestore error since fix #931. Both `checkRateLimit` and `checkRateLimitByIp` catch blocks return `{allowed: false, remaining: 0, resetAt: ...}` with `[ALERT]` log tag.

**Why:** Original fail-open was changed — on Firestore outage, blocking is safer than creating an abuse window.

**How to apply:** Do NOT flag as a security bug. The fail-closed behavior is intentional and correct as of 2026-05-25. Old memory entry was stale.
