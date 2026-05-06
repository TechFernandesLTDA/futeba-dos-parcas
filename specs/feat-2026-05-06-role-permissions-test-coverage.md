# SPEC: Role Permissions Test Coverage

> **Status:** `APPROVED`
> **Autor:** Renan Locatiz Fernandes (via Claude Opus 4.7)
> **Data:** 2026-05-06
> **PR:** #xxx (multi-PR — 1 por layer)

---

## 1. Requirements

### 1.1 Problema

O sistema tem 3 roles (`ADMIN`, `FIELD_OWNER`, `PLAYER`) com matriz de 23 actions, distribuídos em 3 camadas de autorização (Domain Kotlin shared, Firestore Rules via Custom Claims, Cloud Functions callable). Cobertura atual: **~50% domain, 0% rules, 0% role-gating em functions**. Risco: regressão silenciosa de permissão (escalonamento, vazamento de dados, ações cruzadas).

### 1.2 Casos de Uso (matriz mínima)

| Ator | Ação | Resultado esperado |
|------|------|--------------------|
| ADMIN | qualquer action | allow |
| FIELD_OWNER | criar local | allow |
| FIELD_OWNER | editar local de outro | deny |
| PLAYER | criar próprio jogo | allow |
| PLAYER | mudar role de outro user | deny (rules + function) |
| PLAYER | acessar admin panel | deny |
| Unauth | qualquer write | deny |

### 1.3 Critérios de Aceite

- [ ] **CA1**: Matriz domain exaustiva — para cada role, asserts de TODAS as 23 actions (allow/deny). Total ≥ 69 asserts.
- [ ] **CA2**: `UserExtensions.kt` 100% coberto — `canViewAllGames`, `canEditAllGames`, `canJoinAllGames`, `hasGamePermission`, `hasUserPermission`, `hasLocationPermission`.
- [ ] **CA3**: Cloud Functions callables com role-gating testados — ≥6 callables por 3 roles = 18 cenários.
- [ ] **CA4**: Firestore Rules com `@firebase/rules-unit-testing` — cada role × cada collection × CRUD principal.
- [ ] **CA5**: Todos os testes rodam em CI (existe `functions-ci.yml`, `android-ci.yml`).

### 1.4 Fora de Escopo

- Triggers (`onGameFinished`, `onUserCreated`) — não têm role-gating direto.
- Web frontend role gating (UI level).
- Performance/load testing.
- App Check enforcement testing.

---

## 2. Technical Design

### 2.1 Layer 1 — Domain (Kotlin/JUnit)

**Arquivos:**
- `app/src/test/java/com/futebadosparcas/domain/authorization/UserPermissionsTest.kt` (estender)
- `app/src/test/java/com/futebadosparcas/domain/model/UserExtensionsTest.kt` (novo)

**Approach:** Data-driven matrix via `Stream.of(Arguments.of(...))` ou `@ParameterizedTest`. Source of truth: tabela `rolePermissions` em `UserPermissions.kt`.

### 2.2 Layer 2 — Cloud Functions (Jest)

**Arquivo:** `functions/test/role-actions.test.ts` (novo)

**Mocks:** `firebase-functions-test` ou stub manual de `request.auth.token.role`. Já existe pattern em `custom-claims.test.ts`.

**Callables cobertos:**
- `setUserRole` (admin only)
- `setUserVerified` (admin only)
- `verifyCpf` (any auth, self)
- `denormalizeGameLocations` (admin only)
- `enqueueNotificationCallable` (admin only para broadcast)
- `checkInToGame` (any auth, self)

### 2.3 Layer 3 — Firestore Rules (rules-unit-testing)

**Pacote novo:** `firestore-rules-tests/` na raiz (separado de `functions/` pra não poluir).

**Stack:**
- `@firebase/rules-unit-testing` v3+
- `firebase-tools` (emulator runner)
- Vitest ou Jest

**Coverage por collection:**
| Collection | Roles testados | Operações |
|-----------|----------------|-----------|
| `users/` | ADMIN/FIELD_OWNER/PLAYER/unauth | read self, read other, create self, update role (own/other), delete |
| `games/` | ADMIN/owner/random PLAYER | create, read, update score, delete |
| `locations/` | ADMIN/FIELD_OWNER (own)/FIELD_OWNER (other)/PLAYER | create, read, update, delete |
| `groups/` | ADMIN/owner/member/non-member | create, update, delete, manage cashbox |
| `cashbox/` | group admin/member/non-member | read, write |
| `notifications/` | self/other/admin | read, mark as read |

### 2.4 Definition of Done

- [ ] PRs criados (1 por layer): `test/role-permissions-domain`, `test/role-permissions-functions`, `test/role-permissions-rules`
- [ ] Cada PR passa CI
- [ ] Total de novos testes: ≥ 100
- [ ] Spec atualizada para `DONE` e linkada a `specs/DECISIONS.md` se houver decisão arquitetural

---

## 3. Tasks

### Phase 1 — Domain (Layer 1)
- [x] T1.1: Estender UserPermissionsTest com matriz exaustiva 3×23
- [x] T1.2: Criar UserExtensionsTest
- [ ] T1.3: PR + admin merge

### Phase 2 — Functions (Layer 2)
- [ ] T2.1: Criar role-actions.test.ts com mocks por role
- [ ] T2.2: Cobrir 6 callables × 3 roles
- [ ] T2.3: PR + admin merge

### Phase 3 — Rules (Layer 3)
- [ ] T3.1: Setup `firestore-rules-tests/` com `@firebase/rules-unit-testing`
- [ ] T3.2: Cobrir users/games/locations/groups
- [ ] T3.3: Cobrir cashbox/notifications/invites
- [ ] T3.4: Workflow CI (`firestore-rules-ci.yml`) — opcional, se valer
- [ ] T3.5: PR + admin merge

---

## 4. Decisões

| Data | Decisão | Razão |
|------|---------|-------|
| 2026-05-06 | Pacote separado `firestore-rules-tests/` em vez de dentro de `functions/` | Isolamento de deps (Rules tests não precisam firebase-admin) e CI step próprio |
| 2026-05-06 | Triggers não cobertos | Não têm role-gating; cobertura cabe em test plan separado de domain logic |
| 2026-05-06 | 1 PR por layer | Review fácil; failures isolados |
