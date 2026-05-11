# PERMISSION MATRIX — Futeba dos Parças

Gerado em: 2026-05-11  
Escopo: Web (React) + Firestore Rules + Cloud Functions Callables + Android (KMP)

---

## Legenda

**Roles do sistema (Custom Claims JWT):** `ADMIN` | `FIELD_OWNER` | `PLAYER` (default)  
**Guard React:** `PublicRoute` | `ProtectedRoute` | `AdminRoute` | `FieldOwnerOrAdminRoute` | `FieldOwnerRoute`  
**App Check:** `ON` = enforceAppCheck prod | `OFF` = desabilitado | `EMULATOR` = off somente no emulador  
**Status:** `OK` | `GAP` | `BROKEN`

---

## Seção 1 — Telas Web (Rotas React)

### 1.1 Rotas Públicas e de Onboarding

| Rota | Guard | Roles Permitidos | Mutações Principais | UI Gates Adicionais | Status |
|------|-------|-----------------|---------------------|---------------------|--------|
| `/splash` | Nenhum | Todos (anônimos) | Nenhuma | — | OK |
| `/welcome` | `PublicRoute` | Anônimos (redireciona auth) | Nenhuma | — | OK |
| `/login` | `PublicRoute` | Anônimos | Firebase Auth signIn | — | OK |
| `/register` | `PublicRoute` | Anônimos | Firebase Auth createUser | — | OK |
| `/forgot-password` | `PublicRoute` | Anônimos | Firebase Auth resetPassword | — | OK |
| `/onboarding/phone` | `ProtectedRoute` | Qualquer auth | `canSendSmsOtp`, `setUserVerified` | — | OK |
| `/onboarding/cpf` | `ProtectedRoute` | Qualquer auth | `verifyCpf` | — | OK |
| `/profile/setup` | `ProtectedRoute` | Qualquer auth | Escrita em `users/{uid}` | — | OK |
| `/guide` | `ProtectedRoute` | Qualquer auth | Nenhuma | — | OK |

### 1.2 Rotas Protegidas (Usuário Autenticado)

| Rota | Guard | Roles Permitidos | Mutações Principais | UI Gates Adicionais | Status |
|------|-------|-----------------|---------------------|---------------------|--------|
| `/` | `ProtectedRoute` | Qualquer auth | Nenhuma | — | OK |
| `/games` | `ProtectedRoute` | Qualquer auth | Nenhuma (listagem) | — | OK |
| `/game/:gameId` | `ProtectedRoute` | Qualquer auth | Confirmação, MVP vote | Verificação Firestore rule | OK |
| `/game/create` | `ProtectedRoute` | Qualquer auth | Criação de `games` | Precisa `isVerifiedOrGrace()` | GAP |
| `/tactical/:gameId` | `ProtectedRoute` | Qualquer auth | Nenhuma | — | OK |
| `/join/:code` | `ProtectedRoute` | Qualquer auth | Entrada em grupo | — | OK |
| `/groups` | `ProtectedRoute` | Qualquer auth | Nenhuma (listagem) | — | OK |
| `/groups/discover` | `ProtectedRoute` | Qualquer auth | Nenhuma | — | OK |
| `/group/create` | `ProtectedRoute` | Qualquer auth | Criação de `groups` | — | OK |
| `/group/:groupId` | `ProtectedRoute` | Membros do grupo | Nenhuma | Regra Firestore verifica membership | OK |
| `/group/:groupId/edit` | `ProtectedRoute` | Dono/Admin grupo | Edição de `groups` | Lógica no componente | GAP |
| `/group/:groupId/settings` | `ProtectedRoute` | Dono/Admin grupo | Configurações | Lógica no componente | GAP |
| `/group/:groupId/cashbox` | `ProtectedRoute` | Membros/Admin | Entradas de caixa | Lógica no componente | GAP |
| `/group/:groupId/players` | `ProtectedRoute` | Membros | Nenhuma | — | OK |
| `/group/:groupId/schedules` | `ProtectedRoute` | Membros/Owner | Criação/edição schedules | — | OK |
| `/group/:groupId/invite` | `ProtectedRoute` | Dono/Admin grupo | Geração de invite | Lógica no componente | GAP |
| `/profile` | `ProtectedRoute` | Próprio usuário | Edição limitada | — | OK |
| `/profile/:userId` | `ProtectedRoute` | Qualquer auth | Nenhuma (visualização) | — | OK |
| `/profile/edit` | `ProtectedRoute` | Próprio usuário | Edição de `users/{uid}` | — | OK |
| `/level-journey` | `ProtectedRoute` | Qualquer auth | Nenhuma | — | OK |
| `/level-journey/:userId` | `ProtectedRoute` | Qualquer auth | Nenhuma | — | OK |
| `/statistics` | `ProtectedRoute` | Qualquer auth | Nenhuma | — | OK |
| `/weekly-recap` | `ProtectedRoute` | Qualquer auth | Nenhuma | — | OK |
| `/weekly-recap/:userId` | `ProtectedRoute` | Qualquer auth | Nenhuma | — | OK |
| `/evolution` | `ProtectedRoute` | Qualquer auth | Nenhuma | — | OK |
| `/evolution/:userId` | `ProtectedRoute` | Qualquer auth | Nenhuma | — | OK |
| `/map/games` | `ProtectedRoute` | Qualquer auth | Nenhuma | — | OK |
| `/map/locations` | `ProtectedRoute` | Qualquer auth | Nenhuma | — | OK |
| `/settings` | `ProtectedRoute` | Qualquer auth | Preferências | — | OK |
| `/settings/theme` | `ProtectedRoute` | Qualquer auth | Theme preference | — | OK |
| `/settings/feedbacks` | `ProtectedRoute` | Qualquer auth | `user_feedback` write | — | OK |
| `/location/:locationId` | `ProtectedRoute` | Qualquer auth | Reviews | Regra Firestore pub/auth | GAP |

