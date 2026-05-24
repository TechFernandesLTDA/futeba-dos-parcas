# Prompt: Gerar validações anti-quebra para o projeto Futeba dos Parças

Envie este documento como prompt para o **Qwen 3.7 Max**. O objetivo é que ele gere código de validação (scripts, regras de lint, hooks do Husky, workflows CI adicionais) para evitar que novos desenvolvimentos quebrem a aplicação.

---

## Contexto do Projeto

**Futeba dos Parças** — app de organização de jogos de futebol entre amigos.

### Arquitetura (3 camadas ativas):
| Camada | Stack | Diretório |
|---------|-------|-----------|
| **Web** | React + Vite + TypeScript + MUI + TanStack Query + Firebase JS SDK | `web/` |
| **Android** | Kotlin + Jetpack Compose + Koin DI + Room DB + Firebase Android SDK + KMP shared | `app/`, `shared/` |
| **Cloud Functions** | Node.js + TypeScript + Firebase Admin SDK + Jest | `functions/` |

Firebase: Firestore (DB), Auth, Storage, Hosting (SPA), Cloud Functions, Remote Config.
Projeto único: `futebadosparcas`. Node 22.
Branch `master` protegida: squash-merge, 1 review, code owners, sem force-push.

### Deploy:
- **Web**: `firebase deploy --only hosting` → `https://futebadosparcas.web.app`
- **Functions**: `firebase deploy --only functions`
- **Android**: Push da tag `v*` dispara `deploy-production.yml` → Google Play Store (Internal Testing)
- **Firestore Rules**: `firebase deploy --only firestore:rules`
- Ambiente padrão: self-hosted macOS ARM64 runners

---

## Validações JÁ EXISTENTES

### 1. Pre-commit (Husky v9)
```bash
# .husky/pre-commit (root)
cd web && npx tsc --noEmit

# .husky/commit-msg
npx --no -- commitlint --edit "$1"

# web/.husky/pre-commit
npm test
```

