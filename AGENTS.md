# AGENTS.md

> Quick-reference for AI coding assistants. For full context, read [CLAUDE.md](CLAUDE.md).

---

## Repo facts (non-obvious)

- **Private** repo (`TechFernandesLTDA/futeba-dos-parcas`). External collaborators need explicit access.
- **Squash-merge only** on `master`. `delete_branch_on_merge: true`.
- **Branch protection**: 1 approving review required, code owner review required, no force-push, no deletions.
- **Dependabot**: monthly schedule, limit 2 PRs, label `dependencies`. Auto-bump PRs get closed — deps handled in batch via `npm audit fix`.
- **Node 20** required (see `.nvmrc`). Use `nvm use` before working in `web/` or `functions/`.
- **Firebase Hosting URL**: `https://futebadosparcas.web.app` (SPA, all routes → `/index.html`).

---

## Commands you MUST get right

### Web (`web/`)
```bash
cd web
npm run build          # tsc && vite build  (TYPE-CHECK FIRST)
npm run dev            # Vite dev server (port 5173)
npm run lint           # ESLint
npx firebase deploy --only hosting --project futebadosparcas
```

### Android (root)
```bash
./gradlew :app:assembleDebug                # Full build
./gradlew :app:compileDebugKotlin           # Fast syntax check (use for quick iterations)
./gradlew :app:testDebugUnitTest            # All unit tests
./gradlew :app:testDebugUnitTest --tests "*.ClassName.methodName"  # Single test
./gradlew lint                              # Android lint
./gradlew detekt                            # Static analysis
```

### Cloud Functions (`functions/`)
```bash
cd functions
npm run build         # tsc
npm run lint          # ESLint
npx jest --no-coverage                    # All tests
npx jest --testNamePattern="test name"    # Single test
```

### GitHub
```bash
gh pr list --repo TechFernandesLTDA/futeba-dos-parcas
gh pr close <N> --repo TechFernandesLTDA/futeba-dos-parcas -c "reason"
gh api repos/TechFernandesLTDA/futeba-dos-parcas/branches --jq '.[].name'
```

---

## Architecture: what lives where

| Layer | Android | Web |
|-------|---------|-----|
| UI | `app/.../ui/<feature>/` (Compose) | `web/src/pages/<feature>/` (React) |
| State | `app/.../ui/<feature>/<Feature>ViewModel.kt` | `web/src/hooks/use<Feature>.ts` + TanStack Query |
| Domain | `shared/commonMain/` (KMP) | N/A (Firestore-only) |
| Data | `shared/androidMain/` (Firebase Android SDK) | `web/src/services/firebase.ts` |
| DI | Koin modules at `app/.../di/koin/` | React Context at `web/src/contexts/` |

**Key boundaries**:
- Web app does NOT use the KMP `:shared` module. All Firebase queries are via `web/src/hooks/` → `web/src/services/firebase.ts`.
- `archive/backend/` is an 🗄️ **ARCHIVED/dormant** Express.js + TypeORM + PostgreSQL REST API, **with zero consumers** (web/Android/iOS all use Firestore + Cloud Functions directly). Audit decision #1356 (2026-05-19) → archived. Distinct from `functions/` (the real Firebase Cloud Functions backend). Do not develop here without an SDD spec; do not treat as production.

---

## Web patterns (discovered by audit — DO NOT REPEAT THESE BUGS)

### Firebase writes
- **Always** wrap `addDoc`/`setDoc`/`updateDoc`/`deleteDoc` in `try/catch` with `showError()` toast.
- **Always** add `disabled={loading}` + `CircularProgress` to submit buttons.
- **Always** use `serverTimestamp()` (NOT `Timestamp.now()` or `new Date()`).
- **Always** use `writeBatch()` for multi-document atomic operations (member removal, group deletion).
- **Always** validate inputs (non-empty, non-whitespace, positive numbers).
- **Never** use `navigate(-1)` after destructive ops — use `navigate('/')`.