### 1.3 Rotas Elevadas (FIELD_OWNER / ADMIN)

| Rota | Guard | Roles Permitidos | Mutações Principais | UI Gates Adicionais | Status |
|------|-------|-----------------|---------------------|---------------------|--------|
| `/locations` | `FieldOwnerOrAdminRoute` | FIELD_OWNER, ADMIN | Listagem/gestão | — | OK |
| `/location/create` | `FieldOwnerOrAdminRoute` | FIELD_OWNER, ADMIN | Criação de `locations` | — | OK |
| `/location/:locationId/edit` | `FieldOwnerOrAdminRoute` | FIELD_OWNER, ADMIN | Edição de `locations` | — | OK |
| `/owner/dashboard` | `FieldOwnerRoute` | FIELD_OWNER, ADMIN | Visualização dashboard | — | OK |

### 1.4 Rotas Administrativas

| Rota | Guard | Roles Permitidos | Mutações Principais | UI Gates Adicionais | Status |
|------|-------|-----------------|---------------------|---------------------|--------|
| `/settings/gamification` | `AdminRoute` | ADMIN | `app_settings` write | — | OK |
| `/admin/users` | `AdminRoute` | ADMIN | `setUserRole` (callable inline) | — | GAP |

---

## Seção 2 — Coleções Firestore (Regras de Permissão)

### 2.1 Coleções de Usuários e Identidade

| Coleção | Read | Write/Create | Update | Delete | Notas de Segurança |
|---------|------|--------------|--------|--------|-------------------|
| `users/{uid}` | Owner ou ADMIN (dados básicos); autenticado (campos públicos via projeção) | Owner (campos permitidos) ou ADMIN | Owner (restrição de campos imutáveis) ou ADMIN | ADMIN | `xp`, `level`, `milestones` imutáveis pelo cliente (CF-only) |
| `users_private/{uid}` | Owner ou ADMIN | `false` (somente CF) | `false` | `false` | PII: phone, CPF hash — escrito somente por triggers CF |
| `users/{uid}/preferences/{prefId}` | Owner | Owner | Owner | Owner | — |
| `users/{uid}/groups/{groupId}` | Owner ou ADMIN | Owner ou ADMIN | Owner ou ADMIN | Owner ou ADMIN | Denorm de membership |
| `users/{uid}/upcoming_games/{gameId}` | Owner ou ADMIN | Owner ou ADMIN | Owner ou ADMIN | Owner ou ADMIN | Cache de jogos futuros |
| `users/{uid}/game_templates/{templateId}` | Owner | Owner | Owner | Owner | Templates privados por usuário |

### 2.2 Jogos e Eventos

