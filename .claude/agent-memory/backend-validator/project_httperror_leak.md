---
name: HttpsError originalError information disclosure
description: HttpsError details field IS sent to clients; originalError in secure-callable-wrapper.ts:396 leaks internal messages
type: project
---

Firebase SDK serializes the `details` argument of `HttpsError` and sends it to the client in the response body. Confirmed at runtime.

`secure-callable-wrapper.ts` line 396 passes `{ originalError: errorMessage }` as details when wrapping generic errors. This can leak Firestore collection names, SDK error details, etc.

**Fix:** Remove the details argument or pass only an opaque error code. Log with requestId internally.

**Issue:** #435

**How to apply:** When adding new error handling in callable functions, never include raw error.message in HttpsError details argument.
