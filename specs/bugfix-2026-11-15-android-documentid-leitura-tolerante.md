# BUGFIX: App Android fecha ao ler documento com campo `id` gravado (`@DocumentId`), correção sistêmica

> **Status:** `APPROVED` → `FIXED`
> **Severidade:** `CRITICAL`
> **Autor:** Claude Code (pedido do Renan em 15/11/2026)
> **Data:** 2026-11-15
> **PR:** a definir

Continuação de `specs/bugfix-2026-11-15-android-crash-meus-grupos-documentid.md` (#4566), que tratou só o
espelho `users/{uid}/groups`.

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

O app fecha ao abrir uma tela que observa os membros de um grupo. Relato pelo "Enviar feedback" do Android:

```
java.lang.RuntimeException: 'id' was found from document groups/<groupId>/members/<uid>,
  cannot apply @DocumentId on this property for class com.futebadosparcas.data.model.GroupMember
    ... QuerySnapshot.toObjects ← addSnapshotListener
```

### 1.2 Comportamento Esperado (Correto)

Nenhuma leitura do Firestore fecha o app por causa do formato de um documento. Documento com o campo `id`
gravado é lido normalmente, com o ID vindo do ID do documento.

### 1.3 Passos para Reproduzir

1. Entrar num grupo em que algum membro tenha o campo `id` gravado em `groups/{groupId}/members/{uid}`.
2. Abrir a tela do grupo (lista de membros).
3. O app fecha.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Versão do app | 1.43.2 (86) ou 1.43.3 (88); o código é o mesmo na `master` |
| Frequência | Sempre, para grupos com um membro nesse formato |
| Impacto em usuários | 8 de 105 documentos de `groups/*/members` têm o campo `id` |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

O mapper do Firestore para Android lança `RuntimeException` quando o modelo tem `@DocumentId` numa
propriedade e o documento traz um campo gravado com o mesmo nome. O app tem 40 modelos com `@DocumentId` em
`id` e 130 leituras por `toObject`/`toObjects`, 17 delas dentro de `addSnapshotListener` de documento único e
várias em listeners de lista.

Medição em produção em 15/11/2026, só leitura. "Total" e "com `id`" contam documentos da coleção ou do grupo
de coleções (subcoleção). "Lido por reflexão" diz se o app Android lê a coleção com `toObject(s)` desse modelo.

| Modelo (`data.model`) | Coleção | Total | Com `id` | Lido por reflexão no Android |
|---|---|---|---|---|
| **GroupMember** | `groups/{id}/members` | 105 | **8** | Sim (4 pontos, 1 listener). **Era o fechamento relatado** |
| **UserGroup** | `users/{uid}/groups` | 13 | **1** | Sim, corrigido no #4566 |
| AppNotification | `notifications` | 26.894 | 26.889 | Não (leitura pelo módulo KMP) |
| GameEvent | `game_events` | 53 | 53 | Não: `LiveGameRepository` lê com o modelo de domínio, sem `@DocumentId` |
| GameEvent | `games/{id}/events` | 0 | 0 | Sim (1 ponto, com `try/catch`) |
| LivePlayerStats | `live_player_stats` | 7 | 7 | Não: lido com o modelo de domínio |
| LiveGameScore, LiveScore | `live_scores` | 1 | 0 | Não: lido com o modelo de domínio |
| Group | `groups` | 5 | 0 | Sim (1 ponto) |
| GroupWallPost | `groups/{id}/wall_posts` | 11 | 0 | Sim (1 ponto) |
| GroupInvite | `group_invites` | 4 | 0 | Não: modelo de domínio |
| CashboxEntry | `groups/{id}/cashbox` | 906 | 0 | Não |
| GameChatMessage | `games/{id}/chat` | 0 | 0 | Sim (listener) |
| GameComment | `games/{id}/comments` | 0 | 0 | Sim (listener) |
| GameSummon | `game_summons` | 5 | 0 | Não |
| UpcomingGame | `users/{uid}/upcoming_games` | 0 | 0 | Não |
| GameTemplate | `users/{uid}/game_templates` | 0 | 0 | Não: modelo de domínio |
| GameJoinRequest | `join_requests` | 0 | 0 | Não |
| MVPVote | `mvp_votes` | 0 | 0 | Não |
| Season | `seasons` | 4 | 0 | Sim (1 ponto) |
| SeasonFinalStanding | `season_final_standings` | 1.975 | 0 | Não |
| SeasonParticipation, SeasonParticipationV2 | `season_participation` | 0 | 0 | Não: modelo de domínio |
| Badge | `badges` (`users/{uid}/badges`) | 1 | 0 | Não |
| UserBadge | `user_badges` | 17 | 0 | Sim (listener) |
| UserStreak | `user_streaks` | 7 | 0 | Não |
| UserStatistics | `statistics` | 7 | 0 | Não: modelo de domínio |
| XpLog | `xp_logs` | 11 | 0 | Não: modelo de domínio |
| RankingDelta | `ranking_deltas` | 14 | 0 | Não |
| RankingDocument | `rankings` | 0 | 0 | Não |
| Location | `locations` | 240 | 0 | Não: modelo de domínio |
| Field | `locations/{id}/fields` | 246 | 0 | Não |
| Schedule | `schedules` | 0 | 0 | Sim (2 pontos, 1 listener) |
| SavedTeamFormation | `saved_formations` | 0 | 0 | Sim (2 pontos) |
| WeeklyChallenge, UserChallengeProgress, PlayerCard, HeadToHead, TacticalBoard, SocialCard, VoteCategoryConfig | sem coleção com documentos em produção | 0 | 0 | Não |

Outras coleções com o campo `id` gravado, lidas no Android por modelos sem `@DocumentId`: `users` (23 de 28)
e `confirmations` (12 de 19).

Limites da medição: os nomes de subcoleção vieram das `firestore.rules` e do código Android; uma subcoleção
que não apareça em nenhum dos dois não foi medida. Em `notifications` a contagem "com `id`" considera só
valor do tipo texto.

### 2.2 Causa Raiz

Leitura por reflexão espalhada em 130 pontos, sem tolerância ao campo gravado com o nome do `@DocumentId`, e
conversão dentro de listeners sem tratamento de erro. O #4566 corrigiu um ponto; a classe de bug continuou.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `app/src/main/java/com/futebadosparcas/data/util/FirestoreSafeMapping.kt` | Helper genérico de leitura tolerante |
| 34 arquivos em `app/src/main/java` | Todas as leituras por `toObject`/`toObjects` passam pelo helper |
| `app/src/test/java/com/futebadosparcas/data/util/FirestoreSafeMappingTest.kt` | Regressão com o mapper real do Firestore |

---

## 3. Solução Proposta

### 3.1 Abordagem

Regra nova: no app Android, leitura por reflexão usa as funções de `FirestoreSafeMapping.kt`.

| Função | Onde | Comportamento |
|--------|------|---------------|
| `toObjectTolerant` | Fora de listener (79 pontos) | Igual ao `toObject`. No conflito de `@DocumentId`, refaz a conversão sem o campo gravado. Outras exceções seguem como antes |
| `toObjectOrNullSafely` | Dentro de `addSnapshotListener` (17 pontos) | Nunca lança: falha vira `null` e não fatal no Crashlytics |
| `toObjectsTolerant` | Listas (34 pontos) | Tenta o `toObjects`; se falhar, converte documento a documento e deixa de fora só o ilegível |

- O fallback usa `CustomClassMapper.convertToCustomClass`, a mesma função que o `toObject` chama por baixo,
  com o mapa de campos sem o campo em conflito. É API interna do SDK (pacote `util`); o teste usa o mapper
  real, então uma mudança de assinatura quebra o build e o teste.
- O conflito é registrado no Crashlytics uma vez por modelo e coleção, sem o caminho do documento.
- Fora de listener, exceção que não seja o conflito continua sendo relançada. Devolver `null` ali faria
  transações tratarem um documento ilegível como inexistente e sobrescreverem dados.
- O `@DocumentId` continua nos modelos: ele mantém o `id` fora das gravações.

### 3.2 Código Antes/Depois

```kotlin
// ANTES: fecha o app se um membro tiver o campo `id` gravado
val members = snapshot?.toObjects(GroupMember::class.java) ?: emptyList()

// DEPOIS
val members = snapshot?.toObjectsTolerant(GroupMember::class.java) ?: emptyList()
```

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Troca mecânica em 130 pontos mudar comportamento | No caminho sem erro as funções chamam o mesmo `toObject`/`toObjects`. Suíte completa do app passou |
| API interna do SDK mudar | Erro de compilação no helper e falha no teste, antes de chegar ao usuário |
| `toObjectOrNullSafely` esconder documento ilegível | Fica registrado como não fatal; antes o app fechava |
| Leitura nova voltar a usar `toObject` direto | Regra registrada em `specs/DECISIONS.md`; ver 5.2 |

---

## 4. Verificação

### 4.1 Testes Adicionados

- [x] `FirestoreSafeMappingTest` (14 casos): `GroupMember` e `UserGroup` com o campo `id`, passando pelo mapper real do Firestore; lista com documento em conflito e com documento ilegível; exceção diferente relançada; `toObjectOrNullSafely`; registro único do conflito; conflito em mais de um campo.
- [x] `UserGroupFirestoreMappingTest` (#4566) continua passando.

### 4.2 Testes de Regressão

- [x] `./gradlew :app:testDebugUnitTest`: 1420 testes, 0 falhas.
- [x] `./gradlew detekt`: mesmos 30 avisos da `master`, nenhum nos arquivos novos.

### 4.3 Checklist

- [x] Build passa (`:app:compileDebugKotlin`)
- [x] Testes passam
- [ ] Conferido no aparelho com a conta afetada (não feito)

---

## 5. Prevenção Futura

### 5.1 Por que não foi pego antes?

O levantamento do #4566 mediu só coleções de topo. Os documentos de `groups/*/members` com o campo `id` são
de subcoleção e ficaram de fora.

### 5.2 Ações para evitar bugs similares

- [x] Helper único para leitura por reflexão, aplicado em todos os pontos do app.
- [x] Teste que usa o mapper real sobre os modelos reais.
- [ ] Regra de lint (detekt ou Semgrep) que barre `.toObject(`/`.toObjects(` fora de `FirestoreSafeMapping.kt`. Fica como tarefa seguinte.
- [ ] Remover o campo `id` dos documentos legados (`groups/*/members`: 8; `users/*/groups`: 1). Corrige as versões já instaladas. Depende de autorização do Renan; nenhum dado de produção foi alterado.
- [ ] Descobrir e corrigir o escritor que grava `id` em `groups/*/members`.

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-11-15 | Renan | Novo fechamento relatado pelo "Enviar feedback" |
| 2026-11-15 | Claude Code | Medição em produção, helper genérico, troca nos 130 pontos e testes |