| Coleção | Read | Write/Create | Update | Delete | Notas de Segurança |
|---------|------|--------------|--------|--------|-------------------|
| `games/{gameId}` | `isVerifiedOrGrace()` + não-deletado (ou ADMIN para soft-deleted); GROUP_ONLY filtra por membership | `isVerifiedOrGrace()` + owner_id == uid (ou ADMIN) + status == SCHEDULED | ADMIN ou dono (`canManageGame`) com transição de status válida; qualquer membro confirma contadores; dono define mvp_id só em FINISHED | ADMIN ou `canManageGame` | Scores validados (max 100); `isValidGameStatusTransition` bloqueia reversão |
| `games/{gameId}/schedules/{scheduleId}` | Ver `schedules` raiz | — | — | — | — |
| `games/{gameId}/confirmations/{confId}` | `isVerifiedOrGrace()` | `isVerifiedOrGrace()` + userId == uid | Owner ou ADMIN ou próprio usuário | Owner ou ADMIN | — |
| `games/{gameId}/teams/{teamId}` | Autenticado | ADMIN ou dono do jogo | ADMIN ou dono do jogo | ADMIN ou dono do jogo | — |
| `games/{gameId}/player_stats/{statId}` | Autenticado | ADMIN ou dono do jogo | ADMIN ou dono do jogo | `false` | — |
| `game_events/{eventId}` | Autenticado | Dono do jogo ou ADMIN (jogo em LIVE) | `false` | `false` | — |
| `live_games/{gameId}` | Autenticado | ADMIN ou dono do jogo | ADMIN ou dono do jogo | `false` | — |
| `live_games/{gameId}/events/{eventId}` | Autenticado | ADMIN ou dono do jogo | `false` | `false` | — |
| `live_scores/{scoreId}` | Autenticado | ADMIN ou dono do jogo | ADMIN ou dono do jogo | `false` | — |
| `live_player_stats/{statId}` | Autenticado | ADMIN ou dono do jogo | ADMIN ou dono do jogo | `false` | — |
| `mvp_votes/{voteId}` | Autenticado e é confirmado no jogo | Confirmado no jogo (window válida) | `false` | `false` | Idempotência por document ID determinístico |
| `game_summons/{summonId}` | Autenticado (próprio ou dono do jogo) | Dono do jogo ou ADMIN | Dono do jogo ou ADMIN | Dono do jogo ou ADMIN | — |
| `game_requests/{requestId}` | Autenticado (próprio ou gerente do local) | Autenticado | Dono/gerente do local ou ADMIN | Dono/gerente do local ou ADMIN | — |

### 2.3 Grupos

| Coleção | Read | Write/Create | Update | Delete | Notas de Segurança |
|---------|------|--------------|--------|--------|-------------------|
| `groups/{groupId}` | Autenticado + não-deletado (ou ADMIN) | Autenticado (owner_id == uid) | ADMIN ou dono/admin do grupo (`isGroupAdmin`) | ADMIN | `member_count` server-authoritative via CF |
| `groups/{groupId}/members/{memberId}` | Membro do grupo ou ADMIN | Membro do grupo ou ADMIN (referral) | ADMIN ou admin do grupo | ADMIN ou admin do grupo | Expulsão via CF para consistência |
| `groups/{groupId}/join_requests/{requesterId}` | Requester ou admin do grupo ou ADMIN | Autenticado (requesterId == uid) + não membro | Admin do grupo ou ADMIN | Requester ou admin do grupo | — |
| `groups/{groupId}/cashbox/{entryId}` | Membro do grupo ou ADMIN | Membro do grupo ou ADMIN | Membro do grupo ou ADMIN (criador ou ADMIN) | Criador ou ADMIN | `MANAGE_GROUP_CASHBOX` no Android — sem verificação equivalente no web |
| `groups/{groupId}/cashbox_summary/{docId}` | Membro do grupo ou ADMIN | ADMIN ou CF | ADMIN ou CF | `false` | — |

### 2.4 Locais (Locations)

