# Custom Claims Quick Reference

**Status:** ✅ IMPLEMENTED (Fase 2 - Complete)
**Last Updated:** 2026-02-05
**Commit:** 21ac0ce

---

## What is Custom Claims?

Firebase Custom Claims são dados no JWT token que contêm informações do usuário **sem fazer chamadas Firestore**.

```javascript
// Antes: 1 read por request
function isAdmin() {
  let userDoc = get(/databases/$(database)/documents/users/$(request.auth.uid));
  return userDoc.data.role == 'ADMIN';  // 1 read
}

// Depois: 0 reads
function isAdmin() {
  return request.auth.token.role == 'ADMIN';  // No reads
}
```

---

## Quick API

### Set Role (Admin Only)
```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase-config';

const setRole = httpsCallable(functions, 'setUserRole');
await setRole({ uid: 'user123', role: 'ADMIN' });
```

### Get Role (Client)
```kotlin
// Android
val user = FirebaseAuth.getInstance().currentUser
user?.getIdTokenResult(true).addOnCompleteListener { task ->
  val claims = task.result.claims
  val role = claims["role"] as? String
  Log.d("Auth", "User role: $role")
}
```

### Verify Migration Status
```bash
# Firebase CLI
firebase functions:shell
> checkCustomClaimsCoverage()
```

---

## Locations

| File | Purpose | Status |
|------|---------|--------|
| `functions/src/auth/custom-claims.ts` | Cloud Functions | ✅ Deployed |
| `functions/src/scripts/migrate-custom-claims.ts` | Migration script | ✅ Executed |
| `firestore.rules:67-96` | Security Rules | ✅ Updated |
| `specs/CUSTOM_CLAIMS_MIGRATION.md` | Full docs | ✅ Complete |

---

## Troubleshooting

### Q: Custom Claim not showing up?
**A:** Token expires after 1 hour. Force refresh:
```kotlin
user?.getIdTokenResult(forceRefresh = true)
```

### Q: How to migrate existing users?
**A:** Already done! All 4 users migrated (2026-02-05).

### Q: Can I add more data to Custom Claims?
**A:** No. Limit is 1000 bytes. Only `role` is stored.

### Q: What if Custom Claims fail?
**A:** Fallback to Firestore (not implemented in Fase 2, but can be added).

---

## Performance Impact

**Before:**
```
1000 users × 10 requests/day × 1 read = 10,000 reads/day = $0.12/day
```

**After:**
```
1000 users × 10 requests/day × 0 reads = 0 reads/day = $0/day
```

**Savings:** $3.60/month per 1000 users

---

## Roles

| Role | Permissions | Users |
|------|-------------|-------|
| `ADMIN` | All operations | renankakinho69@gmail.com |
| `FIELD_OWNER` | Manage locations | techfernandesltda@gmail.com |
| `PLAYER` | Standard user | ricardogf2004, rafaboumer |

---

## For Developers

### When Adding New User
Custom Claim is automatically set by `onNewUserCreated` trigger:
```typescript
// Triggered when users/{userId} is created
export const onNewUserCreated = onDocumentCreated("users/{userId}", async (event) => {
  const role = event.data?.data().role || "PLAYER";
  await admin.auth().setCustomUserClaims(userId, { role });
});
```

### When Changing Role
Use `setUserRole` callable function (Admin only):
```typescript
const result = await setRole({ uid: 'user-id', role: 'ADMIN' });
// Result: { success: true, role: 'ADMIN', ... }
```

### In Security Rules
Access via `request.auth.token.role`:
```javascript
function isAdmin() {
  return request.auth.token.role == 'ADMIN';
}

match /games/{gameId} {
  allow update: if isAdmin() || isGameOwner(gameId);
}
```

---

## Files to Review

1. **Implementation:**
   - `C:\Projetos\FutebaDosParcas\functions\src\auth\custom-claims.ts`
   - `C:\Projetos\FutebaDosParcas\firestore.rules` (lines 67-96)

2. **Documentation:**
   - `C:\Projetos\FutebaDosParcas\specs\CUSTOM_CLAIMS_MIGRATION.md`
   - `C:\Projetos\FutebaDosParcas\.claude\P0_04_CUSTOM_CLAIMS_IMPLEMENTATION_SUMMARY.md`

3. **Reference:**
   - `C:\Projetos\FutebaDosParcas\CLAUDE.md` (Custom Claims section)
   - `C:\Projetos\FutebaDosParcas\specs\PERF_001_SECURITY_RULES_OPTIMIZATION.md`

---

## Monitoring

### Dashboard Metrics
- **Custom Claims Coverage:** Should be 100%
- **Firestore Reads:** Should be 30-40% lower than before
- **Auth Errors:** Monitor for Custom Claims failures

### Alerts (Firebase Console)
- Alert if coverage < 95%
- Alert if reads > 80% of historical median
- Alert if claims > 900 bytes

---

## Rollback

If critical issues occur:
```bash
git revert 21ac0ce
firebase deploy --only firestore:rules
```

Custom Claims don't harm, so no cleanup needed. Only Security Rules need to change.

---

**Questions?** See `specs/CUSTOM_CLAIMS_MIGRATION.md` for full guide.
