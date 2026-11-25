# BUGFIX: @ServerTimestamp sem efeito em modelos com @get:PropertyName

> **Status:** `IN_PROGRESS`
> **Severidade:** `MEDIUM`
> **Autor:** opencode
> **Data:** 2026-11-25
> **PR:** (a abrir)
> **Issue:** #4592

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)
36 campos `@ServerTimestamp` sem alvo em 34 deles com `@get:PropertyName("snake_case")`. Nessa combinação a anotação é ignorada pelo mapper do Firestore: gravar o modelo com a data nula grava `null` (não a hora do servidor). Já corrigido só para `group_invites` no PR #4589 (gravação campo a campo).

### 1.2 Comportamento Esperado (Correto)
- Campos de auditoria (`created_at`/`updated_at`): `@get:ServerTimestamp` — gravação de modelo inteiro preenche a hora do servidor.
- Campos de evento/derivados (`voted_at`, `joined_at`, `confirmed_at`, `requested_at`, `summoned_at`, `started_at`, `last_calculated_at`, `last_used_at`): **sem** `@ServerTimestamp` — a hora é escrita explicitamente com `FieldValue.serverTimestamp()` no ponto de criação (`AndroidEscritoresFirestore`, `GroupRepository`, etc.). Com a anotação valendo, qualquer `set(modelo)` posterior sobrescreveria a data do evento (mesmo erro que `voided_at` já evita).
- `Cashbox.voidedAt` e `AppNotification`: já sem anotação — sem alteração.

### 1.3 Passos para Reproduzir
1. `scripts/bateria/rodar.sh subir`.
2. Gravar modelo anotado com data nula (ex.: `GameComment(createdAt = null)` via `set(modelo)`).
3. Ler o documento: `created_at` = `null` (esperado: hora do servidor) — só nos escritores que ainda serializam o modelo inteiro.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Issue | #4592 |
| Impacto hoje | Baixo-médio: escritores principais (`GameRepositoryImpl`, `GameChatRepository`, `GameCommentsRepository`, `GroupRepository`, `AndroidEscritoresFirestore`) já gravam mapa com `FieldValue.serverTimestamp()` explícito; os modelos anotados são lidos via `toObject` (só `PropertyName` importa). O fix fecha o buraco para os escritores que ainda fazem `set(modelo)` (`LiveGame`, `Schedule`, `GroupWall`) e evita regressão futura. |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação
- `grep -rn ServerTimestamp app/.../data/model` = 54 ocorrências (inclui imports/comentários); 34 campos reais listados na issue.
- Escritores principais conferidos: `GameRepositoryImpl.gameToClientWriteMap` (linhas 127-129: `serverTimestamp()` explícito p/ `created_at`/`updated_at`), `GameChatRepository`/`GameCommentsRepository` (mapa + `serverTimestamp()`), `AndroidEscritoresFirestore` (`created_at`/`updated_at`/`joined_at` via `serverTimestamp()`), `GroupRepository:964` (`joined_at`).
- Queda: `FirebaseDataSourceImpl:232` (`set(gameWithId)`), `LiveGameRepository` (`set(score/event)`), `ScheduleRepositoryImpl` (`add/set(model)`), `GroupWallRepository:269` (`set(post)`).

### 2.2 Causa Raiz
Sem alvo, o Kotlin põe `@ServerTimestamp` no campo Java `createdAt`; o mapper só considera a anotação quando o nome do campo bate com o da propriedade (`created_at` via getter). A forma que o mapper enxerga é `@get:ServerTimestamp`.

### 2.3 Arquivos Afetados (20 modelos + 1 use case)

| Arquivo | Campos auditoria → `@get:ServerTimestamp` | Campos evento → remover anotação |
|---------|------------------------------------------|----------------------------------|
| `GameExperience.kt` | `created_at` x3 | `voted_at` |
| `Group.kt` | `created_at` | `joined_at` x2 |
| `GroupInvite.kt` | `created_at`, `updated_at` | — |
| `LocationReview.kt` (`val`) | `created_at` | — |
| `GameChatMessage.kt` | `created_at` (alt-order) | — |
| `Ranking.kt` | `created_at`, `updated_at` x2 | `last_calculated_at` |
| `Statistics.kt` | — | `last_calculated_at` |
| `Schedule.kt` | `created_at` | — |
| `GameComment.kt` | `created_at` (alt-order) | — |
| `LiveGame.kt` | `created_at` | `started_at` (alt-order) |
| `GameSummon.kt` | — | `summoned_at` |
| `Location.kt` | `created_at`, `updated_at` | — |
| `Game.kt` | `created_at`, `updated_at` | `confirmed_at` |
| `Gamification.kt` | `created_at` | — |
| `GroupWallPost.kt` | `created_at` | — |
| `VoteCategoryConfig.kt` | `created_at` | — |
| `TeamFormation.kt` | `created_at` | `last_used_at` |
| `Cashbox.kt` | `created_at` | `voided_at` já sem anotação (verificado) |
| `GameRequest.kt` | — | `requested_at` |
| `UpdateNotificationSettingsUseCase.kt` | `createdAt` (sem rename; `@get:` por consistência) | — |

---

## 3. Solução Proposta

### 3.1 Abordagem
Transformação mecânica campo a campo:
1. Auditoria: `@ServerTimestamp` → `@get:ServerTimestamp` (mantém `@get/@set:PropertyName`).
2. Evento: remove a linha `@ServerTimestamp` e adiciona comentário `// Sem @ServerTimestamp: ...` no padrão do `voided_at`.

### 3.2 Código Antes/Depois
```kotlin
// ANTES (bugado)
@ServerTimestamp
@get:PropertyName("created_at")
@set:PropertyName("created_at")
var createdAt: Date? = null,

// DEPOIS (auditoria)
@get:ServerTimestamp
@get:PropertyName("created_at")
@set:PropertyName("created_at")
var createdAt: Date? = null,

// DEPOIS (evento)
@get:PropertyName("joined_at")
@set:PropertyName("joined_at")
var joinedAt: Date? = null,
```

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| `created_at` sobrescrito em `set(modelo)` de update | Fora do escopo: escritores principais já usam mapa + `merge()`/update; anotação só restaura o comportamento pretendido. |
| Regex no transform | Diff conferido arquivo a arquivo antes do commit. |
| `val` (LocationReview) | `@get:ServerTimestamp` no getter continua válido; `PropertyName` bare preservado. |

---

## 4. Verificação

### 4.1 Testes Adicionados
- Emulador da bateria: gravar um modelo anotado com data nula via `set(modelo)` e conferir `created_at` (pendente — sem emulador neste ambiente; CI + review de código).

### 4.2 Checklist
- [x] `./gradlew :app:compileDebugKotlin` (ver PR)
- [ ] Sem novos warnings no lint (CI)
- [ ] Teste em emulador (pendente de reviewer)

---

## Histórico

| Data | Alteração |
|------|-----------|
| 2026-11-25 | Spec criada; auditoria de escritores feita |