| Coleção | Read | Write/Create | Update | Delete | Notas de Segurança |
|---------|------|--------------|--------|--------|-------------------|
| `locations/{locationId}` | Público (is_active && is_verified && não-deletado) ou autenticado (exceto soft-deleted) ou ADMIN | Autenticado (owner_id == uid + validação de dados + is_verified == false na criação) | ADMIN ou owner/manager (campos básicos) | ADMIN (soft-delete) | is_verified somente ADMIN pode setar true |
| `locations/{locationId}/fields/{fieldId}` | Autenticado | ADMIN ou owner/manager do local | ADMIN ou owner/manager | ADMIN | — |
| `locations/{locationId}/audit_logs/{logId}` | ADMIN | `false` | `false` | `false` | — |
| `locations/{locationId}/reviews/{reviewId}` | Autenticado | `isVerifiedOrGrace()` (reviewer_id == uid) | Próprio reviewer | Próprio reviewer ou ADMIN | — |
| `locations/{locationId}/availability/{slotId}` | Autenticado | ADMIN ou owner/manager | ADMIN ou owner/manager | ADMIN ou owner/manager | — |
| `fields/{fieldId}` (raiz) | Autenticado | ADMIN ou FIELD_OWNER | ADMIN ou owner do field | ADMIN | Duplicado de subcoleção; ver GAP #7 |

### 2.5 Convites e Agendamentos

| Coleção | Read | Write/Create | Update | Delete | Notas de Segurança |
|---------|------|--------------|--------|--------|-------------------|
| `invites/{inviteId}` | Autenticado (destino ou criador ou ADMIN) | Autenticado (criador == uid) | Criador ou ADMIN | Criador ou ADMIN | Coleção canônica de convites de grupo |
| `group_invites/{inviteId}` | Autenticado (destino ou remetente) | Autenticado (sender_id == uid) | `false` | Remetente ou destino | Caso de uso diferente de `invites/` |
| `schedules/{scheduleId}` | Autenticado | `isVerifiedOrGrace()` (owner_id == uid) | ADMIN ou owner + campos válidos | ADMIN ou owner | FIELD_OWNER pode criar para local gerenciado |

### 2.6 Notificações e Comunicação

| Coleção | Read | Write/Create | Update | Delete | Notas de Segurança |
|---------|------|--------------|--------|--------|-------------------|
| `notifications/{notificationId}` | Próprio usuário ou ADMIN | CF somente (Admin SDK) | Próprio usuário (apenas marcar lida) | Próprio usuário ou ADMIN | — |
| `notification_queue/{notifId}` | `false` | `false` | `false` | `false` | 100% CF-only; bloqueio total cliente |
| `activities/{activityId}` | Autenticado (PUBLIC ou próprio) | Autenticado (created_by == uid, type/visibility obrigatórios) | Próprio criador (created_by imutável) | Próprio criador | — |

### 2.7 Gamificação e Rankings

| Coleção | Read | Write/Create | Update | Delete | Notas de Segurança |
|---------|------|--------------|--------|--------|-------------------|
| `statistics/{statId}` | Autenticado | ADMIN | ADMIN | `false` | — |
| `xp_logs/{logId}` | Autenticado (próprio user_id) | ADMIN | `false` | `false` | Imutável após criação |
| `ranking_deltas/{deltaId}` | Autenticado | ADMIN | ADMIN | ADMIN | FIX #584: bloqueou XP fraud via cliente |
| `rankings/{rankingId}` | Autenticado | ADMIN | ADMIN | ADMIN | — |
| `seasons/{seasonId}` | Autenticado | ADMIN | ADMIN | ADMIN | — |
| `season_participation/{partId}` | Autenticado | ADMIN | ADMIN | ADMIN | — |
| `season_final_standings/{standingId}` | Autenticado | ADMIN | ADMIN | ADMIN | Rankings históricos |
| `user_streaks/{streakId}` | Autenticado | ADMIN | ADMIN | — | — |
| `user_badges/{badgeId}` | Autenticado | ADMIN | — | — | — |
| `badges/{badgeId}` | Autenticado | ADMIN | ADMIN | ADMIN | Definições de badges |
| `challenges/{challengeId}` | Autenticado | ADMIN | ADMIN | ADMIN | — |
| `challenge_progress/{progressId}` | Autenticado (próprio uid) | Autenticado (uid == userId) | Próprio usuário | `false` | — |

### 2.8 Infraestrutura e Segurança (Bloqueadas ao Cliente)

