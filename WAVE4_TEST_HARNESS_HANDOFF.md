# Handoff — Onda 4: Test Harness de Grupos (emulador)

> Documento de orientação para continuar a Onda 4 (ex.: com DeepSeek).
> Gerado em 2026-06-06. Autocontido — não precisa do contexto da sessão anterior.
> Umbrella: **#2530**. Issues: **#2547, #2532, #2533, #2548**.

---

## 0. TL;DR — o que fazer, nesta ordem

1. **#2547** — sweep mecânico `admin.firestore.FieldValue/FieldPath` → import modular (144 ocorrências/42 arquivos). Desbloqueia tudo. **Comece por aqui.**
2. **#2532** — rework do Web E2E (Playwright + emulador), não-tautológico. Depende de #2547.
3. **#2533 (metade web)** — adicionar job web-e2e no CI. Depende de #2532. Fecha #2533 + #2530.
4. **#2548** — (independente) idempotência de XP por-jogador no retry (follow-up #2524).

---

## 1. Contexto e estado atual

A Onda 4 cria um **harness de teste autônomo** (sem ação humana em prod) que exercita os fluxos de Grupos contra o **Firebase Emulator Suite**, como guarda de regressão permanente para:
- **invite-join** (#2518) — trigger `onInviteRedeemed` tinha **0 invocações em prod**, nunca testado e2e.
- **discover** (#2523) — regressão de LIST query (grupo público soft-deleted derrubava a lista).
- **preview público** (#2519) — listener de members tornava a tela fatal.

### Já FEITO (mergeado em master)
- ✅ **#2531** (PR #2534, merge `33939963`): `functions/test/integration/invite-redeemed.integration.test.ts` roda contra o emulador real (firestore+functions), **6/6 verde**, triggers REAIS (prova não-tautológica). Script `npm run test:integration`.

### Em voo
- 🟡 **#2533 metade-functions** (PR **#2546**, branch `ci/2533-functions-integration-emulator`): workflow `functions-integration-ci.yml`. Estava com o job emulador rodando no runner self-hosted; um poller em background admin-mergeia quando ficar verde. **Verifique:** `gh pr view 2546 --json state`.

### Falta (issues abaixo)
- 🔴 **#2547** (sweep sandbox) · 🔴 **#2532** (web E2E rework) · 🟡 **#2533 metade-web** · 🔵 **#2548** (XP idempotência).

---

## 2. Causa-raiz CRÍTICA (descoberta no #2531) — leia antes de tudo

Dentro do **sandbox do Functions Emulator**, `admin.firestore.FieldValue` e `admin.firestore.FieldPath` resolvem como **`undefined`** (o namespace estático não é exposto pelo `require()` do runtime emulado). Qualquer função/trigger que use:

```ts
admin.firestore.FieldValue.serverTimestamp()   // 💥 TypeError no emulador
admin.firestore.FieldValue.increment(1)         // 💥
admin.firestore.FieldPath.documentId()          // 💥
```

…**crasha no emulador** com `TypeError: Cannot read properties of undefined (reading 'serverTimestamp'|'increment'|'documentId')`.

**Em produção funciona** (sem sandbox). É bug de **paridade emulador↔prod**, prod-safe. O fix é a API modular:

```ts
import {FieldValue, FieldPath} from "firebase-admin/firestore";
FieldValue.serverTimestamp();
FieldValue.increment(1);
FieldPath.documentId();
```

⚠️ **NÃO** trocar `admin.firestore.Timestamp` nem tipos `admin.firestore.DocumentData/QueryDocumentSnapshot/...` — esses **não** têm o problema (Timestamp funciona; tipos são compile-time). Focar **só** em `FieldValue` e `FieldPath`.

---

## 3. Ambiente / comandos (validados nesta máquina)

```bash
# JDK 21 é OBRIGATÓRIO (firebase-tools >=15 recusa JDK<21). JDK do shell costuma ser 17.
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export PATH="$JAVA_HOME/bin:$PATH"
java -version   # deve dizer 21.x

# Functions — build + testes de integração no emulador
cd functions
npm ci
npm run build                              # gera lib/ (o emulador de functions carrega os triggers daí)
npm run test:integration                   # = build + emulators:exec --only firestore,functions 'jest -c jest.integration.config.js test/integration'

# rodar manualmente (equivalente)
firebase emulators:exec --only firestore,functions --project futebadosparcas \
  'npx jest -c jest.integration.config.js test/integration --no-coverage'

# Unit tests (não-emulador) continuam normais
npx jest --no-coverage
```

Emulador Firestore default: `127.0.0.1:8085`. `emulators:exec` exporta `FIRESTORE_EMULATOR_HOST` automaticamente.

---

## 4. #2547 — Sweep `admin.firestore.FieldValue/FieldPath` → import modular

**Por quê:** desbloqueia o harness — ao semear usuários (`onUserCreated`→PII sync) ou deletar grupos (`onGroupDeleted`) no emulador, esses triggers crasham hoje. Mesma classe do bug já corrigido no #2531.

**Escopo:** `git grep -nE "admin\.firestore\.(FieldValue|FieldPath)" functions/src` → **144 ocorrências em 42 arquivos**. Trocar todas para a API modular (seção 2).

**Confirmados quebrados (alta prioridade):**
- `functions/src/index.ts` (~L1888) — `onGroupDeleted`: `admin.firestore.FieldPath.documentId()`.
- `functions/src/auth/pii-migration.ts` (~L121) — `onUserCreated` PII sync: `admin.firestore.FieldValue.serverTimestamp()`.

**Como fazer (por arquivo):**
1. Adicionar/expandir `import {FieldValue, FieldPath} from "firebase-admin/firestore";` (manter `import * as admin from "firebase-admin"` se ainda usado p/ Timestamp/tipos).
2. Trocar `admin.firestore.FieldValue` → `FieldValue` e `admin.firestore.FieldPath` → `FieldPath`.
3. Não tocar `admin.firestore.Timestamp` nem tipos.

**DoD:**
- [ ] `git grep -E "admin\.firestore\.(FieldValue|FieldPath)" functions/src` → **0**.
- [ ] `cd functions && npm run build` verde · `npm run lint` verde.
- [ ] `npm run test:integration` verde **sem** logs `TypeError ... reading 'serverTimestamp'|'increment'|'documentId'`.
- [ ] `npx jest --no-coverage` (unit) continua verde.

---

## 5. #2532 — Web E2E (Playwright + emulador): REWORK não-tautológico

**Depende de #2547.** A WIP atual (`web/e2e/grupos.spec.ts` + `scripts/seed-e2e-groups.ts`) é **fraca/tautológica** — corrigir:

| Jornada | Problema na WIP | O que o teste DEVE fazer |
|---|---|---|
| **Invite-join** (#2518) | Só checa que um membro **já semeado** vê o grupo | Redimir `invites/{code}` (`update used:true, used_by, used_at`) e **aguardar o member doc** criado pelo trigger `onInviteRedeemed` (exige functions emulator). Sem o trigger → membership NÃO aparece. |
| **Preview público** (#2519) | Só checa heading visível | Asseverar **ausência** do ErrorScreen "sem permissão" + presença do botão "Solicitar entrada"/"Entrar" para não-membro. |
| **Discover** (#2523) | Seed não tem grupo público soft-deleted | Seed DEVE ter um grupo público **soft-deleted/SUSPENDED** + um público ACTIVE. Asserção: lista carrega sem `permission-denied` e mostra o ACTIVE. |

Evitar asserções de `member_count` via `body` textContent ("contains 2") — usar seletor/role específico.

**Arquivos:**
- `scripts/seed-e2e-groups.ts` (Admin SDK no emulador; chamado no `web/e2e/globalSetup.ts` após `seedE2EUsers`): criar (a) público ACTIVE c/ membros, (b) público soft-deleted/SUSPENDED, (c) privado + `invites/{code}` válido (não usado, `expires_at` futuro).
- `web/e2e/grupos.spec.ts`: as 3 jornadas com `VITE_USE_EMULATOR=true`. Reusar `web/e2e/fixtures/auth.ts` + `connectFirestoreEmulator/connectAuthEmulator` de `web/src/services/firebase.ts`.

**Rodar:** emulador firestore+auth+functions + `vite preview` (`VITE_USE_EMULATOR=true`) + `npx playwright test grupos.spec.ts`.

**DoD (não-tautológico):**
- [ ] 3 jornadas verdes com emulador.
- [ ] **Reverter #2519** → jornada Preview falha. **Reverter #2523** → jornada Discover falha. Sem `onInviteRedeemed` → invite-join não reflete membership.
- [ ] Sem credencial de prod.

---

## 6. #2533 — CI emulador (metade web restante)

- [x] **Functions** — PR #2546 (`functions-integration-ci.yml`).
- [ ] **Web E2E** — novo job/workflow (preferir `web-e2e-ci.yml` dedicado p/ isolar flakiness): sobe firestore+auth+functions, builda+serve web (`vite preview`, `VITE_USE_EMULATOR=true`), semeia (`seed-e2e-users.ts` + `seed-e2e-groups.ts`), roda `playwright test grupos.spec.ts`. Trigger em `web/**`, `functions/**`, `firestore.rules`. **Depende de #2532 validado** e #2547.
- ⚠️ **NÃO** usar `continue-on-error` (mascara falha — hardening do projeto). Atenção RAM no runner (functions emulator + vite + chromium).
- Padrão de runner: `runs-on: ${{ fromJSON(vars.RUNNER_LABELS || '["self-hosted","macOS","ARM64"]') }}`, `setup-java@v4` temurin 21, `npm install -g firebase-tools`. Espelhar `.github/workflows/firestore-rules-ci.yml` e `functions-integration-ci.yml`.

---

## 7. #2548 — Idempotência de XP por-jogador (follow-up #2524, independente)

O #2524 corrigiu a perda permanente de XP (marca `xp_processed` só após todos os batches). **Limitação:** no retry, jogadores cujos batches já tiveram sucesso têm XP **re-incrementado** (double-count parcial).

**Fazer:** dedup por `(gameId, userId)` — ex. doc determinístico `xp_logs/${gameId}_${userId}` (ou campo `processed_game_ids`), gravado na transação/batch do jogador; no retry, pular quem já tem marcador.

**DoD:** teste de falha parcial (1º run processa A, falha B; retry processa só B; XP de A não dobra); `xp_processed=true` só após todos marcados; fluxo feliz sem regressão.

---

## 8. Gotchas operacionais (do projeto)

- **NUNCA push direto a master.** Sempre branch + PR + admin merge (`gh pr merge --squash --admin`). Branch protection exige 1 review + code owner; `--admin` faz bypass.
- **Auto-close de issue só com keyword EN** no corpo do PR: `Closes #N` / `Fixes #N` (PT "Fecha #N" NÃO fecha).
- **Conventional Commits** (commitlint). Scope ∈ {functions, web, android, ios, shared, firebase, ci}. Subject minúsculo.
- **Worktrees frescos** podem não ter hooks da raiz → commit/push com `--no-verify` (após validar build/teste manualmente).
- **Collection canônica de convites = `invites/`** (não `group_invites/`). O trigger `onInviteRedeemed` escuta `invites/{code}`.
- **`member_count` é server-authoritative**: criado por `onMemberWritten` (member-counter.ts) no CREATE_ACTIVE (+1) / DELETE/REMOVED (-1). `onInviteRedeemed` NÃO incrementa nem seta `_counted_by_join_request` (senão double-count/zero-count).
- **Deploy de functions** (se mexer em src e quiser em prod): worktree limpo de `origin/master` + `firebase deploy --only functions`. O sweep #2547 é prod-safe mas vale deployar p/ paridade. Rules/hosting: ver skills `/futeba-deploy`, `/futeba-firestore-rules`.
- **CI self-hosted**: 2 runners macOS (Mac, Mac2). Emulador exige JDK21. Jobs podem ficar QUEUED se runners busy.

## 9. Referências rápidas (paths)

| O quê | Onde |
|---|---|
| Harness #2531 (modelo a seguir) | `functions/test/integration/invite-redeemed.integration.test.ts` |
| Jest integration config | `functions/jest.integration.config.js` (testMatch `**/test/integration/**/*.test.ts`) |
| CI functions (modelo) | `.github/workflows/functions-integration-ci.yml`, `firestore-rules-ci.yml` |
| Trigger invite | `functions/src/groups/invite-redeemed.ts` |
| Member counter | `functions/src/groups/member-counter.ts` |
| onGroupDeleted (FieldPath bug) | `functions/src/index.ts` (~L1888) |
| PII sync (FieldValue bug) | `functions/src/auth/pii-migration.ts` (~L121) |
| Web E2E | `web/e2e/grupos.spec.ts`, `web/e2e/globalSetup.ts`, `web/e2e/fixtures/auth.ts` |
| Seed E2E | `scripts/seed-e2e-users.ts`, `scripts/seed-e2e-groups.ts` |
| Firebase web service | `web/src/services/firebase.ts` |