### 2. commitlint.config.js
- Conventional Commits: 11 tipos (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`)
- 8 escopos: `web`, `android`, `ios`, `shared`, `functions`, `firebase`, `ci`, `deps`
- Subject max 100 chars, body line max 200 chars

### 3. CI Workflows (18 workflows no `.github/workflows/`):
| Workflow | O que valida |
|----------|-------------|
| **pr-check.yml** | PR: Kotlin compile, Detekt, unit tests, hardcoded strings/colors check |
| **web-ci.yml** | PR/push master: ESLint, tsc --noEmit, Vitest, Vite build |
| **android-ci.yml** | Push master/develop: Lint, Detekt, unit tests, debug APK build |
| **functions-ci.yml** | PR/push master: tsc build, ESLint, Jest, Firestore query perf |
| **firestore-rules-ci.yml** | PR/push: Firestore emulator + Vitest rules tests |
| **deploy-production.yml** | Tag v*: build AAB assinado, upload Play Store, GitHub Release |
| **release.yml** | Tag v*.*.*: build AAB+APK, GitHub Release, publish release notes |

### 4. ESLint (web/.eslintrc.cjs)
- `strict: true` no tsconfig
- `eqeqeq: error`, `prefer-const: error`, `no-var: error`
- **2 regras customizadas `no-restricted-syntax`** (auditoria #601):
  1. `onSnapshot()` SEM 3º argumento de erro → warning
  2. `catch { logger.error }` SEM `showError`/`setError`/`throw` → warning

### 5. ESLint (functions/.eslintrc.js)
- Google style + max-len 120, double quotes, 2-space indent
- `strict: true`, `noImplicitReturns: true`, `noUnusedLocals: true`

### 6. Detekt (Android — detekt.yml, 613 linhas)
- Max issues: 80, thresholds: cyclomatic 30, long method 120 linhas, large class 1000 linhas
- `UnsafeCallOnNullableType: enabled`, `WildcardImport: enabled`, `PrintStackTrace: enabled`
- Baseline: 82 issues suprimidas (`detekt-baseline.xml`)

### 7. Firestore Security Rules (firestore.rules — 2188 linhas)
- Custom Claims para auth (0 Firestore reads)
- Validators: `isValidStringLength`, `isValidEmail`, `isValidRating`, `isValidGameStatusTransition`, `fieldUnchanged`, `onlyAllowedFields`
- Role-based access: ADMIN, FIELD_OWNER, user próprio, group admin/member, confirmed player
- PII em `users_private/` (read owner only, write: false)
- Catch-all: `match /{document=**} { allow read, write: if false; }`

### 8. Storage Rules (storage.rules — 248 linhas)
- `isImage()` bloqueia SVG/XML (anti-XSS)
- Size limits por path: 2MB (avatar), 5MB (logo/receipt), 10MB (game photo)
- Catch-all: deny

### 9. Route Guards (web/App.tsx)
- `PublicRoute`, `ProtectedRoute`, `VerifiedRoute`, `AdminRoute`, `FieldOwnerOrAdminRoute`, `GroupMemberRoute`
- Toda rota lazy: `React.lazy(() => import(...).then(m => ({ default: m.X })))`

---

## Padrões OBRIGATÓRIOS que NÃO podem ser quebrados

### Firebase Writes (web)
1. **Sempre** `try/catch` com `showError()` toast + `logger.error()`
2. **Sempre** `serverTimestamp()` (NUNCA `Timestamp.now()` nem `new Date()`)
3. **Sempre** `writeBatch()` para operações multi-documento (member removal, group deletion)
4. **Sempre** `disabled={loading}` + `CircularProgress` nos botões de submit
5. **Sempre** validar inputs (non-empty, non-whitespace, positive numbers)
6. **Nunca** usar `navigate(-1)` após operações destrutivas — usar `navigate('/')`

### Hooks (web)
7. **Nunca** colocar funções/arrays inline em `useEffect`/`useCallback` deps — usar `useRef`
8. **Nunca** fire-and-forget async calls em `useEffect` — adicionar flag `cancelled`/`AbortController`
9. **Sempre** adicionar error callbacks a listeners `onSnapshot()`
10. **Sempre** expor `loading` e `error` de todo hook

### Colors / Theme (web + Android)
11. **Nunca** hardcodar `'white'`, `'#fff'`, `'red'`, hex values em `sx=` — usar `theme.palette.*`
12. **Sempre** definir dark-mode palette variants para `error`, `warning`, `success`, `info`
13. Gamification colors: `gold`, `silver`, `bronze`, `level` em `web/src/theme/index.ts`

### Auth (web)
14. `updateUserProfile()` DEVE escrever em AMBOS Firebase Auth (`updateProfile`) E Firestore (`updateDoc`)
15. `onAuthStateChanged` dispara em todo token refresh — comparar UIDs para evitar loading flash
16. `auth/popup-closed-by-user` NÃO é erro — retornar silenciosamente

### State (web + Android)
17. Toda tela DEVE implementar 4 estados: Loading → Empty → Error → Success
18. `sealed class UiState { Loading, Empty, Error, Success }` no Kotlin

### Firestore Rules
19. Scores validados: 0-100 (anti-XP exploit)
20. Status de jogo: transições SEMPRE SCHEDULED→CONFIRMED→LIVE→FINISHED, sem skip/reversal
21. PII (`email`, `fcm_token`, `birth_date`, `cpf`) → `fieldUnchanged` (server-authoritative)
22. `member_count` em groups é SERVER-AUTHORITATIVE (cliente nunca escreve)
23. `whereIn` limitado a 10 itens — chunk em lotes de 10

### Commits
24. Conventional Commits SEMPRE
25. NUNCA push direto a master

### Spec-Driven Development
26. Feature/bugfix requer spec em `/specs/` ANTES de implementar
27. Decisões técnicas registradas em `/specs/DECISIONS.md`

---

## Tarefa para o Qwen 3.7 Max

Gere código PRONTO para implantação que adicione as seguintes validações ao projeto. Priorize validações que rodam automaticamente (pre-commit / CI) e que detectam regressões em **novo código** sem quebrar código existente. Use baseline/allowlists para código legado.

### A) Script de validação pre-push
Crie um script bash (`scripts/validate-pre-push.sh`) que execute:
1. Verifica se o branch atual NÃO é `master` (bloqueia push direto)
2. `cd web && npx tsc --noEmit`
3. `cd web && npm run lint`
4. `cd functions && npm run build`
5. `cd functions && npm run lint`
6. Commit message validation via `commitlint`
7. Se qualquer passo falhar → aborta o push com mensagem clara

Registre como hook Husky: `.husky/pre-push`

### B) ESLint: novas regras `no-restricted-syntax` para web
Adicione ao `web/.eslintrc.cjs` rules que detectam (warning, não error para não quebrar builds existentes):

1. **`serverTimestamp` ausente em writes**: detecta `addDoc`, `setDoc`, `updateDoc` que contêm campos `created_at`, `updated_at`, `joined_at`, `deleted_at` sem usar `serverTimestamp()`
2. **`Timestamp.now()` ou `new Date()` em dados Firestore**: detecta uso dessas APIs em argumentos de `addDoc`/`setDoc`/`updateDoc`
3. **`navigate(-1)` após delete/remove**: detecta padrão `deleteDoc`/`batch.commit` seguido de `navigate(-1)`
4. **Hardcoded colors em `sx=`**: detecta strings como `'white'`, `'#fff'`, `'red'`, `'#ff0000'` em props `sx=`
5. **`useEffect` sem cleanup**: detecta `useEffect` com `onSnapshot`/`addListener`/`subscribe` sem `return () =>` de cleanup
6. **Hook sem `loading`/`error`**: detecta hooks customizados (arquivos `use*.ts`) que não exportam `loading` e `error`

### C) Script de auditoria estática para padrões cross-cutting
Crie `scripts/audit-patterns.sh` que faz grep/ast-grep nos diretórios `web/src/` e `functions/src/` para detectar:

1. `addDoc`/`setDoc`/`updateDoc` sem `try {` antes (em até 3 linhas)
2. `deleteDoc`/`batch.commit` sem `try {` antes
3. `onSnapshot(` chamadas que não têm 3 argumentos (regex conta vírgulas)
4. `useEffect(` contendo `async (` sem `cancelled` flag
5. `navigate(-1)` no mesmo arquivo que `deleteDoc`/`removeDoc`/`batch()`
6. `new Date()` em arquivos de hook (use*.ts) — deveria ser `serverTimestamp()`
7. Import de `Timestamp` do firebase sendo usado com `.now()` ou `.fromDate(new Date())`
8. `sx={{` contendo strings de cor literal: `'white'`, `'#fff'`, `'red'`, `'blue'`, `'green'`, hex colors

Output: lista de arquivos + linha + severidade. CI deve rodar como warning não-blocking (continue-on-error: true).

### D) TypeScript: tornar `noUnusedLocals` e `noUnusedParameters` errors
No `web/tsconfig.json`, mude:
```json
"noUnusedLocals": true,
"noUnusedParameters": true,
```
Crie `web/tsconfig.dev.json` que estende com `false` para dev (igual functions faz).

### E) Workflow CI adicional: `validate-patterns.yml`
Crie `.github/workflows/validate-patterns.yml` que:
1. Dispara em PR e push a master (paths: `web/**`, `functions/**`, `scripts/**`)
2. Roda `scripts/audit-patterns.sh`
3. Roda `scripts/validate-pre-push.sh` (sem o bloqueio de branch)
4. Verifica se `firestore.rules` e `storage.rules` têm catch-all deny no final
5. Verifica se `firebase.json` tem security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
6. Upload de relatório como artifact
7. Non-blocking (continue-on-error: true)

### F) Script de sanitização de environment
Crie `scripts/check-secrets.sh` que:
1. Verifica se NENHUM arquivo commitado contém `serviceAccountKey`, `private_key`, `-----BEGIN`, secrets hardcoded
2. Verifica se `.env` e `.env.local` estão no `.gitignore`
3. Gera relatório e falha se encontrar secrets (CRÍTICO — error blocking)

Adicione ao workflow `validate-patterns.yml`.

### G) Detekt: novas regras Android
Adicione ao `detekt.yml`:
1. Regra customizada: detecta `Color.White`, `Color.Black`, `Color.Gray` em Composable functions (fora de tema)
2. Regra customizada: detecta strings hardcoded em `Text(text = "...")` (fora de strings.xml)
3. Ativar `MandatoryBracesIfStatements` (multi-line if sem chaves)
4. Thresholds existentes viram baseline

### H) Pre-commit hook adicional: web
Adicione ao `web/.husky/pre-commit`:
```bash
npm run lint
npm run typecheck:test
```
(atualmente só roda `npm test`)

### I) CI: adicionar step de auditoria ao web-ci.yml
Adicione um job `audit` ao `web-ci.yml` que:
1. Roda `scripts/audit-patterns.sh` (apenas web)
2. Non-blocking (continue-on-error: true)
3. Upload do relatório como artifact

---

## Instruções de Geração

Para cada item (A até I), gere:

1. **Código fonte completo** do arquivo — pronto para salvar e commitar
2. **Instruções de instalação** (ex: `chmod +x`, `npx husky add`, editar package.json scripts)
3. **Baseline/allowlist** para código existente que viola as regras (para que validação só pegue código NOVO)
4. **Como testar** que a validação funciona (ex: crie um arquivo temporário com violação e execute)

Priorize:
- Regras que NÃO quebram builds existentes (use warning + baseline para legacy)
- Automação total (CI/pre-commit, zero intervenção manual)
- Mensagens de erro em PT-BR claras e acionáveis
- Detecção de regressões (mudanças que quebram padrões já estabelecidos)

O não precisa modificar código existente para corrigir violações — apenas detectar código NOVO que introduz violações. Use baseline/allowlist para suprimir código legado.

---

## Contexto Adicional Relevante

### Estrutura de diretórios:
```
web/src/
  hooks/          # 54 arquivos (27 hooks + testes) — padrão: useRef deps, cancelled flag, loading/error expostos
  services/       # firebase.ts: init Firestore/Auth/Storage, emulators condicionais
  contexts/       # AuthContext, ToastContext (showSuccess/showError), TeamsContext
  types/          # game.ts, user.ts, gamification.ts, group.ts, location.ts — todos com type guards
  theme/          # index.ts: futebaTheme, futebaDarkTheme, gamificationColors
  pages/          # 55+ telas lazy-loaded
functions/src/    # Cloud Functions: game logic, auth triggers, XP, badges, notifications
firestore.rules   # 2188 linhas — role-based, validators, PII protection
storage.rules     # 248 linhas — image-only, size limits
```

### Comandos essenciais:
```bash
# Web
cd web && npm run build          # tsc && vite build
cd web && npm run lint           # ESLint
cd web && npm test               # Vitest

# Functions
cd functions && npm run build    # tsc
cd functions && npm run lint     # ESLint
cd functions && npm test         # Jest

# Android
./gradlew :app:compileDebugKotlin  # fast syntax check
./gradlew detekt                   # static analysis
./gradlew :app:testDebugUnitTest   # unit tests

# Deploy
npx firebase deploy --only hosting --project futebadosparcas
npx firebase deploy --only functions --project futebadosparcas
```