| Coleção | Read | Write | Notas |
|---------|------|-------|-------|
| `rate_limits/{bucketId}` | `false` | `false` | CF Admin SDK only |
| `audit_logs/{logId}` (raiz) | ADMIN | `false` | Imutável; ADMIN pode ler |
| `notification_queue/{notifId}` | `false` | `false` | CF Admin SDK only |
| `cpf_index/{cpfHash}` | `false` | `false` | CF Admin SDK only; hash CPF → uid |
| `users_private/{uid}` | Owner ou ADMIN | `false` | PII; escrito por triggers CF |
| `verification_failures/{failId}` | ADMIN | `false` | Anti-abuse; CF-only |
| `metrics/{metricId}` | ADMIN | `false` | CF-only |
| `error_logs/{logId}` | ADMIN | `false` | CF-only |

### 2.9 Configurações e Miscelânea

| Coleção | Read | Write/Create | Update | Delete | Status |
|---------|------|--------------|--------|--------|--------|
| `app_settings/{docId}` | Autenticado | ADMIN | ADMIN | ADMIN | OK |
| `favorite_teams/{teamId}` | Owner ou ADMIN | Autenticado (userId == uid) | Próprio usuário ou ADMIN | Próprio usuário ou ADMIN | OK |
| `user_feedback/{feedbackId}` | Próprio usuário ou ADMIN | Autenticado (user_id == uid) | Próprio usuário | ADMIN | OK |

---

## Seção 3 — Cloud Functions Callables

### 3.1 Autenticação e Verificação

| Callable | Role Mínima | App Check | Rate Limit | Páginas Web que Chamam | Status |
|----------|------------|-----------|------------|------------------------|--------|
| `canSendSmsOtp` | Autenticado | ON (prod) | Interno | `/onboarding/phone` | OK |
| `logVerificationFailure` | Autenticado | ON (prod) | Interno | `/onboarding/phone`, `/onboarding/cpf` | OK |
| `verifyCpf` | Autenticado | ON (enforce) | — | `/onboarding/cpf` | OK |
| `setUserVerified` | Autenticado | ON (enforce) | — | `/onboarding/phone` | OK |
| `setUserRole` | ADMIN | ON (prod) | 5 req/60s | `/admin/users` (chamada inline, não via `cloudFunctions.ts`) | GAP |
| `migrateAllUsersToCustomClaims` | ADMIN | ON (prod) | 1 req/hora | Scripts de migração apenas | OK |

### 3.2 PII e Dados Privados

| Callable | Role Mínima | App Check | Rate Limit | Páginas Web que Chamam | Status |
|----------|------------|-----------|------------|------------------------|--------|
| `migratePiiToUsersPrivate` | ADMIN (verificado internamente) | ON (prod) | 1 req/timeout | Scripts de migração apenas | OK |
| `updateUserPii` | Autenticado (próprio uid) | ON (prod) | — | Fluxo de onboarding (interno) | OK |
| `removePiiFromUsers` | ADMIN (verificado internamente) | ON (prod) | — | Scripts de admin apenas | OK |

### 3.3 Soft Delete e Restauração

| Callable | Role Mínima | App Check | Rate Limit | Páginas Web que Chamam | Status |
|----------|------------|-----------|------------|------------------------|--------|
| `softDeleteGame` | Autenticado (dono ou ADMIN verificado internamente) | ON (prod) | 5 req/60s | `/game/:gameId` (admin/dono) | OK |
| `softDeleteGroup` | Autenticado (dono ou ADMIN verificado internamente) | ON (prod) | 5 req/60s | `/group/:groupId/settings` | OK |
| `restoreDeletedGame` | Autenticado (dono ou ADMIN verificado internamente) | ON (prod) | 5 req/60s | `/admin/users` ou painel admin | OK |
| `restoreDeletedGroup` | Autenticado (dono ou ADMIN verificado internamente) | ON (prod) | 5 req/60s | Painel admin | OK |

### 3.4 Votação e Presença

| Callable | Role Mínima | App Check | Rate Limit | Páginas Web que Chamam | Status |
|----------|------------|-----------|------------|------------------------|--------|
| `checkInToGame` | Autenticado | ON (exceto emulador) | checkRateLimit interno | `/game/:gameId` | OK |
| `submitMvpVote` | Autenticado (confirmado no jogo) | ON (prod) | checkRateLimit interno | `/game/:gameId` (votação pós-jogo) | OK |
| `concludeMvpVoting` | Autenticado (dono do jogo ou ADMIN) | ON (prod) | — | `/game/:gameId` | OK |