### Hooks
- **Never** put inline functions/arrays in `useEffect`/`useCallback` deps — use `useRef` instead.
- **Never** fire-and-forget async calls in `useEffect` — add `cancelled` flag or `AbortController`.
- **Always** add error callbacks to `onSnapshot()` listeners.
- **Always** expose `loading` and `error` from every hook.

### Colors / Theme
- **Never** hardcode `'white'`, `'#fff'`, `'red'`, hex values in `sx=` — use `theme.palette.*`.
- **Never** use `alpha('#fff', ...)` — use `alpha(theme.palette.common.white, ...)`.
- **Always** define dark-mode palette variants for `error`, `warning`, `success`, `info`.
- Gamification colors (`gold`, `silver`, `bronze`, `level`) live in `web/src/theme/index.ts` as `gamificationColors`.

### Auth
- `useAuth()` returns `{ user, firebaseUser, signIn, signOut, signInWithGoogle, updateUserProfile }`.
- `updateUserProfile()` MUST write to BOTH Firebase Auth (`updateProfile`) AND Firestore (`updateDoc` on `users/{uid}`).
- `onAuthStateChanged` fires on every token refresh — compare UIDs to avoid loading flash.
- `auth/popup-closed-by-user` is NOT an error — silently return.

### CPF validation (critical constraint)
- The CPF check-digit algorithm is implemented in **3 places**: `functions/src/validation/cpf.ts`, `web/src/utils/cpfValidator.ts`, and `shared/.../CpfValidator.kt`.
- **All three MUST stay in sync.** If the algorithm changes, update all three simultaneously.
- The formula `(sum * 10) % 11` (with `10 → 0`) is mathematically equivalent to the standard `11 - (sum % 11)` algorithm.<

### States every screen must handle
```typescript
// Loading → ShimmerLoading or LoadingState
// Error   → Alert with retry button
// Empty   → EmptyState with icon + message
// Success → normal render
```

### Toast system
- Only `ToastProvider` from `web/src/contexts/ToastContext.tsx` — ONE toast system.
- Use `const { showSuccess, showError } = useToast();`
- `react-hot-toast` was REMOVED. Do NOT re-add it.

---

## Common gotchas

- **Stale `.tsbuildinfo`**: If TSC reports errors in files that don't exist, delete `web/tsconfig.tsbuildinfo` and `web/dist/`.
- **PowerShell**: `ls -la` doesn't work. Use `Get-ChildItem` or `dir`.
- **`git add -A &&`**: `&&` fails on PowerShell. Use `;` or separate commands.
- **Firestore `whereIn`**: Limited to 10 items. Batch in chunks.
- **`ListItemSecondaryAction`**: Deprecated in MUI v5. Use `secondaryAction` prop on `ListItem`.
- **`Divider`**: Deprecated. Use `HorizontalDivider` (Compose) or `<Divider />` (MUI — still valid).
- **Lazy imports in `App.tsx`**: All 55+ screens use `React.lazy(() => import(...).then(m => ({ default: m.X })))`.
- **Commit conventions**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`). Enforced by `commitlint.config.js`.

---

## Key files (quick find)

| Purpose | Path |
|---------|------|
| Android entry | `app/src/main/java/com/futebadosparcas/ui/main/MainActivityCompose.kt` |
| Web entry | `web/src/main.tsx` |
| Web routes | `web/src/App.tsx` (55+ lazy routes) |
| Web theme | `web/src/theme/index.ts` |
| Web hooks | `web/src/hooks/` |
| Web types | `web/src/types/` (game, user, group, gamification, location) |
| Web services | `web/src/services/firebase.ts` |
| Spec templates | `specs/_TEMPLATE_FEATURE_MOBILE.md`, `_TEMPLATE_BUGFIX_MOBILE.md` |
| Decision log | `specs/DECISIONS.md` |
| CI workflows | `.github/workflows/` (14 workflows) |
| Cloud Functions | `functions/src/index.ts` (main entry) |