### 3.5 Cache e Leaderboard

| Callable | Role Mínima | App Check | Rate Limit | Páginas Web que Chamam | Status |
|----------|------------|-----------|------------|------------------------|--------|
| `getLeaderboardCached` | Autenticado | Padrão (`secureCallable`) | Interno | `/statistics`, `/level-journey` | OK |

### 3.6 Notificações

| Callable | Role Mínima | App Check | Rate Limit | Páginas Web que Chamam | Status |
|----------|------------|-----------|------------|------------------------|--------|
| `enqueueNotificationCallable` | Autenticado (`secureCallable`) | Padrão prod | Interno | Disparado por triggers internos | OK |
| `sendTestNotification` | Autenticado | OFF | 10 req/60s | Ferramentas de dev/admin | GAP |
| `createFakeGameNotifications` | Autenticado (`secureCallable`) | OFF | Interno | Ferramentas de dev/seed | GAP |

### 3.7 Localização e Migração

| Callable | Role Mínima | App Check | Rate Limit | Páginas Web que Chamam | Status |
|----------|------------|-----------|------------|------------------------|--------|
| `denormalizeGameLocations` | ADMIN (verificado internamente) | ON (prod) | — | Scripts de migração apenas | OK |
| `migrateGroupsInviteCodeToInvites` | ADMIN | ON (prod) | 1 req/hora | Scripts de migração apenas | OK |

---

## Seção 4 — Paridade Android (`UserPermissions.kt`) vs Web

### 4.1 Mapeamento de Actions Android → Equivalente Web/Rules

| Action (Android) | Roles no Android | Guard Web Equivalente | Regra Firestore | Paridade |
|-------------------|-----------------|----------------------|-----------------|---------|
| `MANAGE_USERS` | ADMIN | `AdminRoute` + `/admin/users` | ADMIN lê/edita `users` | OK |
| `VIEW_ALL_USERS` | ADMIN | `AdminRoute` | ADMIN lê `users` sem restrição | OK |
| `CHANGE_USER_ROLE` | ADMIN | `AdminRoute` (UserManagementScreen) | `setUserRole` callable requiredRole ADMIN | OK |
| `CREATE_GAME` | ADMIN, FIELD_OWNER, PLAYER | `ProtectedRoute` | `isVerifiedOrGrace()` na create de `games` | GAP — Android dá `CREATE_GAME` a FIELD_OWNER mas Firestore não distingue FIELD_OWNER de PLAYER na create |
| `EDIT_ANY_GAME` | ADMIN, FIELD_OWNER | `ProtectedRoute` | `canManageGame` = dono do jogo ou ADMIN (**não FIELD_OWNER genérico**) | BROKEN — FIELD_OWNER no Android tem `EDIT_ANY_GAME` mas regra Firestore não concede edição a FIELD_OWNERs que não são donos do jogo |
| `DELETE_ANY_GAME` | ADMIN | `ProtectedRoute` + soft delete | ADMIN ou `canManageGame` (dono) | GAP — Android só ADMIN; Firestore permite dono do jogo deletar |
| `CONFIRM_PRESENCE_ANY_GAME` | ADMIN | Interno | ADMIN | OK |
| `EDIT_GAME_STATS` | ADMIN, FIELD_OWNER | Interno | ADMIN ou dono do jogo (player_stats) | GAP — FIELD_OWNER no Android mas Firestore restringe a dono do jogo/ADMIN |
| `CREATE_LOCATION` | ADMIN, FIELD_OWNER | `FieldOwnerOrAdminRoute` | Qualquer autenticado pode criar (owner_id == uid) | GAP — Firestore permite PLAYER criar location; web bloqueia via route guard mas Android e Firestore divergem |
| `EDIT_ANY_LOCATION` | ADMIN | `FieldOwnerOrAdminRoute` | ADMIN ou owner/manager | GAP — web guard permite FIELD_OWNER editar qualquer; Firestore restringe ao owner/manager específico |
| `DELETE_ANY_LOCATION` | ADMIN | `FieldOwnerOrAdminRoute` | ADMIN apenas | OK |
| `CREATE_GROUP` | ADMIN, FIELD_OWNER, PLAYER | `ProtectedRoute` | Qualquer autenticado | OK |
| `EDIT_ANY_GROUP` | ADMIN | `ProtectedRoute` (lógica no componente) | ADMIN ou `isGroupAdmin` | GAP — sem `AdminRoute` na rota de edição de grupo |
| `DELETE_ANY_GROUP` | ADMIN | `ProtectedRoute` | ADMIN ou dono do grupo via CF | GAP — sem guard elevado |
| `MANAGE_GROUP_CASHBOX` | ADMIN, FIELD_OWNER | `ProtectedRoute` | Membros do grupo | GAP — PLAYER pode acessar cashbox na web se for membro, mas Android restringe a FIELD_OWNER/ADMIN |
| `VIEW_GLOBAL_STATS` | ADMIN, FIELD_OWNER | `ProtectedRoute` | Autenticado | OK (acesso mais amplo na rules) |
| `EDIT_RANKINGS` | ADMIN | — | ADMIN | OK |
| `ADJUST_XP` | ADMIN | — | ADMIN (via CF) | OK |
| `MANAGE_NOTIFICATIONS` | ADMIN | — | ADMIN | OK |
| `ACCESS_ADMIN_PANEL` | ADMIN | `AdminRoute` | — | OK |
| `MANAGE_BADGES` | ADMIN | — | ADMIN | OK |
| `MANAGE_CHALLENGES` | ADMIN | — | ADMIN | OK |
| `MANAGE_OWN_LOCATIONS` | FIELD_OWNER, ADMIN | `FieldOwnerOrAdminRoute` | Owner/manager do local | OK |

### 4.2 Verificação (isVerifiedOrGrace) — Paridade

| Plataforma | Enforcement | Mecanismo |
|-----------|-------------|-----------|
| Firestore Rules | `isVerifiedOrGrace()` — phone+CPF verificados OU dentro da grace period (30 dias, até 2026-06-04) | Regra em `games`, `schedules`, `confirmations`, `reviews` |
| Web React | Sem `VerifiedRoute` — enforcement somente via Firestore rules | Nenhum guard de rota verifica verificação |
| Android | Verificação checada no ViewModel antes de permitir ação | Client-side only (segunda camada) |

**Conclusão:** sem `VerifiedRoute` no web, um usuário não verificado que acesse `/game/create` diretamente verá o formulário — mas a escrita será bloqueada pelo Firestore. UX incorreta (falha silenciosa para o usuário).

---

## Seção 5 — Top 10 Inconsistências e Gaps (Priorizado por Risco)

| # | Prioridade | Gap | Localização | Impacto | Ação Recomendada |
|---|-----------|-----|-------------|---------|-----------------|
| 1 | **CRITICAL** | `EDIT_ANY_GAME` concedido a FIELD_OWNER no Android, mas Firestore não permite FIELD_OWNER editar jogos que não criou | `UserPermissions.kt` (FIELD_OWNER actions) vs `firestore.rules` linha ~500 | FIELD_OWNER pode pensar que tem permissão, recebe erro silencioso; inconsistência de produto | Remover `EDIT_ANY_GAME` de FIELD_OWNER no Android OU adicionar regra Firestore que permite FIELD_OWNER editar jogos do seu local |
| 2 | **CRITICAL** | `EDIT_GAME_STATS` no Android concede FIELD_OWNER acesso, mas Firestore restringe a dono/ADMIN | `UserPermissions.kt` vs `player_stats` rules | Inconsistência silenciosa; FIELD_OWNER bloqueado no backend sem feedback | Alinhar: remover de FIELD_OWNER ou criar regra Firestore para FIELD_OWNER do local |
| 3 | **HIGH** | `/group/:groupId/edit`, `/settings`, `/cashbox`, `/invite` — sem guard de rota elevado; só lógica no componente | `web/src/App.tsx` rotas de grupo | Qualquer membro pode navegar para a rota; proteção depende de checks no componente | Adicionar guard de rota (`GroupAdminRoute` ou verificação no loader) |
| 4 | **HIGH** | `sendTestNotification` e `createFakeGameNotifications` com App Check OFF e sem `requiredRole` — qualquer usuário autenticado pode disparar notificações | `functions/src/notifications/callable.ts` linhas 37-140 | Potencial spam de notificações para todos os usuários | Adicionar `requiredRole: 'ADMIN'` ou remover do build de produção |
| 5 | **HIGH** | `setUserRole` chamado inline em `UserManagementScreen` (`httpsCallable(functions, 'setUserRole')`) em vez de usar o export de `cloudFunctions.ts` | `web/src/pages/admin/UserManagementScreen.tsx` | Duplicação de contrato; se o nome da função mudar, só um site atualiza — silent break | Unificar via `cloudFunctions.ts` |
| 6 | **HIGH** | `CREATE_LOCATION` no Firestore permite qualquer usuário autenticado criar um local (owner_id == uid), mas Android e web restringem a FIELD_OWNER/ADMIN | `firestore.rules` linha ~840 vs `FieldOwnerOrAdminRoute` no web | PLAYER pode criar local via SDK diretamente bypassando a UI | Adicionar `isFieldOwner()` à regra de create de `locations` OU aceitar como intencional e alinhar o Android |
| 7 | **MEDIUM** | Sem `VerifiedRoute` no React — usuário não verificado acessa `/game/create` e vê formulário, mas a escrita é bloqueada no Firestore sem feedback claro | `web/src/App.tsx`, `/game/create` rota | UX quebrada: formulário acessível mas submit falha silenciosamente | Criar `VerifiedRoute` que redireciona para `/onboarding/cpf` se não verificado |
| 8 | **MEDIUM** | `FieldOwnerRoute` e `FieldOwnerOrAdminRoute` têm lógica idêntica (ambas permitem FIELD_OWNER ou ADMIN) | `web/src/App.tsx` definições dos guards | Confusão de manutenção; desenvolvedor pode assumir que `FieldOwnerRoute` exclui ADMIN | Consolidar em um único guard ou documentar explicitamente a equivalência |
| 9 | **MEDIUM** | `MANAGE_GROUP_CASHBOX` no Android restrito a FIELD_OWNER/ADMIN; Firestore permite qualquer membro do grupo; web não tem guard | `UserPermissions.kt` vs `groups/{id}/cashbox` rules | PLAYER pode gerenciar caixa via web e Android (se for membro), mas Android mostra UI como se fosse restrito | Alinhar política: membro pode gerenciar cashbox (OK) ou restringir para ADMIN/dono do grupo |
| 10 | **LOW** | `/location/:locationId` (detalhe do local) tem apenas `ProtectedRoute` enquanto `/location/:locationId/edit` tem `FieldOwnerOrAdminRoute` — inconsistência cosmética de escalada | `web/src/App.tsx` linha ~330 | Baixo risco (edição bloqueada pelo guard correto); mas coloca PLAYER em rota de detalhe sem saber que não pode editar | Aceitável — mas adicionar UI gate para esconder botão de edição para não-owners |

---

## Apêndice — Helper Functions das Security Rules

| Função | O que faz | Custo |
|--------|-----------|-------|
| `isAuthenticated()` | `request.auth != null` | 0 reads |
| `userId()` | `request.auth.uid` | 0 reads |
| `isOwner(uid)` | `userId() == uid` | 0 reads |
| `isAdmin()` | `request.auth.token.role == 'ADMIN'` | 0 reads (Custom Claim) |
| `isFieldOwner()` | `request.auth.token.role == 'FIELD_OWNER'` | 0 reads (Custom Claim) |
| `isVerified()` | `users/{uid}.phone_verified && cpf_verified` | 1 read |
| `isVerifiedOrGrace()` | `isVerified()` OU dentro do grace period | 1 read |
| `isGroupMember(groupId)` | `get(groups/{groupId}/members/{uid})` | 1 read |
| `isGroupAdmin(groupId)` | `get(groups/{groupId}/members/{uid}).role in [OWNER, ADMIN]` | 1 read |
| `isGroupActive(groupId)` | `get(groups/{groupId}).is_active == true` | 1 read |
| `isGameOwner(gameId)` | `get(games/{gameId}).owner_id == uid` | 1 read |
| `canManageGame(data)` | `data.owner_id == uid \|\| isGroupAdmin(data.group_id)` | 0-1 reads |
| `isConfirmedPlayer(gameId)` | `get(games/{gameId}/confirmations/{uid})` | 1 read |

**Nota de custo:** `isGroupMember`, `isGroupAdmin`, e `isGameOwner` são chamadas frequentes que cada uma custam 1 Firestore read por operação. Com Custom Claims é impossível otimizar group-level roles (são dinâmicas por grupo).

---

*Documento gerado pelo Firestore Master Agent — Sessão 2026-05-11*
